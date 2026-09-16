# Quorum

```text
  ___   _   _   ___   ____   _   _  __  __
 / _ \ | | | | / _ \ |  _ \ | | | ||  \/  |
| | | || | | || | | || |_) || | | || |\/| |
| |_| || |_| || |_| ||  _ < | |_| || |  | |
 \__\_\ \___/  \___/ |_| \_\ \___/ |_|  |_|

                    QUORUM v0.1.60
```

An adaptive multi-perspective reasoning skill for AI coding agents.

Current package: **0.1.60**. Published builds include signed provenance.

[![npm version](https://img.shields.io/npm/v/quorum-skill)](https://www.npmjs.com/package/quorum-skill)
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

## Why Quorum Exists

Quorum started almost by accident. I installed a local LLM Council implementation to understand how it worked and was impressed by the underlying pattern: let several models attempt the same problem independently, review and challenge their answers, then synthesize the strongest result.

I wanted that pattern inside the tools where I do most of my development work, Codex and Claude Code. My first idea was to put an MCP server around the local council so coding agents could delegate difficult problems to it. Before building that, I remembered a SudoLang prompt I had written years earlier. It approached one problem from several perspectives, let those perspectives challenge one another, and consolidated their conclusions. I began testing how much of the council pattern a prompt could reproduce.

The results were surprisingly useful. I iterated on the prompt in Codex against real engineering problems. Early versions performed structured deliberation inside one model context, but agent delegation changed the experiment. When the host supports it, Quorum can dispatch separate agents to investigate independently instead of only simulating several roles. Those agents can have different responsibilities and, where the host permits, different model and reasoning configurations. One might develop the strongest case for a solution while another searches for flaws, unsupported assumptions, or inconsistencies before their findings are reviewed and synthesized.

That became especially valuable inside coding tools, where agents can inspect the codebase, compare an implementation with its ticket or requirements, and reason with the surrounding project context. Code review, implementation validation, architecture analysis, and difficult debugging emerged as practical uses.

Eventually, keeping this as “that prompt I use” stopped making sense. I wanted a portable approach that could move between repositories and work in both Codex and Claude Code, so I turned it into a skill and named it Quorum. It uses the agent capabilities already available in the host and requires no separate council service.

Quorum is not an implementation of, or replacement for, LLM Council. It grew from the same core idea: difficult decisions often benefit from independent attempts, disagreement, criticism, and synthesis instead of relying on the first plausible reasoning path.

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
npx quorum-skill@0.1.61
```

`npx` may ask before downloading an uncached package. Put `-y` before the
package name to suppress that npm prompt:

```sh
npx -y quorum-skill@0.1.61 --all --dry-run
```

This does not suppress Quorum's replacement confirmation. Pass Quorum's
`--yes` option separately only when you intend to replace differing content.

### Manual archive installation

Download the published tarball from npm into an empty working directory:

```sh
npm pack quorum-skill@0.1.61
```

On macOS or Linux:

```sh
tar -xzf quorum-skill-0.1.61.tgz &&
cd package &&
./install.sh
```

On Windows PowerShell with `tar` available, run each command after the previous
one succeeds:

```powershell
tar -xzf quorum-skill-0.1.61.tgz
Set-Location .\package
.\install.ps1
```

The tarball includes the installer and skill payload. Version-tag publishing
does not automatically create a GitHub release or attach ZIP/checksum assets.
The publishing workflow retains its build archives temporarily as Actions
artifacts; `npm run dist` also builds archives from a source checkout.
Use npm for the published package.

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
applies version 0.1.61 explicitly:

```sh
npx quorum-skill@0.1.61 --update
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

### Control deliberation (0.1.60)

Ask in natural language; these controls belong in your assistant request, not
in the npm install command:

```text
Use Quorum at mini level to compare these two approaches.
Use full Quorum with 3 candidates and 2 reviewers to assess this migration.
Use auto Quorum with a maximum of 4 workers total.
Use full Quorum with 1 candidate and 1 reviewer.
```

| Control | Behavior |
| --- | --- |
| `level: auto` | Direct for routine work, mini for bounded ambiguity, full for consequential uncertainty benefiting from independent investigation. |
| `level: direct` | No optional deliberation and no delegated workers. |
| `level: mini` | Analyst, Skeptic, and Pragmatist perspectives in one context; zero delegated workers. |
| `level: full` | Isolated candidates, anonymized independent review, and synthesis by the coordinator. |
| `candidates`, `reviewers` | Positive integer worker targets for full runs; defaults are 3 and 1. |
| `maxWorkers` | Nonnegative integer cap on total launches, including failed workers and replacements; excludes the coordinator. |

Explicit levels override automatic routing, and leading `Direct:` overrides
all deliberation controls. Counts alone do not force a full run. Controls apply
to the current run only; invalid values require clarification before dispatch.
Direct and mini explain explicitly supplied counts that they do not use.

Full defaults to four workers, but **four is not a minimum**: one candidate
plus one fresh independent reviewer is valid, with less alternative generation.
The reviewer can apply all three lenses. Explicit counts without a cap set the
budget to their sum, with defaults filling missing counts. A cap limits rather
than enlarges a requested panel. When constrained, reserve reviewer slots first
while retaining at least one candidate, and report any count reductions.

Total worker budget differs from concurrency: a host may run fresh workers in
successive waves. If the budget cannot fund 1+1 or isolated workers are
unavailable, full falls back to mini. Insufficient time or reasoning budget can
force direct execution with disclosed uncertainty. User controls do not
override host restrictions or authorize extra actions.

Quorum reports what actually ran, for example:

```text
Quorum: requested full; full, 3 candidates + 1 reviewer, 4 workers;
isolated-same-model; synthesis: coordinator
```

Receipts include reductions, failed launches, and fallback reasons when present.
A failed full attempt followed by mini still reports the workers already spent.
Role names never establish distinct-model participation.

After reaching a decision, return to direct implementation. A compatible
decision in the current conversation can be reused; changed evidence, goals,
constraints, or assumptions require reassessment. An explicit full request
starts a fresh run. This does not add persistent decision memory.

## How it works

- [`SKILL.md`](SKILL.md) defines activation, routing, safety, and output behavior.
- [`references/protocol.sudo.md`](references/protocol.sudo.md) is the portable SudoLang-style protocol.
- [`references/codex-adapter.md`](references/codex-adapter.md) maps the protocol to Codex capabilities.
- [`installer/`](installer/) contains the dependency-free installation engine and terminal selector.

Mini runs can simulate several perspectives inside one model context. For full runs, a host with agent delegation can dispatch isolated candidate agents. When supported, those agents can use different models, reasoning levels, and responsibilities. Each candidate receives only the problem, necessary context, a cognitive frame, and an output schema. Candidates are anonymized before review. The final response presents the synthesis, material dissent, and uncertainty without exposing hidden chain of thought.

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

It also checks a development-only deliberation reference policy and consistency
of the shipped prompt contracts. Those deterministic tests do not prove that
every assistant follows the protocol. See the source repository's
`docs/testing/0.1.60-smoke.md` for host smoke scenarios and recorded limitations.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution steps and [SECURITY.md](SECURITY.md) for private vulnerability reporting.

## License

Quorum is available under the [MIT License](LICENSE).
