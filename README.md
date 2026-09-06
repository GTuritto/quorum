# Quorum

```text
  ___   _   _   ___   ____   _   _  __  __
 / _ \ | | | | / _ \ |  _ \ | | | ||  \/  |
| | | || | | || | | || |_) || | | || |\/| |
| |_| || |_| || |_| ||  _ < | |_| || |  | |
 \__\_\ \___/  \___/ |_| \_\ \___/ |_|  |_|

                    QUORUM v0.1.57
```

An adaptive multi-perspective reasoning skill for AI coding agents.

[![Release](https://img.shields.io/github/v/release/GTuritto/quorum)](https://github.com/GTuritto/quorum/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Quorum helps an assistant examine difficult, ambiguous, or consequential decisions through independent candidate perspectives, anonymous review, and concise Chairman synthesis. It uses the least expensive reasoning tier that can produce a reliable answer and preserves uncertainty when the evidence does not support consensus.

## Features

- Analyst, Skeptic, and Pragmatist review lenses
- Adaptive direct, mini, and full deliberation tiers
- SudoLang-style portable protocol
- Explicit provenance for internal simulation, isolated same-model workers, and verified distinct models
- Safe inference for reversible decisions and one focused question when required information cannot be inferred safely
- Portable installer for Codex, Claude Code, Antigravity, VS Code, and Cursor
- Keyboard and mouse multi-select target picker
- Dry runs, atomic placement, and recoverable updates

Quorum is a reasoning protocol, not evidence that several models participated. It never claims distinct-model agreement unless distinct models were actually invoked and verified.

## Requirements

- Node.js 18 or later
- A terminal for the interactive selector, or `--targets`/`--all` for non-interactive installation

The installer has no third-party package dependencies.

## Install

Clone the repository and run the launcher for your platform:

```sh
git clone https://github.com/GTuritto/quorum.git
cd quorum
./install.sh
```

On Windows PowerShell:

```powershell
git clone https://github.com/GTuritto/quorum.git
Set-Location quorum
.\install.ps1
```

With no target flags, the installer opens this selector:

```text
Select one or more targets:

> [ ] All

  [ ] Codex
  [ ] Claude Code
  [ ] Antigravity
  [ ] VS Code
  [ ] Cursor
```

Use Up/Down to move, Space or a primary mouse click to toggle, Enter to confirm, and Escape or `Ctrl+C` to cancel. Selecting `All` selects every tool. If any individual tool is cleared, `All` is cleared too.

### Non-interactive examples

Install for every supported assistant at user scope:

```sh
./install.sh --all --yes
```

Install only Codex, Claude Code, and Cursor:

```sh
./install.sh --targets codex,claude,cursor
```

Preview a project-local installation without writing:

```sh
./install.sh --targets codex,cursor --scope project --dry-run
```

Install into an explicit project:

```sh
./install.sh --all --project-root /path/to/project --yes
```

`--targets` and `--all` skip the interactive selector.

### Options

| Option | Purpose |
| --- | --- |
| `--targets LIST` | Select a comma-separated subset of targets. |
| `--all` | Select every supported target. |
| `--scope user\|project` | Install user-wide, the default, or into a project. |
| `--project-root PATH` | Set the project destination and imply project scope. |
| `--dry-run` | Show planned actions without writing files. |
| `--yes` | Authorize replacement of differing installations. |
| `--help` | Show command help. |

### Installation paths

| Target | User-wide | Project-local |
| --- | --- | --- |
| Codex | `~/.agents/skills/quorum` | `.agents/skills/quorum` |
| Claude Code | `~/.claude/skills/quorum` | `.claude/skills/quorum` |
| Antigravity | `~/.gemini/config/skills/quorum` | `.agents/skills/quorum` |
| VS Code | `~/.copilot/skills/quorum` | `.github/skills/quorum` |
| Cursor | `~/.cursor/skills/quorum` | `.cursor/skills/quorum` |

When targets share a project destination, Quorum writes one copy and reports every consumer.

## Use Quorum

Ask your assistant to use the Quorum skill for a difficult decision. In Codex, you can invoke it explicitly with `$quorum`. Runtimes that expose skills as slash commands may also support `/quorum`.

Examples:

```text
$quorum Should we split this service now or keep the modular monolith?
```

```text
Use Quorum to review this migration plan and recommend the safest rollout.
```

Prefix a request with `Direct:` to bypass optional council deliberation while keeping safety, authorization, and uncertainty rules:

```text
Direct: Summarize the decision in three bullets.
```

Quorum activates automatically only when multiple perspectives are likely to improve the result. Simple lookups and low-stakes transformations stay direct.

## How it works

- [`SKILL.md`](SKILL.md) defines activation, routing, safety, and output behavior.
- [`references/protocol.sudo.md`](references/protocol.sudo.md) is the portable SudoLang-style protocol.
- [`references/codex-adapter.md`](references/codex-adapter.md) maps the protocol to Codex capabilities.
- [`installer/`](installer/) contains the dependency-free installation engine and terminal selector.

For full runs, candidate branches receive only the problem, necessary context, a cognitive frame, and an output schema. Candidates are anonymized before review. The final response presents the synthesis, material dissent, and uncertainty without exposing hidden chain of thought.

## Update safety

- Identical installations are skipped.
- Differing installations require confirmation unless `--yes` is present.
- Existing content is moved to a timestamped sibling backup before replacement.
- The new payload is staged beside the destination and renamed into place.
- Backups are never removed automatically.
- A legacy Codex copy under `${CODEX_HOME:-~/.codex}/skills/quorum` is reported but never changed.

Use `--dry-run` before a broad or automated installation.

## Development

```sh
npm test
```

The suite covers target paths, CLI parsing, selector state, split terminal escape sequences, mouse clicks, safe replacement, partial failure, payload contents, and version agreement.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution steps and [SECURITY.md](SECURITY.md) for private vulnerability reporting.

## License

Quorum is available under the [MIT License](LICENSE).
