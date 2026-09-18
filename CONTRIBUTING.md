# Contributing to Quorum

Thank you for helping improve Quorum. Contributions should preserve the core
protocol invariants while keeping the skill portable and the installer small.

## Before opening a change

- Search existing issues and pull requests.
- Open an issue before a large protocol, compatibility, or installer design
  change.
- Report vulnerabilities privately according to [SECURITY.md](SECURITY.md).
- Follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Development setup

Requirements:

- Git
- Node.js 18 or later

```sh
git clone https://github.com/GTuritto/quorum.git
cd quorum
npm test
```

Quorum currently has no third-party package dependencies, so no dependency
installation step is required.

## Making a change

1. Fork the repository and create a focused branch.
2. Keep protocol changes aligned across `SKILL.md`,
   `references/protocol.sudo.md`, and runtime adapters where applicable.
3. Add or update tests for installer behavior changes.
4. Keep `VERSION`, `package.json`, and `SKILL.md` version declarations aligned.
5. Run the full verification suite.

```sh
npm test
npm run dist
git diff --check
```

`npm test` includes Quorum's portable structural and version checks. `npm run
dist` verifies the exact npm packlist before producing the compact release
archives and `SHA256SUMS` in `dist/`.

## Logo maintenance

The terminal banner in `installer/selector.mjs` owns the ASCII lettering and
blue/teal palette. After changing it, run `node scripts/build-logo.mjs` to
regenerate `assets/quorum-logo.svg`. The banner tests check SVG consistency,
plain-text fallback, selector row positions, and version-only output.

## Publishing a release

Merge the versioned changes and publishing workflow into `main` first. Then
push a stable version tag, for example `v0.1.60`, on the intended release
commit. The `Publish npm package` workflow runs automatically on `v*` tag
pushes, checks the exact X.Y.Z version against `package.json`, and verifies
that the tagged commit is an ancestor of `origin/main`. Prerelease tags are
not supported by this stable-release workflow.

The workflow runs tests, builds and uploads archives, then publishes the npm
tarball using trusted publishing. A merge into main alone does not publish.
Manual dispatch remains available on `main` with an exact version input.
Do not rerun a successful publish for the same version: npm versions are
immutable. This workflow does not create a GitHub release or attach its assets.

## Commit and pull request guidance

- Use Conventional Commit messages, such as `fix(installer): restore terminal on cancellation`.
- Keep commits focused and explain user-visible behavior changes.
- Update `README.md` and `CHANGELOG.md` when behavior or compatibility changes.
- Complete the pull-request checklist and include verification results.
- Do not include generated dependencies, credentials, or local installation
  directories.

By contributing, you agree that your contribution will be licensed under the
MIT License.
