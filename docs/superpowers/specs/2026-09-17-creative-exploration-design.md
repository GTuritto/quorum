# Quorum 0.1.65: Creative exploration

Date: 2026-09-17
Status: Approved by the user and locally implemented on 2026-09-18; unpublished

## Objective

Help users discover useful possibilities beyond the first conventional answer.
Produce grounded options alongside unconventional alternatives, then evaluate
them without confusing novelty with evidence. Apply to software, products,
strategy, and other open-ended problems.

## Approaches considered

1. Recommended: a request-scoped exploration control layered onto the existing
   deliberation tiers. Infer exploration from the user's intent, with explicit
   on/off overrides. Reuse generation, independent review, and synthesis.
2. Explicit-only creative mode: predictable and easy to invoke, but users must
   know to ask for it even when their problem clearly calls for exploration.
3. A separate creative panel: dedicated ideation agents could increase breadth,
   but add orchestration and cost before the existing workflow needs expansion.

## Activation and controls

Introduce `exploration: auto | on | off`, defaulting to `auto`. Interpret natural
language for the current request; this is not an installer flag or persisted
configuration. For example: "Use mini Quorum to explore unconventional solutions"
or "Use Quorum, but keep creative exploration off."

In auto, activate only when the user seeks new possibilities, alternative
approaches, brainstorming, or problem reframing. Do not activate merely because
a task is difficult. Routine implementation, status checks, factual lookups,
and evaluation of a fixed proposal retain existing behavior.

Explicit on/off overrides inferred intent. A leading `Direct:` or explicit
direct level bypasses the structured exploration workflow and launches no
workers; a normal answer may still be creative when requested. Mini performs
generation and review in one context. Full retains isolated generation and
fresh independent review. Exploration alone never forces full or enlarges the
panel. An explicit request for new alternatives invalidates reuse of an older
decision as a complete answer.

## Generation before evaluation

Use the user's objective, available evidence, and hard constraints to frame
the problem. Infer domain-appropriate cognitive frames within the allocated
panel; do not introduce a specialist catalogue or another routing system.

Seek at least one practical baseline and two materially different exploratory
alternatives when useful and feasible within the existing budget. This is a
content target, not a worker count. A single generator may offer several ideas.
Do not pad the answer with variations or invent feasibility to meet the target;
disclose when fewer useful options survive.

Useful frames include challenging an assumption, transferring an approach from
another domain, combining mechanisms, or reframing the objective. In full,
generators remain isolated and receive no other generator's output. With one
generator, request both grounded and exploratory options while preserving the
existing disclosure about limited independent alternative generation.

Each option records its mechanism, expected benefit, evidence or analogy,
material assumptions, constraints, and a small validation experiment. Generators
describe dependencies but do not rank options or choose a winner. Label
speculation explicitly; do not fabricate supporting facts or external research.

## Review and synthesis

Retain anonymous review through Analyst, Skeptic, and Pragmatist lenses. Assess
usefulness, originality relative to the baseline, feasibility, cost, and risk.
Do not claim an idea is globally novel without evidence. Unknown feasibility
can justify an experiment; it does not automatically justify implementation.

Keep hard constraints binding. An idea requiring a relaxed constraint must be
clearly conditional and cannot become the current recommendation without the
user's agreement. Preserve promising minority ideas with their assumptions and
disagreements rather than treating consensus as proof.

Return a concise grounded recommendation, worthwhile exploratory alternatives,
and the smallest test for the most promising uncertain option. A test states
what assumption it checks, what observable result supports or rejects it, and
its expected effort when estimable. If no option is adequately supported,
recommend an experiment instead of inventing a confident implementation choice.
Proposing an experiment does not authorize executing it.

## Budget, fallback, and provenance

Preserve existing candidate/reviewer targets, launch accounting, review capacity
reservation, and fallback rules. No extra brainstorming or synthesis workers.
When full degrades to mini, retain the exploration intent with honest
internal-simulation provenance and spent-launch counts. If direct is necessary,
give the best concise answer and disclose incomplete exploration when material.

Extend the existing receipt with whether exploration was applied and any
material bypass or fallback. Do not imply that more ideas mean more agents,
different models, or verified evidence. Keep hidden reasoning private.

## Implementation scope

- Align SKILL.md, the portable protocol, and the Codex adapter.
- Extend the development-only reference policy and existing structural tests
  for activation, precedence, reuse invalidation, and receipt semantics.
- Add README examples and a manual behavioral smoke checklist.
- Align current version declarations and release documentation at 0.1.65 during
  implementation, preserving historical records.
- Retain Node.js, the installer interface, and the existing package boundary.

Persistent memory, learning from outcomes, interactive multi-agent questioning,
dynamic specialist catalogues, and token or monetary budgets remain out of scope.
Commit, push, tagging, and publication require separate user authorization.

## Verification and acceptance

Deterministic checks cover auto/on/off, explicit direct and Direct bypass,
ordinary tasks remaining unchanged, new-alternative requests invalidating reuse,
unchanged worker allocation, and fallback receipts. Structural checks verify
that all protocol surfaces preserve generation-before-review and honest evidence.

Manual host scenarios cover a bounded software problem, a non-code idea,
a tight hard constraint, mini with zero workers, full with one generator and
one reviewer, and fallback when full cannot fit the cap. Record actual output
and provenance. Judge semantic diversity, clear assumptions, constraint
adherence, and testable experiments; keyword checks alone cannot establish
creative quality. Mark unavailable host scenarios unverified.

Run npm test, npm run dist, and git diff --check after implementation. Inspect
the packed payload and version alignment. Release publication is a separate step.

## Review decision

The user approved this design and requested implementation on 2026-09-18.
Automatic exploration uses mini unless independent consequential investigation
justifies full; explicit direct overrides remain binding. This resolves how
auto activation interacts with tier routing without increasing worker budgets.
