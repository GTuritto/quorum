#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { formatBanner, runSelector } from "./selector.mjs";
import { inspectQuorumPath } from "./identity.mjs";
import {
  detectTools,
  discoverInstallations,
  resolveSkillsDestination,
} from "./detection.mjs";
import {
  allTargetIds,
  groupCustomDestination,
  groupDestinations,
  parseTargetList,
} from "./targets.mjs";
import { compareSemanticVersions, parseSemanticVersion } from "./version.mjs";

const SOURCE_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const COMMON_PAYLOAD = ["SKILL.md", "VERSION", "references"];
const CODEX_PAYLOAD = [path.join("agents", "openai.yaml")];

export function assertSupportedNode(version) {
  const major = Number.parseInt(String(version).split(".")[0], 10);
  if (!Number.isInteger(major) || major < 18) {
    throw new Error(`Quorum requires Node.js 18 or later; found ${version}`);
  }
}

export function parseArguments(argv) {
  const options = {
    targetIds: null,
    all: false,
    scope: null,
    projectRoot: null,
    skillsDir: null,
    operation: "install",
    dryRun: false,
    yes: false,
    help: false,
    version: false,
  };
  let scopeWasProvided = false;
  const operationFlags = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const nextValue = (flag) => {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
      index += 1;
      return value;
    };

    if (argument === "--targets") options.targetIds = parseTargetList(nextValue("--targets"));
    else if (argument.startsWith("--targets=")) {
      options.targetIds = parseTargetList(argument.slice("--targets=".length));
    } else if (argument === "--all") options.all = true;
    else if (argument === "--scope") {
      options.scope = nextValue("--scope");
      scopeWasProvided = true;
    } else if (argument.startsWith("--scope=")) {
      options.scope = argument.slice("--scope=".length);
      scopeWasProvided = true;
    }
    else if (argument === "--project-root") options.projectRoot = nextValue("--project-root");
    else if (argument.startsWith("--project-root=")) {
      options.projectRoot = argument.slice("--project-root=".length);
    } else if (argument === "--skills-dir") options.skillsDir = nextValue("--skills-dir");
    else if (argument.startsWith("--skills-dir=")) {
      options.skillsDir = argument.slice("--skills-dir=".length);
      if (!options.skillsDir) throw new Error("--skills-dir requires a value");
    } else if (argument === "--update" || argument === "--upgrade") {
      operationFlags.push(argument);
      options.operation = "update";
    } else if (argument === "--uninstall") {
      operationFlags.push(argument);
      options.operation = "uninstall";
    } else if (argument === "--version") options.version = true;
    else if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--yes") options.yes = true;
    else if (argument === "--help" || argument === "-h") options.help = true;
    else throw new Error(`Unknown option: ${argument}`);
  }

  if (options.all && options.targetIds) {
    throw new Error("--targets and --all cannot be used together");
  }
  if (operationFlags.length > 1) {
    throw new Error(`${operationFlags.join(" and ")} cannot be used together`);
  }
  if (options.skillsDir && (options.targetIds || options.all || scopeWasProvided || options.projectRoot)) {
    throw new Error("--skills-dir cannot be used with --targets, --all, --scope, or --project-root");
  }
  if ((options.help || options.version) && argv.length !== 1) {
    throw new Error(`${options.help ? "--help" : "--version"} must be used alone`);
  }
  if (options.scope && !["user", "project"].includes(options.scope)) {
    throw new Error("--scope must be user or project");
  }
  if (options.projectRoot && options.scope === "user") {
    throw new Error("--project-root cannot be used with user scope");
  }
  if (options.projectRoot) options.scope = "project";
  options.scope ||= "user";
  if (options.all) options.targetIds = allTargetIds();

  return options;
}

