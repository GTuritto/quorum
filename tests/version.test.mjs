import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test("version declarations agree", async () => {
  const version = (await readFile(path.join(root, "VERSION"), "utf8")).trim();
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const skill = await readFile(path.join(root, "SKILL.md"), "utf8");
  const skillVersion = skill.match(/^\s{2}version:\s*["']?([^"'\n]+)["']?\s*$/m)?.[1];

  assert.match(version, /^\d+\.\d+\.\d+$/);
  assert.equal(packageJson.version, version);
  assert.equal(skillVersion, version);
});
