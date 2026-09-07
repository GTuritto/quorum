import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  detectTools,
  discoverInstallations,
  legacyCodexPath,
  resolveSkillsDestination,
} from "../installer/detection.mjs";

async function withTempDirectory(callback) {
  const root = await mkdtemp(path.join(os.tmpdir(), "quorum-detection-"));
  try {
    return await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("detects commands without executing them and honors Windows PATHEXT", async () => {
  const existing = new Set(["c:\\tools\\codex.cmd"]);
  const results = await detectTools({
    platform: "win32",
    pathApi: path.win32,
    homeDir: "C:\\Users\\giuseppe",
    env: { PATH: "C:\\Tools", PATHEXT: ".EXE;.CMD" },
    pathExists: async (candidate) => existing.has(candidate.toLowerCase()),
    readDirectory: async () => [],
  });
  assert.deepEqual(results, [{ targetId: "codex", evidence: "command: codex" }]);
});

test("does not detect VS Code from the application or code command alone", async () => {
  const existing = new Set([
    "/Applications/Visual Studio Code.app",
    "/usr/local/bin/code",
  ]);
  const results = await detectTools({
    platform: "darwin",
    pathApi: path.posix,
    homeDir: "/Users/giuseppe",
    env: { PATH: "/usr/local/bin" },
    pathExists: async (candidate) => existing.has(candidate),
    readDirectory: async () => [],
  });
  assert.equal(results.some(({ targetId }) => targetId === "vscode"), false);
});

test("detects macOS applications and Copilot extension markers", async () => {
  const existing = new Set(["/Applications/Codex.app"]);
  const results = await detectTools({
    platform: "darwin",
    pathApi: path.posix,
    homeDir: "/Users/giuseppe",
    env: { PATH: "" },
    pathExists: async (candidate) => existing.has(candidate),
    readDirectory: async (directory) => directory === "/Users/giuseppe/.vscode/extensions"
      ? ["github.copilot-chat-0.31.0", "other.extension-1.0.0"]
      : [],
  });
  assert.deepEqual(results, [
    { targetId: "codex", evidence: "application: /Applications/Codex.app" },
    { targetId: "vscode", evidence: "extension: github.copilot-chat" },
  ]);
});

test("ignores inaccessible optional detection markers", async () => {
  const results = await detectTools({
    platform: "linux",
    pathApi: path.posix,
    homeDir: "/home/giuseppe",
    env: { PATH: "" },
    pathExists: async () => false,
    readDirectory: async () => {
      const error = new Error("permission denied");
      error.code = "EACCES";
      throw error;
    },
  });
  assert.deepEqual(results, []);
});

test("resolves parent skills paths and rejects ambiguous or root paths", () => {
  const context = { cwd: "/work", homeDir: "/home/giuseppe", pathApi: path.posix };
  assert.equal(
    resolveSkillsDestination("~/skills", context),
    "/home/giuseppe/skills/quorum",
  );
  assert.equal(
    resolveSkillsDestination("skills", context),
    "/work/skills/quorum",
  );
  assert.throws(() => resolveSkillsDestination("", context), /cannot be empty/);
  assert.throws(() => resolveSkillsDestination("/", context), /filesystem root/);
  assert.throws(() => resolveSkillsDestination("~other/skills", context), /unsupported home expansion/i);
});

test("discovers managed, foreign, and recognized legacy installations separately", async () => {
  await withTempDirectory(async (homeDir) => {
    const managed = path.join(homeDir, ".agents", "skills", "quorum");
    const foreign = path.join(homeDir, ".cursor", "skills", "quorum");
    const legacy = legacyCodexPath({ homeDir, env: {} });
    for (const directory of [managed, foreign, legacy]) {
      await mkdir(directory, { recursive: true });
    }
    await writeFile(path.join(managed, "SKILL.md"), "---\nname: quorum\n---\n");
    await writeFile(path.join(foreign, "SKILL.md"), "---\nname: other\n---\n");
    await writeFile(path.join(legacy, "SKILL.md"), "---\nname: quorum\n---\n");

    const discovered = await discoverInstallations({
      targetIds: ["codex", "cursor"],
      scope: "user",
      homeDir,
      projectRoot: null,
      env: {},
    });
    assert.deepEqual(discovered.managed.map(({ targetIds }) => targetIds), [["codex"]]);
    assert.deepEqual(discovered.foreign.map(({ targetIds }) => targetIds), [["cursor"]]);
    assert.equal(discovered.legacy.length, 1);
    assert.equal(discovered.legacy[0].destination, legacy);
  });
});
