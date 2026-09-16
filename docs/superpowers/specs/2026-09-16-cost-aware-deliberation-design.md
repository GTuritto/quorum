# Quorum 0.1.60: Cost-aware deliberation

Date: 2026-09-16
Status: Approved, implemented, and published as 0.1.60

## Objective and scope

Let users select deliberation depth and delegated-agent counts while making
ordinary execution cheaper and reporting actual participation honestly.
Ship the existing npm keywords with this release. Retain Node.js and npx.

This release changes the portable skill, protocol, Codex adapter, documentation,
and verification. It does not introduce an agent service or turn the installer
into a deliberation CLI. Persistent decision memory belongs to 0.2.0;
interactive questioning belongs to 0.2.1. Dynamic specialist routing remains
future work. The original implementation scope excluded commit, push, tag, and
publication; the user separately authorized those actions after verification.
See [release evidence](../../testing/0.1.60-smoke.md#release-verification).

## Approaches considered

1. Request-level controls in the portable protocol, with a development-only
   executable reference policy and behavioral smoke scenarios. Recommended:
   preserves portability and allows precise deterministic checks without
   claiming every host executes JavaScript policy code.
2. Add installer flags and saved configuration. This would conflate installing
   the skill with running it and introduce configuration precedence ahead of
   the memory milestone.
3. Add an executable orchestration engine. It could enforce budgets directly,
   but would add a runtime integration surface beyond this release's scope.

## User controls

Accept natural-language instructions; normalize them to these concepts:

- `level`: auto (default), direct, mini, or full.
- `candidates`: positive integer target for candidate workers in full mode.
- `reviewers`: positive integer target for independent reviewer workers.
- `maxWorkers`: nonnegative integer cap on total worker launches for one run,
  not a concurrency limit. The coordinating agent is excluded.

Examples: "Use mini Quorum", "Use full Quorum with 3 candidates and 2
reviewers", and "Use auto Quorum with at most 4 workers total".

Explicit direct, mini, or full selection overrides automatic routing; auto
uses the routing rules below. A leading `Direct:` overrides all deliberation
options and ignores unused numeric controls without asking about them.
Counts alone do not force full mode.
Direct and mini launch zero delegated workers; explain unused explicit counts
briefly. Reject invalid numeric controls before launching workers and ask one
focused clarification rather than silently inventing a value. Request-level
controls last for the current run, not unrelated future requests.

## Routing and decision reuse

Use ordered rules after resolving explicit controls:

1. A leading `Direct:` or explicit direct, mini, or full selects that tier,
   subject to safe degradation when full cannot run. Auto continues below.
2. Routine coding, lookups, status checks, known-cause fixes, and implementing
   an already-approved decision use direct execution when no new material
   uncertainty requires reconsideration.
3. Reuse a decision in the current conversation when the task, constraints,
   and material assumptions remain compatible. New evidence, a changed goal,
   a changed constraint, or an explicit request to reconsider invalidates reuse.
4. A consequential or difficult-to-reverse decision with meaningful uncertainty
   and value from independent investigation can select full.
5. Bounded ambiguity that benefits from structured challenge selects mini.
6. Otherwise use direct.

Complexity or a long implementation alone is insufficient to require full.
After a decision, implementation returns to direct; invoking Quorum does not
force another council on every turn. Explicit full still requests a fresh run.
Reuse uses conversation context only and does not add persistent memory.

## Full-run allocation and independence

Default to three candidate workers and one independent reviewer worker. The
reviewer applies all three existing Analyst, Skeptic, and Pragmatist lenses;
lenses are perspectives, not a claim about three agents. When multiple
reviewers are requested, distribute the lenses with complete coverage and
use the same rubric. Each reviewer sees anonymized candidates, never other
reviewers' assessments before submitting its own.

The smallest full run is one candidate worker plus one fresh reviewer worker.
Disclose that a single candidate lacks independent alternative generation.
There is no four-worker minimum and no fixed five-candidate maximum when the
user explicitly requests more. The default total launch cap is four when no
counts or cap are supplied. If explicit counts are supplied without a cap,
the cap is their sum after filling unspecified counts with defaults.

Under a tighter cap, reserve at least one reviewer, then allocate candidates
up to their target while reserving reviewers up to their target when possible.
Precisely: reviewers = min(requestedReviewers, cap - 1), then candidates =
min(requestedCandidates, cap - reviewers), for cap >= 2. Both must be at least
one. Report reductions from requested counts. A cap below two or unavailable
isolated workers selects mini with a disclosed reason.

The parent performs Chairman synthesis without a separate worker. Execute
generators in isolated waves when concurrency is limited; low simultaneous
capacity alone does not imply low total capacity. Reviewers must be fresh
contexts, not reused generators. Host restrictions always take precedence.

Count every dispatched worker, including failed workers and replacement
attempts, against the cap. Reserve review capacity before dispatching extra
generators or replacements. A malformed result may be repaired once within
its existing worker; any new worker consumes another launch. Continue full
only with at least one valid candidate and one valid independent review.
Otherwise fall back to mini, retaining launch counts and failure disclosures.
If even mini cannot be completed within available time or reasoning budget,
fall back to direct and preserve uncertainty. Numeric token or currency
accounting is not promised where the host does not expose it.

## Receipts

When Quorum is explicitly invoked or mini/full executes, return a concise
receipt with requested and actual tier, launched candidate/reviewer counts,
total launches, valid result counts when different, provenance, and any
reduction or degradation. Avoid adding Quorum receipts to ordinary unrelated
answers. A direct bypass of an explicit invocation can report zero workers.

Example: `Quorum: full, 3 candidates + 1 reviewer, 4 workers;
isolated-same-model; synthesis: coordinator`.

Internal mini perspectives are not worker launches. If a failed full run
falls back to mini, report both the actual launches already spent and that
the final deliberation used internal simulation. Never relabel a mixed or
failed run as zero workers. Verify distinct-model participation before
claiming it. Never expose hidden reasoning.

Implementation clarification: direct provenance is `none`. Isolated workers
with unknown model identity use `isolated-models-unverified`; unverified
isolation cannot satisfy full's minimum. Record spent-worker provenance
separately on fallback. Direct bypass retains required inputs and goal handling.

## Implementation boundaries

- Align SKILL.md, references/protocol.sudo.md, and references/codex-adapter.md.
- Add a development-only pure reference policy using Node built-ins and
  fixture-driven tests for routing, allocation, receipt accounting, and reuse.
  Do not include it in the published payload or imply it enforces host behavior.
- Document controls, examples, fallback behavior, and a manual host smoke
  checklist. Keep the installer interface unchanged.
- Align VERSION, package.json, skill metadata, and relevant current-version
  documentation at 0.1.60; retain historical release records and clearly mark
  0.1.60 as locally prepared until publication is verified separately.
- Preserve existing roadmap additions and npm keywords.

## Verification and completion criteria

Deterministic cases must cover explicit overrides and Direct precedence;
routine, ambiguous, and consequential decisions; compatible reuse and changed
assumptions; zero-worker mini; a 1+1 full run; default 3+1; explicit larger
panels; tight caps; invalid values; sequential capacity; failures consuming
budget; missing valid review; and honest fallback receipts.

Structural checks must keep the three protocol surfaces aligned with these
controls and invariants. Tests of a reference policy establish only that
policy's behavior, not arbitrary host compliance. Record manual smoke evidence
for direct, mini, full 1+1, constrained fallback, and post-decision execution
where the current host can exercise them; label unavailable host checks as
unverified rather than claiming support.

Run npm test, npm run dist, and git diff --check. Inspect packed payload and
version consistency, review the final diff, and document any residual host
verification limits. Implementation may begin after this design is approved.
