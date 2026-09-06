# Quorum npm and Standalone Distribution Design

Date: 2026-09-06
Version: 0.1.58
Status: Approved design, pending written-spec review

## Objective

Let users install Quorum without cloning its Git repository. Provide two
distribution paths from one verified package:

- `npx quorum-skill` as the primary one-command experience.
- Compact GitHub release archives for manual download, verification, and use.

Both paths must preserve the existing interactive selector, command-line flags,
target paths, atomic replacement, backups, and legacy Codex detection.

## Decisions

- Publish the public, unscoped npm package `quorum-skill`.
- Release version `0.1.58`; keep `0.1.57` immutable.
- Use the existing `installer/install.mjs` as the package executable.
- Keep Node.js 18 as the minimum runtime.
- Reject execution under an older Node.js version with a clear error.
- Publish no runtime dependencies and no npm lifecycle scripts.
- Build npm and GitHub artifacts from one explicit file allowlist.
- Publish the first npm release from an authenticated maintainer account.
- Defer npm trusted publishing through GitHub Actions until package ownership is
  established.

The name `quorum` is already registered on npm. `quorum-skill` appeared
unregistered during design, but the release process must confirm availability
again immediately before publication.

## User experience

### Primary npm flow

The default command downloads the package into npm's cache and starts Quorum's
interactive selector:

```sh
npx quorum-skill
```

Users pass existing installer arguments after the package name:

```sh
npx quorum-skill --targets codex,cursor
npx quorum-skill --all --scope project
npx quorum-skill --all --dry-run
```

Users can pin a release:

```sh
npx quorum-skill@0.1.58
```

`npx` may ask permission before downloading an uncached package. Users may put
`-y` before the package name to suppress only that npm prompt:

```sh
npx -y quorum-skill@0.1.58 --all --dry-run
```

The Quorum installer's own replacement confirmation remains independent. Users
must still confirm a differing installation or pass Quorum's `--yes` flag.

### Manual archive flow

The GitHub release contains:

```text
quorum-skill-0.1.58.tgz
quorum-skill-0.1.58.zip
SHA256SUMS
```

The `.tgz` file is the exact tarball published to npm. The ZIP contains the same
allowlisted package contents under a `quorum-skill-0.1.58/` directory. Users
verify the selected archive against `SHA256SUMS`, extract it, then run
`install.sh` or `install.ps1`.

GitHub's automatically generated source archives remain available for source
review. The README directs installers to the compact release assets instead.

## npm package contract

`package.json` changes to the following publication contract:

- `name` becomes `quorum-skill`.
- `version` becomes `0.1.58`.
- `private` is removed.
- `bin.quorum-skill` points to `installer/install.mjs`.
- `publishConfig.access` is `public`.
- `files` lists only runtime and skill payload paths.
- `author` identifies Giuseppe Turitto and `giuseppe@turitto.com`.
- `engines.node` remains `>=18`.

The `files` allowlist contains:

```text
SKILL.md
VERSION
agents/
references/
installer/
install.sh
install.ps1
```

npm also includes `package.json`, `README.md`, and `LICENSE` by contract. The
published package excludes tests, design documents, issue templates, repository
configuration, changelog, contribution policy, security policy, and local
files.

The executable already starts with `#!/usr/bin/env node`. npm creates the
platform-specific command shims needed by `npx`, including Windows command
execution.

## Build components

### Package manifest

`package.json` defines the public package, executable, file allowlist, supported
Node.js version, and local validation commands.

### Distribution builder

Add a dependency-free build script under `scripts/`. It performs these steps:

1. Read `VERSION`, `SKILL.md`, and `package.json`.
2. Reject mismatched or invalid semantic versions.
3. Remove and recreate only the repository-local `dist/` directory.
4. Run `npm pack --json --pack-destination dist`.
5. Inspect the reported tarball entries against the expected allowlist.
6. Extract that exact tarball into a staging directory.
7. Produce `quorum-skill-0.1.58.zip` from the extracted package contents.
8. Compute SHA-256 digests for the `.tgz` and `.zip` files.
9. Write `dist/SHA256SUMS` in a stable order.

The build may use the host's standard archive utility to create the ZIP. The
installed npm package and Quorum runtime keep their zero-dependency guarantee.

### Existing installer

`installer/install.mjs` remains the single installation engine for repository,
npm, and manual-archive execution. It resolves its source root from its own file
location, so running from npm's cache needs no special path mode.

The POSIX and PowerShell launchers remain manual-archive entry points. Both
continue to forward all arguments and the installer's exit status.

## Installation data flow

```text
npx
  -> npm downloads quorum-skill into its cache
  -> npm invokes installer/install.mjs through package.json bin
  -> installer validates the package-local payload and version
  -> selector or explicit target flags choose destinations
  -> installer stages, backs up, and places the skill payload

manual archive
  -> user downloads archive plus SHA256SUMS
  -> user verifies and extracts archive
  -> install.sh or install.ps1 invokes installer/install.mjs
  -> the same validation and installation flow runs
```

