# Quorum npm and Standalone Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish Quorum as `quorum-skill@0.1.58` for one-command `npx` execution and provide matching compact, checksum-protected GitHub release archives.

**Architecture:** npm invokes the existing `installer/install.mjs` through one package `bin` entry. A separate dependency-free distribution builder validates an exact package-file contract, creates the npm tarball once, derives the ZIP from that tarball, and writes SHA-256 checksums. The release flow publishes the verified tarball to npm and the same artifacts to a draft GitHub release before making the release public.

**Tech Stack:** Node.js 18+, ECMAScript modules, Node's built-in test runner, npm CLI, POSIX `tar` and `zip` for maintainer builds, PowerShell smoke tests, GitHub CLI.

**Spec:** `docs/superpowers/specs/2026-09-06-npx-distribution-design.md`

## Global Constraints

- The public npm package name is exactly `quorum-skill`.
- The release version is exactly `0.1.58`; `v0.1.57` remains immutable.
- The installed skill name remains `quorum`.
- Node.js 18 is the minimum runtime.
- Runtime and package code have no third-party dependencies.
- The npm package has no `preinstall`, `install`, `postinstall`, or `prepare` script.
- `installer/install.mjs` remains the only installation engine.
- Existing target paths, selector behavior, flags, backups, and legacy Codex detection remain unchanged.
- npm and GitHub receive the same verified `.tgz` bytes.
- The first `0.1.58` publication establishes npm ownership through maintainer
  authentication and does not claim trusted-publishing provenance.
- After `0.1.58` exists, npm trusts only GitHub repository `GTuritto/quorum` and
  workflow filename `publish.yml` for direct OIDC publishing.
- The trusted workflow uses a GitHub-hosted runner, Node.js 24, npm `11.15.0+`,
  `contents: read`, and `id-token: write`.
- The trusted workflow stores no npm token; npm adds provenance automatically
  to subsequent trusted publishes.
- Do not modify an installed Quorum copy during build or publication.
- Stop before npm publication when authentication, two-factor authentication, package-name ownership, tests, package contents, or integrity checks are unresolved.

## File map

**Modify:**

- `VERSION`: release source of truth becomes `0.1.58`.
- `SKILL.md`: installed skill metadata becomes `0.1.58`.
- `package.json`: public npm identity, executable, explicit file allowlist, author, and distribution scripts.
- `installer/install.mjs`: Node.js version guard and package-neutral help text.
- `tests/version.test.mjs`: release and public package-contract assertions.
- `tests/install.test.mjs`: Node.js guard and npm-friendly help behavior.
- `tests/test-install.sh`: release-banner expectations.
- `.gitignore`: ignore repository-local `dist/` artifacts.
- `README.md`: make `npx quorum-skill` primary and document compact archives.
- `CHANGELOG.md`: add the `0.1.58` release.
- `CONTRIBUTING.md`: document package and distribution checks.
- `SECURITY.md`: cover npm and release-asset integrity.
- `PUBLISHING.md`: document first publication, trusted publishing, provenance,
  and future release steps.

**Create:**

- `scripts/package-contract.mjs`: canonical packed-file list and exact comparison helpers.
- `scripts/build-distribution.mjs`: build `.tgz`, derive ZIP, and produce `SHA256SUMS`.
- `tests/package-contract.test.mjs`: exact `npm pack` contents and mismatch tests.
- `tests/distribution.test.mjs`: archive, checksum, command-shim, and packed dry-run tests.
- `.github/workflows/publish.yml`: manually dispatched OIDC npm publication for
  releases after `0.1.58`.
- `tests/workflow.test.mjs`: trusted-publisher workflow security invariants.

**Generated and ignored:**

- `dist/quorum-skill-0.1.58.tgz`
- `dist/quorum-skill-0.1.58.zip`
- `dist/SHA256SUMS`

---

### Task 1: Public package identity and executable

**Files:**

- Modify: `VERSION`
- Modify: `SKILL.md:1-7`
- Modify: `package.json`
- Modify: `installer/install.mjs:26-92`
- Modify: `installer/install.mjs:328-392`
- Modify: `tests/version.test.mjs`
- Modify: `tests/install.test.mjs`
- Modify: `tests/test-install.sh`

**Interfaces:**

