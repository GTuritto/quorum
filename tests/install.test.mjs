import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  assertSupportedNode,
  installSelected,
  main,
  parseArguments,
  payloadFiles,
  resolveRunPlan,
  validateSource,
} from "../installer/install.mjs";

const sourceRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

async function withTempDirectory(callback) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "quorum-test-"));
  try {
    return await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function createSink() {
  let value = "";
  return {
    write(chunk) {
      value += chunk;
    },
    text() {
      return value;
    },
  };
}

test("rejects Node.js versions older than 18", async () => {
  assert.throws(() => assertSupportedNode("17.9.1"), /requires Node\.js 18 or later/);
  assert.doesNotThrow(() => assertSupportedNode("18.0.0"));
  assert.doesNotThrow(() => assertSupportedNode("25.9.0"));

  const output = createSink();
  const errorOutput = createSink();
  const exitCode = await main({
    argv: ["--help"],
    nodeVersion: "17.9.1",
    output,
    errorOutput,
    sourceRoot,
  });

  assert.equal(exitCode, 1);
  assert.equal(output.text(), "");
  assert.match(errorOutput.text(), /requires Node\.js 18 or later/);
});

test("help names both npm and archive entry points", async () => {
  const output = createSink();
  const errorOutput = createSink();
  const exitCode = await main({
    argv: ["--help"],
    nodeVersion: "18.0.0",
    output,
    errorOutput,
    sourceRoot,
  });

  assert.equal(exitCode, 0);
  assert.match(output.text(), /quorum-skill \[options\]/);
  assert.match(output.text(), /\.\/install\.sh \[options\]/);
  assert.equal(errorOutput.text(), "");
});

test("parses preselected targets and project options", () => {
  assert.deepEqual(parseArguments([
    "--targets",
    "codex,cursor",
    "--project-root",
    "/tmp/project",
    "--dry-run",
    "--yes",
  ]), {
    targetIds: ["codex", "cursor"],
    all: false,
    scope: "project",
    projectRoot: "/tmp/project",
    skillsDir: null,
    operation: "install",
    dryRun: true,
    yes: true,
    help: false,
    version: false,
  });
  assert.equal(parseArguments(["--all"]).targetIds.length, 5);
});

test("parses update aliases, uninstall, skills-dir, and version", () => {
  assert.equal(parseArguments(["--update"]).operation, "update");
  assert.equal(parseArguments(["--upgrade"]).operation, "update");
  assert.equal(parseArguments(["--uninstall"]).operation, "uninstall");
  assert.equal(parseArguments(["--skills-dir", "./skills"]).skillsDir, "./skills");
  assert.equal(parseArguments(["--version"]).version, true);
});

test("rejects conflicting and invalid options", () => {
  assert.throws(() => parseArguments(["--all", "--targets", "codex"]), /cannot be used together/);
  assert.throws(() => parseArguments(["--scope", "team"]), /user or project/);
  assert.throws(
    () => parseArguments(["--scope", "user", "--project-root", "/tmp/project"]),
    /cannot be used with user scope/,
  );
  assert.throws(() => parseArguments(["--no-color"]), /Unknown option/);
  assert.throws(() => parseArguments(["--update", "--upgrade"]), /cannot be used together/);
  assert.throws(() => parseArguments(["--update", "--uninstall"]), /cannot be used together/);
  assert.throws(() => parseArguments(["--skills-dir", "./skills", "--targets", "codex"]), /cannot be used with/);
  assert.throws(() => parseArguments(["--skills-dir", "./skills", "--scope", "user"]), /cannot be used with/);
  assert.throws(() => parseArguments(["--version", "--yes"]), /must be used alone/);
  assert.throws(() => parseArguments(["--help", "--dry-run"]), /must be used alone/);
  assert.throws(() => parseArguments(["--project-root="]), /requires a value/);
});

test("version reads only VERSION and exits without a banner or destination access", async () => {
  await withTempDirectory(async (temporaryRoot) => {
    await writeFile(path.join(temporaryRoot, "VERSION"), "9.8.7\n");
    const output = createSink();
    const errorOutput = createSink();
    const exitCode = await main({
      argv: ["--version"],
      output,
      errorOutput,
      sourceRoot: temporaryRoot,
    });
    assert.equal(exitCode, 0);
    assert.equal(output.text(), "quorum-skill 9.8.7\n");
    assert.equal(errorOutput.text(), "");
  });
});

test("no-target update chooses managed installations only", async () => {
  const plan = await resolveRunPlan(parseArguments(["--update"]), {
    scope: "user",
    homeDir: "/home/giuseppe",
    projectRoot: null,
    discover: async () => ({
      managed: [{
        destination: "/home/giuseppe/.agents/skills/quorum",
        targetIds: ["codex"],
        labels: ["Codex"],
        includeOpenAI: true,
      }],
      legacy: [],
      foreign: [],
    }),
    detect: async () => { throw new Error("tool detection must not run"); },
  });
  assert.equal(plan.operation, "update");
  assert.deepEqual(plan.targetIds, ["codex"]);
});

test("no-target update installs for detected tools when no managed installation exists", async () => {
  const plan = await resolveRunPlan(parseArguments(["--update"]), {
    scope: "user",
    homeDir: "/home/giuseppe",
    projectRoot: null,
    discover: async () => ({ managed: [], legacy: [], foreign: [] }),
    detect: async () => [
      { targetId: "claude", evidence: "command: claude" },
      { targetId: "cursor", evidence: "command: cursor-agent" },
    ],
  });
  assert.equal(plan.operation, "install");
  assert.deepEqual(plan.targetIds, ["claude", "cursor"]);
  assert.equal(plan.automatic, true);
});

test("explicit missing update target remains an update destination", async () => {
  const plan = await resolveRunPlan(parseArguments(["--update", "--targets", "codex"]), {
    scope: "user",
    homeDir: "/home/giuseppe",
    projectRoot: null,
    discover: async () => { throw new Error("discovery must not run"); },
  });
  assert.equal(plan.operation, "update");
  assert.deepEqual(plan.targetIds, ["codex"]);
  assert.equal(plan.allowMissingInstall, false);
});

test("normal no-target routing preserves the selector only with a managed install", async () => {
  let selectorCalls = 0;
  const plan = await resolveRunPlan(parseArguments([]), {
    scope: "user",
    homeDir: "/home/giuseppe",
    projectRoot: null,
    discover: async () => ({
      managed: [{ targetIds: ["codex"] }],
      legacy: [],
      foreign: [],
    }),
    selectTargets: async () => {
      selectorCalls += 1;
      return ["cursor"];
    },
  });
  assert.equal(selectorCalls, 1);
  assert.deepEqual(plan.targetIds, ["cursor"]);
});

test("legacy evidence and detected tools install without the selector", async () => {
  const plan = await resolveRunPlan(parseArguments([]), {
    scope: "user",
    homeDir: "/home/giuseppe",
    projectRoot: null,
    discover: async () => ({
      managed: [],
      legacy: [{ destination: "/home/giuseppe/.codex/skills/quorum", targetIds: ["codex"] }],
      foreign: [],
    }),
    detect: async () => [{ targetId: "claude", evidence: "command: claude" }],
    selectTargets: async () => { throw new Error("selector must not run"); },
  });
  assert.deepEqual(plan.targetIds, ["codex", "claude"]);
  assert.equal(plan.operation, "install");
  assert.equal(plan.legacy.length, 1);
});

test("no detected tool prompts for a custom parent only in an interactive run", async () => {
  const base = {
    scope: "user",
    homeDir: "/home/giuseppe",
    projectRoot: null,
    cwd: "/work",
    discover: async () => ({ managed: [], legacy: [], foreign: [] }),
    detect: async () => [],
  };
  const plan = await resolveRunPlan(parseArguments([]), {
    ...base,
    interactive: true,
    promptForSkillsDir: async () => "./skills",
  });
  assert.equal(plan.groups[0].destination, "/work/skills/quorum");
  assert.deepEqual(plan.targetIds, ["custom"]);

  await assert.rejects(
    resolveRunPlan(parseArguments([]), { ...base, interactive: false }),
    /--skills-dir, --targets, or --all/,
  );
});

test("explicit skills directory takes precedence over discovery", async () => {
  const plan = await resolveRunPlan(parseArguments(["--skills-dir", "~/portable-skills"]), {
    scope: "user",
    homeDir: "/home/giuseppe",
    projectRoot: null,
    cwd: "/work",
    discover: async () => { throw new Error("discovery must not run"); },
  });
  assert.equal(plan.groups[0].destination, "/home/giuseppe/portable-skills/quorum");
  assert.equal(plan.groups[0].includeOpenAI, false);
});

test("install and update output identifies the running source version", async () => {
  await withTempDirectory(async (homeDir) => {
    const output = createSink();
    const errorOutput = createSink();
    const exitCode = await main({
      argv: ["--targets", "cursor", "--dry-run"],
      cwd: homeDir,
      homeDir,
      output,
      errorOutput,
      sourceRoot,
    });
    assert.equal(exitCode, 0);
    assert.match(output.text(), /Source version: 0\.1\.59/);
    assert.match(output.text(), /PLAN\s+install/);
    assert.equal(errorOutput.text(), "");
  });
});

test("no-target uninstall never detects supported tools", async () => {
  const plan = await resolveRunPlan(parseArguments(["--uninstall"]), {
    scope: "user",
    homeDir: "/home/giuseppe",
    projectRoot: null,
    discover: async () => ({ managed: [], legacy: [], foreign: [] }),
    detect: async () => { throw new Error("tool detection must not run"); },
  });
  assert.equal(plan.operation, "uninstall");
  assert.deepEqual(plan.groups, []);
});

test("user-scope Codex uninstall removes current and recognized legacy installations", async () => {
  await withTempDirectory(async (homeDir) => {
    const current = path.join(homeDir, ".agents", "skills", "quorum");
    const legacy = path.join(homeDir, ".codex", "skills", "quorum");
    await mkdir(current, { recursive: true });
    await mkdir(legacy, { recursive: true });
    await writeFile(path.join(current, "SKILL.md"), "---\nname: quorum\n---\n");
    await writeFile(path.join(legacy, "SKILL.md"), "---\nname: quorum\n---\n");
    const output = createSink();
    const errorOutput = createSink();
    const exitCode = await main({
      argv: ["--uninstall", "--targets", "codex", "--yes"],
      cwd: homeDir,
      homeDir,
      env: {},
      output,
      errorOutput,
      sourceRoot,
    });
    assert.equal(exitCode, 0);
    await assert.rejects(readFile(path.join(current, "SKILL.md")), /ENOENT/);
    await assert.rejects(readFile(path.join(legacy, "SKILL.md")), /ENOENT/);
    assert.match(output.text(), /REMOVED/);
    assert.equal(errorOutput.text(), "");
  });
});

test("uninstall requires only the running package VERSION, not its install payload", async () => {
  await withTempDirectory(async (temporaryRoot) => {
    const sourceOnly = path.join(temporaryRoot, "source");
    const skillsParent = path.join(temporaryRoot, "portable-skills");
    const destination = path.join(skillsParent, "quorum");
    await mkdir(sourceOnly);
    await mkdir(destination, { recursive: true });
    await writeFile(path.join(sourceOnly, "VERSION"), "0.1.59\n");
    await writeFile(path.join(destination, "SKILL.md"), "---\nname: quorum\n---\n");
    const output = createSink();
    const errorOutput = createSink();
    const exitCode = await main({
      argv: ["--uninstall", "--skills-dir", skillsParent, "--yes"],
      cwd: temporaryRoot,
      homeDir: temporaryRoot,
      output,
      errorOutput,
      sourceRoot: sourceOnly,
    });
    assert.equal(exitCode, 0);
    await assert.rejects(readFile(path.join(destination, "SKILL.md")), /ENOENT/);
    assert.equal(errorOutput.text(), "");
  });
});

test("does not report foreign legacy Codex content as a Quorum installation", async () => {
  await withTempDirectory(async (homeDir) => {
    const legacy = path.join(homeDir, ".codex", "skills", "quorum");
    await mkdir(legacy, { recursive: true });
    await writeFile(path.join(legacy, "SKILL.md"), "---\nname: other\n---\n");
    const output = createSink();
    const exitCode = await main({
      argv: ["--targets", "codex", "--dry-run"],
      cwd: homeDir,
      homeDir,
      env: {},
      output,
      errorOutput: createSink(),
      sourceRoot,
    });
    assert.equal(exitCode, 0);
    assert.doesNotMatch(output.text(), /Legacy Codex installation detected/);
  });
});

test("install and update leave a recognized legacy Codex copy unchanged", async () => {
  await withTempDirectory(async (homeDir) => {
    const legacy = path.join(homeDir, ".codex", "skills", "quorum");
    await mkdir(legacy, { recursive: true });
    const legacySkill = "---\nname: quorum\n---\nlegacy marker\n";
    await writeFile(path.join(legacy, "SKILL.md"), legacySkill);
    await writeFile(path.join(legacy, "VERSION"), "0.1.40\n");

    for (const argv of [
      ["--targets", "codex", "--yes"],
      ["--update", "--targets", "codex", "--yes"],
    ]) {
      assert.equal(await main({
        argv,
        cwd: homeDir,
        homeDir,
        env: {},
        output: createSink(),
        errorOutput: createSink(),
        sourceRoot,
      }), 0);
    }
    assert.equal(await readFile(path.join(legacy, "SKILL.md"), "utf8"), legacySkill);
    assert.equal((await readFile(path.join(legacy, "VERSION"), "utf8")).trim(), "0.1.40");
  });
});

test("validates versions and source payload", async () => {
  const source = await validateSource(sourceRoot);
  assert.equal(source.version, "0.1.59");
  assert.deepEqual(await payloadFiles(sourceRoot, false), [
    "SKILL.md",
    "VERSION",
    path.join("references", "codex-adapter.md"),
    path.join("references", "protocol.sudo.md"),
  ]);
  assert.equal((await payloadFiles(sourceRoot, true)).includes(path.join("agents", "openai.yaml")), true);
});

test("installs selected targets with target-specific payloads", async () => {
  await withTempDirectory(async (homeDir) => {
    const results = await installSelected({
      sourceRoot,
      targetIds: ["codex", "claude"],
      scope: "user",
      homeDir,
      projectRoot: null,
      yes: true,
    });
    assert.deepEqual(results.map((result) => result.status), ["installed", "installed"]);

    const codex = path.join(homeDir, ".agents", "skills", "quorum");
    const claude = path.join(homeDir, ".claude", "skills", "quorum");
    assert.equal((await readFile(path.join(codex, "VERSION"), "utf8")).trim(), "0.1.59");
    assert.equal((await readFile(path.join(codex, "agents", "openai.yaml"), "utf8")).includes("Quorum"), true);
    await assert.rejects(readFile(path.join(claude, "agents", "openai.yaml")), /ENOENT/);
  });
});

test("dry-run writes nothing and identifies the planned action", async () => {
  await withTempDirectory(async (homeDir) => {
    const results = await installSelected({
      sourceRoot,
      targetIds: ["cursor"],
      scope: "user",
      homeDir,
      projectRoot: null,
      dryRun: true,
    });
    assert.equal(results[0].status, "planned");
    assert.equal(results[0].action, "install");
    await assert.rejects(readFile(path.join(homeDir, ".cursor", "skills", "quorum", "SKILL.md")), /ENOENT/);
  });
});

test("skips identical content and backs up an authorized replacement", async () => {
  await withTempDirectory(async (homeDir) => {
    const options = {
      sourceRoot,
      targetIds: ["cursor"],
      scope: "user",
      homeDir,
      projectRoot: null,
      yes: true,
      now: () => new Date("2026-09-06T10:11:12.000Z"),
    };
    assert.equal((await installSelected(options))[0].status, "installed");
    assert.equal((await installSelected(options))[0].status, "skipped");

    const destination = path.join(homeDir, ".cursor", "skills", "quorum");
    await writeFile(path.join(destination, "SKILL.md"), "---\nname: quorum\n---\n# changed\n");
    const updated = (await installSelected(options))[0];
    assert.equal(updated.status, "updated");
    assert.equal(updated.backup, `${destination}.backup-20260906T101112Z`);
    assert.match(await readFile(path.join(updated.backup, "SKILL.md"), "utf8"), /# changed/);
  });
});

test("refuses replacement without authorization", async () => {
  await withTempDirectory(async (homeDir) => {
    const destination = path.join(homeDir, ".cursor", "skills", "quorum");
    await mkdir(destination, { recursive: true });
    await writeFile(path.join(destination, "SKILL.md"), "---\nname: quorum\n---\nlocal\n");
    await writeFile(path.join(destination, "VERSION"), "0.1.57\n");
    const result = (await installSelected({
      sourceRoot,
      targetIds: ["cursor"],
      scope: "user",
      homeDir,
      projectRoot: null,
      confirmReplacement: async () => false,
    }))[0];
    assert.equal(result.status, "failed");
    assert.match(result.error, /not authorized/);
    assert.match(await readFile(path.join(destination, "SKILL.md"), "utf8"), /name: quorum/);
  });
});

test("refuses foreign content and a newer installation even with yes", async () => {
  await withTempDirectory(async (homeDir) => {
    const destination = path.join(homeDir, ".cursor", "skills", "quorum");
    await mkdir(destination, { recursive: true });
    await writeFile(path.join(destination, "SKILL.md"), "---\nname: other\n---\n");
    let result = (await installSelected({
      sourceRoot,
      targetIds: ["cursor"],
      scope: "user",
      homeDir,
      yes: true,
    }))[0];
    assert.equal(result.status, "refused");
    assert.equal(result.reason, "foreign content");

    await writeFile(path.join(destination, "SKILL.md"), "---\nname: quorum\n---\n");
    await writeFile(path.join(destination, "VERSION"), "0.2.0\n");
    result = (await installSelected({
      sourceRoot,
      targetIds: ["cursor"],
      scope: "user",
      homeDir,
      yes: true,
      operation: "update",
    }))[0];
    assert.equal(result.status, "refused");
    assert.match(result.reason, /newer than source/);
  });
});

test("explicit update skips a missing installation", async () => {
  await withTempDirectory(async (homeDir) => {
    const result = (await installSelected({
      sourceRoot,
      targetIds: ["cursor"],
      scope: "user",
      homeDir,
      operation: "update",
    }))[0];
    assert.equal(result.status, "skipped");
    assert.equal(result.reason, "not installed");
  });
});

test("refuses a destination that changes after confirmation", async () => {
  await withTempDirectory(async (homeDir) => {
    const destination = path.join(homeDir, ".cursor", "skills", "quorum");
    await mkdir(destination, { recursive: true });
    await writeFile(path.join(destination, "SKILL.md"), "---\nname: quorum\n---\nlocal\n");
    await writeFile(path.join(destination, "VERSION"), "0.1.57\n");
    const result = (await installSelected({
      sourceRoot,
      targetIds: ["cursor"],
      scope: "user",
      homeDir,
      operation: "update",
      confirmReplacement: async () => {
        await writeFile(path.join(destination, "VERSION"), "0.1.56\n");
        return true;
      },
    }))[0];
    assert.equal(result.status, "refused");
    assert.equal(result.reason, "destination changed");
    assert.equal((await readFile(path.join(destination, "VERSION"), "utf8")).trim(), "0.1.56");
  });
});

test("refuses changed modified content even when identity and version stay the same", async () => {
  await withTempDirectory(async (homeDir) => {
    const destination = path.join(homeDir, ".cursor", "skills", "quorum");
    await mkdir(destination, { recursive: true });
    await writeFile(path.join(destination, "SKILL.md"), "---\nname: quorum\n---\nfirst edit\n");
    await writeFile(path.join(destination, "VERSION"), "0.1.57\n");
    const result = (await installSelected({
      sourceRoot,
      targetIds: ["cursor"],
      scope: "user",
      homeDir,
      operation: "update",
      confirmReplacement: async () => {
        await writeFile(path.join(destination, "SKILL.md"), "---\nname: quorum\n---\nsecond edit\n");
        return true;
      },
    }))[0];
    assert.equal(result.status, "refused");
    assert.equal(result.reason, "destination changed");
    assert.match(await readFile(path.join(destination, "SKILL.md"), "utf8"), /second edit/);
  });
});

test("continues after an independent destination fails", async () => {
  await withTempDirectory(async (homeDir) => {
    await writeFile(path.join(homeDir, ".claude"), "blocks directory creation\n");
    const results = await installSelected({
      sourceRoot,
      targetIds: ["claude", "cursor"],
      scope: "user",
      homeDir,
      projectRoot: null,
      yes: true,
    });
    assert.deepEqual(results.map((result) => result.status), ["failed", "installed"]);
  });
});
