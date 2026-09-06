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
    dryRun: true,
    yes: true,
    help: false,
  });
  assert.equal(parseArguments(["--all"]).targetIds.length, 5);
});

test("rejects conflicting and invalid options", () => {
  assert.throws(() => parseArguments(["--all", "--targets", "codex"]), /cannot be used together/);
  assert.throws(() => parseArguments(["--scope", "team"]), /user or project/);
  assert.throws(
    () => parseArguments(["--scope", "user", "--project-root", "/tmp/project"]),
    /cannot be used with user scope/,
  );
  assert.throws(() => parseArguments(["--no-color"]), /Unknown option/);
});

test("validates versions and source payload", async () => {
  const source = await validateSource(sourceRoot);
  assert.equal(source.version, "0.1.58");
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
    assert.equal((await readFile(path.join(codex, "VERSION"), "utf8")).trim(), "0.1.58");
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
    await writeFile(path.join(destination, "SKILL.md"), "changed\n");
    const updated = (await installSelected(options))[0];
    assert.equal(updated.status, "updated");
    assert.equal(updated.backup, `${destination}.backup-20260906T101112Z`);
    assert.equal(await readFile(path.join(updated.backup, "SKILL.md"), "utf8"), "changed\n");
  });
});

test("refuses replacement without authorization", async () => {
  await withTempDirectory(async (homeDir) => {
    const destination = path.join(homeDir, ".cursor", "skills", "quorum");
    await mkdir(destination, { recursive: true });
    await writeFile(path.join(destination, "SKILL.md"), "local\n");
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
    assert.equal(await readFile(path.join(destination, "SKILL.md"), "utf8"), "local\n");
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
