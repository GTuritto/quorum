# Creative Exploration Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to execute and review each task. No commits or publication are authorized.

**Goal:** Implement the approved 0.1.65 creative exploration behavior.

**Architecture:** Extend the portable instructions and development-only reference policy. Exploration is independent of worker allocation and uses existing generation, review, and synthesis stages.

**Tech Stack:** Markdown/SudoLang, Node.js built-ins, node:test.

**Spec:** ../specs/2026-09-17-creative-exploration-design.md

## Global constraints

- Request-scoped auto/on/off; no saved configuration.
- No new dependencies, installer flags, or runtime service.
- Direct bypass, existing worker caps, review isolation, and honest provenance remain binding.
- Preserve historical releases; prepare 0.1.65 locally without claiming publication.
- Work on codex/0.1.65-creative-exploration; preserve existing roadmap/spec edits.

## Task 1: Portable behavior

Files: SKILL.md, references/protocol.sudo.md, references/codex-adapter.md, tests/creative-protocol.test.mjs.

- [x] Define exploration input, resolution, candidate option fields, evaluation rubric, and receipt fields in all three surfaces.
- [x] Integrate resolution before auto routing: exploration intent selects at least mini unless explicitly direct; consequential uncertainty can still select full. Explicit on or new alternatives invalidates decision reuse.
- [x] Connect candidate bundles (baseline and exploratory options) to mini/full generation, anonymized review, and synthesis. Preserve independent worker counts regardless of option count.
- [x] Document conditional constraints, no fabricated evidence, actionable experiments, fallback, and request reset.
- [x] Add structural checks for all surfaces; run node --test tests/creative-protocol.test.mjs.

## Task 2: Reference policy

Files: scripts/deliberation-policy.mjs, tests/creative-policy.test.mjs.

Interface: planDeliberation accepts exploration and semantic signals.exploratoryIntent/newAlternatives. Returns requestedExploration and explorationActive; receipt reports explorationApplied using final tier.

- [x] Write tests before implementation: auto intent -> mini/active/zero workers; explicit off -> inactive; full/on leaves allocation unchanged; Direct ignores invalid exploration; explicit direct validates but bypasses; newAlternatives invalidates reuse even with off; request controls reset; mini fallback preserves exploration; direct fallback reports not applied with spent launches.
- [x] Run node --test tests/creative-policy.test.mjs and observe failures.
- [x] Validate enum (including rejecting null), resolve intent, integrate auto routing and reuse invalidation, and append factual receipt state/reasons.
- [x] Run node --test tests/creative-policy.test.mjs tests/deliberation-policy.test.mjs.

## Task 3: Integration and release preparation

Files: README.md, VERSION, package.json, SKILL.md metadata, CHANGELOG.md, ROADMAP.md, current-version tests, docs/testing/0.1.65-smoke.md, approved spec.

- [x] Document examples, activation, small experiments, and budget distinctions in README.
- [x] Update current declarations and test expectations to 0.1.65; preserve historical fixture versions. Label the release locally prepared, not published.
- [x] Run npm test, npm run dist, git diff --check; inspect packlist and version declarations.
- [x] Record semantic host scenarios, including software and non-code exploration, strict constraints, mini, isolated full 1+1, and budget fallback. Mark host limits accurately.
- [x] Independently review the complete change, fix actionable findings, rerun affected checks, and mark completion. No commit/push/tag/publish.

## Execution rulings

- User approved the design and implementation on 2026-09-18; no further design gate is needed.
- Auto exploration routes to mini when useful, after direct overrides and consequential full criteria. Otherwise automatic activation would silently resolve to direct for ordinary brainstorming.
- Tasks 1 and 2 share field names only; Task 3 integrates after both. Worker count is not idea count.

## Completion evidence

135 Node tests, installer integration, distribution build, payload/hash checks,
and seven behavioral smoke cases passed. Independent review has no open findings.
See ../../testing/0.1.65-smoke.md. No commit, push, tag, or publication performed.
