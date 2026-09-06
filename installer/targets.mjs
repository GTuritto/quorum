import path from "node:path";

export const TARGETS = Object.freeze([
  Object.freeze({
    id: "codex",
    label: "Codex",
    aliases: Object.freeze(["codex"]),
    userPath: Object.freeze([".agents", "skills", "quorum"]),
    projectPath: Object.freeze([".agents", "skills", "quorum"]),
    includeOpenAI: true,
  }),
  Object.freeze({
    id: "claude",
    label: "Claude Code",
    aliases: Object.freeze(["claude", "claude-code", "claudecode"]),
    userPath: Object.freeze([".claude", "skills", "quorum"]),
    projectPath: Object.freeze([".claude", "skills", "quorum"]),
    includeOpenAI: false,
  }),
  Object.freeze({
    id: "antigravity",
    label: "Antigravity",
    aliases: Object.freeze(["antigravity", "anti-gravity"]),
    userPath: Object.freeze([".gemini", "config", "skills", "quorum"]),
    projectPath: Object.freeze([".agents", "skills", "quorum"]),
    includeOpenAI: false,
  }),
  Object.freeze({
    id: "vscode",
    label: "VS Code",
    aliases: Object.freeze(["vscode", "vs-code", "visual-studio-code"]),
    userPath: Object.freeze([".copilot", "skills", "quorum"]),
    projectPath: Object.freeze([".github", "skills", "quorum"]),
    includeOpenAI: false,
  }),
  Object.freeze({
    id: "cursor",
    label: "Cursor",
    aliases: Object.freeze(["cursor"]),
    userPath: Object.freeze([".cursor", "skills", "quorum"]),
    projectPath: Object.freeze([".cursor", "skills", "quorum"]),
    includeOpenAI: false,
  }),
]);

const TARGET_BY_ALIAS = new Map(
  TARGETS.flatMap((target) => target.aliases.map((alias) => [alias, target])),
);

export function allTargetIds() {
  return TARGETS.map((target) => target.id);
}

export function parseTargetList(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("--targets requires at least one target");
  }

  const selected = [];
  const seen = new Set();
  for (const token of value.split(",")) {
    const alias = token.trim().toLowerCase();
    const target = TARGET_BY_ALIAS.get(alias);
    if (!target) {
      throw new Error(`Unknown target: ${token.trim() || "(empty)"}`);
    }
    if (!seen.has(target.id)) {
      selected.push(target.id);
      seen.add(target.id);
    }
  }
  return selected;
}

export function getTarget(id) {
  const target = TARGETS.find((candidate) => candidate.id === id);
  if (!target) {
    throw new Error(`Unknown target: ${id}`);
  }
  return target;
}

export function resolveDestination(targetId, { scope, homeDir, projectRoot }) {
  const target = getTarget(targetId);
  if (scope === "user") {
    if (!homeDir) throw new Error("A home directory is required for user scope");
    return path.resolve(homeDir, ...target.userPath);
  }
  if (scope === "project") {
    if (!projectRoot) throw new Error("A project root is required for project scope");
    return path.resolve(projectRoot, ...target.projectPath);
  }
  throw new Error(`Unknown scope: ${scope}`);
}

export function groupDestinations(targetIds, context) {
  const groups = new Map();

  for (const targetId of targetIds) {
    const target = getTarget(targetId);
    const destination = resolveDestination(targetId, context);
    const existing = groups.get(destination);
    if (existing) {
      existing.targetIds.push(target.id);
      existing.labels.push(target.label);
      existing.includeOpenAI ||= target.includeOpenAI;
      continue;
    }
    groups.set(destination, {
      destination,
      targetIds: [target.id],
      labels: [target.label],
      includeOpenAI: target.includeOpenAI,
    });
  }

  return [...groups.values()];
}
