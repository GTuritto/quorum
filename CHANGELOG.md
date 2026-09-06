# Changelog

All notable changes to Quorum are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.58] - 2026-09-06

### Added

- Public `quorum-skill` npm package for one-command `npx` installation.
- Compact `.tgz` and ZIP release assets with SHA-256 checksums.
- Exact published-file validation and packed-executable integration tests.
- Token-free trusted npm publishing workflow for releases after `0.1.58`.

### Changed

- Made `npx quorum-skill` the primary installation method.
- Added a clear error for Node.js versions older than 18.

## [0.1.57] - 2026-09-06

### Added

- Portable Quorum reasoning skill with adaptive direct, mini, and full tiers.
- SudoLang-style council protocol and Codex runtime adapter.
- Dependency-free installer for Codex, Claude Code, Antigravity, VS Code, and
  Cursor.
- Keyboard and mouse multi-select target selector with an `All` invariant.
- User-wide and project-local installation paths.
- Non-interactive `--targets`, `--all`, `--dry-run`, and `--yes` workflows.
- Atomic placement, timestamped backups, legacy Codex detection, and partial
  failure reporting.
- Automated unit and integration coverage for installer behavior and payload
  integrity.

[Unreleased]: https://github.com/GTuritto/quorum/compare/v0.1.58...HEAD
[0.1.58]: https://github.com/GTuritto/quorum/compare/v0.1.57...v0.1.58
[0.1.57]: https://github.com/GTuritto/quorum/releases/tag/v0.1.57
