import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { memoryOperation } from "../references/memory.mjs";

const record = {
  decision: "Keep storage local",
  assumptions: ["One writer"],
  uncertainty: ["Scale unknown"],
  sources: ["Architecture notes"],
  reconsideration: [{ text: "Multiple writers", basis: "confirmed" }],
};

async function fixture(t) {
  const projectRoot = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "quorum-selection-")));
  t.after(() => fs.rm(projectRoot, { recursive: true, force: true }));
  const quorumDir = path.join(projectRoot, ".quorum");
  const dir = path.join(quorumDir, "memory");
  return {
    projectRoot, dir,
    config: path.join(quorumDir, "config.json"),
    store: path.join(dir, "records.json"),
    lock: path.join(dir, ".lock"),
    op: (input, options) => memoryOperation({ projectRoot, ...input }, options),
  };
}

function offResult(projectRoot) {
  return {
    projectRoot, historical: true, validated: false, enabled: false, reason: "off",
    matched: 0, omitted: 0, returned: 0, truncated: false, records: [], recordDigests: {},
  };
}

function refuseRecordOpen(store) {
  return { ...fs, open: async (target, ...args) => {
    assert.notEqual(target, store, "off must block access before opening the record store");
    return fs.open(target, ...args);
  } };
}

test("default and explicit off select without opening saved records", async (t) => {
  const f = await fixture(t);
  const options = { fs: refuseRecordOpen(f.store) };
  const selector = { action: "select", query: "local" };
  assert.deepEqual(await f.op(selector, options), offResult(f.projectRoot));
  assert.deepEqual(await fs.readdir(f.projectRoot), []);

  const { id } = await f.op({ action: "save", record });
  assert.deepEqual(await f.op(selector, options), offResult(f.projectRoot));

  await f.op({ action: "off" });
  assert.deepEqual(await f.op({ action: "select", id }, options), offResult(f.projectRoot));
  assert.deepEqual((await f.op({ action: "read", id })).records[0],
    { ...record, id, createdAt: JSON.parse(await fs.readFile(f.store, "utf8")).records[0].createdAt });
});

test("select shares read matching and insertion order with a smaller count cap", async (t) => {
  const f = await fixture(t);
  await f.op({ action: "on" });
  await f.op({ action: "save", record: { ...record, decision: "Use remote storage" } });
  const ids = [];
  for (let i = 0; i < 12; i++) {
    const saved = await f.op({ action: "save", record: { ...record, decision: `Keep storage local ${i}` } });
    ids.push(saved.id);
  }
  const query = "LOCAL";
  const read = await f.op({ action: "read", query, limit: 20 });
  assert.deepEqual(read.records.map(({ id }) => id), ids);

  for (const [limit, returned] of [[undefined, 5], [1, 1], [10, 10]]) {
    const selected = await f.op({ action: "select", query, limit });
    const records = read.records.slice(0, returned);
    assert.deepEqual(selected, {
      ...read, enabled: true, omitted: 12 - returned, returned, truncated: true, records,
      recordDigests: Object.fromEntries(records.map((candidate) => [
        candidate.id, createHash("sha256").update(JSON.stringify(candidate)).digest("hex"),
      ])),
    });
  }
  const bySource = await f.op({ action: "select", query: "architecture NOTES", limit: 1 });
  assert.equal(bySource.matched, 13, "query matches serialized decision fields beyond the decision title");
});

test("select and read apply the existing byte bound before the count limit", async (t) => {
  const f = await fixture(t);
  await f.op({ action: "on" });
  const large = {
    decision: `Keep storage local ${"x".repeat(4000)}`,
    assumptions: Array(16).fill("é".repeat(250)),
    uncertainty: Array(16).fill("é".repeat(250)),
    sources: Array(16).fill("é".repeat(250)),
    reconsideration: [],
  };
  const ids = [];
  for (let i = 0; i < 3; i++) ids.push((await f.op({ action: "save", record: large })).id);
  const select = await f.op({ action: "select", query: "local", limit: 10 });
  const read = await f.op({ action: "read", query: "local", limit: 20 });
  assert.deepEqual(select.records, read.records);
  assert.deepEqual(select.records.map(({ id }) => id), ids.slice(0, 2));
  assert.deepEqual(Object.keys(select.recordDigests), ids.slice(0, 2));
  assert.equal(select.matched, 3);
  assert.equal(select.omitted, 1);
  assert.equal(select.returned, 2);
  assert.equal(select.truncated, true);
});

