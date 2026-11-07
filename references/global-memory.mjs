import * as realFs from "node:fs/promises";
import { constants } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const MAX_CONFIG = 4096;
const MAX_STORE = 1024 * 1024;

function fields(value, allowed) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).some((key) => !allowed.includes(key))) throw new Error("Unknown fields or invalid global memory object");
}

function inputCheck(input) {
  fields(input, ["scope", "action", "projectRoot", "sourceId", "id", "all", "authorized", "allowProjectOff", "previewDigest"]);
  if (input.scope !== "global") throw new Error("Explicit global scope required");
  const { action, projectRoot, sourceId, id, all, authorized, allowProjectOff, previewDigest } = input;
  if (!["on", "off", "status", "share", "preview", "admit", "read", "revoke", "forget", "links"].includes(action)) {
    throw new Error("Unknown global memory action");
  }
  if (projectRoot !== undefined && (typeof projectRoot !== "string" || !path.isAbsolute(projectRoot))) throw new Error("Absolute project root required");
  if (sourceId !== undefined && !UUID.test(sourceId)) throw new Error("Invalid source record ID");
  if (id !== undefined && !UUID.test(id)) throw new Error("Invalid global record ID");
  if (previewDigest !== undefined && (typeof previewDigest !== "string" || !/^[a-f0-9]{64}$/.test(previewDigest))) throw new Error("Invalid preview digest");
  if (allowProjectOff !== undefined && typeof allowProjectOff !== "boolean") throw new Error("Invalid project-off override");
  if (all !== undefined && all !== true) throw new Error("Invalid all selector");
  if (["on", "off", "status"].includes(action)) {
    if ([projectRoot, sourceId, id, all, authorized, allowProjectOff, previewDigest].some((value) => value !== undefined)) throw new Error("Global setting accepts no record selector");
  } else if (action === "share") {
    if (!projectRoot || !sourceId || authorized !== true || [id, all, previewDigest].some((value) => value !== undefined)) throw new Error("Share requires exact source and explicit authorization");
  } else if (action === "preview") {
    if (!projectRoot || !id || authorized !== true || [sourceId, all, allowProjectOff, previewDigest].some((value) => value !== undefined)) throw new Error("Preview requires destination and explicit request");
  } else if (["admit", "read", "revoke"].includes(action)) {
    if (!projectRoot || !id || sourceId !== undefined || all !== undefined || allowProjectOff !== undefined ||
        (["admit", "read"].includes(action) ? authorized !== true || (action === "admit" && previewDigest === undefined) ||
          (action === "read" && previewDigest !== undefined) : authorized !== undefined || previewDigest !== undefined)) throw new Error("Invalid destination action");
  } else if (action === "forget") {
    if (projectRoot !== undefined || sourceId !== undefined || authorized !== undefined || allowProjectOff !== undefined || previewDigest !== undefined ||
        (id !== undefined) === (all === true)) throw new Error("Global forget requires one ID or all");
  } else if (!projectRoot || id !== undefined || all !== undefined || authorized !== undefined || allowProjectOff !== undefined || previewDigest !== undefined) {
    throw new Error("Links requires a project and optional source ID");
  }
}

function identity(info, resolved) {
  return { projectRoot: resolved, device: info.dev, inode: info.ino };
}

function sameIdentity(a, b) {
  return a.projectRoot === b.projectRoot && a.device === b.device && a.inode === b.inode;
}

