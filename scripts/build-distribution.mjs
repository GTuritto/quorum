#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  EXPECTED_PACKAGE_FILES,
  assertExactPackageFiles,
  packFilePaths,
} from "./package-contract.mjs";

const SOURCE_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function runNpm(args, cwd) {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error("Run the distribution builder through npm run dist");
  return execFileSync(process.execPath, [npmCli, ...args], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
}

function runArchive(command, args, cwd) {
  try {
    execFileSync(command, args, { cwd, stdio: ["ignore", "ignore", "inherit"] });
  } catch (error) {
    throw new Error(`${command} failed or is unavailable`, { cause: error });
  }
}

export async function sha256File(filePath) {
  const digest = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) digest.update(chunk);
  return digest.digest("hex");
}

export async function buildDistribution({
  root = SOURCE_ROOT,
  outputDirectory = path.join(root, "dist"),
} = {}) {
  if (path.basename(path.resolve(outputDirectory)) !== "dist") {
    throw new Error("Distribution output directory must be named dist");
  }

  const version = (await readFile(path.join(root, "VERSION"), "utf8")).trim();
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Invalid VERSION: ${version}`);

  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });

  const [packResult] = JSON.parse(runNpm([
    "pack",
    "--json",
    "--pack-destination",
    outputDirectory,
  ], root));
  const packageFiles = packFilePaths(packResult);
  assertExactPackageFiles(packageFiles);

  const tgzPath = path.join(outputDirectory, path.basename(packResult.filename));
  const stage = await mkdtemp(path.join(os.tmpdir(), "quorum-distribution-"));
  const releaseRootName = `quorum-skill-${version}`;
  const releaseRoot = path.join(stage, releaseRootName);
  const zipPath = path.join(outputDirectory, `${releaseRootName}.zip`);

  try {
    runArchive("tar", ["-xzf", tgzPath, "-C", stage], root);
    await rename(path.join(stage, "package"), releaseRoot);
    const zipEntries = EXPECTED_PACKAGE_FILES.map((file) => `${releaseRootName}/${file}`);
    runArchive("zip", ["-X", "-q", zipPath, ...zipEntries], stage);
  } finally {
    await rm(stage, { recursive: true, force: true });
  }

  const checksumPath = path.join(outputDirectory, "SHA256SUMS");
  const checksumText =
    `${await sha256File(tgzPath)}  ${path.basename(tgzPath)}\n` +
    `${await sha256File(zipPath)}  ${path.basename(zipPath)}\n`;
  await writeFile(checksumPath, checksumText);

  return { version, tgzPath, zipPath, checksumPath, packageFiles };
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  const result = await buildDistribution();
  process.stdout.write(`Built ${result.tgzPath}\n`);
  process.stdout.write(`Built ${result.zipPath}\n`);
  process.stdout.write(`Built ${result.checksumPath}\n`);
}
