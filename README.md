# Quorum

```text
  ___   _   _   ___   ____   _   _  __  __
 / _ \ | | | | / _ \ |  _ \ | | | ||  \/  |
| | | || | | || | | || |_) || | | || |\/| |
| |_| || |_| || |_| ||  _ < | |_| || |  | |
 \__\_\ \___/  \___/ |_| \_\ \___/ |_|  |_|

                    QUORUM v0.2.2
```

**Give your AI assistant a structured second opinion.**

Quorum helps your assistant challenge plans, compare approaches, and review
code before you commit to a decision. Use it in coding sessions or general chat
when another perspective could change your answer. It reports a recommendation,
disagreements, and uncertainty.

Works with Codex, Claude Code, Cursor, GitHub Copilot in VS Code, and Antigravity.
Available reasoning modes depend on your assistant's capabilities.

[![npm version](https://img.shields.io/npm/v/quorum-skill)](https://www.npmjs.com/package/quorum-skill)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## Install

Requires **Node.js 18 or later**.

```sh
npx quorum-skill --targets codex
# Or, for Claude Code:
npx quorum-skill --targets claude
```

Run `npx quorum-skill` to detect supported tools, or use `--help` for all options.
Pin this version with `npx quorum-skill@0.2.2 --targets codex`.

## Use it

In a coding session, start a new session in your assistant and ask:

```text
Use Quorum to review this implementation plan against the requirements.
Use Quorum to review this code change and identify unsupported assumptions.
Use Quorum to compare these two approaches and recommend one.
```

In a general chat project, you can use the same review process for a decision
outside software development. Give the assistant your goals and constraints:

```text
Use Quorum to compare these study plans against my available time and goals.
Challenge the assumptions and explain what could change the recommendation.
```

In Codex, you can also invoke it with `$quorum`.
Selecting Quorum from the Codex picker offers a mode choice in chat before the
review. A request that already names a mode starts with that mode.

## Choose the depth

Quorum selects Direct, Mini, or Full automatically. You can also request a mode:

- **Direct:** a straightforward answer without extra deliberation.
- **Mini:** multiple perspectives in one context, without delegated workers.
- **Full:** isolated candidates and independent review when your assistant
  supports delegation, with a disclosed fallback when it cannot run.
- **Super:** explicitly requested Full deliberation with a model and
  reasoning effort assigned per agent for a specific task. Never selected automatically.

```text
Use mini Quorum to explore ways to simplify onboarding.
Use full Quorum with 1 candidate and 1 reviewer to assess this migration.
```

Quorum uses your assistant's existing capabilities and needs no separate council
service. It reports which mode actually ran. Extra review can take more time and
model usage; verify consequential findings against relevant evidence and tests.

## Optional memory

Ask Quorum to remember a decision, or say “Turn Quorum memory on for this project”
to enable automatic capture. In 0.2.2, an existing or new project-on setting also
allows bounded selection of saved local decisions for eligible tasks. Quorum
checks a candidate against current evidence and rechecks the exact record before
relying on it. Project memory defaults off. Explicit historical reads still
work while off, and a request for fresh evaluation skips automatic selection.

Global memory is a separate local store, off by default. Access stays explicit
even when global memory is on. Share one saved project record, preview and
admit it in another project, then request it by exact ID. See the
[user guide](docs/guide.md#project-decision-memory) and
[0.2.2 release verification](docs/testing/0.2.2-release.md).

## Update

```sh
npx quorum-skill --update
```

## Evaluate with Harbor

Quorum 0.2.1 adds a development-only bridge for the
[Harbor agent evaluation framework](https://github.com/harbor-framework/harbor).
It exports the public decision cases as local Harbor tasks and converts completed
human assessments into Quorum's existing observed-run format. Harbor is optional
and is not included in the npm package or installed skill.

```sh
npm run harbor:export -- --output /tmp/quorum-harbor
harbor datasets init gturitto/quorum -o /tmp/quorum-harbor --author "Giuseppe Turitto"
harbor run -p /tmp/quorum-harbor -a codex -m "<model>" -k 3
npm run harbor:report -- --assessments /path/to/assessments.json --output /tmp/observed-runs.json
npm run quality:record -- --benchmark /tmp/observed-runs.json
```

See the [Harbor evaluation procedure](docs/testing/harbor.md) and the
[initial host baseline](docs/testing/0.2.1-harbor-baseline.md) for the assessment
format, privacy boundary, evidence requirements, and current results.

## Learn more

- [User guide](https://github.com/GTuritto/quorum/blob/main/docs/guide.md): advanced controls, project memory, installation options, and uninstall.
- [Testing and quality](https://github.com/GTuritto/quorum/blob/main/docs/testing/quality.md): test levels, host evidence, and decision-quality benchmarks.
- [Why Quorum exists](https://github.com/GTuritto/quorum/blob/main/docs/guide.md#why-quorum-exists)
- [Contributing](https://github.com/GTuritto/quorum/blob/main/CONTRIBUTING.md) · [Changelog](https://github.com/GTuritto/quorum/blob/main/CHANGELOG.md) · [MIT License](LICENSE)
