import { access, lstat, readdir } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

import { inspectQuorumPath } from "./identity.mjs";
import { TARGETS, allTargetIds, groupDestinations } from "./targets.mjs";

async function defaultPathExists(candidate) {
  try {
    await access(candidate, constants.X_OK);
    return true;
  } catch (error) {
    if (["EACCES", "ENOENT", "ENOTDIR"].includes(error.code)) return false;
    throw error;
  }
}

async function defaultPathIsDirectory(candidate) {
  try {
    return (await lstat(candidate)).isDirectory();
  } catch (error) {
    if (["EACCES", "ENOENT", "ENOTDIR"].includes(error.code)) return false;
    throw error;
  }
}

function defaultReadDirectory(directory) {
  return readdir(directory, { withFileTypes: true });
}

function expandHome(candidate, homeDir, pathApi) {
  if (candidate === "~") return homeDir;
  if (/^~[\\/]/.test(candidate)) return pathApi.join(homeDir, candidate.slice(2));
  return candidate;
}

function executableCandidates(command, { env, platform, pathApi }) {
  const pathEntries = String(env.PATH ?? "")
    .split(pathApi.delimiter)
    .filter(Boolean);
  if (platform !== "win32") {
    return pathEntries.map((entry) => pathApi.join(entry, command));
  }
  const extensions = String(env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD")
    .split(";")
    .filter(Boolean);
  return pathEntries.flatMap((entry) =>
    extensions.map((extension) => pathApi.join(entry, `${command}${extension}`)));
}

async function findCommand(target, context) {
  for (const command of target.commands) {
    for (const candidate of executableCandidates(command, context)) {
      if (await context.pathExists(candidate)) return `command: ${command}`;
    }
  }
  return null;
}

async function findMacApplication(target, context) {
  if (context.platform !== "darwin") return null;
  for (const marker of target.macApplications) {
    const candidate = expandHome(marker, context.homeDir, context.pathApi);
    if (await context.pathIsDirectory(candidate)) return `application: ${candidate}`;
  }
  return null;
}

async function findExtension(target, context) {
  for (const marker of target.extensionMarkers) {
    const root = context.pathApi.join(context.homeDir, ...marker.root);
    let entries;
    try {
      entries = await context.readDirectory(root);
    } catch (error) {
      if (["EACCES", "ENOENT", "ENOTDIR"].includes(error.code)) continue;
      throw error;
    }
    const names = entries
      .filter((entry) => typeof entry === "string" || entry.isDirectory())
      .map((entry) => typeof entry === "string" ? entry : entry.name);
    if (names.some((name) => name.startsWith(marker.prefix))) {
      return `extension: ${marker.prefix.slice(0, -1)}`;
    }
  }
  return null;
}

export async function detectTools({
  env = process.env,
  homeDir,
  platform = process.platform,
  pathApi = platform === "win32" ? path.win32 : path.posix,
  pathExists = defaultPathExists,
  pathIsDirectory,
  readDirectory = defaultReadDirectory,
} = {}) {
  const directoryProbe = pathIsDirectory
    ?? (pathExists === defaultPathExists ? defaultPathIsDirectory : pathExists);
  const context = {
    env,
    homeDir,
    platform,
    pathApi,
    pathExists,
    pathIsDirectory: directoryProbe,
    readDirectory,
  };
  const detected = [];
  for (const target of TARGETS) {
    const evidence = await findCommand(target, context)
      ?? await findMacApplication(target, context)
      ?? await findExtension(target, context);
    if (evidence) detected.push({ targetId: target.id, evidence });
  }
  return detected;
}

export function legacyCodexPath({ homeDir, env = {} }) {
  const codexHome = env.CODEX_HOME ? path.resolve(env.CODEX_HOME) : path.join(homeDir, ".codex");
  return path.join(codexHome, "skills", "quorum");
}

export async function discoverInstallations({
  targetIds = allTargetIds(),
  scope,
  homeDir,
  projectRoot,
  env = process.env,
  inspectPath = inspectQuorumPath,
} = {}) {
  const managed = [];
  const foreign = [];
  const groups = groupDestinations(targetIds, { scope, homeDir, projectRoot });
  for (const group of groups) {
    const identity = await inspectPath(group.destination);
    if (identity.recognized) managed.push({ ...group, identity });
    else if (identity.kind !== "missing") foreign.push({ ...group, identity });
  }

  const legacy = [];
  if (scope === "user" && targetIds.includes("codex")) {
    const destination = legacyCodexPath({ homeDir, env });
    const identity = await inspectPath(destination);
    if (identity.recognized) {
      legacy.push({
        destination,
        targetIds: ["codex"],
        labels: ["Legacy Codex"],
        includeOpenAI: true,
        legacy: true,
        identity,
      });
    } else if (identity.kind !== "missing") {
      foreign.push({
        destination,
        targetIds: ["codex"],
        labels: ["Legacy Codex"],
        includeOpenAI: true,
        legacy: true,
        identity,
      });
    }
  }
  return { managed, legacy, foreign };
}

export function resolveSkillsDestination(value, {
  cwd = process.cwd(),
  homeDir,
  pathApi = path,
} = {}) {
  const raw = String(value ?? "").trim();
  if (!raw) throw new Error("--skills-dir cannot be empty");
  if (raw.startsWith("~") && raw !== "~" && !/^~[\\/]/.test(raw)) {
    throw new Error("Unsupported home expansion; use ~ or an absolute path");
  }
  const expanded = expandHome(raw, homeDir, pathApi);
  const parent = pathApi.resolve(cwd, expanded);
  if (parent === pathApi.parse(parent).root) {
    throw new Error("--skills-dir cannot be a filesystem root");
  }
  return pathApi.join(parent, "quorum");
}
