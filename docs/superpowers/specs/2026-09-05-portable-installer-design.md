# Quorum Portable Installer Design

Date: 2026-09-05
Last updated: 2026-09-06
Version: 0.1.57
Status: Approved for implementation

## Objective

Provide a portable Quorum installer for Codex, Claude Code, Google Antigravity, VS Code with GitHub Copilot, and Cursor. The installer must let a user select several targets or every target in one run through a keyboard-and-mouse terminal interface. It must support user-wide and project-local installation without changing the Quorum protocol.

## Chosen approach

Use one Node.js installer with no third-party packages. Ship two thin launchers:

- `install.sh` starts the installer on macOS and Linux.
- `install.ps1` starts the installer from Windows PowerShell.

The Node.js program owns target selection, terminal input, path resolution, payload copying, backups, and reporting. One implementation prevents the shell and PowerShell versions from drifting. The launchers verify that `node` is available and print a clear installation requirement when it is missing.

Rejected alternatives:

- Native shell and PowerShell implementations would avoid Node.js, but portable terminal mouse handling would be unreliable and the two implementations could drift.
- Bundled executables could provide a richer interface without Node.js, but they would require release artifacts for every operating system and processor architecture.
- One shared skill directory would reduce copies, but Claude Code and Antigravity use separate global locations.

## Files

```text
quorum/
|-- SKILL.md
|-- VERSION
|-- install.sh
|-- install.ps1
|-- README.md
|-- LICENSE
|-- CODE_OF_CONDUCT.md
|-- CONTRIBUTING.md
|-- SECURITY.md
|-- CHANGELOG.md
|-- package.json
|-- .gitignore
|-- .github/
|   |-- ISSUE_TEMPLATE/
|   |   |-- bug_report.yml
|   |   |-- feature_request.yml
|   |   `-- config.yml
|   `-- PULL_REQUEST_TEMPLATE.md
|-- installer/
|   |-- install.mjs
|   |-- selector.mjs
|   `-- targets.mjs
|-- agents/
|   `-- openai.yaml
|-- references/
|   |-- codex-adapter.md
|   `-- protocol.sudo.md
|-- tests/
|   `-- test-install.sh
`-- docs/superpowers/specs/
    `-- 2026-09-05-portable-installer-design.md
```

`VERSION` is the installer source of truth and contains `0.1.57`. `SKILL.md` also exposes `metadata.version: "0.1.57"` for installed-skill inspection. The test suite verifies that both values match.

The portable payload contains:

- `SKILL.md`
- `VERSION`
- `references/`
- `agents/openai.yaml` for Codex installations

Installer code, tests, repository metadata, and documentation are not copied into installed skill directories.

## Target locations

User-wide installation is the default.

| Target | User-wide path | Project-local path |
| --- | --- | --- |
| Codex | `~/.agents/skills/quorum` | `<project>/.agents/skills/quorum` |
| Claude Code | `~/.claude/skills/quorum` | `<project>/.claude/skills/quorum` |
| Antigravity | `~/.gemini/config/skills/quorum` | `<project>/.agents/skills/quorum` |
| VS Code | `~/.copilot/skills/quorum` | `<project>/.github/skills/quorum` |
| Cursor | `~/.cursor/skills/quorum` | `<project>/.cursor/skills/quorum` |

When two selected targets resolve to the same destination, the installer performs one copy and reports both consumers.

## Interactive selection

Running either launcher without target flags opens this selector:

```text
Select one or more targets:

> [ ] All

  [ ] Codex
  [ ] Claude Code
  [ ] Antigravity
  [ ] VS Code
  [ ] Cursor
```

The selector follows these rules:

- Up and down arrows move the highlighted row.
- Space toggles the highlighted row.
- A primary-button mouse click toggles the clicked row when the terminal reports mouse events.
- Enter confirms the current selection.
- Escape or `Ctrl+C` cancels without installing.
- Selecting All selects every tool.
- Deselecting All deselects every tool.
- Deselecting any tool clears All.
- Selecting every tool individually selects All.
- `[ ]` means unselected and `[x]` means selected.
- The All row stays above a blank line and the tool rows.

Keyboard input remains available in terminals that do not report mouse events. The installer restores normal cursor, keyboard, and mouse modes after confirmation, cancellation, errors, and handled process signals.

## Command-line interface

Both installers support:

```text
--targets codex,claude,antigravity,vscode,cursor
--all
--scope user|project
--project-root PATH
--dry-run
--yes
--help
```

Rules:

- `--targets` accepts multiple comma-separated target names.
- `--all` selects every target.
- `--targets` and `--all` are mutually exclusive.
- `--targets` or `--all` preselects the targets and skips the interactive target selector.
- `--scope user` is inferred when scope is omitted.
- Project scope infers the Git root when available, then falls back to the current directory.
- `--project-root` implies project scope.
- A non-interactive run without targets exits with usage guidance instead of guessing.
- Shell and PowerShell return a nonzero status if any selected installation fails.