test("select strictly validates its scope, selectors and bounds", async (t) => {
  const f = await fixture(t);
  const id = "abcdefab-cdef-4abc-8abc-abcdefabcdef";
  for (const [input, message] of [
    [{}, /exactly one ID or query/],
    [{ id, query: "local" }, /exactly one ID or query/],
    [{ query: "local", record }, /exactly one ID or query/],
    [{ query: "local", all: true }, /exactly one ID or query/],
    [{ id: "not-a-uuid" }, /Invalid record ID/],
    [{ query: "" }, /Invalid or oversized text/],
    [{ query: "  " }, /Invalid or oversized text/],
    [{ query: "x".repeat(257) }, /Invalid or oversized text/],
    ...[0, 11, 20, 1.5, "5", null].map((limit) => [{ query: "local", limit }, /limit must be 1\.\.10/]),
    [{ query: "local", projectRoot: "." }, /absolute project root/],
    [{ query: "local", scope: "other" }, /Invalid project memory scope/],
    [{ scope: "global", id }, /Unknown global memory action/],
    [{ query: "local", unknown: true }, /Unknown fields/],
  ]) await assert.rejects(f.op({ action: "select", ...input }), message);
  assert.equal((await f.op({ action: "select", query: "x".repeat(256) })).enabled, false);
  assert.deepEqual(await fs.readdir(f.projectRoot), []);
});

test("exact ID selection is case-insensitive and digests the returned record", async (t) => {
  const f = await fixture(t);
  await f.op({ action: "on" });
  await f.op({ action: "save", record });
  const data = JSON.parse(await fs.readFile(f.store, "utf8"));
  const id = "abcdefab-cdef-4abc-8abc-abcdefabcdef";
  data.records[0].id = id;
  data.records[0].createdAt = "2026-11-20T00:00:00.000Z";
  await fs.writeFile(f.store, JSON.stringify(data));

  const selector = { action: "select", id: id.toUpperCase(), scope: "project" };
  const result = await f.op(selector);
  assert.deepEqual(result.records, [{ ...record, id, createdAt: "2026-11-20T00:00:00.000Z" }]);
  assert.equal(result.matched, 1);
  assert.equal(result.returned, 1);
  assert.equal(result.truncated, false);
  assert.deepEqual(result.recordDigests, {
    [id]: createHash("sha256").update(JSON.stringify(result.records[0])).digest("hex"),
  });
  assert.deepEqual(await f.op(selector), result, "the digest remains stable for the same stored content");
});

test("an enabled missing store is empty without initializing it", async (t) => {
  const f = await fixture(t);
  await f.op({ action: "on" });
  const before = await fs.readFile(f.config);
  const expected = { ...offResult(f.projectRoot), enabled: true };
  delete expected.reason;
  const select = () => f.op({ action: "select", query: "local" }, { fs: refuseRecordOpen(f.store) });

  assert.deepEqual(await select(), expected);
  assert.deepEqual(await fs.readdir(f.dir), [".gitignore"]);

  await fs.rename(f.dir, `${f.dir}-unused`);
  assert.deepEqual(await select(), expected);
  await assert.rejects(fs.lstat(f.dir), { code: "ENOENT" });
  assert.deepEqual(await fs.readFile(f.config), before);
});

test("select does not change schema-v1 records or configuration or recreate ignore files", async (t) => {
  const f = await fixture(t);
  await f.op({ action: "on" });
  const { id } = await f.op({ action: "save", record });
  const config = await fs.readFile(f.config);
  const store = await fs.readFile(f.store);
  const ignore = path.join(path.dirname(f.config), ".gitignore");
  await fs.unlink(ignore);
  await fs.unlink(path.join(f.dir, ".gitignore"));

  assert.equal((await f.op({ action: "select", id })).returned, 1);
  assert.deepEqual(await fs.readFile(f.config), config);
  assert.deepEqual(await fs.readFile(f.store), store);
  assert.deepEqual(await fs.readdir(f.dir), ["records.json"]);
  await assert.rejects(fs.lstat(ignore), { code: "ENOENT" });
});