The installer performs no network access. npm or the user's download tool owns
artifact retrieval; Quorum owns only local validation and installation.

## Safety and integrity

- The npm package has no `preinstall`, `install`, `postinstall`, or `prepare`
  lifecycle script.
- `npx` runs Quorum only through the declared `bin` executable.
- The explicit `files` list limits published content.
- Package tests compare the packed file list with an exact expected list.
- npm's package integrity protects npm-cache retrieval.
- `SHA256SUMS` protects manual archive verification.
- The release process builds once, publishes that `.tgz` to npm, and uploads the
  same `.tgz` to GitHub.
- A credential scan runs against tracked files and distribution artifacts.
- The existing dry-run, confirmation, backup, rollback, and partial-failure
  behavior remains unchanged.
- No release command modifies an installed Quorum copy.

Checksums detect accidental corruption and mismatched downloads. They do not
replace publisher trust because the archives and checksum file share a release
channel.

## Error handling

- If `quorum-skill` is unavailable at publication time, stop and ask for a new
  name. Do not rename the package automatically.
- If npm authentication or two-factor authentication is missing, stop before
  publication and ask the maintainer to complete it.
- If packaging includes an unexpected or missing file, stop before publication.
- If versions differ, stop before building artifacts.
- If tests, local tarball execution, checksum verification, or credential scans
  fail, stop before publication.
- If npm publication succeeds but GitHub publication fails, preserve the
  verified artifacts and retry the GitHub step without rebuilding.
- Upload GitHub assets to a draft release. If remote verification fails, keep
  the release as a draft and report the mismatch.

npm package versions are immutable for this workflow. Never reuse `0.1.58` for
different contents.

## Version and release flow

1. Update `VERSION`, `SKILL.md`, `package.json`, and `CHANGELOG.md` to `0.1.58`.
2. Implement the package contract, builder, documentation, and tests.
3. Run the repository test suite and skill validator.
4. Build artifacts once and inspect the exact package contents.
5. Run `--help`, dry-run, selected-target, and all-target checks from the local
   `.tgz` through npm execution.
6. Commit the implementation and push the verified `main` commit.
7. Recheck npm name availability and authenticate the maintainer.
8. Publish the existing `.tgz` as public `quorum-skill@0.1.58`.
9. Verify npm metadata and run a version-pinned command from a clean npm cache
   outside the repository.
10. Create and push annotated tag `v0.1.58` at the verified commit.
11. Create draft GitHub release `v0.1.58` and upload the existing `.tgz`, ZIP,
    and `SHA256SUMS`.
12. Download or stream each remote asset and compare its digest with the local
    checksum file.
13. Publish the verified GitHub release.
14. Verify the README commands, npm package page, GitHub tag, and release URLs.

The release process never changes `v0.1.57` or republishes its assets.

## Verification

### Package structure

- `npm pack --dry-run --json` reports only approved files.
- The real packed `.tgz` contains the same approved files.
- The ZIP contains the same logical files as the npm package.
- `VERSION`, `SKILL.md`, and `package.json` contain `0.1.58`.
- The `.tgz` uploaded to GitHub matches the `.tgz` published to npm.

### Execution

- The local tarball exposes one executable named `quorum-skill`.
- Node.js versions older than 18 receive a clear version error.
- `--help` works from an npm-created command shim.
- `--targets` and `--all` bypass interactive selection.
- The interactive selector works through `npx` in a terminal.
- Installer arguments and exit codes pass through unchanged.
- User and project dry-runs write nothing.
- A temporary project installation contains only the expected skill payload.
- The PowerShell launcher smoke test runs when `pwsh` is available.

### Publication

- `npm view quorum-skill@0.1.58` reports the expected version, executable,
  license, repository, and Node.js requirement.
- `npx -y quorum-skill@0.1.58 --help` works from a clean cache.
- GitHub release assets match `SHA256SUMS`.
- The `v0.1.58` tag and npm package repository metadata resolve to the verified
  commit and repository.

## Documentation changes

The README makes `npx quorum-skill` the primary installation method. It keeps
repository cloning as a contributor workflow, documents version pinning and
`npx -y`, explains manual archive verification, and retains the existing target
and safety documentation.

`CONTRIBUTING.md` documents the package-content test and distribution build.
`SECURITY.md` adds npm-package and release-asset integrity to its scope.
`CHANGELOG.md` records the `0.1.58` distribution changes.

## Deferred work

- Configure npm trusted publishing through GitHub Actions after the first
  package establishes ownership.
- Add provenance attestations when trusted publishing is configured.
- Add other package registries only after demand justifies another release
  channel.
- Add native executables only if requiring Node.js becomes a material adoption
  barrier.

## Success criteria

- A new user can launch the existing installer with `npx quorum-skill` without
  cloning the Git repository.
- A user can install from compact GitHub release assets without downloading the
  repository source archive.
- npm and GitHub publish the same verified package contents for `0.1.58`.
- The package contains no unexpected repository, test, or credential files.
- Existing installer behavior and tests remain intact.
- Existing Quorum installations and release `v0.1.57` remain unchanged.
