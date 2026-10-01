# Quorum

```text
  ___   _   _   ___   ____   _   _  __  __
 / _ \ | | | | / _ \ |  _ \ | | | ||  \/  |
| | | || | | || | | || |_) || | | || |\/| |
| |_| || |_| || |_| ||  _ < | |_| || |  | |
 \__\_\ \___/  \___/ |_| \_\ \___/ |_|  |_|

                    QUORUM v0.1.81
```

**Give your AI coding agent a structured second opinion.**

Quorum helps your coding assistant challenge plans, review code, and compare
approaches before you commit to a decision. It brings multiple perspectives
together and reports a recommendation, disagreements, and uncertainty.

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
To pin this release, use `npx quorum-skill@0.1.81 --targets codex`.

## Use it

Start a new session in your assistant and ask:

```text
Use Quorum to review this implementation plan against the requirements.
Use Quorum to review this code change and identify unsupported assumptions.
Use Quorum to compare these two approaches and recommend one.
```

In Codex, you can also invoke it with `$quorum`.

## Choose the depth

Quorum selects a mode automatically, or you can ask for one:

- **Direct:** a straightforward answer without extra deliberation.
- **Mini:** multiple perspectives in one context, without delegated workers.
- **Full:** isolated candidates and independent review when your assistant
  supports delegation, with a disclosed fallback when it cannot run.

```text
Use mini Quorum to explore ways to simplify onboarding.
Use full Quorum with 1 candidate and 1 reviewer to assess this migration.
```

Quorum uses your assistant's existing capabilities and needs no separate council
service. It reports which mode actually ran. Extra review can take more time and
model usage; verify consequential findings against your code and tests.

## Optional project memory

Ask Quorum to remember a decision, or say “Turn Quorum memory on for this project”
to capture future meaningful decisions automatically. Automatic capture is off
by default. Saved decisions stay local to the project; retrieval requires an
explicit request.

## Update

```sh
npx quorum-skill --update
```

## Learn more

- [User guide](https://github.com/GTuritto/quorum/blob/main/docs/guide.md): advanced controls, project memory, installation options, and uninstall.
- [Why Quorum exists](https://github.com/GTuritto/quorum/blob/main/docs/guide.md#why-quorum-exists)
- [Contributing](https://github.com/GTuritto/quorum/blob/main/CONTRIBUTING.md) · [Changelog](https://github.com/GTuritto/quorum/blob/main/CHANGELOG.md) · [MIT License](LICENSE)