- Consumes: existing `main(options): Promise<number>` and `validateSource(sourceRoot)` from `installer/install.mjs`.
- Produces: npm executable `quorum-skill`, `assertSupportedNode(version): void`, and `main({ nodeVersion, ...options }): Promise<number>`.
- Produces: aligned `0.1.58` values in `VERSION`, `SKILL.md`, and `package.json`.

- [ ] **Step 1: Extend the version and package-contract test**

Replace the existing assertion body in `tests/version.test.mjs` with explicit release and npm metadata checks:

```js
test("version and public package declarations agree", async () => {
  const version = (await readFile(path.join(root, "VERSION"), "utf8")).trim();
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const skill = await readFile(path.join(root, "SKILL.md"), "utf8");
  const skillVersion = skill.match(/^\s{2}version:\s*["']?([^"'\n]+)["']?\s*$/m)?.[1];

  assert.equal(version, "0.1.58");
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

  for (const lifecycle of ["preinstall", "install", "postinstall", "prepare"]) {
    assert.equal(packageJson.scripts[lifecycle], undefined);
  }
});
```

- [ ] **Step 2: Add failing Node.js guard and help tests**

Import `assertSupportedNode` and `main` in `tests/install.test.mjs`, then add:

```js
function createSink() {
  let value = "";
  return {
    write(chunk) {
      value += chunk;
    },
    text() {
      return value;
    },
  };
}

test("rejects Node.js versions older than 18", async () => {
  assert.throws(() => assertSupportedNode("17.9.1"), /requires Node\.js 18 or later/);
  assert.doesNotThrow(() => assertSupportedNode("18.0.0"));
  assert.doesNotThrow(() => assertSupportedNode("25.9.0"));

  const output = createSink();
  const errorOutput = createSink();
  const exitCode = await main({
    argv: ["--help"],
    nodeVersion: "17.9.1",
    output,
    errorOutput,
    sourceRoot,
  });

  assert.equal(exitCode, 1);
  assert.equal(output.text(), "");
  assert.match(errorOutput.text(), /requires Node\.js 18 or later/);
});

test("help names both npm and archive entry points", async () => {
  const output = createSink();
  const errorOutput = createSink();
  const exitCode = await main({
    argv: ["--help"],
    nodeVersion: "18.0.0",
    output,
    errorOutput,
    sourceRoot,
  });

  assert.equal(exitCode, 0);
  assert.match(output.text(), /quorum-skill \[options\]/);
  assert.match(output.text(), /\.\/install\.sh \[options\]/);
  assert.equal(errorOutput.text(), "");
});
```

- [ ] **Step 3: Run focused tests and confirm the red state**

Run:

```sh
node --test tests/version.test.mjs tests/install.test.mjs
```

Expected: FAIL because the repository still declares `0.1.57`, the package is private and named `quorum-agent-skill`, and `assertSupportedNode` does not exist.

- [ ] **Step 4: Update version and package metadata**

Set `VERSION` to `0.1.58`, set `metadata.version` in `SKILL.md` to `"0.1.58"`, and replace `package.json` with this contract while retaining the repository URLs:

```json
{
  "name": "quorum-skill",
  "version": "0.1.58",
  "description": "Adaptive multi-perspective reasoning skill for AI coding agents.",
  "type": "module",
  "license": "MIT",
  "author": {
    "name": "Giuseppe Turitto",
    "email": "giuseppe@turitto.com"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/GTuritto/quorum.git"
  },
  "homepage": "https://github.com/GTuritto/quorum#readme",
  "bugs": {
    "url": "https://github.com/GTuritto/quorum/issues"
  },
  "bin": {
    "quorum-skill": "installer/install.mjs"
  },
  "files": [
    "SKILL.md",
    "VERSION",
    "agents/openai.yaml",
    "install.ps1",
    "install.sh",
    "installer/install.mjs",
    "installer/selector.mjs",
    "installer/targets.mjs",
    "references/codex-adapter.md",
    "references/protocol.sudo.md"
  ],
  "publishConfig": {
    "access": "public"
  },
  "engines": {
    "node": ">=18"
  },
  "scripts": {
    "test": "node --test tests/*.test.mjs && sh tests/test-install.sh",
    "test:unit": "node --test tests/*.test.mjs",
    "test:integration": "sh tests/test-install.sh"
  }
}
```

- [ ] **Step 5: Add the runtime guard and npm-friendly usage text**

Add this exported function before `parseArguments` in `installer/install.mjs`:

