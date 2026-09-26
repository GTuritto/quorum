#!/usr/bin/env node
import * as realFs from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const OWNER = "quorum";
const MAX_CONFIG = 4096;
const MAX_STORE = 1024 * 1024;
const MAX_RECORD = 32 * 1024;
const MAX_OUTPUT = 64 * 1024;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const RECORD_FIELDS = ["decision", "assumptions", "uncertainty", "sources", "reconsideration"];

function keys(value, allowed) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((k) => !allowed.includes(k))) {
    throw new Error("Unknown fields or invalid object");
  }
}
function string(value, max) {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error("Invalid or oversized text");
}
function validateRecord(record, stored = false) {
  keys(record, stored ? [...RECORD_FIELDS, "id", "createdAt"] : RECORD_FIELDS);
  string(record.decision, 4096);
  for (const name of RECORD_FIELDS.slice(1)) {
    if (!Array.isArray(record[name]) || record[name].length > 16) throw new Error(`Invalid ${name} array`);
    for (const item of record[name]) {
      if (name === "reconsideration") {
        keys(item, ["text", "basis"]);
        string(item.text, 512);
        if (!["confirmed", "inferred", "unknown"].includes(item.basis)) throw new Error("Invalid condition basis");
      } else string(item, 512);
    }
  }
  if (stored && (!UUID.test(record.id) || typeof record.createdAt !== "string" || !Number.isFinite(Date.parse(record.createdAt)))) {
    throw new Error("Invalid record identity or timestamp");
  }
  if (Buffer.byteLength(JSON.stringify(record)) > MAX_RECORD) throw new Error("Record exceeds 32 KiB");
}
function validateInput(input) {
  keys(input, ["action", "projectRoot", "record", "id", "query", "limit", "all"]);
  if (typeof input.projectRoot !== "string" || !path.isAbsolute(input.projectRoot)) throw new Error("Explicit absolute project root required");
  const { action, id, query, record, all, limit } = input;
  if (!["save", "capture", "read", "forget", "on", "off", "status"].includes(action)) throw new Error("Expected save, capture, read, forget, on, off, or status");
  if (id !== undefined && (typeof id !== "string" || !UUID.test(id))) throw new Error("Invalid record ID");
  if (["on", "off", "status"].includes(action)) {
    if ([id, query, record, all, limit].some((v) => v !== undefined)) throw new Error("Controls accept only a project root");
  } else if (action === "save" || action === "capture") {
    if ([id, query, all, limit].some((v) => v !== undefined)) throw new Error("Save accepts only a record");
    validateRecord(record);
  } else if (action === "read") {
    if (record !== undefined || all !== undefined || (id !== undefined) === (query !== undefined)) throw new Error("Read requires exactly one ID or query");
    if (query !== undefined) string(query, 256);
    if (limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1 || limit > 20)) throw new Error("Read limit must be 1..20");
  } else if (record !== undefined || query !== undefined || limit !== undefined ||
    (all !== undefined && all !== true) || ((id !== undefined) === (all === true))) {
    throw new Error("Forget requires exactly one ID or --all");
  }
}

