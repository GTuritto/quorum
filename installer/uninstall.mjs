import { realpath, rm, unlink } from "node:fs/promises";
import path from "node:path";

import { inspectQuorumPath } from "./identity.mjs";

function identitySignature(snapshot) {
  return JSON.stringify({
    kind: snapshot.kind,
    recognized: snapshot.recognized,
    resolvedPath: snapshot.resolvedPath ?? null,
  });
}

async function containsCurrentWorkingDirectory(destination, cwd) {
  const [resolvedDestination, resolvedCwd] = await Promise.all([
    realpath(destination),
    realpath(cwd),
  ]);
  const relative = path.relative(resolvedDestination, resolvedCwd);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

async function planRemoval(group, { cwd, inspect = inspectQuorumPath }) {
  const snapshot = await inspect(group.destination);
  if (snapshot.kind === "missing") {
    return { group, snapshot, result: { ...group, status: "skipped", reason: "missing" } };
  }
  if (!snapshot.recognized || !["directory", "symlink"].includes(snapshot.kind)) {
    return { group, snapshot, result: { ...group, status: "refused", reason: "foreign content" } };
  }
  if (snapshot.kind === "directory" && await containsCurrentWorkingDirectory(group.destination, cwd)) {
    return {
      group,
      snapshot,
      result: {
        ...group,
        status: "refused",
        reason: "destination contains the current working directory",
      },
    };
  }
  return { group, snapshot, result: null };
}

export async function defaultConfirmUninstall(groups, { input, output }) {
  if (!input?.isTTY || !output?.isTTY) return false;
  const { createInterface } = await import("node:readline/promises");
  const prompt = createInterface({ input, output });
  try {
    output.write("Quorum will permanently remove these installations:\n");
    groups.forEach((group) => output.write(`  ${group.destination}\n`));
    const answer = await prompt.question("Continue? [y/N] ");
    return /^(y|yes)$/i.test(answer.trim());
  } finally {
    prompt.close();
  }
}

export async function uninstallDestination(group, {
  cwd = process.cwd(),
  dryRun = false,
  yes = false,
  input = process.stdin,
  output = process.stdout,
  confirmRemoval,
  plannedSnapshot,
  inspect = inspectQuorumPath,
} = {}) {
  let snapshot = plannedSnapshot;
  if (!snapshot) {
    const planned = await planRemoval(group, { cwd, inspect });
    if (planned.result) return planned.result;
    snapshot = planned.snapshot;
  }
  if (dryRun) return { ...group, status: "planned", action: "remove" };
  if (!yes) {
    const confirm = confirmRemoval
      ?? ((selected) => defaultConfirmUninstall(selected, { input, output }));
    if (!(await confirm([group]))) {
      return { ...group, status: "failed", error: "permanent removal was not authorized" };
    }
  }

  const current = await inspect(group.destination);
  if (identitySignature(snapshot) !== identitySignature(current)) {
    return { ...group, status: "refused", reason: "destination changed" };
  }
  if (current.kind === "directory" && await containsCurrentWorkingDirectory(group.destination, cwd)) {
    return {
      ...group,
      status: "refused",
      reason: "destination contains the current working directory",
    };
  }
  if (current.kind === "symlink") await unlink(group.destination);
  else await rm(group.destination, { recursive: true });
  return { ...group, status: "removed" };
}

export async function uninstallSelected(groups, {
  cwd = process.cwd(),
  dryRun = false,
  yes = false,
  input = process.stdin,
  output = process.stdout,
  confirmUninstall,
  inspect = inspectQuorumPath,
} = {}) {
  const planned = [];
  for (const group of groups) {
    try {
      planned.push(await planRemoval(group, { cwd, inspect }));
    } catch (error) {
      planned.push({ group, result: { ...group, status: "failed", error: error.message } });
    }
  }

  if (dryRun) {
    return planned.map(({ group, result }) => result
      ?? ({ ...group, status: "planned", action: "remove" }));
  }

  const eligible = planned.filter(({ result }) => !result);
  if (eligible.length > 0 && !yes) {
    const confirm = confirmUninstall
      ?? ((selected) => defaultConfirmUninstall(selected, { input, output }));
    if (!(await confirm(eligible.map(({ group }) => group)))) {
      return planned.map(({ group, result }) => result
        ?? ({ ...group, status: "failed", error: "permanent removal was not authorized" }));
    }
  }

  const results = [];
  for (const item of planned) {
    if (item.result) {
      results.push(item.result);
      continue;
    }
    try {
      results.push(await uninstallDestination(item.group, {
        cwd,
        yes: true,
        plannedSnapshot: item.snapshot,
        inspect,
      }));
    } catch (error) {
      results.push({ ...item.group, status: "failed", error: error.message });
    }
  }
  return results;
}
