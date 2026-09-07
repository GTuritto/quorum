# Quorum

```text
  ___   _   _   ___   ____   _   _  __  __
 / _ \ | | | | / _ \ |  _ \ | | | ||  \/  |
| | | || | | || | | || |_) || | | || |\/| |
| |_| || |_| || |_| ||  _ < | |_| || |  | |
 \__\_\ \___/  \___/ |_| \_\ \___/ |_|  |_|

                    QUORUM v0.1.59
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
- Automatic discovery of existing installations and supported tools
- Version-aware updates, dry runs, atomic placement, and recoverable backups
- Guarded permanent uninstall

Quorum is a reasoning protocol, not evidence that several models participated. It never claims distinct-model agreement unless distinct models were actually invoked and verified.

## Requirements

- Node.js 18 or later
- A terminal for interactive target or custom-path input, or explicit target
  options for non-interactive installation

The installer has no third-party package dependencies.

## Install

Run Quorum directly from npm:

```sh
npx quorum-skill
```

Pin the exact release when reproducibility matters:

```sh
npx quorum-skill@0.1.59
```

`npx` may ask before downloading an uncached package. Put `-y` before the
package name to suppress that npm prompt:

```sh
npx -y quorum-skill@0.1.59 --all --dry-run
```

This does not suppress Quorum's replacement confirmation. Pass Quorum's
`--yes` option separately only when you intend to replace differing content.

### Manual archive installation

Download `quorum-skill-0.1.59.tgz` or `quorum-skill-0.1.59.zip` and
`SHA256SUMS` from the [v0.1.59 release](https://github.com/GTuritto/quorum/releases/tag/v0.1.59).

On macOS or Linux:

```sh
grep 'quorum-skill-0.1.59.tgz' SHA256SUMS | shasum -a 256 -c - &&
tar -xzf quorum-skill-0.1.59.tgz &&
cd package &&
./install.sh
```

On Windows PowerShell:

```powershell
$expected = (Select-String "quorum-skill-0.1.59.zip" SHA256SUMS).Line.Split()[0]
$actual = (Get-FileHash quorum-skill-0.1.59.zip -Algorithm SHA256).Hash.ToLower()
if ($actual -ne $expected) { throw "Checksum verification failed" }
Expand-Archive quorum-skill-0.1.59.zip -DestinationPath .
Set-Location .\quorum-skill-0.1.59
.\install.ps1
```

The compact assets contain the installer and skill payload. GitHub's source
archives contain the complete development repository.

On a first installation without target flags, Quorum detects supported tools
and installs for all detected targets. It requires target-specific evidence.
For example, the VS Code target requires the Copilot CLI or an installed
`github.copilot-chat` extension. VS Code alone does not qualify.

If Quorum finds no supported tool, an interactive terminal asks for a parent
skills directory and appends `quorum`. A non-interactive run exits with guidance
to use `--skills-dir`, `--targets`, or `--all`.

A normal no-target run opens the selector when it finds an existing managed
Quorum installation:

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
npx quorum-skill --all --yes
```

Install only Codex, Claude Code, and Cursor:

```sh
npx quorum-skill --targets codex,claude,cursor
```

Preview a project-local installation without writing:

```sh
npx quorum-skill --targets codex,cursor --scope project --dry-run
```

Install into an explicit project:

```sh
npx quorum-skill --all --project-root /path/to/project --yes
```

`--targets`, `--all`, automatic detection, and `--skills-dir` skip the selector.

### Options

| Option | Purpose |
| --- | --- |
| `--targets LIST` | Select a comma-separated subset of targets. |
| `--all` | Select every supported target. |
| `--scope user\|project` | Install user-wide, the default, or into a project. |
| `--project-root PATH` | Set the project destination and imply project scope. |
| `--skills-dir PATH` | Use an explicit parent skills directory and append `quorum`. |
| `--update` | Apply the running package to eligible existing installations. |
| `--upgrade` | Exact alias for `--update`. |
| `--uninstall` | Permanently remove recognized Quorum installations. |
| `--version` | Print the running package version without scanning destinations. |
| `--dry-run` | Show planned actions without writing files. |
| `--yes` | Confirm eligible replacement or permanent removal. |
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

### Version and updates

Show the version supplied by the running package:

```sh
npx quorum-skill --version
```

Update every managed installation that Quorum finds:

```sh
npx quorum-skill --update
```

`--upgrade` is an exact alias. The installer performs no network request and
does not choose a release. npm selects the package first, so this command
applies version 0.1.59 explicitly:

```sh
npx quorum-skill@0.1.59 --update
```

An explicit update target stays absent when it is not installed:

```sh
npx quorum-skill --update --targets codex
```

To update a custom installation, pass the same parent directory used to
install it:

```sh
npx quorum-skill --update --skills-dir /path/to/skills
```

### Permanent uninstall

Preview removal first:

```sh
npx quorum-skill --uninstall --all --dry-run
```

Remove recognized installations permanently:

```sh
npx quorum-skill --uninstall --all --yes
```

Without targets, `--uninstall` removes the recognized current and legacy
installations it discovers. User-scope Codex removal also includes a recognized
legacy copy at `${CODEX_HOME:-~/.codex}/skills/quorum`. Project-scope removal
never reaches into that user path. `--skills-dir` removes only its exact
`quorum` child.

Uninstall creates no backup. It preserves parent directories, sibling skills,
and timestamped update backups. It refuses foreign content and a directory
that contains the current working directory. For a recognized symbolic link,
it removes only the link and preserves its target.

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

- Missing destinations install during normal installation. Explicit update
  targets remain missing.
- Current identical installations are skipped.
- Older, modified, or unknown-version Quorum installations require confirmation
  unless `--yes` is present.
- Newer installations are never downgraded.
- Foreign files and directories and user-managed symbolic links are never
  replaced.
- Eligible replacements move the existing installation to a timestamped sibling
  backup, stage the new payload, and place it atomically.
- A legacy Codex copy under `${CODEX_HOME:-~/.codex}/skills/quorum` remains
  read-only during install and update.
- Every destination is checked again before mutation. A changed destination is
  refused.

Use `--dry-run` before a broad or automated installation.

## Development

```sh
npm test
```

The suite covers target paths, conservative tool detection, CLI routing,
selector state, split terminal escape sequences, mouse clicks, version policy,
safe replacement, permanent uninstall, partial failure, packed execution,
payload contents, and version agreement.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution steps and [SECURITY.md](SECURITY.md) for private vulnerability reporting.

## License

Quorum is available under the [MIT License](LICENSE).
