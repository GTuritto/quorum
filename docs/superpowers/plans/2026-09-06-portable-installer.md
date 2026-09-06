# Quorum Portable Installer Implementation Plan

Date: 2026-09-06
Specification: `docs/superpowers/specs/2026-09-05-portable-installer-design.md`
Release: `0.1.57`

## Outcome

Deliver and publish a tested Quorum installer with a monochrome wordmark, interactive checkbox target selection, non-interactive target flags, safe installation, public documentation, and GitHub release `v0.1.57`.

## Commit 1: Baseline protocol and approved design

Status: complete in commit `a094fb0`.

- Add the portable Quorum skill.
- Add the Codex adapter and SudoLang protocol.
- Add the approved installer and publication specification.
- Validate the skill structure before committing.

## Commit 2: Implementation plan

- Add this plan before changing installer behavior.
- Confirm that the plan matches the approved specification.

Verification:

```sh
git diff --check
```

## Commit 3: Portable installer

### Version and package metadata

- Add `VERSION` containing `0.1.57`.
- Add `metadata.version: "0.1.57"` to `SKILL.md`.
- Add a private `package.json` with the matching version, Node.js engine requirement, and test commands.
- Add a test that fails when the three version declarations differ.

### Target model

- Add `installer/targets.mjs`.
- Define stable identifiers, display labels, aliases, user paths, project paths, and target-specific payload needs.
- Resolve user and project scope from explicit inputs.
- Infer the Git root for project scope when `--project-root` is absent, then use the current directory.
- Deduplicate destinations and preserve the list of consumers for each destination.
- Include `agents/openai.yaml` when any consumer of a destination is Codex.

Tests:

- Resolve every user and project path.
- Reject unknown targets.
- Deduplicate Codex and Antigravity project destinations.
- Preserve Codex-specific payload metadata on shared destinations.

### Interactive selector

- Add `installer/selector.mjs` with a pure selection-state model and a terminal adapter.
- Render All first, followed by a blank line and the five tool rows.
- Support up, down, space, Enter, Escape, `Ctrl+C`, and primary-button mouse clicks.
- Maintain the All invariant in both directions.
- Use a buffered parser because terminal escape sequences may arrive across multiple input chunks.
- Use a terminal alternate screen during selection so mouse row coordinates remain deterministic.
- Restore raw input, cursor visibility, alternate-screen state, and mouse reporting on every exit path.
- Keep the wordmark monochrome.
- Fall back to keyboard when a terminal does not report mouse events.

Tests:

- Exercise every state transition without a real terminal.
- Parse complete and split keyboard sequences.
- Parse primary mouse clicks and ignore unsupported mouse buttons.
- Confirm cancellation and terminal cleanup paths.

### CLI and installation engine

- Add `installer/install.mjs`.
- Support `--targets`, `--all`, `--scope`, `--project-root`, `--dry-run`, `--yes`, and `--help`.
- Treat `--targets` and `--all` as mutually exclusive and skip the selector when either is present.
- Validate the source payload before resolving destinations.
- Compare complete installed payloads and skip identical destinations.
- Stage each installation under its destination parent.
- Move differing destinations to timestamped backups before replacement.
- Restore a backup if final placement fails.
- Continue independent destinations after one failure and return a nonzero exit status for partial failure.
- Report legacy Codex installations without altering them.

Tests:

- Install selected targets under temporary homes and projects.
- Install all targets.
- Verify dry-run makes no changes.
- Verify identical installations are skipped.
- Verify replacements require authorization and create backups.
- Verify partial failure reporting.
- Verify installed payload contents and exclusions.
- Verify target flags bypass the selector.

### Launchers

- Add `install.sh` and `install.ps1` as thin launchers.
- Resolve the repository path instead of depending on the caller's current directory.
- Check for Node.js and forward all arguments and exit codes.
- Keep launchers free of installation policy.

Verification:

```sh
npm test
./install.sh --all --scope user --dry-run
./install.sh --targets codex,cursor --scope project --project-root "$(mktemp -d)" --dry-run
```

Run the PowerShell smoke test when `pwsh` is available and report a skip otherwise.

## Commit 4: Public project documentation

- Add `.gitignore` for operating-system, editor, dependency, coverage, and temporary installer files.
- Add `README.md` with the wordmark, purpose, supported targets, installation, flags, invocation, architecture, safety, development, contribution, security, and license sections.
- Add the MIT `LICENSE` for Giuseppe Turitto.
- Add Contributor Covenant 2.1 as `CODE_OF_CONDUCT.md`, with `giuseppe@turitto.com` as the enforcement contact.
- Add `CONTRIBUTING.md`, `SECURITY.md`, and `CHANGELOG.md`.
- Add bug and feature issue forms plus a pull-request template under `.github/`.
- Keep instructions aligned with observable installer behavior.

Verification:

```sh
npm test
git diff --check
```

When Codex's `skill-creator` tooling is available, also run its quick validator
against the repository root.

## Final verification

- Review the complete diff and commit history.
- Run the full local test suite.
- Run shell dry-runs for all targets and a selected subset.
- Run the structural skill validator.
- Confirm that no repository or installer files leak into installed skill payloads.
- Scan tracked files for secrets and private credentials.

## Publish

After local verification succeeds:

1. Create the public repository `GTuritto/quorum` without remote-generated files.
2. Add the repository as `origin` and push `main`.
3. Set the public description and repository topics.
4. Create and push annotated tag `v0.1.57` at the verified installer revision.
5. Publish GitHub release `v0.1.57` from the changelog.
6. Verify public visibility, default branch, topics, community profile, license detection, tag, and release.

## Stop conditions

- Stop before publication if tests fail, version declarations differ, or the diff contains credentials.
- Stop and report if `GTuritto/quorum` becomes unavailable or GitHub authentication changes.
- Do not alter the existing legacy Codex installation during implementation or publication.
