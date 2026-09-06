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
import { createInterface } from "node:readline/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import { formatBanner, runSelector } from "./selector.mjs";
import { allTargetIds, groupDestinations, parseTargetList } from "./targets.mjs";

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
    dryRun: false,
    yes: false,
    help: false,
  };

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
    else if (argument === "--scope") options.scope = nextValue("--scope");
    else if (argument.startsWith("--scope=")) options.scope = argument.slice("--scope=".length);
    else if (argument === "--project-root") options.projectRoot = nextValue("--project-root");
    else if (argument.startsWith("--project-root=")) {
      options.projectRoot = argument.slice("--project-root=".length);
    } else if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--yes") options.yes = true;
    else if (argument === "--help" || argument === "-h") options.help = true;
    else throw new Error(`Unknown option: ${argument}`);
  }

  if (options.all && options.targetIds) {
    throw new Error("--targets and --all cannot be used together");
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

Without --targets or --all, Quorum opens an interactive target selector.

Options:
  --targets LIST       Comma-separated targets: codex, claude, antigravity,
                       vscode, cursor
  --all                Select every supported target
  --scope SCOPE        user (default) or project
  --project-root PATH  Project destination; implies --scope project
  --dry-run            Show planned actions without writing
  --yes                Replace differing installations without prompting
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
  const prompt = createInterface({ input, output });
  try {
    const answer = await prompt.question(`Replace the existing installation at ${destination}? [y/N] `);
    return /^(y|yes)$/i.test(answer.trim());
  } finally {
    prompt.close();
  }
}

export async function installDestination(group, options) {
  const { sourceRoot, dryRun, yes, now = () => new Date(), input, output } = options;
  const files = await payloadFiles(sourceRoot, group.includeOpenAI);
  const existingKind = await pathKind(group.destination);
  const matches = existingKind === "directory"
    ? await destinationMatches(sourceRoot, group.destination, files)
    : false;

  if (matches) return { ...group, status: "skipped" };
  const action = existingKind === "missing" ? "install" : "update";
  if (dryRun) return { ...group, status: "planned", action };

  if (action === "update" && !yes) {
    const confirm = options.confirmReplacement ?? ((destination) => defaultConfirm(destination, { input, output }));
    if (!(await confirm(group.destination))) {
      return {
        ...group,
        status: "failed",
        error: "replacement was not authorized; rerun interactively or pass --yes",
      };
    }
  }

  const parent = path.dirname(group.destination);
  await mkdir(parent, { recursive: true });
  const stage = await mkdtemp(path.join(parent, ".quorum-install-"));
  let backup;

  try {
    await copyPayload(sourceRoot, stage, files);
    if (action === "update") {
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
    return { ...group, status: action === "install" ? "installed" : "updated", backup };
  } catch (error) {
    if ((await pathKind(stage)) !== "missing") await rm(stage, { recursive: true, force: true });
    throw error;
  }
}

export async function installSelected({
  sourceRoot = SOURCE_ROOT,
  targetIds,
  scope,
  homeDir,
  projectRoot,
  dryRun = false,
  yes = false,
  confirmReplacement,
  now,
  input = process.stdin,
  output = process.stdout,
}) {
  const groups = groupDestinations(targetIds, { scope, homeDir, projectRoot });
  const results = [];

  for (const group of groups) {
    try {
      results.push(await installDestination(group, {
        sourceRoot,
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

function formatResult(result) {
  const consumers = result.labels.join(", ");
  if (result.status === "planned") return `PLAN      ${result.action} ${result.destination} (${consumers})`;
  if (result.status === "installed") return `INSTALLED ${result.destination} (${consumers})`;
  if (result.status === "updated") return `UPDATED   ${result.destination} (${consumers})\n           Backup: ${result.backup}`;
  if (result.status === "skipped") return `SKIPPED   ${result.destination} (${consumers}, already current)`;
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
} = {}) {
  try {
    assertSupportedNode(nodeVersion);
    const options = parseArguments(argv);
    const source = await validateSource(sourceRoot);
    output.write(`${formatBanner(source.version)}\n`);
    if (options.help) {
      output.write(helpText());
      return 0;
    }

    let targetIds = options.targetIds;
    if (!targetIds) {
      targetIds = await runSelector({ version: source.version, input, output });
      if (!targetIds) {
        output.write("Installation cancelled.\n");
        return 130;
      }
    }

    const homeDir = os.homedir();
    const projectRoot = options.scope === "project"
      ? path.resolve(options.projectRoot ?? inferProjectRoot(cwd))
      : null;
    const context = {
      sourceRoot,
      targetIds,
      scope: options.scope,
      homeDir,
      projectRoot,
      dryRun: options.dryRun,
      yes: options.yes,
      input,
      output,
    };
    const groups = groupDestinations(targetIds, context);

    output.write(`Scope: ${options.scope}${projectRoot ? ` (${projectRoot})` : ""}\n`);
    output.write(`Targets: ${targetIds.join(", ")}\n`);
    output.write("Destinations:\n");
    groups.forEach((group) => output.write(`  ${group.destination} (${group.labels.join(", ")})\n`));
    output.write("\n");

    const results = await installSelected(context);
    results.forEach((result) => output.write(`${formatResult(result)}\n`));
    await reportLegacyCodex({ targetIds, scope: options.scope, homeDir, env, output });

    return results.some((result) => result.status === "failed") ? 1 : 0;
  } catch (error) {
    errorOutput.write(`Error: ${error.message}\n`);
    return 1;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(await realpath(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  process.exitCode = await main();
}