test("select rejects copied and foreign memory while preserving the original files", async (t) => {
  const source = await fixture(t);
  const target = await fixture(t);
  await source.op({ action: "on" });
  const { id } = await source.op({ action: "save", record });
  await target.op({ action: "on" });
  await fs.copyFile(source.store, target.store);
  const targetConfig = await fs.readFile(target.config);
  await fs.copyFile(source.config, target.config);

  const select = () => target.op({ action: "select", id });
  const original = await fs.readFile(source.store);
  await assert.rejects(select(), /Configuration belongs to a different project/);
  await fs.writeFile(target.config, targetConfig);
  await assert.rejects(select(), /Memory belongs to a different project/);

  const badStore = JSON.stringify({ ...JSON.parse(original), projectRoot: target.projectRoot, schemaVersion: 99 });
  await fs.writeFile(target.store, badStore);
  await assert.rejects(select(), /Foreign memory owner or unsupported schema/);
  assert.equal(await fs.readFile(target.store, "utf8"), badStore);
  assert.deepEqual(await fs.readFile(source.store), original);
  await assert.rejects(fs.lstat(target.lock), { code: "ENOENT" });
});

test("select refuses tracked configuration before opening records", async (t) => {
  const f = await fixture(t);
  execFileSync("git", ["init", "--quiet", f.projectRoot]);
  await f.op({ action: "on" });
  const { id } = await f.op({ action: "save", record });
  execFileSync("git", ["-C", f.projectRoot, "add", "-f", f.config]);
  await assert.rejects(f.op({ action: "select", id }, { fs: refuseRecordOpen(f.store) }), /tracked/);
  assert.equal((await f.op({ action: "read", id })).matched, 1);
});

test("select preserves existing locks and residual writes", async (t) => {
  const f = await fixture(t);
  await f.op({ action: "on" });
  const { id } = await f.op({ action: "save", record });
  const select = () => f.op({ action: "select", id }, { fs: refuseRecordOpen(f.store) });
  await fs.writeFile(f.lock, "existing lock owner");
  await assert.rejects(select(), /Memory busy/);
  assert.equal(await fs.readFile(f.lock, "utf8"), "existing lock owner");

  await fs.unlink(f.lock);
  const pending = path.join(f.dir, ".write-0123.tmp");
  await fs.writeFile(pending, "existing temporary file");
  await assert.rejects(select(), /Incomplete prior memory write/);
  assert.equal(await fs.readFile(pending, "utf8"), "existing temporary file");
  await assert.rejects(fs.lstat(f.lock), { code: "ENOENT" });
});

test("select rechecks on-to-off after the lock is acquired without opening records", async (t) => {
  const f = await fixture(t);
  await f.op({ action: "on" });
  const { id } = await f.op({ action: "save", record });
  const noRecords = refuseRecordOpen(f.store);
  const result = await f.op({ action: "select", id }, { fs: {
    ...fs, open: async (target, ...args) => {
      if (target === f.lock) await f.op({ action: "off" });
      return noRecords.open(target, ...args);
    },
  } });
  assert.deepEqual(result, offResult(f.projectRoot));
  assert.equal((await f.op({ action: "status" })).enabled, false);
  await assert.rejects(fs.lstat(f.lock), { code: "ENOENT" });
});

test("select holds the existing lock against off and forget while reading", async (t) => {
  const f = await fixture(t);
  await f.op({ action: "on" });
  const { id } = await f.op({ action: "save", record });
  let release, ready;
  const blocked = new Promise((resolve) => { release = resolve; });
  const entered = new Promise((resolve) => { ready = resolve; });
  const pending = f.op({ action: "select", id }, { fs: {
    ...fs, open: async (target, ...args) => {
      if (target === f.store) { ready(); await blocked; }
      return fs.open(target, ...args);
    },
  } });
  try {
    await Promise.race([entered, pending]);
    await assert.rejects(f.op({ action: "off" }), /Memory busy/);
    await assert.rejects(f.op({ action: "forget", id }), /Memory busy/);
  } finally { release(); }
  assert.equal((await pending).records[0].id, id);
});