// Coordinates cooperating writers. Rechecks reject observed path changes;
// this is not a transaction against a malicious process replacing directories.
export async function memoryOperation(input, { fs = realFs } = {}) {
  validateInput(input);
  const stat = async (p) => {
    try { return await fs.lstat(p); } catch (error) { if (error.code === "ENOENT") return null; throw error; }
  };
  const assertKind = async (p, directory) => {
    const info = await stat(p);
    if (!info) return null;
    if (info.isSymbolicLink()) throw new Error(`Symbolic link refused: ${p}`);
    if (directory ? !info.isDirectory() : !info.isFile() || info.nlink !== 1) throw new Error(`Unexpected type or hard link: ${p}`);
    return info;
  };
  if (!await assertKind(input.projectRoot, true)) throw new Error("Project root does not exist");
  const projectRoot = await fs.realpath(input.projectRoot);
  const dirs = [projectRoot, path.join(projectRoot, ".quorum"), path.join(projectRoot, ".quorum", "memory")];
  const dir = dirs[2], store = path.join(dir, "records.json"), lockPath = path.join(dir, ".lock"), ignorePath = path.join(dir, ".gitignore");
  const config = path.join(dirs[1], "config.json");
  const configOperation = ["on", "off", "status", "capture"].includes(input.action);
  const settingMutation = ["on", "off"].includes(input.action);
  const identities = new Map();
  async function checkPaths(create = false) {
    for (const p of dirs) {
      let info = await assertKind(p, true);
      if (!info && create) {
        try { await fs.mkdir(p, { mode: 0o700 }); } catch (error) { if (error.code !== "EEXIST") throw error; }
        info = await assertKind(p, true);
      }
      const identity = info && `${info.dev}:${info.ino}`;
      if (identities.has(p) && identities.get(p) !== identity) throw new Error("Memory path changed during operation");
      if (info) identities.set(p, identity);
    }
  }
  async function readFileSafe(p, max) {
    const info = await assertKind(p, false);
    if (!info) return null;
    if (info.size > max) throw new Error("Memory file exceeds size limit");
    const handle = await fs.open(p, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    try {
      const actual = await handle.stat();
      if (actual.dev !== info.dev || actual.ino !== info.ino || actual.nlink !== 1) throw new Error("Memory file changed during read");
      const buffer = Buffer.alloc(max + 1);
      let used = 0;
      while (used < buffer.length) {
        const { bytesRead } = await handle.read(buffer, used, buffer.length - used, null);
        if (!bytesRead) break;
        used += bytesRead;
      }
      if (used > max) throw new Error("Memory file exceeds size limit");
      return new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, used));
    } finally { await handle.close(); }
  }
  async function rejectTracked() {
    // Non-Git projects need only Node. Git projects need Git to verify the index.
    let current = projectRoot, found = false;
    while (true) {
      if (await stat(path.join(current, ".git"))) { found = true; break; }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
    if (!found) return;
    let tracked;
    try { tracked = execFileSync("git", ["-C", projectRoot, "ls-files", "-z", "--", ...(configOperation ? [".quorum/config.json", ".quorum/.gitignore", ".quorum/memory"] : [".quorum/memory"])], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
    catch { throw new Error("Cannot verify Git exclusion; Git is required for memory in Git projects"); }
    if (tracked.length) throw new Error("Memory path contains tracked files; remove them from the Git index before using memory");
  }
  async function readConfig() {
    await checkPaths();
    const raw = await readFileSafe(config, MAX_CONFIG);
    if (raw === null) return { raw, data: { owner: OWNER, schemaVersion: 1, projectRoot, enabled: false } };
    let data;
    try { data = JSON.parse(raw); } catch { throw new Error("Malformed memory configuration JSON"); }
    keys(data, ["owner", "schemaVersion", "projectRoot", "enabled"]);
    if (data.owner !== OWNER || data.schemaVersion !== 1) throw new Error("Foreign configuration owner or unsupported schema");
    if (data.projectRoot !== projectRoot) throw new Error("Configuration belongs to a different project");
    if (typeof data.enabled !== "boolean") throw new Error("Invalid memory enabled setting");
    return { raw, data };
  }
  async function ensureIgnore(p, content) {
    const ignore = await readFileSafe(p, 1024);
    if (ignore !== null && ignore !== content) throw new Error("Foreign memory .gitignore; expected complete exclusion");
    if (ignore === null) await fs.writeFile(p, content, { flag: "wx", mode: 0o600 });
  }
  async function readStore() {
    await checkPaths();
    const raw = await readFileSafe(store, MAX_STORE);
    if (raw === null) return { raw, data: { owner: OWNER, schemaVersion: 1, projectRoot, records: [] } };
    let data;
    try { data = JSON.parse(raw); } catch { throw new Error("Malformed memory JSON"); }
    keys(data, ["owner", "schemaVersion", "projectRoot", "records"]);
    if (data.owner !== OWNER || data.schemaVersion !== 1) throw new Error("Foreign memory owner or unsupported schema");
    if (data.projectRoot !== projectRoot) throw new Error("Memory belongs to a different project");
    if (!Array.isArray(data.records) || data.records.length > 200) throw new Error("Invalid record collection");
    const ids = new Set();
    for (const record of data.records) {
      validateRecord(record, true);
      const id = record.id.toLowerCase();
      if (ids.has(id)) throw new Error("Duplicate record ID");
      ids.add(id);
    }
    return { raw, data };
  }
  async function rejectResidualWrites() {
    const residual = (await fs.readdir(dir)).find((name) => /^\.write-[a-f0-9-]+\.tmp$/i.test(name));
    if (residual) throw new Error(`Incomplete prior memory write at ${path.join(dir, residual)}; recover it before mutating memory`);
  }
  await checkPaths();
  await rejectTracked();
  if (configOperation) {
    const { data } = await readConfig();
    if (input.action === "status") return { projectRoot, enabled: data.enabled };
    // Off is a no-op for capture: do not open records or initialize storage.
    if (input.action === "capture" && !data.enabled) return { projectRoot, saved: false, reason: "off" };
  }
  if (input.action === "read") {
    const { data } = await readStore();
    const matches = data.records.filter((record) => input.id ? record.id.toLowerCase() === input.id.toLowerCase() :
      JSON.stringify(RECORD_FIELDS.map((field) => record[field])).toLowerCase().includes(input.query.toLowerCase()));
    const records = [];
    let bytes = 0;
    for (const record of matches) {
      const size = Buffer.byteLength(JSON.stringify(record));
      if (records.length >= (input.limit ?? 5) || bytes + size > MAX_OUTPUT) break;
      records.push(record); bytes += size;
    }
    return { projectRoot, historical: true, validated: false, matched: matches.length, omitted: matches.length - records.length, records };
  }
  // Empty forget is side-effect free, even without the storage directory.
  if (input.action === "forget" && !await stat(store)) {
    if (await stat(dir)) {
      if (await stat(lockPath)) throw new Error("Memory busy: lock exists; retry after the active operation completes");
      await rejectResidualWrites();
    }
    return { projectRoot, forgotten: 0 };
  }
  await checkPaths(input.action === "save" || input.action === "capture" || settingMutation);
  await assertKind(lockPath, false);
  let lock;
  try { lock = await fs.open(lockPath, "wx", 0o600); }
  catch (error) { if (error.code === "EEXIST") throw new Error("Memory busy: lock exists; retry after the active operation completes"); throw error; }
  let temporary, operationError, lockInfo;
  try {
    lockInfo = await lock.stat();
    await rejectResidualWrites();
    await lock.writeFile(`${process.pid}\n`);
    // Configuration and records share the existing lock, including old save/forget clients.
    const captureConfig = input.action === "capture" ? await readConfig() : null;
    if (captureConfig && !captureConfig.data.enabled) return { projectRoot, saved: false, reason: "off" };
    if (settingMutation || captureConfig) await ensureIgnore(path.join(dirs[1], ".gitignore"), ".gitignore\n/config.json\n");
    const readTarget = settingMutation ? readConfig : readStore;
    const target = settingMutation ? config : store;
    const before = await readTarget();
    const data = before.data;
    let result;
    if (settingMutation) {
      await ensureIgnore(ignorePath, "*\n");
      data.enabled = input.action === "on";
      result = { projectRoot, enabled: data.enabled };
      if (before.raw !== null && JSON.parse(before.raw).enabled === data.enabled) return result;
    } else if (input.action === "save" || input.action === "capture") {
      await ensureIgnore(ignorePath, "*\n");
      // Exact, adjacent deduplication preserves reversals and all uncertainty.
      const signature = (r) => JSON.stringify(RECORD_FIELDS.map((field) => field === "reconsideration"
        ? r[field].map(({ text, basis }) => [text, basis]) : r[field]));
      const latest = data.records.at(-1);
      if (input.action === "capture" && latest && signature(latest) === signature(input.record)) {
        return { projectRoot, saved: false, reason: "duplicate", id: latest.id };
      }
      const record = { ...input.record, id: randomUUID(), createdAt: new Date().toISOString() };
      validateRecord(record, true);
      data.records.push(record);
      if (data.records.length > 200) throw new Error("Memory record capacity reached (200)");
      result = { projectRoot, saved: true, id: record.id };
    } else {
      const remaining = input.all ? [] : data.records.filter((r) => r.id.toLowerCase() !== input.id.toLowerCase());
      result = { projectRoot, forgotten: data.records.length - remaining.length };
      if (!result.forgotten) return result;
      data.records = remaining;
    }
    const serialized = JSON.stringify(data) + "\n";
    if (Buffer.byteLength(serialized) > (settingMutation ? MAX_CONFIG : MAX_STORE)) {
      throw new Error(settingMutation ? "Configuration exceeds 4 KiB" : "Memory store capacity reached (1 MiB)");
    }
    if (settingMutation || data.records.length) {
      temporary = path.join(dir, `.write-${randomUUID()}.tmp`);
      const handle = await fs.open(temporary, "wx", 0o600);
      try { await handle.writeFile(serialized); await handle.sync(); } finally { await handle.close(); }
    }
    await checkPaths();
    await rejectTracked();
    if (captureConfig && (await readConfig()).raw !== captureConfig.raw) throw new Error("Memory setting changed during capture");
    if ((await readTarget()).raw !== before.raw) throw new Error("Memory data changed during operation");
    if (temporary) { await fs.rename(temporary, target); temporary = undefined; }
    else if (before.raw !== null) await fs.unlink(target);
    return result;
  } catch (error) {
    operationError = error;
    throw error;
  } finally {
    const failures = [];
    try { await lock.close(); } catch (error) { failures.push(error); }
    let pathsSafe = false;
    try { await checkPaths(); pathsSafe = true; } catch (error) { failures.push(error); }
    if (pathsSafe) {
      if (temporary) {
        try { await fs.unlink(temporary); } catch (error) { failures.push(new Error(`Residual temporary file ${temporary}: ${error.message}`)); }
      }
      try {
        const current = await assertKind(lockPath, false);
        if (!current || !lockInfo || current.dev !== lockInfo.dev || current.ino !== lockInfo.ino) throw new Error("Lock ownership changed; refusing cleanup");
        await fs.unlink(lockPath);
      } catch (error) { failures.push(error); }
    }
    if (failures.length) {
      const errors = operationError ? [operationError, ...failures] : failures;
      throw new AggregateError(errors, `Memory cleanup failed; data may have changed: ${errors.map((e) => e.message).join("; ")}`);
    }
  }
}

async function cli() {
  const [action, ...args] = process.argv.slice(2);
  if (action === "--help") {
    console.log("Quorum memory: on|off|status --project-root ABS | save|capture --project-root ABS < record.json | read --project-root ABS (--id UUID | --query TEXT) [--limit 1..20] | forget --project-root ABS (--id UUID | --all)");
    return;
  }
  const input = { action };
  const names = { "--project-root": "projectRoot", "--id": "id", "--query": "query", "--limit": "limit", "--all": "all" };
  for (let i = 0; i < args.length; i++) {
    const name = names[args[i]];
    if (!name || Object.hasOwn(input, name)) throw new Error("Unknown or duplicate option");
    if (name === "all") input[name] = true;
    else {
      if (args[i + 1] === undefined) throw new Error("Missing option value");
      input[name] = name === "limit" ? Number(args[++i]) : args[++i];
    }
  }
  if (action === "save" || action === "capture") {
    const chunks = [];
    let size = 0;
    for await (const chunk of process.stdin) {
      size += chunk.length;
      if (size > MAX_RECORD) throw new Error("Record exceeds 32 KiB");
      chunks.push(chunk);
    }
    input.record = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
  }
  console.log(JSON.stringify(await memoryOperation(input)));
}
// Node resolves module symlinks; compare canonical paths for installed entry points.
const entryPath = process.argv[1] && await realFs.realpath(process.argv[1]).catch(() => null);
if (entryPath === fileURLToPath(import.meta.url)) {
  cli().catch((error) => { console.error(`Quorum memory: ${error.message}`); process.exitCode = 1; });
}