export async function globalMemoryOperation(input, {
  fs = realFs, homeDir = os.homedir(), projectOperation, validateRecord,
} = {}) {
  inputCheck(input);
  if (typeof projectOperation !== "function" || typeof validateRecord !== "function") throw new Error("Global memory requires project helper bindings");
  const stat = async (target) => {
    try { return await fs.lstat(target); } catch (error) { if (error.code === "ENOENT") return null; throw error; }
  };
  const directory = async (target, create = false) => {
    let info = await stat(target);
    if (!info && create) {
      try { await fs.mkdir(target, { mode: 0o700 }); } catch (error) { if (error.code !== "EEXIST") throw error; }
      info = await stat(target);
    }
    if (info && (!info.isDirectory() || info.isSymbolicLink())) throw new Error(`Unsafe global memory directory: ${target}`);
    return info;
  };
  const file = async (target) => {
    const info = await stat(target);
    if (info && (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1)) throw new Error(`Unsafe global memory file: ${target}`);
    return info;
  };
  const homeInfo = await directory(homeDir);
  if (!homeInfo) throw new Error("Home directory unavailable");
  const homeRoot = await fs.realpath(homeDir);
  const parent = path.join(homeRoot, ".quorum");
  const root = path.join(parent, "global-memory");
  const configPath = path.join(root, "config.json");
  const storePath = path.join(root, "records.json");
  const lockPath = path.join(root, ".lock");
  const knownDirectories = new Map();
  const ensureRoot = async (create = false) => {
    for (const target of [homeRoot, parent, root]) {
      const info = await directory(target, create && target !== homeRoot);
      if (info && target !== homeRoot && (info.mode & 0o077)) throw new Error("Global memory directory permissions are too broad");
      const current = info && `${info.dev}:${info.ino}`;
      if (knownDirectories.has(target) && knownDirectories.get(target) !== current) throw new Error("Global memory path changed during operation");
      if (info) knownDirectories.set(target, current);
    }
  };
  const readSafe = async (target, max) => {
    const info = await file(target);
    if (!info) return null;
    if (info.mode & 0o077) throw new Error("Global memory file permissions are too broad");
    if (info.size > max) throw new Error("Global memory file exceeds limit");
    const handle = await fs.open(target, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    try {
      const actual = await handle.stat();
      if (actual.dev !== info.dev || actual.ino !== info.ino || actual.nlink !== 1) throw new Error("Global memory file changed during read");
      const buffer = Buffer.alloc(max + 1);
      let used = 0;
      while (used < buffer.length) {
        const { bytesRead } = await handle.read(buffer, used, buffer.length - used, null);
        if (!bytesRead) break;
        used += bytesRead;
      }
      if (used > max) throw new Error("Global memory file exceeds limit");
      return new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, used));
    } finally { await handle.close(); }
  };
  const readConfig = async () => {
    await ensureRoot();
    const raw = await readSafe(configPath, MAX_CONFIG);
    if (raw === null) return { owner: "quorum", schemaVersion: 1, homeRoot, enabled: false };
    const data = JSON.parse(raw);
    fields(data, ["owner", "schemaVersion", "homeRoot", "enabled"]);
    if (data.owner !== "quorum" || data.schemaVersion !== 1 || data.homeRoot !== homeRoot || typeof data.enabled !== "boolean") throw new Error("Foreign or invalid global memory configuration");
    return data;
  };
  const readStore = async () => {
    await ensureRoot();
    const raw = await readSafe(storePath, MAX_STORE);
    if (raw === null) return { owner: "quorum", schemaVersion: 1, homeRoot, entries: [] };
    const data = JSON.parse(raw);
    fields(data, ["owner", "schemaVersion", "homeRoot", "entries"]);
    if (data.owner !== "quorum" || data.schemaVersion !== 1 || data.homeRoot !== homeRoot || !Array.isArray(data.entries) || data.entries.length > 200) throw new Error("Foreign or invalid global memory store");
    const ids = new Set();
    for (const entry of data.entries) {
      fields(entry, ["id", "source", "record", "digest", "sharedAt", "admissions"]);
      if (!UUID.test(entry.id) || ids.has(entry.id.toLowerCase()) || !Array.isArray(entry.admissions) || entry.admissions.length > 20 ||
          typeof entry.sharedAt !== "string" || !Number.isFinite(Date.parse(entry.sharedAt))) throw new Error("Invalid global entry");
      ids.add(entry.id.toLowerCase());
      fields(entry.source, ["projectRoot", "device", "inode", "recordId"]);
      if (typeof entry.source.projectRoot !== "string" || !path.isAbsolute(entry.source.projectRoot) ||
          !Number.isSafeInteger(entry.source.device) || !Number.isSafeInteger(entry.source.inode) || !UUID.test(entry.source.recordId)) throw new Error("Invalid global source");
      validateRecord(entry.record, true);
      if (entry.record.id.toLowerCase() !== entry.source.recordId.toLowerCase() ||
          createHash("sha256").update(JSON.stringify(entry.record)).digest("hex") !== entry.digest) throw new Error("Global entry digest mismatch");
      const ticketIds = new Set();
      const destinations = new Set();
      for (const ticket of entry.admissions) {
        fields(ticket, ["id", "projectRoot", "device", "inode", "admittedAt"]);
        if (!UUID.test(ticket.id) || typeof ticket.projectRoot !== "string" || !path.isAbsolute(ticket.projectRoot) ||
            !Number.isSafeInteger(ticket.device) || !Number.isSafeInteger(ticket.inode) || typeof ticket.admittedAt !== "string" ||
            !Number.isFinite(Date.parse(ticket.admittedAt)) || ticketIds.has(ticket.id.toLowerCase()) ||
            destinations.has(`${ticket.projectRoot}\0${ticket.device}\0${ticket.inode}`)) throw new Error("Invalid global admission");
        ticketIds.add(ticket.id.toLowerCase());
        destinations.add(`${ticket.projectRoot}\0${ticket.device}\0${ticket.inode}`);
      }
    }
    return data;
  };
  const writeJson = async (target, data, max) => {
    const serialized = JSON.stringify(data) + "\n";
    if (Buffer.byteLength(serialized) > max) throw new Error("Global memory capacity reached");
    const temp = path.join(root, `.write-${randomUUID()}.tmp`);
    let pending = true;
    try {
      const handle = await fs.open(temp, "wx", 0o600);
      try { await handle.writeFile(serialized); await handle.sync(); } finally { await handle.close(); }
      await ensureRoot();
      await file(target);
      await fs.rename(temp, target);
      pending = false;
    } finally {
      if (pending) await fs.unlink(temp).catch((error) => { if (error.code !== "ENOENT") throw error; });
    }
  };
  const locked = async (operation) => {
    await ensureRoot(true);
    let lock;
    try { lock = await fs.open(lockPath, "wx", 0o600); }
    catch (error) { if (error.code === "EEXIST") throw new Error("Global memory busy; retry"); throw error; }
    const lockInfo = await lock.stat();
    try {
      const residual = (await fs.readdir(root)).find((name) => /^\.write-[a-f0-9-]+\.tmp$/i.test(name));
      if (residual) throw new Error(`Incomplete global memory write: ${residual}`);
      return await operation();
    }
    finally {
      await lock.close();
      const current = await file(lockPath);
      if (!current || current.dev !== lockInfo.dev || current.ino !== lockInfo.ino) throw new Error("Global memory lock changed; cleanup refused");
      await ensureRoot();
      await fs.unlink(lockPath);
    }
  };
  const projectIdentity = async (candidate) => {
    const info = await directory(candidate);
    if (!info) throw new Error("Project root unavailable");
    const resolved = await fs.realpath(candidate);
    return identity(info, resolved);
  };
  const sourceState = async (entry) => {
    try {
      const identity = await projectIdentity(entry.source.projectRoot);
      if (!sameIdentity(identity, entry.source)) return "identity-changed";
      const read = await projectOperation({ action: "read", projectRoot: entry.source.projectRoot, id: entry.source.recordId });
      if (!read.records.length) return "record-missing";
      const digest = createHash("sha256").update(JSON.stringify(read.records[0])).digest("hex");
      return digest === entry.digest ? "same-record" : "record-changed";
    } catch (error) {
      return error.code === "ENOENT" || /unavailable/.test(error.message) ? "project-unavailable" : "unverified";
    }
  };
  const requiredOn = async () => {
    const config = await readConfig();
    if (!config.enabled) throw new Error("Global memory is off");
  };
  const entryFor = (store, id) => store.entries.find((entry) => entry.id.toLowerCase() === id.toLowerCase());

  if (input.action === "status") return { scope: "global", homeRoot, enabled: (await readConfig()).enabled };
  if (input.action === "on" || input.action === "off") return locked(async () => {
    const config = await readConfig();
    const enabled = input.action === "on";
    if (config.enabled !== enabled || !await file(configPath)) await writeJson(configPath, { ...config, enabled }, MAX_CONFIG);
    return { scope: "global", homeRoot, enabled };
  });
  if (input.action === "share") {
    const source = await projectIdentity(input.projectRoot);
    await requiredOn();
    const sourceDir = path.join(source.projectRoot, ".quorum", "memory");
    await directory(path.join(source.projectRoot, ".quorum"));
    if (!await directory(sourceDir)) throw new Error("Source memory store unavailable");
    const sourceLockPath = path.join(sourceDir, ".lock");
    let sourceLock;
    try { sourceLock = await fs.open(sourceLockPath, "wx", 0o600); }
    catch (error) { if (error.code === "EEXIST") throw new Error("Source memory busy; retry"); throw error; }
    const sourceLockInfo = await sourceLock.stat();
    try {
      const setting = await projectOperation({ action: "status", projectRoot: source.projectRoot });
      if (!setting.enabled && input.allowProjectOff !== true) throw new Error("Project memory is off; explicit share override required");
      const read = await projectOperation({ action: "read", projectRoot: source.projectRoot, id: input.sourceId });
      if (read.records.length !== 1) throw new Error("Source record unavailable");
      const record = read.records[0];
      const digest = createHash("sha256").update(JSON.stringify(record)).digest("hex");
      return await locked(async () => {
        if (!sameIdentity(await projectIdentity(source.projectRoot), source)) throw new Error("Source identity changed during share");
        await requiredOn();
        const store = await readStore();
        const existing = store.entries.find((entry) => sameIdentity(entry.source, source) && entry.source.recordId.toLowerCase() === input.sourceId.toLowerCase());
        if (existing) {
          if (existing.digest !== digest) throw new Error("Source record changed after sharing; new authorization required");
          return { scope: "global", saved: false, reason: "already-shared", id: existing.id, sourceId: record.id, digest };
        }
        const entry = { id: randomUUID(), source: { ...source, recordId: record.id }, record, digest,
          sharedAt: new Date().toISOString(), admissions: [] };
        store.entries.push(entry);
        if (store.entries.length > 200) throw new Error("Global record capacity reached");
        await writeJson(storePath, store, MAX_STORE);
        return { scope: "global", saved: true, id: entry.id, sourceId: record.id, digest, source: source.projectRoot };
      });
    } finally {
      await sourceLock.close();
      const current = await file(sourceLockPath);
      if (!current || current.dev !== sourceLockInfo.dev || current.ino !== sourceLockInfo.ino) throw new Error("Source memory lock changed; cleanup refused");
      await fs.unlink(sourceLockPath);
    }
  }
  if (input.action === "links") {
    const source = await projectIdentity(input.projectRoot);
    const store = await readStore();
    const ids = store.entries.filter((entry) => sameIdentity(entry.source, source) &&
      (!input.sourceId || entry.source.recordId.toLowerCase() === input.sourceId.toLowerCase())).map((entry) => entry.id);
    return { scope: "global", projectRoot: source.projectRoot, ids };
  }
  if (input.action === "forget" && !await directory(root)) {
    return { scope: "global", forgotten: 0, ids: [], projectRecordsChanged: false };
  }
  if (input.action === "revoke" && !await directory(root)) {
    const destination = await projectIdentity(input.projectRoot);
    return { scope: "global", found: false, changed: false, id: input.id, destination: destination.projectRoot };
  }
  if (input.action === "forget") return locked(async () => {
    const store = await readStore();
    const removed = input.all ? store.entries : store.entries.filter((entry) => entry.id.toLowerCase() === input.id.toLowerCase());
    if (removed.length) {
      store.entries = store.entries.filter((entry) => !removed.includes(entry));
      await writeJson(storePath, store, MAX_STORE);
    }
    return { scope: "global", forgotten: removed.length, ids: removed.map((entry) => entry.id), projectRecordsChanged: false };
  });
  if (input.action !== "revoke") await requiredOn();
  const destination = await projectIdentity(input.projectRoot);
  if (input.action === "preview" || input.action === "read") {
    return locked(async () => {
      await requiredOn();
      if (!sameIdentity(await projectIdentity(destination.projectRoot), destination)) throw new Error("Destination identity changed during read");
      const store = await readStore();
      const entry = entryFor(store, input.id);
      if (!entry) return { scope: "global", found: false, id: input.id, destination: destination.projectRoot, historical: true, validated: false };
      const ticket = entry.admissions.find((admission) => sameIdentity(admission, destination));
      if (input.action === "read" && !ticket) throw new Error("Destination has not admitted this global record");
      return { scope: "global", found: true, historical: true, validated: false, id: entry.id, digest: entry.digest,
        record: entry.record, source: entry.source, sharedAt: entry.sharedAt,
        destination: destination.projectRoot, admissionId: ticket?.id ?? null,
        sourceState: await sourceState(entry) };
    });
  }
  return locked(async () => {
    if (input.action !== "revoke") await requiredOn();
    if (!sameIdentity(await projectIdentity(destination.projectRoot), destination)) throw new Error("Destination identity changed during admission");
    const store = await readStore();
    const entry = entryFor(store, input.id);
    if (!entry) return { scope: "global", found: false, changed: false };
    const existing = entry.admissions.find((admission) => sameIdentity(admission, destination));
    if (input.action === "admit") {
      if (input.previewDigest !== entry.digest) throw new Error("Global record changed since preview");
      if (existing) return { scope: "global", found: true, changed: false, id: entry.id, admissionId: existing.id };
      if (entry.admissions.length >= 20) throw new Error("Global admission capacity reached");
      const ticket = { ...destination, id: randomUUID(), admittedAt: new Date().toISOString() };
      entry.admissions.push(ticket);
      await writeJson(storePath, store, MAX_STORE);
      return { scope: "global", found: true, changed: true, id: entry.id, admissionId: ticket.id, destination: destination.projectRoot };
    }
    if (!existing) return { scope: "global", found: true, changed: false, id: entry.id };
    entry.admissions = entry.admissions.filter((ticket) => ticket !== existing);
    await writeJson(storePath, store, MAX_STORE);
    return { scope: "global", found: true, changed: true, id: entry.id, admissionId: existing.id, globalRecordSurvives: true };
  });
}