export function helpText() {
  return `Usage:
  quorum-skill [options]
  ./install.sh [options]

Without explicit targets, Quorum updates existing installations or installs for
detected supported tools. It prompts for a parent skills directory when needed.

Options:
  --targets LIST       Comma-separated targets: codex, claude, antigravity,
                       vscode, cursor
  --all                Select every supported target
  --scope SCOPE        user (default) or project
  --project-root PATH  Project destination; implies --scope project
  --skills-dir PATH    Explicit parent skills directory; appends quorum
  --update             Apply the running package to existing installations
  --upgrade            Alias for --update
  --uninstall          Permanently remove recognized Quorum installations
  --version            Print the running package version
  --dry-run            Show planned actions without writing
  --yes                Confirm eligible replacement or permanent removal
  --help, -h           Show this help
`;
}

function parseSkillVersion(skill) {
  return skill.match(/^\s{2}version:\s*["']?([^"'\n]+)["']?\s*$/m)?.[1];
}

async function pathKind(targetPath) {
  try {
    const stat = await lstat(targetPath);
    if (stat.isSymbolicLink()) return "symlink";
    if (stat.isDirectory()) return "directory";
    if (stat.isFile()) return "file";
    return "other";
  } catch (error) {
    if (error.code === "ENOENT") return "missing";
    throw error;
  }
}

async function listFiles(root, relative = "") {
  const current = path.join(root, relative);
  const kind = await pathKind(current);
  if (kind === "file") return [relative];
  if (kind === "symlink") throw new Error(`Symbolic links are not allowed in the payload: ${current}`);
  if (kind !== "directory") throw new Error(`Expected a file or directory: ${current}`);

  const entries = await readdir(current);
  const files = [];
  for (const entry of entries.sort()) {
    const child = path.join(relative, entry);
    files.push(...(await listFiles(root, child)));
  }
  return files;
}

