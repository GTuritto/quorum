import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  allTargetIds,
  groupDestinations,
  parseTargetList,
  resolveDestination,
} from "../installer/targets.mjs";

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