```js
export function assertSupportedNode(version) {
  const major = Number.parseInt(String(version).split(".")[0], 10);
  if (!Number.isInteger(major) || major < 18) {
    throw new Error(`Quorum requires Node.js 18 or later; found ${version}`);
  }
}
```

Change the start of `helpText()` to:

```js
export function helpText() {
  return `Usage:
  quorum-skill [options]
  ./install.sh [options]

Without --targets or --all, Quorum opens an interactive target selector.
```

Add `nodeVersion = process.versions.node` to `main`'s options and call the guard as the first statement inside its `try` block:

```js
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
```

Make `installer/install.mjs` executable:

```sh
chmod +x installer/install.mjs
```

- [ ] **Step 6: Update existing release assertions**

Change hard-coded current-version assertions in `tests/install.test.mjs` and `tests/test-install.sh` from `0.1.57` to `0.1.58`. Do not change historical `0.1.57` references in old design documents or changelog entries.

- [ ] **Step 7: Run focused and full tests**

Run:

```sh
node --test tests/version.test.mjs tests/install.test.mjs
npm test
codex_skill_validator="${CODEX_HOME:-$HOME/.codex}/skills/.system/skill-creator/scripts/quick_validate.py"
python3 "$codex_skill_validator" .
git diff --check
```

Expected: all Node tests pass, shell integration passes with the `0.1.58` banner, and the skill validator reports `Skill is valid!`.

- [ ] **Step 8: Commit the package entry point**

```sh
git add VERSION SKILL.md package.json installer/install.mjs tests/version.test.mjs tests/install.test.mjs tests/test-install.sh
git diff --cached --check
git diff --cached
git commit -m "feat(package): expose quorum-skill CLI"
```

---

### Task 2: Exact npm package-file contract

**Files:**

- Create: `scripts/package-contract.mjs`
- Create: `tests/package-contract.test.mjs`

**Interfaces:**

- Consumes: npm's `pack --dry-run --json` result object.
- Produces: `EXPECTED_PACKAGE_FILES: readonly string[]`.
- Produces: `packFilePaths(packResult): string[]`.
- Produces: `assertExactPackageFiles(actualPaths, expectedPaths = EXPECTED_PACKAGE_FILES): void`.

- [ ] **Step 1: Write exact contract tests**

Create `tests/package-contract.test.mjs`:

```js
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  EXPECTED_PACKAGE_FILES,
  assertExactPackageFiles,
  packFilePaths,
} from "../scripts/package-contract.mjs";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function runNpm(args) {
  const npmCli = process.env.npm_execpath;
  assert.ok(npmCli, "npm_execpath must be available under npm test");
  return execFileSync(process.execPath, [npmCli, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

test("npm dry-run contains exactly the approved package files", () => {
  const [packResult] = JSON.parse(runNpm(["pack", "--dry-run", "--json"]));
  const actual = packFilePaths(packResult);

  assert.deepEqual(actual, EXPECTED_PACKAGE_FILES);
  assert.doesNotThrow(() => assertExactPackageFiles(actual));
});

test("exact package contract reports missing and unexpected files", () => {
  assert.throws(
    () => assertExactPackageFiles(EXPECTED_PACKAGE_FILES.slice(1)),
    /Missing package files: LICENSE/,
  );
  assert.throws(
    () => assertExactPackageFiles([...EXPECTED_PACKAGE_FILES, "tests/leak.test.mjs"]),
    /Unexpected package files: tests\/leak\.test\.mjs/,
  );
});
```

- [ ] **Step 2: Run the contract test and confirm the red state**

Run:

```sh
node --test tests/package-contract.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/package-contract.mjs`.

- [ ] **Step 3: Implement the exact package contract**

Create `scripts/package-contract.mjs`:

```js
export const EXPECTED_PACKAGE_FILES = Object.freeze([
  "LICENSE",
  "README.md",
  "SKILL.md",
  "VERSION",
  "agents/openai.yaml",
  "install.ps1",
  "install.sh",
  "installer/install.mjs",
  "installer/selector.mjs",
  "installer/targets.mjs",
  "package.json",
  "references/codex-adapter.md",
  "references/protocol.sudo.md",
]);

export function packFilePaths(packResult) {
  if (!packResult || !Array.isArray(packResult.files)) {
    throw new Error("npm pack did not return a files array");
  }
  return packResult.files.map(({ path }) => path).sort();
}

export function assertExactPackageFiles(
  actualPaths,
  expectedPaths = EXPECTED_PACKAGE_FILES,
) {
  const actual = [...new Set(actualPaths)].sort();
  const expected = [...new Set(expectedPaths)].sort();
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  const missing = expected.filter((file) => !actualSet.has(file));
  const unexpected = actual.filter((file) => !expectedSet.has(file));

  if (missing.length > 0 || unexpected.length > 0) {
    const details = [];
    if (missing.length > 0) details.push(`Missing package files: ${missing.join(", ")}`);
    if (unexpected.length > 0) details.push(`Unexpected package files: ${unexpected.join(", ")}`);
    throw new Error(details.join("\n"));
  }
}
```

- [ ] **Step 4: Run package and full tests**

Run:

```sh
npm run test:unit
npm test
git diff --check
```

Expected: exact package-contract tests and all existing tests pass. `npm pack --dry-run` reports 13 files and excludes `tests/`, `scripts/`, `docs/`, `.github/`, and `CHANGELOG.md`.

- [ ] **Step 5: Commit the package contract**

```sh
git add scripts/package-contract.mjs tests/package-contract.test.mjs
git diff --cached --check
git diff --cached
git commit -m "test(package): enforce exact published files"
```

---

### Task 3: Distribution archives and packed execution

**Files:**

- Create: `scripts/build-distribution.mjs`
- Create: `tests/distribution.test.mjs`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**

- Consumes: `EXPECTED_PACKAGE_FILES`, `packFilePaths`, and `assertExactPackageFiles` from `scripts/package-contract.mjs`.
- Produces: `sha256File(filePath): Promise<string>`.
- Produces: `buildDistribution({ root?, outputDirectory? }): Promise<{ version, tgzPath, zipPath, checksumPath, packageFiles }>`.
- Produces: `npm run dist`, which writes only under `<repo>/dist/`.

- [ ] **Step 1: Write failing distribution tests**

Create `tests/distribution.test.mjs`:

```js
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { access, mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
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
```

- [ ] **Step 2: Run the distribution tests and confirm the red state**

Run:

```sh
node --test tests/distribution.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/build-distribution.mjs`.

- [ ] **Step 3: Implement the distribution builder**

Create `scripts/build-distribution.mjs` with these imports and public functions:

```js
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
```

- [ ] **Step 4: Add the build command and ignore generated artifacts**

Add this script to `package.json` without adding lifecycle scripts:

```json
"dist": "node scripts/build-distribution.mjs"
```

Add this line to `.gitignore`:

```gitignore
dist/
```

- [ ] **Step 5: Run distribution and full tests**

Run:

```sh
npm run test:unit
npm test
npm run dist
cat dist/SHA256SUMS
tar -tzf dist/quorum-skill-0.1.58.tgz
unzip -Z1 dist/quorum-skill-0.1.58.zip
git status --short
```

Expected: both distribution tests pass, the full suite passes, both archive listings contain the exact 13-file package contract under their expected roots, checksums contain two entries, and `dist/` remains ignored.

- [ ] **Step 6: Exercise the packed interactive selector in a terminal**

From a real TTY outside the repository, run:

```sh
temporary_cache=$(mktemp -d)
npm_config_cache="$temporary_cache/cache" npm exec --yes --package="$PWD/dist/quorum-skill-0.1.58.tgz" -- quorum-skill --scope project --project-root "$temporary_cache/project" --dry-run
```

Use Space on `All`, then Enter. Expected: all five targets appear in the dry-run result, shared project destinations are deduplicated, and the selector restores normal terminal state. Keep the temporary directory until verification is recorded; cleanup is a separate, explicit action.

- [ ] **Step 7: Commit distribution generation**

```sh
git add scripts/build-distribution.mjs tests/distribution.test.mjs package.json .gitignore
git diff --cached --check
git diff --cached
git commit -m "feat(package): build verified release artifacts"
```

---

### Task 4: User and maintainer documentation

**Files:**

- Modify: `README.md:3-112`
- Modify: `README.md:168-180`
- Modify: `CHANGELOG.md`
- Modify: `CONTRIBUTING.md:14-50`
- Modify: `SECURITY.md:28-32`
- Create: `PUBLISHING.md`

**Interfaces:**

- Consumes: `npx quorum-skill`, `npm run dist`, and release filenames from Tasks 1 through 3.
- Produces: copy-ready npm and manual installation commands for users.
- Produces: release notes and maintainer verification instructions for `0.1.58`.
- Produces: trusted-publishing runbook for releases after `0.1.58`.

- [ ] **Step 1: Make npx the primary README installation path**

Update the banner to `QUORUM v0.1.58` and replace the clone-first installation introduction with:

````markdown
## Install

Run Quorum directly from npm:

```sh
npx quorum-skill
```

Pin the exact release when reproducibility matters:

```sh
npx quorum-skill@0.1.58
```

`npx` may ask before downloading an uncached package. Put `-y` before the
package name to suppress that npm prompt:

```sh
npx -y quorum-skill@0.1.58 --all --dry-run
```

This does not suppress Quorum's replacement confirmation. Pass Quorum's
`--yes` option separately only when you intend to replace differing content.
````

Convert the existing non-interactive examples from `./install.sh` to
`npx quorum-skill`. Keep the selector, options, target paths, and update-safety
sections unchanged except where entry-point wording requires adjustment.

- [ ] **Step 2: Document compact manual archives**

Add a manual-install subsection with exact release assets and verification:

````markdown
### Manual archive installation

Download `quorum-skill-0.1.58.tgz` or `quorum-skill-0.1.58.zip` and
`SHA256SUMS` from the [v0.1.58 release](https://github.com/GTuritto/quorum/releases/tag/v0.1.58).

On macOS or Linux:

```sh
grep 'quorum-skill-0.1.58.tgz' SHA256SUMS | shasum -a 256 -c -
tar -xzf quorum-skill-0.1.58.tgz
cd package
./install.sh
```

On Windows PowerShell:

```powershell
$expected = (Select-String "quorum-skill-0.1.58.zip" SHA256SUMS).Line.Split()[0]
$actual = (Get-FileHash quorum-skill-0.1.58.zip -Algorithm SHA256).Hash.ToLower()
if ($actual -ne $expected) { throw "Checksum verification failed" }
Expand-Archive quorum-skill-0.1.58.zip -DestinationPath .
Set-Location .\quorum-skill-0.1.58
.\install.ps1
```

The compact assets contain the installer and skill payload. GitHub's source
archives contain the complete development repository.
````

- [ ] **Step 3: Update contributor, security, and changelog documentation**

Add `npm run dist` and exact-packlist verification to `CONTRIBUTING.md`. Extend
`SECURITY.md` scope with npm package contents, executable shims, release assets,
and checksums.

Add this changelog entry above `0.1.57`:

```markdown
## [0.1.58] - 2026-09-06

### Added

- Public `quorum-skill` npm package for one-command `npx` installation.
- Compact `.tgz` and ZIP release assets with SHA-256 checksums.
- Exact published-file validation and packed-executable integration tests.
- Token-free trusted npm publishing workflow for releases after `0.1.58`.

### Changed

- Made `npx quorum-skill` the primary installation method.
- Added a clear error for Node.js versions older than 18.
```

Change the comparison links to:

```markdown
[Unreleased]: https://github.com/GTuritto/quorum/compare/v0.1.58...HEAD
[0.1.58]: https://github.com/GTuritto/quorum/compare/v0.1.57...v0.1.58
[0.1.57]: https://github.com/GTuritto/quorum/releases/tag/v0.1.57
```

Create `PUBLISHING.md` with this release boundary and runbook:

````markdown
# Publishing Quorum

Only maintainers publish Quorum. Build and test every release from a clean
`main` branch.

## First npm publication

Version `0.1.58` establishes ownership of the unscoped `quorum-skill` package.
It is published once from an authenticated maintainer account after the local
release gate passes. This first release has no trusted-publishing provenance;
provenance cannot be added retroactively.

After `0.1.58` exists, configure GitHub Actions workflow `publish.yml` as the
trusted publisher for `GTuritto/quorum`. The npm account must have 2FA enabled.
Use npm `11.15.0` or later:

```sh
npx -y npm@^11.15.0 trust github quorum-skill \
  --file publish.yml \
  --repo GTuritto/quorum \
  --allow-publish \
  --yes
npx -y npm@^11.15.0 trust list quorum-skill --json
```

## Subsequent npm releases

1. Merge and verify the release commit on `main`.
2. Dispatch `publish.yml` from `main` with the exact package version.
3. Verify npm metadata, clean-cache execution, and provenance.
4. Download the workflow artifact and attach those exact files to the draft
   GitHub release.
5. Verify checksums before publishing the GitHub release.

Trusted publishing uses GitHub OIDC and stores no npm publish token. npm adds
provenance and publish attestations automatically for the public package from
this public repository.
````

- [ ] **Step 4: Verify documentation against behavior**

Run:

```sh
npm test
npm run dist
node installer/install.mjs --help
rg -n "0\.1\.57|quorum-agent-skill|git clone" README.md package.json VERSION SKILL.md tests scripts
git diff --check
```

Expected: tests and build pass; help displays both entry points. The search may
find historical changelog links only when `CHANGELOG.md` is searched separately;
current commands and metadata use `0.1.58` and `quorum-skill`.

- [ ] **Step 5: Commit the public documentation**

```sh
git add README.md CHANGELOG.md CONTRIBUTING.md SECURITY.md PUBLISHING.md
git diff --cached --check
git diff --cached
git commit -m "docs: document npm and archive installation"
```

---

### Task 5: Trusted npm publishing workflow

**Files:**

- Create: `.github/workflows/publish.yml`
- Create: `tests/workflow.test.mjs`

**Interfaces:**

- Consumes: `npm test`, `npm run dist`, and the versioned `.tgz` from Tasks 1
  through 3.
- Produces: manually dispatched GitHub workflow `publish.yml` with required
  string input `version`.
- Produces: token-free `npm publish` authorized through GitHub OIDC after npm
  trust is configured.
- Produces: workflow artifact `quorum-skill-<version>` containing the exact
  `.tgz`, ZIP, and `SHA256SUMS`.

- [ ] **Step 1: Write failing workflow security tests**

Create `tests/workflow.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const workflowPath = path.join(root, ".github", "workflows", "publish.yml");

test("trusted publish workflow uses constrained GitHub OIDC", async () => {
  const workflow = await readFile(workflowPath, "utf8");

  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /version:\n\s+description:/);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /runs-on: ubuntu-latest/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /actions\/checkout@v6/);
  assert.match(workflow, /actions\/setup-node@v6/);
  assert.match(workflow, /node-version: "24"/);
  assert.match(workflow, /npm@\^11\.15\.0/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run dist/);
  assert.match(workflow, /npm publish "\.\/dist\/quorum-skill-\$\{RELEASE_VERSION\}\.tgz" --access public/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.ok(
    workflow.indexOf("actions/upload-artifact@v4") < workflow.indexOf("npm publish"),
    "verified artifacts must be preserved before the immutable npm publish",
  );
  assert.doesNotMatch(workflow, /NODE_AUTH_TOKEN|NPM_TOKEN|secrets\./);
});
```

- [ ] **Step 2: Run the workflow test and confirm the red state**

Run:

```sh
node --test tests/workflow.test.mjs
```

Expected: FAIL with `ENOENT` for `.github/workflows/publish.yml`.

- [ ] **Step 3: Add the trusted-publishing workflow**

Create `.github/workflows/publish.yml`:

```yaml
name: Publish npm package

"on":
  workflow_dispatch:
    inputs:
      version:
        description: Exact package version to publish
        required: true
        type: string

permissions:
  contents: read
  id-token: write

concurrency:
  group: npm-publish
  cancel-in-progress: false

jobs:
  publish:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v6

      - uses: actions/setup-node@v6
        with:
          node-version: "24"
          registry-url: https://registry.npmjs.org
          package-manager-cache: false

      - name: Use an npm CLI that supports trusted publishing
        run: npm install --global npm@^11.15.0

      - name: Verify requested version
        env:
          RELEASE_VERSION: ${{ inputs.version }}
        run: |
          package_version=$(node -p "require('./package.json').version")
          test "$package_version" = "$RELEASE_VERSION"

      - run: npm test

      - run: npm run dist

      - uses: actions/upload-artifact@v4
        with:
          name: quorum-skill-${{ inputs.version }}
          path: |
            dist/quorum-skill-${{ inputs.version }}.tgz
            dist/quorum-skill-${{ inputs.version }}.zip
            dist/SHA256SUMS
          if-no-files-found: error
          retention-days: 7

      - name: Publish through npm trusted publishing
        env:
          RELEASE_VERSION: ${{ inputs.version }}
        run: npm publish "./dist/quorum-skill-${RELEASE_VERSION}.tgz" --access public
```

Do not add `NODE_AUTH_TOKEN`, `NPM_TOKEN`, an npm secret, or broader repository
permissions. Trusted publishing detects the GitHub OIDC environment from
`id-token: write`.

- [ ] **Step 4: Validate workflow syntax and security invariants**

Run:

```sh
node --test tests/workflow.test.mjs
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/publish.yml"); puts "Workflow YAML OK"'
npm test
git diff --check
```

Expected: workflow test and full suite pass, Ruby reports `Workflow YAML OK`,
and the workflow contains no token or secret reference.

- [ ] **Step 5: Commit the trusted workflow**

```sh
git add .github/workflows/publish.yml tests/workflow.test.mjs
git diff --cached --check
git diff --cached
git commit -m "ci: add trusted npm publishing"
```

Do not dispatch the workflow for `0.1.58`. The first package must exist before
npm can bind the workflow as a trusted publisher.

---

### Task 6: Release gate, npm publication, trusted-publisher setup, and GitHub assets

**Files:**

- Verify: all tracked files
- Generate: `dist/quorum-skill-0.1.58.tgz`
- Generate: `dist/quorum-skill-0.1.58.zip`
- Generate: `dist/SHA256SUMS`
- External write: npm package `quorum-skill@0.1.58`
- External write: npm trusted-publisher relationship for `GTuritto/quorum` and
  `publish.yml`
- External write: Git tag and GitHub release `v0.1.58`

**Interfaces:**

- Consumes: verified commits and artifacts from Tasks 1 through 5.
- Produces: public npm package, verified OIDC trust relationship, annotated Git
  tag, and public GitHub release with matching assets.

- [ ] **Step 1: Run the complete local release gate**

Run:

```sh
npm test
codex_skill_validator="${CODEX_HOME:-$HOME/.codex}/skills/.system/skill-creator/scripts/quick_validate.py"
python3 "$codex_skill_validator" .
sh -n install.sh tests/test-install.sh
pwsh -NoProfile -File ./install.ps1 --help
node --check installer/install.mjs
node --check installer/selector.mjs
node --check installer/targets.mjs
node --check scripts/package-contract.mjs
node --check scripts/build-distribution.mjs
node --test tests/workflow.test.mjs
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/publish.yml"); puts "Workflow YAML OK"'
npm run dist
git diff --check
git status --short --branch
```

Expected: every check passes, `dist/` is ignored, and the branch contains only
the intended commits ahead of `origin/main`.

- [ ] **Step 2: Inspect package contents and scan for credentials**

Run:

```sh
npm pack --dry-run --json
tar -tzf dist/quorum-skill-0.1.58.tgz
unzip -Z1 dist/quorum-skill-0.1.58.zip
cat dist/SHA256SUMS
git grep -n -E '(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|BEGIN (RSA|OPENSSH|EC) PRIVATE KEY)' -- .
```

Expected: both archives contain only the 13 approved files and the credential
scan prints nothing. Treat any match as a stop condition and inspect it before
continuing.

- [ ] **Step 3: Push the reviewed implementation commits**

Run:

```sh
git log --oneline --decorate origin/main..HEAD
git push origin main
git status --short --branch
```

Expected: `main` tracks `origin/main` with no ahead/behind count. Do not push a
tag yet.

- [ ] **Step 4: Recheck package availability and npm authentication**

Run:

```sh
npm view quorum-skill name version --json
npm whoami
```

Expected before first publication: `npm view` returns `E404`; `npm whoami`
returns the intended maintainer account. If authentication or 2FA interaction
is required, stop and ask Giuseppe to complete it. If the package exists under
an unexpected owner, stop and request a new package-name decision.

- [ ] **Step 5: Publish the exact verified npm tarball**

After the authentication gate passes, run:

```sh
npm publish ./dist/quorum-skill-0.1.58.tgz --access public
```

Expected: npm reports `+ quorum-skill@0.1.58`. Do not rebuild after this point.

- [ ] **Step 6: Verify npm metadata and clean-cache execution**

Run outside the repository with a new cache:

```sh
npm view quorum-skill@0.1.58 name version bin license repository engines dist --json
verification_root=$(mktemp -d)
cd "$verification_root"
npm_config_cache="$verification_root/npm-cache" npx -y quorum-skill@0.1.58 --help
npm_config_cache="$verification_root/npm-cache" npx -y quorum-skill@0.1.58 --targets codex,cursor --scope project --project-root "$verification_root/project" --dry-run
```

Expected: metadata names version `0.1.58`, one `quorum-skill` binary, MIT,
`GTuritto/quorum`, and Node.js `>=18`. Both commands print `QUORUM v0.1.58`; the
dry-run writes no project skill directories.

- [ ] **Step 7: Configure and verify GitHub Actions as npm's trusted publisher**

The package now exists, and `publish.yml` is present on GitHub's default branch.
Use a temporary npm CLI that meets the `11.15.0+` trust-command requirement:

```sh
npx -y npm@^11.15.0 trust github quorum-skill \
  --file publish.yml \
  --repo GTuritto/quorum \
  --allow-publish \
  --yes
npx -y npm@^11.15.0 trust list quorum-skill --json
gh workflow view publish.yml --repo GTuritto/quorum --yaml
```

Expected: npm records one GitHub trusted publisher for repository
`GTuritto/quorum`, workflow `publish.yml`, with direct `npm publish` permission.
The GitHub workflow matches the committed file and contains `id-token: write`
without `NODE_AUTH_TOKEN`, `NPM_TOKEN`, or `secrets.*`. If npm requests account
2FA, stop and let Giuseppe complete the browser or one-time-password step.

Do not dispatch `publish.yml` for `0.1.58`; npm package versions cannot be
republished. The next release uses this workflow and receives automatic npm
provenance and publish attestations.

- [ ] **Step 8: Create the annotated tag and draft GitHub release**

Return to the repository and run:

```sh
git tag -a v0.1.58 -m "Quorum v0.1.58"
git push origin v0.1.58
gh release create v0.1.58 \
  --repo GTuritto/quorum \
  --draft \
  --verify-tag \
  --title "Quorum v0.1.58" \
  --notes-file CHANGELOG.md \
  dist/quorum-skill-0.1.58.tgz \
  dist/quorum-skill-0.1.58.zip \
  dist/SHA256SUMS
```

Expected: GitHub creates a draft release with three assets. The peeled annotated
tag must equal the verified `main` commit.

- [ ] **Step 9: Verify draft assets without rebuilding**

Download the draft assets to a new temporary directory and compare them:

```sh
repo_root=$(git rev-parse --show-toplevel)
asset_root=$(mktemp -d)
gh release download v0.1.58 --repo GTuritto/quorum --dir "$asset_root"
cd "$asset_root"
shasum -a 256 -c SHA256SUMS
cmp quorum-skill-0.1.58.tgz "$repo_root/dist/quorum-skill-0.1.58.tgz"
cmp quorum-skill-0.1.58.zip "$repo_root/dist/quorum-skill-0.1.58.zip"
```

Expected: both checksum entries report `OK`, and both byte comparisons are
silent. If verification fails, keep the release in draft state and report the
mismatch.

- [ ] **Step 10: Publish and verify the GitHub release**

Run:

```sh
gh release edit v0.1.58 --repo GTuritto/quorum --draft=false
gh release view v0.1.58 --repo GTuritto/quorum --json url,tagName,isDraft,isPrerelease,publishedAt,assets
npx -y npm@^11.15.0 trust list quorum-skill --json
git ls-remote --heads --tags origin
git status --short --branch
```

Expected: release `v0.1.58` is public, not a prerelease, and lists the `.tgz`,
ZIP, and checksum assets. `origin/main` and peeled `v0.1.58` resolve to the
verified release commit. The npm trust output identifies `GTuritto/quorum` and
`publish.yml`. The local tracked worktree is clean.

- [ ] **Step 11: Record final evidence**

Report:

- npm package URL: `https://www.npmjs.com/package/quorum-skill/v/0.1.58`
- GitHub release URL: `https://github.com/GTuritto/quorum/releases/tag/v0.1.58`
- Release commit SHA
- Test counts and commands
- Archive SHA-256 digests
- Trusted-publisher repository, workflow filename, and permission
- Explicit note that `0.1.58` predates trusted-publishing provenance
- Confirmation that subsequent workflow publishes receive automatic npm
  provenance and publish attestations
- Any skipped platform checks
- Confirmation that installed Quorum copies and `v0.1.57` were unchanged

Do not create another commit after publication unless verification uncovers a
documentation defect that requires a separately reviewed patch release.
