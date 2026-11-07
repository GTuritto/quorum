import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { memoryOperation } from "../references/memory.mjs";

const record = {
  decision: "Use manual export until the scheduler is reliable",
  assumptions: ["Existing records are available"],
  uncertainty: ["Scheduler misses jobs"],
  sources: ["Synthetic acceptance fixture"],
  reconsideration: [{ text: "Scheduler passes repeated delivery checks", basis: "confirmed" }],
};

async function fixture(t) {
  const homeDir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "quorum-global-")));
  const a = path.join(homeDir, "a"), b = path.join(homeDir, "b"), c = path.join(homeDir, "c");
  await Promise.all([fs.mkdir(a), fs.mkdir(b), fs.mkdir(c)]);
  t.after(() => fs.rm(homeDir, { recursive: true, force: true }));
  const project = (projectRoot, action, rest = {}) => memoryOperation({ action, projectRoot, ...rest });
  const global = (action, rest = {}) => memoryOperation({ scope: "global", action, ...rest }, { homeDir });
  return { homeDir, a, b, c, project, global, globalDir: path.join(homeDir, ".quorum", "global-memory") };
}

test("global status is off without creating storage; share requires explicit authorization and override", async (t) => {
  const f = await fixture(t);
  assert.equal((await f.global("status")).enabled, false);
  assert.equal((await f.global("forget", { all: true })).forgotten, 0);
  await assert.rejects(fs.stat(path.join(f.homeDir, ".quorum")), { code: "ENOENT" });
  const saved = await f.project(f.a, "save", { record });
  await assert.rejects(f.global("share", { projectRoot: f.a, sourceId: saved.id }), /authorization/i);
  await assert.rejects(f.global("share", { projectRoot: f.a, sourceId: saved.id, authorized: true }), /off/i);
  await f.global("on");
  await assert.rejects(f.global("share", { projectRoot: f.a, sourceId: saved.id, authorized: true }), /override/i);
  const shared = await f.global("share", { projectRoot: f.a, sourceId: saved.id, authorized: true, allowProjectOff: true });
  assert.equal(shared.saved, true);
  assert.equal((await f.global("links", { projectRoot: f.a, sourceId: saved.id })).ids[0], shared.id);
  const retry = await f.global("share", { projectRoot: f.a, sourceId: saved.id, authorized: true, allowProjectOff: true });
  assert.deepEqual({ saved: retry.saved, id: retry.id }, { saved: false, id: shared.id });
});

test("one snapshot survives project forget and source loss; admission, revoke, and global forget have exact scope", async (t) => {
  const f = await fixture(t);
  const saved = await f.project(f.a, "save", { record });
  await f.global("on");
  const shared = await f.global("share", { projectRoot: f.a, sourceId: saved.id, authorized: true, allowProjectOff: true });
  const preview = await f.global("preview", { projectRoot: f.b, id: shared.id, authorized: true });
  assert.equal(preview.record.decision, record.decision);
  assert.equal(preview.historical, true);
  assert.equal(preview.validated, false);
  assert.equal(preview.admissionId, null);
  await assert.rejects(f.global("read", { projectRoot: f.b, id: shared.id, authorized: true }), /admitted/i);
  const admitted = await f.global("admit", { projectRoot: f.b, id: shared.id, authorized: true, previewDigest: preview.digest });
  assert.equal(admitted.changed, true);
  await assert.rejects(f.global("read", { projectRoot: f.b, id: shared.id }), /destination action/i);
  const read = await f.global("read", { projectRoot: f.b, id: shared.id, authorized: true });
  assert.equal(read.admissionId, admitted.admissionId);
  assert.equal(read.sourceState, "same-record");
  assert.deepEqual(read.record.uncertainty, record.uncertainty);
  await assert.rejects(f.global("read", { projectRoot: f.c, id: shared.id, authorized: true }), /admitted/i);
  assert.equal((await f.project(f.a, "forget", { id: saved.id })).forgotten, 1);
  const afterProjectForget = await f.global("read", { projectRoot: f.b, id: shared.id, authorized: true });
  assert.equal(afterProjectForget.found, true);
  assert.equal(afterProjectForget.sourceState, "record-missing");
  await fs.rename(f.a, path.join(f.homeDir, "moved-a"));
  assert.equal((await f.global("read", { projectRoot: f.b, id: shared.id, authorized: true })).sourceState, "project-unavailable");
  const revoked = await f.global("revoke", { projectRoot: f.b, id: shared.id });
  assert.equal(revoked.globalRecordSurvives, true);
  await assert.rejects(f.global("read", { projectRoot: f.b, id: shared.id, authorized: true }), /admitted/i);
  await f.global("admit", { projectRoot: f.b, id: shared.id, authorized: true, previewDigest: preview.digest });
  const forgotten = await f.global("forget", { id: shared.id });
  assert.deepEqual(forgotten.ids, [shared.id]);
  assert.equal((await f.global("read", { projectRoot: f.b, id: shared.id, authorized: true })).found, false);
});

