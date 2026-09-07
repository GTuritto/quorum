import assert from "node:assert/strict";
import { lstat, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { inspectQuorumPath, parseQuorumSkillName } from "../installer/identity.mjs";

async function withTempDirectory(callback) {
  const root = await mkdtemp(path.join(os.tmpdir(), "quorum-identity-"));
  try {
    return await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("reads only a scalar name from the first YAML frontmatter block", () => {
  assert.equal(parseQuorumSkillName("---\nname: quorum\n---\n# Quorum\n"), "quorum");
  assert.equal(parseQuorumSkillName("---\nname: \"quorum\"\n---\n"), "quorum");
  assert.equal(parseQuorumSkillName("---\nname: 'quorum' # comment\n---\n"), "quorum");
  assert.equal(parseQuorumSkillName("---\nname: other\n---\nquorum\n"), "other");
  assert.equal(parseQuorumSkillName("quorum\n"), null);
  assert.equal(parseQuorumSkillName("---\nmetadata:\n  name: quorum\n---\n"), null);
});

test("classifies missing, recognized, and foreign directories", async () => {
  await withTempDirectory(async (root) => {
    const recognized = path.join(root, "recognized", "quorum");
    const foreign = path.join(root, "foreign", "quorum");
    await mkdir(recognized, { recursive: true });
    await mkdir(foreign, { recursive: true });
    await writeFile(path.join(recognized, "SKILL.md"), "---\nname: quorum\n---\n");
    await writeFile(path.join(foreign, "SKILL.md"), "---\nname: other\n---\n");

    assert.deepEqual(await inspectQuorumPath(recognized), {
      kind: "directory",
      recognized: true,
      reason: "quorum skill",
    });
    assert.equal((await inspectQuorumPath(foreign)).recognized, false);
    assert.equal((await inspectQuorumPath(path.join(root, "missing", "quorum"))).kind, "missing");
  });
});

test("requires the final component quorum and inspects symlink targets read-only", async () => {
  await withTempDirectory(async (root) => {
    const target = path.join(root, "target", "quorum");
    const link = path.join(root, "links", "quorum");
    await mkdir(target, { recursive: true });
    await mkdir(path.dirname(link), { recursive: true });
    await writeFile(path.join(target, "SKILL.md"), "---\nname: quorum\n---\n");
    await symlink(target, link);

    const inspected = await inspectQuorumPath(link);
    assert.equal(inspected.kind, "symlink");
    assert.equal(inspected.recognized, true);
    assert.equal(inspected.resolvedPath, await realpath(target));
    assert.equal((await lstat(link)).isSymbolicLink(), true);
    assert.equal((await inspectQuorumPath(path.join(root, "target"))).recognized, false);
  });
});
