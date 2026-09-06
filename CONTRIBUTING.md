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
git diff --check
```

`npm test` includes Quorum's portable structural and version checks.

## Commit and pull request guidance

- Use Conventional Commit messages, such as `fix(installer): restore terminal on cancellation`.
- Keep commits focused and explain user-visible behavior changes.
- Update `README.md` and `CHANGELOG.md` when behavior or compatibility changes.
- Complete the pull-request checklist and include verification results.
- Do not include generated dependencies, credentials, or local installation
  directories.

By contributing, you agree that your contribution will be licensed under the
MIT License.