test("global off blocks reads without deleting snapshots; copied destination cannot inherit admission", async (t) => {
  const f = await fixture(t);
  const saved = await f.project(f.a, "save", { record });
  await f.global("on");
  const shared = await f.global("share", { projectRoot: f.a, sourceId: saved.id, authorized: true, allowProjectOff: true });
  const preview = await f.global("preview", { projectRoot: f.b, id: shared.id, authorized: true });
  await f.global("admit", { projectRoot: f.b, id: shared.id, authorized: true, previewDigest: preview.digest });
  await fs.rm(f.c, { recursive: true });
  await fs.cp(f.b, f.c, { recursive: true });
  await assert.rejects(f.global("read", { projectRoot: f.c, id: shared.id, authorized: true }), /admitted/i);
  await f.global("off");
  await assert.rejects(f.global("read", { projectRoot: f.b, id: shared.id, authorized: true }), /off/i);
  await f.global("on");
  assert.equal((await f.global("read", { projectRoot: f.b, id: shared.id, authorized: true })).found, true);
});

test("global scope and managed paths are validated before any transfer", async (t) => {
  const f = await fixture(t);
  const saved = await f.project(f.a, "save", { record });
  for (const input of [
    { scope: "global", action: "share", projectRoot: f.a, sourceId: saved.id, authorized: true, allowProjectOff: "yes" },
    { scope: "global", action: "forget" },
    { scope: "global", action: "preview", projectRoot: f.b, id: "../record" },
    { scope: "global", action: "admit", projectRoot: f.b, id: saved.id },
    { scope: "project", action: "share", projectRoot: f.a, sourceId: saved.id },
  ]) await assert.rejects(memoryOperation(input, { homeDir: f.homeDir }));
  await fs.mkdir(path.join(f.homeDir, ".quorum"), { mode: 0o700 });
  await fs.symlink(f.b, f.globalDir, "dir");
  await assert.rejects(f.global("status"), /unsafe/i);
});

test("renamed source and destination require explicit new identity authorization", async (t) => {
  const f = await fixture(t);
  const saved = await f.project(f.a, "save", { record });
  await f.global("on");
  const shared = await f.global("share", { projectRoot: f.a, sourceId: saved.id, authorized: true, allowProjectOff: true });
  const preview = await f.global("preview", { projectRoot: f.b, id: shared.id, authorized: true });
  await f.global("admit", { projectRoot: f.b, id: shared.id, authorized: true, previewDigest: preview.digest });
  const movedB = path.join(f.homeDir, "moved-b");
  await fs.rename(f.b, movedB);
  await assert.rejects(f.global("read", { projectRoot: movedB, id: shared.id, authorized: true }), /admitted/i);
  await fs.mkdir(f.b);
  await assert.rejects(f.global("read", { projectRoot: f.b, id: shared.id, authorized: true }), /admitted/i);
  const movedA = path.join(f.homeDir, "moved-a");
  await fs.rename(f.a, movedA);
  await assert.rejects(f.global("share", { projectRoot: movedA, sourceId: saved.id, authorized: true, allowProjectOff: true }), /different project/i);
  assert.equal((await f.global("preview", { projectRoot: f.b, id: shared.id, authorized: true })).sourceState, "project-unavailable");
});

test("global forget preserves project source and unrelated global entries", async (t) => {
  const f = await fixture(t);
  const first = await f.project(f.a, "save", { record });
  const second = await f.project(f.a, "save", { record: { ...record, decision: "Keep a manual fallback" } });
  await f.global("on");
  const a = await f.global("share", { projectRoot: f.a, sourceId: first.id, authorized: true, allowProjectOff: true });
  const b = await f.global("share", { projectRoot: f.a, sourceId: second.id, authorized: true, allowProjectOff: true });
  assert.equal((await f.global("forget", { id: a.id })).forgotten, 1);
  assert.deepEqual((await f.global("links", { projectRoot: f.a })).ids, [b.id]);
  assert.equal((await f.project(f.a, "read", { id: first.id })).records.length, 1);
  assert.equal((await f.project(f.a, "read", { id: second.id })).records.length, 1);
});

