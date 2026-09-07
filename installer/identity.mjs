import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";

export function parseQuorumSkillName(text) {
  const frontmatter = String(text).match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontmatter) return null;
  const name = frontmatter[1].match(/^name:\s*(?:"([^"]+)"|'([^']+)'|([^#\s]+))\s*(?:#.*)?$/m);
  return name ? (name[1] ?? name[2] ?? name[3]) : null;
}

async function readIdentity(directory, io) {
  try {
    const skill = await io.readFile(path.join(directory, "SKILL.md"), "utf8");
    if (parseQuorumSkillName(skill) === "quorum") {
      return { recognized: true, reason: "quorum skill" };
    }
    return { recognized: false, reason: "SKILL.md does not declare name: quorum" };
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") {
      return { recognized: false, reason: "SKILL.md is missing" };
    }
    throw error;
  }
}

export async function inspectQuorumPath(targetPath, io = { lstat, readFile, realpath }) {
  if (path.basename(path.resolve(targetPath)) !== "quorum") {
    return { kind: "invalid", recognized: false, reason: "destination name is not quorum" };
  }

  let stat;
  try {
    stat = await io.lstat(targetPath);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") {
      return { kind: "missing", recognized: false, reason: "not installed" };
    }
    throw error;
  }

  if (stat.isSymbolicLink()) {
    try {
      const resolvedPath = await io.realpath(targetPath);
      const identity = await readIdentity(resolvedPath, io);
      return { kind: "symlink", ...identity, resolvedPath };
    } catch (error) {
      if (error.code === "ENOENT" || error.code === "ENOTDIR") {
        return { kind: "symlink", recognized: false, reason: "symlink target is missing" };
      }
      throw error;
    }
  }
  if (!stat.isDirectory()) {
    return {
      kind: stat.isFile() ? "file" : "other",
      recognized: false,
      reason: "destination is not a directory",
    };
  }

  return { kind: "directory", ...(await readIdentity(targetPath, io)) };
}
