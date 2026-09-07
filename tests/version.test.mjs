import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test("version and public package declarations agree", async () => {
  const version = (await readFile(path.join(root, "VERSION"), "utf8")).trim();
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const skill = await readFile(path.join(root, "SKILL.md"), "utf8");
  const skillVersion = skill.match(/^\s{2}version:\s*["']?([^"'\n]+)["']?\s*$/m)?.[1];

  assert.equal(version, "0.1.59");
  assert.equal(packageJson.name, "quorum-skill");
  assert.equal(packageJson.version, version);
  assert.equal(skillVersion, version);
  assert.equal(packageJson.private, undefined);
  assert.deepEqual(packageJson.bin, {
    "quorum-skill": "installer/install.mjs",
  });
  assert.deepEqual(packageJson.publishConfig, { access: "public" });
  assert.equal(packageJson.engines.node, ">=18");
  assert.equal(packageJson.author.name, "Giuseppe Turitto");
  assert.equal(packageJson.author.email, "giuseppe@turitto.com");
  assert.equal(packageJson.dependencies, undefined);
  assert.equal(packageJson.optionalDependencies, undefined);

  for (const lifecycle of ["preinstall", "install", "postinstall", "prepare"]) {
    assert.equal(packageJson.scripts[lifecycle], undefined);
  }
});
