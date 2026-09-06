import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { EXPECTED_PACKAGE_FILES } from "../scripts/package-contract.mjs";
import { buildDistribution, sha256File } from "../scripts/build-distribution.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

async function withTempDirectory(callback) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "quorum-dist-test-"));
  try {
    return await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function runNpm(args, options = {}) {
  const npmCli = process.env.npm_execpath;
  assert.ok(npmCli, "npm_execpath must be available under npm test");
  return execFileSync(process.execPath, [npmCli, ...args], {
    encoding: "utf8",
    ...options,
  });
}

test("builds matching tgz, zip, and SHA256SUMS", async () => {
  await withTempDirectory(async (temporaryRoot) => {
    const outputDirectory = path.join(temporaryRoot, "dist");
    const result = await buildDistribution({ root, outputDirectory });

    assert.equal(result.version, "0.1.58");
    assert.deepEqual(result.packageFiles, EXPECTED_PACKAGE_FILES);

    const tarEntries = execFileSync("tar", ["-tzf", result.tgzPath], {
      encoding: "utf8",
    }).trim().split("\n").filter((entry) => !entry.endsWith("/")).sort();
    assert.deepEqual(
      tarEntries,
      EXPECTED_PACKAGE_FILES.map((file) => `package/${file}`).sort(),
    );

    const zipRoot = `quorum-skill-${result.version}`;
    const zipEntries = execFileSync("unzip", ["-Z1", result.zipPath], {
      encoding: "utf8",
    }).trim().split("\n").filter((entry) => !entry.endsWith("/")).sort();
    assert.deepEqual(
      zipEntries,
      EXPECTED_PACKAGE_FILES.map((file) => `${zipRoot}/${file}`).sort(),
    );

    const checksumText = await readFile(result.checksumPath, "utf8");
    assert.equal(
      checksumText,
      `${await sha256File(result.tgzPath)}  ${path.basename(result.tgzPath)}\n` +
        `${await sha256File(result.zipPath)}  ${path.basename(result.zipPath)}\n`,
    );
  });
});

test("rejects mismatched versions before clearing distribution output", async () => {
  await withTempDirectory(async (temporaryRoot) => {
    const fixtureRoot = path.join(temporaryRoot, "fixture");
    const outputDirectory = path.join(temporaryRoot, "dist");
    const sentinelPath = path.join(outputDirectory, "sentinel");
    await mkdir(fixtureRoot);
    await mkdir(outputDirectory);
    await Promise.all([
      writeFile(path.join(fixtureRoot, "VERSION"), "0.1.58\n"),
      writeFile(path.join(fixtureRoot, "package.json"), '{"version":"0.1.59"}\n'),
      writeFile(path.join(fixtureRoot, "SKILL.md"), '---\n  version: "0.1.58"\n---\n'),
      writeFile(sentinelPath, "preserve me"),
    ]);

    await assert.rejects(
      buildDistribution({ root: fixtureRoot, outputDirectory }),
      /VERSION, package\.json, and SKILL\.md versions must match/,
    );
    assert.equal(await readFile(sentinelPath, "utf8"), "preserve me");
  });
});

test("runs help and dry-run from the packed npm executable", async () => {
  await withTempDirectory(async (temporaryRoot) => {
    const result = await buildDistribution({
      root,
      outputDirectory: path.join(temporaryRoot, "dist"),
    });
    const workDirectory = path.join(temporaryRoot, "work");
    const projectRoot = path.join(temporaryRoot, "project");
    await mkdir(workDirectory);
    await mkdir(projectRoot);
    const environment = {
      ...process.env,
      npm_config_cache: path.join(temporaryRoot, "npm-cache"),
    };

    const help = runNpm([
      "exec",
      "--yes",
      `--package=${result.tgzPath}`,
      "--",
      "quorum-skill",
      "--help",
    ], { cwd: workDirectory, env: environment });
    assert.match(help, /QUORUM v0\.1\.58/);
    assert.match(help, /quorum-skill \[options\]/);

    const dryRun = runNpm([
      "exec",
      "--yes",
      `--package=${result.tgzPath}`,
      "--",
      "quorum-skill",
      "--targets",
      "codex,cursor",
      "--scope",
      "project",
      "--project-root",
      projectRoot,
      "--dry-run",
    ], { cwd: workDirectory, env: environment });
    assert.match(dryRun, /Targets: codex, cursor/);
    await assert.rejects(access(path.join(projectRoot, ".agents", "skills", "quorum")));
    await assert.rejects(access(path.join(projectRoot, ".cursor", "skills", "quorum")));
  });
});
