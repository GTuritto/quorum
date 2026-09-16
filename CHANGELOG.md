# Changelog

All notable changes to Quorum are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.61] - 2026-09-16

### Fixed

- Refresh the README shipped to npm with current installation and update
  commands, the npm version badge, and accurate archive availability.
- Documentation-only patch; installer and deliberation behavior are unchanged.

## [0.1.60] - 2026-09-16

### Added

- Automatic npm publication on stable version-tag pushes, with matching package
  version and main-branch ancestry checks; manual publishing remains available.
- Request-scoped auto/direct/mini/full controls,
  candidate/reviewer targets, and total worker-launch caps.
- Execution receipts distinguishing requested tiers, actual participation,
  failed launches, provenance, and fallback behavior.
- Development-only deterministic deliberation policy tests and host smoke
  scenarios, with explicit limits on what automated checks prove.
- npm discovery keywords for reasoning, agent skills, and supported assistants.

### Changed

- Prefer direct execution for routine work and implementation after a decision;
  reuse compatible conversation decisions without persistent memory.
- Default full deliberation to three candidates and one independent reviewer;
  support smaller 1+1 panels and explicit larger panels within host/budget limits.
- Keep mini within the current context, reserve capacity for independent review,
  and perform synthesis in the coordinator.

Published to npm through the `v0.1.60` tag workflow with signed provenance.
Release dates use UTC; npm recorded publication at 22:57:40 UTC.

## [0.1.59] - 2026-09-07

### Added

- `--version` reporting without destination discovery or writes.
- `--update` and `--upgrade` maintenance commands for the running package.
- Conservative automatic detection of existing Quorum installations and
  supported tools.
- `--skills-dir` for explicit portable installation, update, and removal.
- Guarded `--uninstall` for permanent removal of recognized Quorum directories
  and links.
- Version, identity, discovery, routing, update-policy, uninstall, and packed
  executable tests.

### Changed

- First-time no-target installation now installs for all detected supported
  tools without opening the selector.
- Updates refuse newer versions, foreign content, symbolic links, and
  destinations that change before mutation.
- Existing eligible installations retain atomic placement and timestamped
  backups.
- npm publication now uses GitHub Actions trusted publishing with provenance.

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

[Unreleased]: https://github.com/GTuritto/quorum/compare/v0.1.61...HEAD
[0.1.61]: https://github.com/GTuritto/quorum/compare/v0.1.60...v0.1.61
[0.1.60]: https://github.com/GTuritto/quorum/compare/v0.1.59...v0.1.60
[0.1.59]: https://github.com/GTuritto/quorum/compare/v0.1.58...v0.1.59
[0.1.58]: https://github.com/GTuritto/quorum/compare/v0.1.57...v0.1.58
[0.1.57]: https://github.com/GTuritto/quorum/releases/tag/v0.1.57