## Banner

The installer prints the following before the selector or command execution:

```text
  ___   _   _   ___   ____   _   _  __  __
 / _ \ | | | | / _ \ |  _ \ | | | ||  \/  |
| | | || | | || | | || |_) || | | || |\/| |
| |_| || |_| || |_| ||  _ < | |_| || |  | |
 \__\_\ \___/  \___/ |_| \_\ \___/ |_|  |_|

                    QUORUM v0.1.57
```

The wordmark is always monochrome. The installer uses terminal control sequences only for cursor movement, checkbox updates, and supported mouse events.

## Installation flow

1. Read and validate `VERSION` and the payload files relative to the installer.
2. Resolve target flags, or open the selector when targets were not provided.
3. Resolve and deduplicate destination paths.
4. Print the planned writes.
5. For each destination:
   - Skip an identical installation.
   - In dry-run mode, report the action without writing.
   - If different content exists, ask before replacement unless `--yes` is present.
   - Move the old directory to a timestamped sibling backup.
   - Stage the new payload under the destination parent and rename it into place.
   - Restore the backup if the final rename fails.
6. Print installed, updated, skipped, and failed paths.

The installer never removes backups automatically.

## Legacy Codex installation

Codex previously used `${CODEX_HOME:-~/.codex}/skills/quorum`; the current documented user location is `~/.agents/skills/quorum`. When the installer selects Codex and finds the legacy path, it reports the legacy copy.

The first version does not remove or migrate that directory automatically. It tells the user how to compare and remove it after verifying the modern installation. This avoids an implicit destructive migration.

## Error handling

The installer stops before writing when the source payload or version is invalid. It handles one destination failure independently so the final summary can report partial success. It never hides a failed copy, failed backup, or permission error.

Interactive prompts appear only when target selection or replacement authorization is missing. Safe defaults and project-root inference avoid unnecessary questions. The installer restores the terminal before printing any error.

## Verification

`tests/test-install.sh` uses temporary home and project directories. It verifies:

- Multi-target selection installs only the requested targets.
- `all` installs every target.
- The All checkbox mirrors the complete tool selection state.
- Arrow keys, space, Enter, cancellation, and mouse clicks produce the expected selector state transitions.
- `--targets` and `--all` bypass the selector.
- Shared destinations are deduplicated.
- User and project paths are correct.
- Dry-run mode writes nothing.
- Existing differing content requires authorization.
- Authorized replacement creates a backup.
- Installed payloads exclude installer and repository files.
- The banner contains `QUORUM v0.1.57`.
- The banner contains no ANSI color sequences.
- Terminal modes are restored after confirmation, cancellation, and simulated failures.
- `VERSION` matches the version in `SKILL.md`.

PowerShell behavior receives a smoke test when `pwsh` is available. Otherwise, verification reports that the PowerShell smoke test was skipped.

## Git and public distribution

The source remains on the `main` branch with Conventional Commit messages. The approved skill source and design form the baseline commit. The implementation plan and installer follow in focused commits so reviewers can distinguish the protocol, installer, tests, and public documentation.

The public repository is `GTuritto/quorum`. It uses:

- Public visibility.
- `main` as its default branch.
- The description `Adaptive multi-perspective reasoning skill for AI coding agents.`
- Repository topics for Agent Skills, Codex, Claude Code, Antigravity, VS Code, Cursor, LLM councils, and SudoLang.

The public project includes:

- A concise README with purpose, supported tools, installation, invocation, architecture, safety boundaries, development commands, and license information.
- The MIT license with copyright assigned to Giuseppe Turitto.
- Contributor Covenant 2.1 in `CODE_OF_CONDUCT.md`, using `giuseppe@turitto.com` for private enforcement reports.
- Contribution and security policies.
- A changelog beginning with version `0.1.57`.
- Bug and feature issue forms plus a pull-request template.

After all checks pass, create the GitHub repository without generating remote files, add it as `origin`, and push the reviewed local `main` history. Create and push the annotated tag `v0.1.57`, then publish a GitHub release from the changelog. Verify repository visibility, default branch, topics, community-profile files, tag, and release from GitHub.

## Success criteria

- A user can select any combination of the five targets or choose all with the keyboard or a supported terminal mouse.
- The default run is interactive and user-wide.
- Automation can install deterministically without prompts.
- Existing installations remain recoverable.
- The installer displays the approved monochrome Quorum wordmark and version `0.1.57`.
- Quorum remains a valid portable Agent Skill after installation.
- `GTuritto/quorum` is public and contains the reviewed local Git history.
- GitHub recognizes the MIT license and public community-health files.
- The `v0.1.57` tag and GitHub release point to the verified installer revision.
