# Quorum

**Give your AI coding agent a structured second opinion.**

Quorum is a skill for challenging implementation plans, reviewing code, and
comparing approaches inside your coding assistant. It helps surface assumptions,
tradeoffs, and disagreements before you commit to a decision.

Start with Codex or Claude Code. The installer also supports Cursor,
GitHub Copilot in VS Code, and Antigravity. Available reasoning modes depend on
what your host supports.

[![npm version](https://img.shields.io/npm/v/quorum-skill)](https://www.npmjs.com/package/quorum-skill)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Current release: **QUORUM v0.1.65**. The npm badge tracks the published package.
Creative exploration is included in this release.

## Quick start

Requires **Node.js 18 or later** and a supported coding assistant.

Install for Codex or Claude Code from your terminal:

```sh
npx quorum-skill --targets codex
# Or, for Claude Code:
npx quorum-skill --targets claude
```

Then start a new session in your assistant, provide an implementation plan and
its relevant requirements, and ask:

```text
Use Quorum to review this implementation plan before I start coding.
Check it against the requirements and repository context. Identify unsupported
assumptions, compare alternatives where useful, and recommend what to change.
State any unresolved disagreements and what evidence would resolve them.
```

In Codex, you can also invoke the skill explicitly with `$quorum`.

Look for a recommendation with reasons, material dissent, uncertainty, and a
receipt stating which reasoning mode actually ran. Verify consequential findings
against your code and tests before acting on them.

[More usage examples](#use-quorum) · [Reasoning controls](#control-deliberation) ·
[Installation and updates](#install) · [How it works](#how-it-works)

## When to use it

| Situation | Ask Quorum to… |
| --- | --- |
| An implementation plan is ready for review | Challenge assumptions and check the plan against requirements. |
| A code change has consequential tradeoffs | Review the change and identify concerns supported by the surrounding code. |
| Two approaches both look plausible | Compare them against your constraints and explain the recommendation. |
| A migration is difficult to reverse | Examine failure modes, rollout options, and unresolved risks. |

Routine lookups and straightforward edits stay direct. Use deliberation when
another perspective could change the decision.

## What it adds to a review prompt

Quorum packages a repeatable process: candidate perspectives, challenge through
Analyst, Skeptic, and Pragmatist lenses, and a synthesis that preserves material
disagreement. You can choose the level of deliberation and bound worker usage.

- **Direct:** answer without optional deliberation or delegated workers.
- **Mini:** apply multiple perspectives in one context, with zero delegated workers.
- **Full:** use isolated candidates and independent review when the host supports
  delegation, then synthesize the findings. Fall back transparently when needed.

Mini is not independent model agreement. Full can use workers running the same
model; distinct-model participation is claimed only when actually verified.
Quorum uses your host's capabilities and needs no separate council service.

Extra review can take more time and model usage. It does not guarantee a better
answer than a well-written review prompt. Check the execution receipt and judge
the result by verified findings, not the number of perspectives.

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

### Explore creative alternatives

Ask Quorum to develop grounded options alongside unconventional possibilities:

```text
Use mini Quorum to explore unusual ways to reduce onboarding friction.
Use full Quorum with 1 candidate and 1 reviewer to explore alternatives
for our internal search tool. Keep all data on our existing infrastructure.
Use Quorum with exploration off to evaluate this fixed proposal.
```

Exploration defaults to `auto`: it activates for requests seeking ideas,
alternatives, brainstorming, or reframing. Set it `on` to request it explicitly
or `off` to disable it for the current request. These are assistant instructions,
not npm flags. Difficulty alone does not activate creative exploration.

Quorum develops options before evaluating them. It seeks a practical baseline
and materially different alternatives, labels assumptions and speculation,
and proposes a small experiment with an observable success or failure signal.
Promising unusual ideas can survive disagreement; originality does not establish
feasibility or truth. Ideas that require changing a hard constraint remain
conditional until you agree to that change.

Exploration uses the existing tier and worker budget. Mini uses zero workers;
full can generate several ideas per worker without expanding the panel. Direct
or a leading `Direct:` bypasses structured exploration. The execution receipt
reports whether exploration was applied, including any fallback. Controls reset
between unrelated requests; no persistent memory or learning is added.

### Control deliberation

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
| `level: auto` | Direct for routine work, mini for creative exploration or bounded ambiguity, full for consequential uncertainty benefiting from independent investigation. |
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
npx quorum-skill@0.1.65
```

`npx` may ask before downloading an uncached package. Put `-y` before the
package name to suppress that npm prompt:

```sh
npx -y quorum-skill@0.1.65 --all --dry-run
```

This does not suppress Quorum's replacement confirmation. Pass Quorum's
`--yes` option separately only when you intend to replace differing content.

### Manual archive installation

Download the tarball from npm into an empty working directory:

```sh
npm pack quorum-skill@0.1.65
```

On macOS or Linux:

```sh
tar -xzf quorum-skill-0.1.65.tgz &&
cd package &&
./install.sh
```

On Windows PowerShell with `tar` available, run each command after the previous
one succeeds:

```powershell
tar -xzf quorum-skill-0.1.65.tgz
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
applies version 0.1.65 explicitly:

```sh
npx quorum-skill@0.1.65 --update
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

## Why Quorum Exists

Quorum started almost by accident. I installed a local LLM Council implementation to understand how it worked and was impressed by the underlying pattern: let several models attempt the same problem independently, review and challenge their answers, then synthesize the strongest result.

I wanted that pattern inside the tools where I do most of my development work, Codex and Claude Code. My first idea was to put an MCP server around the local council so coding agents could delegate difficult problems to it. Before building that, I remembered a SudoLang prompt I had written years earlier. It approached one problem from several perspectives, let those perspectives challenge one another, and consolidated their conclusions. I began testing how much of the council pattern a prompt could reproduce.

The results were surprisingly useful. I iterated on the prompt in Codex against real engineering problems. Early versions performed structured deliberation inside one model context, but agent delegation changed the experiment. When the host supports it, Quorum can dispatch separate agents to investigate independently instead of only simulating several roles. Those agents can have different responsibilities and, where the host permits, different model and reasoning configurations. One might develop the strongest case for a solution while another searches for flaws, unsupported assumptions, or inconsistencies before their findings are reviewed and synthesized.

That became especially valuable inside coding tools, where agents can inspect the codebase, compare an implementation with its ticket or requirements, and reason with the surrounding project context. Code review, implementation validation, architecture analysis, and difficult debugging emerged as practical uses.

Eventually, keeping this as “that prompt I use” stopped making sense. I wanted a portable approach that could move between repositories and work in both Codex and Claude Code, so I turned it into a skill and named it Quorum. It uses the agent capabilities already available in the host and requires no separate council service.

Quorum is not an implementation of, or replacement for, LLM Council. It grew from the same core idea: difficult decisions often benefit from independent attempts, disagreement, criticism, and synthesis instead of relying on the first plausible reasoning path.

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
every assistant follows the protocol. See the
[verification notes](docs/testing/0.1.65-smoke.md)
for host smoke scenarios and recorded limitations.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution steps and [SECURITY.md](SECURITY.md) for private vulnerability reporting.

## License

Quorum is available under the [MIT License](LICENSE).
