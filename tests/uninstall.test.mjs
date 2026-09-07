import assert from "node:assert/strict";
import {
  access,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { uninstallDestination, uninstallSelected } from "../installer/uninstall.mjs";

async function withTempDirectory(callback) {
  const root = await mkdtemp(path.join(os.tmpdir(), "quorum-uninstall-"));
  try {
    return await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function createQuorum(destination) {
  await mkdir(destination, { recursive: true });
  await writeFile(path.join(destination, "SKILL.md"), "---\nname: quorum\n---\n");
}

function group(destination, label = "Custom") {
  return { destination, targetIds: [label.toLowerCase()], labels: [label], includeOpenAI: false };
}

test("permanently removes only the recognized quorum directory", async () => {
  await withTempDirectory(async (root) => {
    const destination = path.join(root, "skills", "quorum");
    const sibling = path.join(root, "skills", "other");
    const backup = `${destination}.backup-20260907T120000Z`;
    await createQuorum(destination);
    await mkdir(sibling);
    await createQuorum(backup);

    const result = await uninstallDestination(group(destination), { yes: true, cwd: root });
    assert.equal(result.status, "removed");
    await assert.rejects(access(destination), /ENOENT/);
    await access(path.dirname(destination));
    await access(sibling);
    await access(backup);
  });
});

test("unlinks a recognized symlink without deleting its target", async () => {
  await withTempDirectory(async (root) => {
    const target = path.join(root, "real-target");
    const destination = path.join(root, "skills", "quorum");
    await createQuorum(target);
    await mkdir(path.dirname(destination), { recursive: true });
    await symlink(target, destination);

    const result = await uninstallDestination(group(destination), { yes: true, cwd: root });
    assert.equal(result.status, "removed");
    await assert.rejects(lstat(destination), /ENOENT/);
    assert.match(await readFile(path.join(target, "SKILL.md"), "utf8"), /name: quorum/);
  });
});

test("refuses foreign content and a directory containing the current working directory", async () => {
  await withTempDirectory(async (root) => {
    const foreign = path.join(root, "foreign", "quorum");
    const active = path.join(root, "active", "quorum");
    const activeChild = path.join(active, "nested");
    await mkdir(foreign, { recursive: true });
    await writeFile(path.join(foreign, "SKILL.md"), "---\nname: other\n---\n");
    await createQuorum(active);
    await mkdir(activeChild);

    assert.deepEqual(
      await uninstallDestination(group(foreign), { yes: true, cwd: root }),
      { ...group(foreign), status: "refused", reason: "foreign content" },
    );
    const activeResult = await uninstallDestination(group(active), { yes: true, cwd: activeChild });
    assert.equal(activeResult.status, "refused");
    assert.match(activeResult.reason, /current working directory/);
    await access(active);
  });
});

test("dry-run plans removal without prompting or writing", async () => {
  await withTempDirectory(async (root) => {
    const destination = path.join(root, "skills", "quorum");
    await createQuorum(destination);
    const results = await uninstallSelected([group(destination)], {
      dryRun: true,
      cwd: root,
      confirmUninstall: async () => { throw new Error("must not prompt"); },
    });
    assert.equal(results[0].status, "planned");
    assert.equal(results[0].action, "remove");
    await access(destination);
  });
});

test("non-interactive uninstall requires --yes and preserves the installation", async () => {
  await withTempDirectory(async (root) => {
    const destination = path.join(root, "skills", "quorum");
    await createQuorum(destination);
    const results = await uninstallSelected([group(destination)], {
      cwd: root,
      input: { isTTY: false },
      output: { isTTY: false, write() {} },
    });
    assert.equal(results[0].status, "failed");
    assert.match(results[0].error, /not authorized/);
    await access(destination);
  });
});

test("uses one confirmation and refuses destinations changed afterward", async () => {
  await withTempDirectory(async (root) => {
    const first = path.join(root, "first", "quorum");
    const second = path.join(root, "second", "quorum");
    await createQuorum(first);
    await createQuorum(second);
    let confirmations = 0;
    const results = await uninstallSelected([group(first), group(second)], {
      cwd: root,
      confirmUninstall: async () => {
        confirmations += 1;
        await writeFile(path.join(first, "SKILL.md"), "---\nname: other\n---\n");
        return true;
      },
    });
    assert.equal(confirmations, 1);
    assert.deepEqual(results.map(({ status }) => status), ["refused", "removed"]);
    assert.equal(results[0].reason, "destination changed");
    await access(first);
    await assert.rejects(access(second), /ENOENT/);
  });
});

test("a foreign destination does not prevent an independent removal", async () => {
  await withTempDirectory(async (root) => {
    const foreign = path.join(root, "foreign", "quorum");
    const valid = path.join(root, "valid", "quorum");
    await mkdir(foreign, { recursive: true });
    await writeFile(path.join(foreign, "SKILL.md"), "---\nname: other\n---\n");
    await createQuorum(valid);
    const results = await uninstallSelected([group(foreign), group(valid)], {
      yes: true,
      cwd: root,
    });
    assert.deepEqual(results.map(({ status }) => status), ["refused", "removed"]);
  });
});