test("exact-ID recheck observes changed content under the same ID and subsequent deletion", async (t) => {
  const f = await fixture(t);
  await f.op({ action: "on" });
  const { id } = await f.op({ action: "save", record });
  const selected = await f.op({ action: "select", query: "local" });
  const data = JSON.parse(await fs.readFile(f.store, "utf8"));
  data.records[0].reconsideration[0].basis = "unknown";
  await fs.writeFile(f.store, JSON.stringify(data));

  const recheck = () => f.op({ action: "select", id });
  const changed = await recheck();
  assert.equal(changed.records[0].id, id);
  assert.equal(changed.records[0].reconsideration[0].basis, "unknown");
  assert.notEqual(changed.recordDigests[id], selected.recordDigests[id]);

  assert.equal((await f.op({ action: "forget", id })).forgotten, 1);
  const deleted = await recheck();
  assert.equal(deleted.enabled, true);
  assert.equal(deleted.matched, 0);
  assert.deepEqual(deleted.records, []);
  assert.deepEqual(deleted.recordDigests, {});
});

test("select propagates a record read failure and releases its lock", async (t) => {
  const f = await fixture(t);
  await f.op({ action: "on" });
  const { id } = await f.op({ action: "save", record });
  const before = await fs.readFile(f.store);

  await assert.rejects(f.op({ action: "select", id }, { fs: {
    ...fs, open: async (target, ...args) => {
      if (target === f.store) throw Object.assign(new Error("injected record read failure"), { code: "EACCES" });
      return fs.open(target, ...args);
    },
  } }), /injected record read failure/);
  await assert.rejects(fs.lstat(f.lock), { code: "ENOENT" });
  assert.deepEqual(await fs.readFile(f.store), before);
  assert.equal((await f.op({ action: "select", id })).returned, 1);
});

test("select fails on a directory replacement and leaves the replacement lock alone", async (t) => {
  const f = await fixture(t);
  await f.op({ action: "on" });
  const { id } = await f.op({ action: "save", record });
  const moved = `${f.dir}-original`;
  await assert.rejects(f.op({ action: "select", id }, { fs: {
    ...fs, open: async (target, ...args) => {
      const handle = await fs.open(target, ...args);
      if (target === f.store) {
        await fs.rename(f.dir, moved);
        await fs.mkdir(f.dir);
        await fs.writeFile(f.lock, "replacement lock owner");
      }
      return handle;
    },
  } }), /Memory path changed during operation/);
  assert.equal(await fs.readFile(f.lock, "utf8"), "replacement lock owner");
});

test("select CLI accepts valid query and ID selectors and rejects invalid options", async (t) => {
  const f = await fixture(t);
  await f.op({ action: "on" });
  const { id } = await f.op({ action: "save", record });
  const helper = fileURLToPath(new URL("../references/memory.mjs", import.meta.url));
  const invoke = (...args) => spawnSync(process.execPath,
    [helper, "select", "--project-root", f.projectRoot, ...args], { encoding: "utf8" });
  for (const args of [["--query", "LOCAL", "--limit", "10"], ["--id", id.toUpperCase()]]) {
    const result = invoke(...args);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).records[0].id, id);
  }
  for (const args of [
    [], ["--id"], ["--id", id, "--query", "local"], ["--query", "local", "--query", "local"],
    ["--query", "local", "--limit", "11"], ["--scope", "global", "--id", id],
    ["--query", "local", "--all"], ["--query", "local", "--unknown"],
  ]) {
    const result = invoke(...args);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
  }
  const help = spawnSync(process.execPath, [helper, "--help"], { encoding: "utf8" });
  assert.match(help.stdout, /select --project-root ABS.*--limit 1\.\.10/);
});
