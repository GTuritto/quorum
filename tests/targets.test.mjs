import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  allTargetIds,
  getTarget,
  groupCustomDestination,
  groupDestinations,
  parseTargetList,
  resolveDestination,
} from "../installer/targets.mjs";

test("declares conservative target-specific detection signals", () => {
  assert.deepEqual(getTarget("codex").commands, ["codex"]);
  assert.deepEqual(getTarget("claude").commands, ["claude"]);
  assert.deepEqual(getTarget("antigravity").commands, ["agy-ide", "agy"]);
  assert.deepEqual(getTarget("vscode").commands, ["copilot"]);
  assert.equal(getTarget("vscode").commands.includes("code"), false);
  assert.deepEqual(getTarget("cursor").commands, ["cursor-agent"]);

  assert.deepEqual(getTarget("codex").macApplications, [
    "/Applications/Codex.app",
    "~/Applications/Codex.app",
  ]);
  assert.deepEqual(getTarget("claude").macApplications, [
    "/Applications/Claude.app",
    "~/Applications/Claude.app",
  ]);
  assert.deepEqual(getTarget("antigravity").macApplications, [
    "/Applications/Antigravity IDE.app",
    "~/Applications/Antigravity IDE.app",
  ]);
  assert.deepEqual(getTarget("cursor").macApplications, [
    "/Applications/Cursor.app",
    "~/Applications/Cursor.app",
  ]);
  assert.deepEqual(getTarget("vscode").extensionMarkers, [
    { root: [".vscode", "extensions"], prefix: "github.copilot-chat-" },
    { root: [".vscode-insiders", "extensions"], prefix: "github.copilot-chat-" },
  ]);
});

test("lists targets in installer display order", () => {
  assert.deepEqual(allTargetIds(), [
    "codex",
    "claude",
    "antigravity",
    "vscode",
    "cursor",
  ]);
});

test("parses aliases and removes duplicates", () => {
  assert.deepEqual(parseTargetList("codex, Claude-Code,vs-code,codex"), [
    "codex",
    "claude",
    "vscode",
  ]);
});

test("rejects missing and unknown targets", () => {
  assert.throws(() => parseTargetList(""), /requires at least one target/);
  assert.throws(() => parseTargetList("codex,unknown"), /Unknown target: unknown/);
});

test("resolves user and project destinations", () => {
  const homeDir = path.resolve("/tmp/quorum-home");
  const projectRoot = path.resolve("/tmp/quorum-project");

  assert.equal(
    resolveDestination("claude", { scope: "user", homeDir, projectRoot }),
    path.join(homeDir, ".claude", "skills", "quorum"),
  );
  assert.equal(
    resolveDestination("vscode", { scope: "project", homeDir, projectRoot }),
    path.join(projectRoot, ".github", "skills", "quorum"),
  );
});

test("deduplicates shared project destinations and preserves Codex metadata", () => {
  const groups = groupDestinations(["codex", "antigravity", "cursor"], {
    scope: "project",
    homeDir: "/tmp/home",
    projectRoot: "/tmp/project",
  });

  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].targetIds, ["codex", "antigravity"]);
  assert.deepEqual(groups[0].labels, ["Codex", "Antigravity"]);
  assert.equal(groups[0].includeOpenAI, true);
  assert.deepEqual(groups[1].targetIds, ["cursor"]);
});

test("groups an explicit custom destination with the generic payload", () => {
  assert.deepEqual(groupCustomDestination("/tmp/skills/quorum"), [{
    destination: "/tmp/skills/quorum",
    targetIds: ["custom"],
    labels: ["Custom"],
    includeOpenAI: false,
  }]);
});
