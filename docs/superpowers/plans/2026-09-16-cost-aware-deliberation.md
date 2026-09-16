# Cost-aware Deliberation Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans or
> superpowers:subagent-driven-development to execute the approved tasks.

**Goal:** Prepare and implement Quorum 0.1.60 with explicit tiers, worker
budgets, conversation decision reuse, and honest execution receipts.

**Architecture:** The shipped implementation is a portable prompt protocol.
A development-only Node reference policy provides deterministic test evidence;
host smoke tests separately check interpretation. The installer remains intact.

**Tech Stack:** Node.js >=18, node:test, Markdown and SudoLang-style pseudocode.

**Spec:** ../specs/2026-09-16-cost-aware-deliberation-design.md

## Global constraints

- No new dependencies, Bun, agent service, or deliberation installer flags.
- No persistent memory, questioning mode, or dynamic specialist routing.
- Preserve existing roadmap edits and npm keywords.
- No commit, push, tag, or publication. Work on codex/quorum-0.1.60.
- A worker cap counts total launches, including failures, not concurrency.
- Direct and mini launch zero workers; full requires one valid isolated
  candidate and one fresh valid independent review. Coordinator synthesizes.

## Task 1: Reference policy and deterministic tests

Files: scripts/deliberation-policy.mjs, tests/deliberation-policy.test.mjs,
tests/fixtures/deliberation-routing.json.

Interface: `planDeliberation(input)` returns requested/actual tier, targets,
allocated counts, maxWorkers, reuse status, and reasons. Inputs use normalized
semantic signals, not brittle keyword parsing. `executionReceipt(plan, launches,
options)` accounts for dispatched worker records and valid results and determines
the final tier. Keep these development utilities outside the package allowlist.

- [x] Write fixture-driven assertions covering explicit tiers, Direct bypass,
  routine/ambiguous/consequential requests, compatible reuse and changed context.
  Example: `assert.equal(planDeliberation({level:'mini'}).tier, 'mini')`.
- [x] Run `node --test tests/deliberation-policy.test.mjs` to establish failure.
- [x] Implement ordered routing and reviewer-reserving allocation from the spec.
  For cap >=2: `r = Math.min(requestedReviewers, cap - 1)`;
  `c = Math.min(requestedCandidates, cap - r)`.
- [x] Test caps 0/1/2/4, defaults 3+1, requested larger panels, invalid controls,
  sequential concurrency, failures and independent-review requirements.
- [x] Run the focused test command; inspect policy against the approved spec.

## Task 2: Shipped prompt behavior and regression checks

Files: SKILL.md, references/protocol.sudo.md, references/codex-adapter.md,
tests/protocol-contract.test.mjs.

- [x] Add level/candidate/reviewer/maxWorkers controls and precedence.
- [x] Replace fixed 3..5 generation and one-worker-per-lens assumptions with
  configured allocation, zero-worker mini, and coordinator synthesis.
- [x] Specify normalized routing, compatible conversation reuse, review reserves,
  retries, sequential waves, anonymous independent review, and truthful fallback.
- [x] Define requested/actual receipts and display rules on all surfaces.
- [x] Add cross-surface structural checks for these invariants, explicitly
  distinguishing structural evidence from semantic host behavior.
- [x] Run `node --test tests/protocol-contract.test.mjs`.

## Task 3: Release metadata and user documentation

Files: VERSION, package.json, README.md, CHANGELOG.md, ROADMAP.md,
tests/version.test.mjs, tests/test-install.sh, relevant current-version tests,
docs/testing/0.1.60-smoke.md.

- [x] Set aligned source versions to 0.1.60, keep historical release evidence.
- [x] Document natural-language controls and optional counts, request lifetime,
  fallback receipts, local preparation status, and Node/npx installation.
- [x] Update assertions that refer to current installer output; retain historical
  semver comparison fixtures. Keep the exact packed-file allowlist unchanged.
- [x] Write manual smoke prompts and expected evidence for direct, mini, full
  1+1, budget fallback, and post-decision execution.

## Task 4: Verification and completion audit

- [x] Run `npm test`, `npm run dist`, and `git diff --check`.
- [x] Check the built tarball's version and protocol, including exclusion of
  development-only policy code and fixtures.
- [x] Exercise host smoke scenarios using isolated agents where possible;
  report host limitations without substituting reference-policy test results.
- [x] Obtain an independent review of spec compliance and code quality; fix
  findings and rerun affected tests.
- [x] Record evidence and residual risks in docs/testing/0.1.60-smoke.md.

## Execution record

- User approved the design and implementation in this task.
- Existing ROADMAP.md and package.json edits belong to the requested work and
  are retained. Commits and external publication remain separate actions.

- Completed: 114 Node tests, installer integration (including available PowerShell
  smoke), archive byte/checksum verification, five Codex host cases, and independent
  review. No open review findings. No commit or publication.