test("changed source, malformed global store, lock, and interrupted write fail without false success", async (t) => {
  const f = await fixture(t);
  const saved = await f.project(f.a, "save", { record });
  await f.global("on");
  const shared = await f.global("share", { projectRoot: f.a, sourceId: saved.id, authorized: true, allowProjectOff: true });
  const projectStore = path.join(f.a, ".quorum", "memory", "records.json");
  const data = JSON.parse(await fs.readFile(projectStore, "utf8"));
  data.records[0].uncertainty.push("New evidence");
  await fs.writeFile(projectStore, JSON.stringify(data));
  await assert.rejects(f.global("share", { projectRoot: f.a, sourceId: saved.id, authorized: true, allowProjectOff: true }), /changed after sharing/i);
  const storePath = path.join(f.globalDir, "records.json");
  const original = await fs.readFile(storePath, "utf8");
  await fs.writeFile(path.join(f.globalDir, ".lock"), "other writer");
  await assert.rejects(f.global("forget", { id: shared.id }), /busy/i);
  assert.equal(await fs.readFile(storePath, "utf8"), original);
  await fs.unlink(path.join(f.globalDir, ".lock"));
  const residual = path.join(f.globalDir, ".write-0123.tmp");
  await fs.writeFile(residual, "incomplete");
  await assert.rejects(f.global("forget", { id: shared.id }), /incomplete/i);
  await fs.unlink(residual);
  await fs.writeFile(storePath, JSON.stringify({ owner: "foreign", schemaVersion: 1, homeRoot: f.homeDir, entries: [] }));
  const foreign = await fs.readFile(storePath, "utf8");
  await assert.rejects(f.global("forget", { id: shared.id }), /foreign/i);
  assert.equal(await fs.readFile(storePath, "utf8"), foreign);
});

test("preview digest prevents admitting a changed snapshot; revoke still works while global is off", async (t) => {
  const f = await fixture(t);
  const saved = await f.project(f.a, "save", { record });
  await f.global("on");
  const shared = await f.global("share", { projectRoot: f.a, sourceId: saved.id, authorized: true, allowProjectOff: true });
  const preview = await f.global("preview", { projectRoot: f.b, id: shared.id, authorized: true });
  await assert.rejects(f.global("admit", { projectRoot: f.b, id: shared.id, authorized: true, previewDigest: "0".repeat(64) }), /changed since preview/i);
  await f.global("admit", { projectRoot: f.b, id: shared.id, authorized: true, previewDigest: preview.digest });
  await f.global("off");
  assert.equal((await f.global("revoke", { projectRoot: f.b, id: shared.id })).changed, true);
  await f.global("on");
  await assert.rejects(f.global("read", { projectRoot: f.b, id: shared.id, authorized: true }), /admitted/i);
});

test("global CLI uses the installed home identity and explicit scope", async (t) => {
  const f = await fixture(t);
  const helper = new URL("../references/memory.mjs", import.meta.url);
  const run = (...args) => spawnSync(process.execPath, [helper.pathname, ...args], {
    env: { ...process.env, HOME: f.homeDir }, encoding: "utf8",
  });
  assert.equal(run("status", "--scope", "global").status, 0);
  const on = run("on", "--scope", "global");
  assert.equal(on.status, 0, on.stderr);
  assert.equal(JSON.parse(on.stdout).enabled, true);
  const status = run("status", "--scope", "global");
  assert.equal(JSON.parse(status.stdout).enabled, true);
  assert.notEqual(run("share", "--scope", "global", "--project-root", f.a).status, 0);
});

test("global managed storage refuses broad permissions without changing data", async (t) => {
  const f = await fixture(t);
  await f.global("on");
  const config = path.join(f.globalDir, "config.json");
  const original = await fs.readFile(config, "utf8");
  await fs.chmod(f.globalDir, 0o755);
  await assert.rejects(f.global("status"), /permissions/i);
  assert.equal(await fs.readFile(config, "utf8"), original);
});