export async function validateSource(sourceRoot = SOURCE_ROOT) {
  const version = (await readFile(path.join(sourceRoot, "VERSION"), "utf8")).trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Invalid VERSION: ${version}`);

  const packageJson = JSON.parse(await readFile(path.join(sourceRoot, "package.json"), "utf8"));
  const skill = await readFile(path.join(sourceRoot, "SKILL.md"), "utf8");
  const skillVersion = parseSkillVersion(skill);
  if (packageJson.version !== version || skillVersion !== version) {
    throw new Error("VERSION, package.json, and SKILL.md versions must match");
  }

  for (const relative of [...COMMON_PAYLOAD, ...CODEX_PAYLOAD]) {
    if ((await pathKind(path.join(sourceRoot, relative))) === "missing") {
      throw new Error(`Missing payload path: ${relative}`);
    }
  }
  return { sourceRoot, version };
}

export async function payloadFiles(sourceRoot, includeOpenAI) {
  const payloadPaths = includeOpenAI ? [...COMMON_PAYLOAD, ...CODEX_PAYLOAD] : COMMON_PAYLOAD;
  const files = [];
  for (const relative of payloadPaths) {
    const absolute = path.join(sourceRoot, relative);
    const kind = await pathKind(absolute);
    if (kind === "directory") files.push(...(await listFiles(sourceRoot, relative)));
    else if (kind === "file") files.push(relative);
    else throw new Error(`Invalid payload path: ${relative}`);
  }
  return [...new Set(files)].sort();
}

async function destinationMatches(sourceRoot, destination, files) {
  if ((await pathKind(destination)) !== "directory") return false;
  let installedFiles;
  try {
    installedFiles = (await listFiles(destination)).sort();
  } catch {
    return false;
  }
  if (installedFiles.length !== files.length) return false;
  if (!files.every((file, index) => file === installedFiles[index])) return false;

  for (const relative of files) {
    const [source, installed] = await Promise.all([
      readFile(path.join(sourceRoot, relative)),
      readFile(path.join(destination, relative)),
    ]);
    if (!source.equals(installed)) return false;
  }
  return true;
}

async function copyPayload(sourceRoot, stage, files) {
  for (const relative of files) {
    const destination = path.join(stage, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(path.join(sourceRoot, relative), destination);
  }
}

function timestamp(now) {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

async function availableBackupPath(destination, now) {
  const base = `${destination}.backup-${timestamp(now)}`;
  let candidate = base;
  let suffix = 1;
  while ((await pathKind(candidate)) !== "missing") {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

async function defaultConfirm(destination, { input, output }) {
  if (!input.isTTY || !output.isTTY) return false;
  const { createInterface } = await import("node:readline/promises");
  const prompt = createInterface({ input, output });
  try {
    const answer = await prompt.question(`Replace the existing installation at ${destination}? [y/N] `);
    return /^(y|yes)$/i.test(answer.trim());
  } finally {
    prompt.close();
  }
}

export async function inspectDestination(group, {
  sourceRoot,
  sourceVersion,
} = {}) {
  const resolvedSourceVersion = sourceVersion
    ?? (await readFile(path.join(sourceRoot, "VERSION"), "utf8")).trim();
  const files = await payloadFiles(sourceRoot, group.includeOpenAI);
  const identity = await inspectQuorumPath(group.destination);
  let installedVersion = null;
  if (identity.recognized) {
    try {
      const value = (await readFile(path.join(group.destination, "VERSION"), "utf8")).trim();
      installedVersion = parseSemanticVersion(value) ? value : null;
    } catch (error) {
      if (!["EACCES", "ENOENT", "ENOTDIR"].includes(error.code)) throw error;
    }
  }
  const contentMatches = identity.kind === "directory" && identity.recognized
    ? await destinationMatches(sourceRoot, group.destination, files)
    : false;
  return {
    kind: identity.kind,
    recognized: identity.recognized,
    identityReason: identity.reason,
    resolvedPath: identity.resolvedPath,
    sourceVersion: resolvedSourceVersion,
    installedVersion,
    contentMatches,
    files,
  };
}

export function classifyDestination(snapshot, operation = "install") {
  if (snapshot.kind === "missing") {
    return operation === "update"
      ? { status: "skipped", reason: "not installed" }
      : { action: "install", requiresConfirmation: false };
  }
  if (snapshot.kind === "symlink") {
    return { status: "refused", reason: "symbolic link" };
  }
  if (snapshot.kind !== "directory" || !snapshot.recognized) {
    return { status: "refused", reason: "foreign content" };
  }
  if (!snapshot.installedVersion) {
    return {
      action: "update",
      requiresConfirmation: true,
      reason: "unknown installed version",
    };
  }

  const comparison = compareSemanticVersions(snapshot.installedVersion, snapshot.sourceVersion);
  if (comparison > 0) {
    return {
      status: "refused",
      reason: `installed version ${snapshot.installedVersion} is newer than source ${snapshot.sourceVersion}`,
    };
  }
  if (comparison === 0 && snapshot.contentMatches) {
    return { status: "skipped", reason: "already current" };
  }
  return {
    action: "update",
    requiresConfirmation: true,
    reason: comparison < 0 ? "older version" : "modified content",
  };
}

function snapshotSignature(snapshot) {
  return JSON.stringify({
    kind: snapshot.kind,
    recognized: snapshot.recognized,
    resolvedPath: snapshot.resolvedPath ?? null,
    installedVersion: snapshot.installedVersion,
    contentMatches: snapshot.contentMatches,
  });
}

export async function installDestination(group, options) {
  const {
    sourceRoot,
    sourceVersion,
    operation = "install",
    dryRun,
    yes,
    now = () => new Date(),
    input,
    output,
  } = options;
  const inspect = options.inspectDestination ?? inspectDestination;
  const snapshot = await inspect(group, { sourceRoot, sourceVersion });
  const policy = classifyDestination(snapshot, operation);
  const resultContext = {
    ...group,
    sourceVersion: snapshot.sourceVersion,
    installedVersion: snapshot.installedVersion,
  };
  if (policy.status) return { ...resultContext, ...policy };
  if (dryRun) return { ...resultContext, status: "planned", action: policy.action, reason: policy.reason };

  if (policy.requiresConfirmation && !yes) {
    const confirm = options.confirmReplacement ?? ((destination) => defaultConfirm(destination, { input, output }));
    if (!(await confirm(group.destination))) {
      return {
        ...resultContext,
        status: "failed",
        error: "replacement was not authorized; rerun interactively or pass --yes",
      };
    }
  }

  const confirmedSnapshot = await inspect(group, { sourceRoot, sourceVersion: snapshot.sourceVersion });
  if (snapshotSignature(snapshot) !== snapshotSignature(confirmedSnapshot)) {
    return { ...resultContext, status: "refused", reason: "destination changed" };
  }

  const parent = path.dirname(group.destination);
  await mkdir(parent, { recursive: true });
  const stage = await mkdtemp(path.join(parent, ".quorum-install-"));
  let backup;

  try {
    await copyPayload(sourceRoot, stage, snapshot.files);
    const placementSnapshot = await inspect(group, {
      sourceRoot,
      sourceVersion: snapshot.sourceVersion,
    });
    if (snapshotSignature(snapshot) !== snapshotSignature(placementSnapshot)) {
      await rm(stage, { recursive: true, force: true });
      return { ...resultContext, status: "refused", reason: "destination changed" };
    }
    if (policy.action === "update") {
      backup = await availableBackupPath(group.destination, now());
      await rename(group.destination, backup);
    }
    try {
      await rename(stage, group.destination);
    } catch (error) {
      if (backup && (await pathKind(group.destination)) === "missing") {
        await rename(backup, group.destination);
      }
      throw error;
    }
    return {
      ...resultContext,
      status: policy.action === "install" ? "installed" : "updated",
      backup,
    };
  } catch (error) {
    if ((await pathKind(stage)) !== "missing") await rm(stage, { recursive: true, force: true });
    throw error;
  }
}

export async function installSelected({
  sourceRoot = SOURCE_ROOT,
  targetIds,
  groups: selectedGroups,
  scope,
  homeDir,
  projectRoot,
  dryRun = false,
  yes = false,
  confirmReplacement,
  now,
  input = process.stdin,
  output = process.stdout,
  operation = "install",
  sourceVersion,
}) {
  const groups = selectedGroups ?? groupDestinations(targetIds, { scope, homeDir, projectRoot });
  const results = [];

  for (const group of groups) {
    try {
      results.push(await installDestination(group, {
        sourceRoot,
        sourceVersion,
        operation,
        dryRun,
        yes,
        confirmReplacement,
        now,
        input,
        output,
      }));
    } catch (error) {
      results.push({ ...group, status: "failed", error: error.message });
    }
  }
  return results;
}

export function inferProjectRoot(cwd) {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return cwd;
  }
}

function uniqueTargetIds(groups) {
  return [...new Set(groups.flatMap((group) => group.targetIds))];
}

function deduplicateGroups(groups) {
  const byDestination = new Map();
  for (const group of groups) {
    const existing = byDestination.get(group.destination);
    if (!existing) {
      byDestination.set(group.destination, { ...group });
      continue;
    }
    existing.targetIds = [...new Set([...existing.targetIds, ...group.targetIds])];
    existing.labels = [...new Set([...existing.labels, ...group.labels])];
    existing.includeOpenAI ||= group.includeOpenAI;
  }
  return [...byDestination.values()];
}

export async function promptForSkillsDirectory({ input, output }) {
  if (!input?.isTTY || !output?.isTTY) return null;
  const { createInterface } = await import("node:readline/promises");
  const prompt = createInterface({ input, output });
  try {
    const answer = await prompt.question(
      "No supported tools detected.\nEnter a parent skills directory, or press Ctrl+C to cancel: ",
    );
    return answer.trim() || null;
  } catch (error) {
    if (error.code === "ERR_USE_AFTER_CLOSE" || error.name === "AbortError") return null;
    throw error;
  } finally {
    prompt.close();
  }
}

export async function resolveRunPlan(options, {
  scope = options.scope,
  homeDir,
  projectRoot,
  cwd = process.cwd(),
  env = process.env,
  interactive = true,
  sourceVersion,
  discover = discoverInstallations,
  detect = detectTools,
  selectTargets,
  promptForSkillsDir,
} = {}) {
  if (options.skillsDir) {
    const destination = resolveSkillsDestination(options.skillsDir, { cwd, homeDir });
    return {
      operation: options.operation,
      groups: groupCustomDestination(destination),
      targetIds: ["custom"],
      evidence: [],
      legacy: [],
      foreign: [],
      automatic: false,
      allowMissingInstall: options.operation === "install",
    };
  }

  if (options.targetIds) {
    return {
      operation: options.operation,
      groups: groupDestinations(options.targetIds, { scope, homeDir, projectRoot }),
      targetIds: options.targetIds,
      evidence: [],
      legacy: [],
      foreign: [],
      automatic: false,
      allowMissingInstall: options.operation === "install",
    };
  }

  const discovered = await discover({
    targetIds: allTargetIds(),
    scope,
    homeDir,
    projectRoot,
    env,
  });

  if (options.operation === "uninstall") {
    const groups = deduplicateGroups([
      ...discovered.managed,
      ...discovered.legacy,
      ...discovered.foreign,
    ]);
    return {
      operation: "uninstall",
      groups,
      targetIds: uniqueTargetIds(groups),
      evidence: [],
      legacy: discovered.legacy,
      foreign: discovered.foreign,
      automatic: true,
      allowMissingInstall: false,
    };
  }

  if (options.operation === "update" && discovered.managed.length > 0) {
    return {
      operation: "update",
      groups: discovered.managed,
      targetIds: uniqueTargetIds(discovered.managed),
      evidence: [],
      legacy: discovered.legacy,
      foreign: discovered.foreign,
      automatic: true,
      allowMissingInstall: false,
    };
  }

  if (options.operation === "install" && discovered.managed.length > 0) {
    if (!selectTargets) throw new Error("Interactive target selection is unavailable");
    const targetIds = await selectTargets({ version: sourceVersion });
    if (!targetIds) return { cancelled: true, operation: "install", groups: [], targetIds: [] };
    return {
      operation: "install",
      groups: groupDestinations(targetIds, { scope, homeDir, projectRoot }),
      targetIds,
      evidence: [],
      legacy: discovered.legacy,
      foreign: discovered.foreign,
      automatic: false,
      allowMissingInstall: true,
    };
  }

  const detected = await detect({ env, homeDir });
  const targetIds = [...new Set([
    ...(discovered.legacy.length > 0 ? ["codex"] : []),
    ...detected.map(({ targetId }) => targetId),
  ])];
  if (targetIds.length > 0) {
    return {
      operation: "install",
      groups: groupDestinations(targetIds, { scope, homeDir, projectRoot }),
      targetIds,
      evidence: detected,
      legacy: discovered.legacy,
      foreign: discovered.foreign,
      automatic: true,
      allowMissingInstall: true,
    };
  }

  if (!interactive) {
    throw new Error("No supported tools detected; use --skills-dir, --targets, or --all");
  }
  if (!promptForSkillsDir) throw new Error("Custom skills directory prompt is unavailable");
  const value = await promptForSkillsDir();
  if (!value) return { cancelled: true, operation: "install", groups: [], targetIds: [] };
  const destination = resolveSkillsDestination(value, { cwd, homeDir });
  return {
    operation: "install",
    groups: groupCustomDestination(destination),
    targetIds: ["custom"],
    evidence: [],
    legacy: discovered.legacy,
    foreign: discovered.foreign,
    automatic: true,
    allowMissingInstall: true,
  };
}

function formatResult(result) {
  const consumers = result.labels.join(", ");
  if (result.status === "planned") return `PLAN      ${result.action} ${result.destination} (${consumers})`;
  if (result.status === "installed") return `INSTALLED ${result.destination} (${consumers})`;
  if (result.status === "updated") {
    const versions = `installed ${result.installedVersion ?? "unknown"}, source ${result.sourceVersion}`;
    return `UPDATED   ${result.destination} (${consumers}; ${versions})\n           Backup: ${result.backup}`;
  }
  if (result.status === "skipped") return `SKIPPED   ${result.destination} (${consumers}; ${result.reason})`;
  if (result.status === "refused") return `REFUSED   ${result.destination} (${consumers}): ${result.reason}`;
  return `FAILED    ${result.destination} (${consumers}): ${result.error}`;
}

async function reportLegacyCodex({ targetIds, scope, homeDir, env, output }) {
  if (scope !== "user" || !targetIds.includes("codex")) return;
  const codexHome = env.CODEX_HOME ? path.resolve(env.CODEX_HOME) : path.join(homeDir, ".codex");
  const legacy = path.join(codexHome, "skills", "quorum");
  if ((await pathKind(legacy)) !== "missing") {
    output.write(`\nLegacy Codex installation detected: ${legacy}\n`);
    output.write("It was not changed. Verify the new installation before removing it manually.\n");
  }
}

export async function main({
  argv = process.argv.slice(2),
  cwd = process.cwd(),
  env = process.env,
  input = process.stdin,
  output = process.stdout,
  errorOutput = process.stderr,
  sourceRoot = SOURCE_ROOT,
  nodeVersion = process.versions.node,
  homeDir = os.homedir(),
} = {}) {
  try {
    assertSupportedNode(nodeVersion);
    const options = parseArguments(argv);
    if (options.version) {
      const version = (await readFile(path.join(sourceRoot, "VERSION"), "utf8")).trim();
      if (!parseSemanticVersion(version)) throw new Error(`Invalid VERSION: ${version}`);
      output.write(`quorum-skill ${version}\n`);
      return 0;
    }
    const source = await validateSource(sourceRoot);
    output.write(`${formatBanner(source.version)}\n`);
    if (options.help) {
      output.write(helpText());
      return 0;
    }

    const projectRoot = options.scope === "project"
      ? path.resolve(options.projectRoot ?? inferProjectRoot(cwd))
      : null;
    const plan = await resolveRunPlan(options, {
      scope: options.scope,
      homeDir,
      projectRoot,
      cwd,
      env,
      interactive: Boolean(input?.isTTY && output?.isTTY),
      sourceVersion: source.version,
      selectTargets: (selectorOptions) => runSelector({ ...selectorOptions, input, output }),
      promptForSkillsDir: () => promptForSkillsDirectory({ input, output }),
    });
    if (plan.cancelled) {
      output.write("Installation cancelled.\n");
      return 130;
    }

    const context = {
      sourceRoot,
      sourceVersion: source.version,
      targetIds: plan.targetIds,
      groups: plan.groups,
      scope: options.scope,
      homeDir,
      projectRoot,
      operation: plan.operation,
      allowMissingInstall: plan.allowMissingInstall,
      dryRun: options.dryRun,
      yes: options.yes,
      input,
      output,
    };
    output.write(`Scope: ${options.scope}${projectRoot ? ` (${projectRoot})` : ""}\n`);
    output.write(`Targets: ${plan.targetIds.join(", ") || "none"}\n`);
    plan.evidence.forEach(({ targetId, evidence }) => {
      output.write(`Detected ${targetId} (${evidence})\n`);
    });
    output.write("Destinations:\n");
    plan.groups.forEach((group) => output.write(`  ${group.destination} (${group.labels.join(", ")})\n`));
    output.write("\n");

    const results = await installSelected(context);
    results.forEach((result) => output.write(`${formatResult(result)}\n`));
    await reportLegacyCodex({ targetIds: plan.targetIds, scope: options.scope, homeDir, env, output });

    return results.some((result) => ["failed", "refused"].includes(result.status)) ? 1 : 0;
  } catch (error) {
    errorOutput.write(`Error: ${error.message}\n`);
    return 1;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(await realpath(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  process.exitCode = await main();
}
