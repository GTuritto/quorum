# Quorum Roadmap

This roadmap records intended future work. Items are not committed release
dates or approved implementation specifications.

## Released: 0.1.59

Released on 2026-09-07 through npm trusted publishing with verified
provenance. The package is available from
[npm](https://www.npmjs.com/package/quorum-skill/v/0.1.59), with checksummed
archives attached to the
[GitHub release](https://github.com/GTuritto/quorum/releases/tag/v0.1.59).
The approved design is documented at:
[`docs/superpowers/specs/2026-09-07-version-update-uninstall-design.md`](docs/superpowers/specs/2026-09-07-version-update-uninstall-design.md).

### Version reporting

- Add `npx quorum-skill --version`.
- Print the package version and exit without opening the selector, inspecting
  destinations, or writing files.
- Keep `VERSION`, `package.json`, and `SKILL.md` version metadata aligned.

### Update and upgrade support

- Add `--update` and `--upgrade` as aliases for applying the running package to
  existing Quorum installations.
- Discover managed installations before detecting supported tools.
- When no installation exists and no target was supplied, install for every
  conservatively detected supported tool without opening the selector.
- Require Copilot-specific evidence before automatically selecting the VS Code
  target.
- Accept an explicit parent skills directory through `--skills-dir` and append
  `quorum`.
- Preserve the installer's target selection, dry-run, confirmation, backup,
  atomic replacement, and partial-failure guarantees.
- Report installed and source-package versions before changing files.
- Prevent downgrades and refuse foreign destination content even with `--yes`.
- Keep legacy Codex installations read-only during install and update.

### Permanent uninstall

- Add `--uninstall` for recognized current, custom, and legacy Quorum
  installations.
- Require confirmation unless `--dry-run` or `--yes` is present.
- Remove only the exact Quorum directory or link. Preserve parent directories,
  sibling skills, and update backups.
- Refuse foreign content, current-working-directory removal, symlink-target
  deletion, and destinations that change after confirmation.

### Deferred installer maintenance

- Normalize ZIP timestamps inside the distribution builder so local and CI
  archives remain byte-for-byte reproducible without a caller-supplied UTC
  environment.
- Consider a read-only `--status` command that lists installed targets,
  versions, legacy copies, and modified content.
- Consider `--json` output after the human-readable status model stabilizes.
- Consider explicit backup listing, restoration, and cleanup commands. Never
  remove update backups implicitly.

## Released: 0.1.60

The design is approved in
[`docs/superpowers/specs/2026-09-16-cost-aware-deliberation-design.md`](docs/superpowers/specs/2026-09-16-cost-aware-deliberation-design.md).
Published on 2026-09-16 (UTC) as
[`quorum-skill@0.1.60`](https://www.npmjs.com/package/quorum-skill/v/0.1.60)
through the [version-tag workflow](https://github.com/GTuritto/quorum/actions/runs/35159952498),
with signed provenance.

### Cost-aware deliberation

- Make direct execution the stronger default for routine coding, status checks,
  known-cause fixes, and implementation of already-approved decisions.
- Use the mini tier for meaningfully ambiguous decisions that benefit from
  structured challenge without isolated workers.
- Reserve the full tier for explicit requests and clearly high-stakes,
  consequential, or difficult-to-reverse decisions.
- Return to direct execution after a decision is made instead of applying a new
  council run to every implementation turn.
- Avoid repeating deliberation when the request and material assumptions have
  not changed.

### Cost visibility and controls

- Show a concise execution receipt, such as `Quorum: mini, 0 workers`, stating
  the selected tier and actual worker usage.
- Include candidate and reviewer counts for full runs without exposing hidden
  reasoning.
- Add optional limits for candidate count, reviewer count, or an equivalent
  deliberation budget.
- Accept explicit auto/direct/mini/full requests and worker targets. Default
  full to 3 candidates + 1 reviewer; allow 1+1 with coordinator synthesis.
- Degrade safely from full to mini or direct when the configured budget is
  insufficient, and disclose the degradation when it affects confidence.
- Add deterministic routing and regression tests covering direct, mini, full,
  repeated-decision, and budget-degradation behavior.

## Patch release: 0.1.61

Documentation-only refresh of the npm README, version badge, and current
installation examples. Installer and deliberation behavior are unchanged.

## Released: 0.1.65

### Creative exploration

Help users explore an idea or problem through both grounded approaches and
unconventional possibilities, including reframing the problem itself. The
design is approved in
[`docs/superpowers/specs/2026-09-17-creative-exploration-design.md`](docs/superpowers/specs/2026-09-17-creative-exploration-design.md).
Published on 2026-09-18 (UTC) through npm trusted publishing with signed
provenance. The [GitHub release](https://github.com/GTuritto/quorum/releases/tag/v0.1.65)
includes the workflow archives and checksums. See
[verification evidence](docs/testing/0.1.65-smoke.md).

- Support an optional creative exploration mode for software, product,
  strategy, and other open-ended problems. Infer useful perspectives from the
  initial question and let the user explicitly request broader exploration.
- Generate practical baseline options alongside out-of-the-box alternatives:
  challenge assumptions, borrow approaches from other domains, and combine
  ideas that would not normally be considered together.
- Separate idea generation from critical evaluation so early criticism does
  not eliminate promising unusual ideas before they can be developed.
- Distinguish evidence-backed claims from analogies, assumptions, and
  speculative hypotheses. Creativity must not turn invented facts into
  supporting evidence.
- Respect the user's hard constraints while identifying assumptions that could
  be relaxed with their agreement. Explain when an idea depends on such a change.
- Evaluate options for usefulness, originality, feasibility, cost, and risk.
  Preserve promising minority ideas rather than forcing premature consensus.
- Present a grounded recommendation and worthwhile exploratory alternatives,
  with the smallest experiment or prototype that could test each uncertain idea.
- Keep exploration within the existing deliberation tier and worker budgets;
  requesting creativity alone must not force additional agents or a full run.
- Define evaluation examples for diverse ideas, honest uncertainty, constraint
  adherence, actionable experiments, and budget compliance before implementation.

## Released: 0.1.66

Restore the terminal ASCII logo with one muted blue/teal color per letter in
the README and shared installer banner. Preserve plain output for redirects,
limited-color terminals, `TERM=dumb`, and `NO_COLOR`. Version-only output stays
machine-readable. See [release verification](docs/testing/0.1.66-release.md).

## Planned milestone: 0.2.0

### Configurable decision memory

- Support `off`, `session`, `project`, and `global` memory scopes.
- Resolve settings in this order: request override, project configuration,
  global configuration, then the default scope.
- Choose the default scope during the approved design process, with privacy and
  least-surprise behavior taking priority.
- Store compact decision records, assumptions, uncertainty, provenance, and
  reconsideration triggers without storing hidden reasoning.
- Reuse a remembered decision only when the request and material assumptions
  remain compatible; reject stale or conflicting records.
- Provide clear ways to inspect, forget, and disable stored memory.
- Define storage locations, retention, redaction, portability, concurrent
  access, and failure behavior before implementation.
- Add tests for scope precedence, opt-out behavior, stale-record rejection,
  deletion, and the prohibition on persisting hidden reasoning.

## Proposed follow-up release: 0.2.1

Continue with incremental releases in the 0.2.x series. Move to 0.3.0 or 1.0.0
only after an explicit release-planning decision.

### Interactive questioning mode

- Add an optional questioning mode inspired by `grill-me`, where participating
  agents propose questions about missing information that could materially
  change their evaluations.
- Have the coordinator combine overlapping questions, prioritize consequential
  unknowns, and ask the user one question at a time.
- Share the questions and user answers with every participating agent while
  keeping preliminary evaluations independent until the review stage.
- Let each agent determine which answers affect its evaluation and revise its
  assessment accordingly. Require all agents to respect the user's stated
  requirements and constraints; challenge factual assumptions with evidence
  when appropriate.
- Synthesize the revised evaluations through independent review and Chairman
  synthesis, preserving disagreements and unresolved assumptions.
- Support questioning controls for off, automatic, and explicitly requested
  modes. In automatic mode, ask only when missing user information could change
  the outcome; proceed without an interview for sufficiently specified tasks.
- Bound questions or rounds, allow the user to skip a question or finish the
  interview, and disclose material uncertainty when evaluating with incomplete
  information.
- Keep shared answers within the configured memory scope and honor memory
  opt-out and deletion controls.
- Add tests for question deduplication, prioritization, shared-answer delivery,
  independent evaluation, constraint adherence, question budgets, skipped
  answers, and early completion.

## Future iteration: Dynamic specialist routing

### Adaptive specialist panels

- Separate process roles, such as generation, adversarial review, and Chairman
  synthesis, from domain perspectives.
- Select the number and type of perspectives from task signals instead of using
  one fixed panel for every full run.
- Start with software-engineering perspectives such as Architect, Staff
  Engineer, Security, DevOps/SRE, and QA, while leaving room for additional
  specialist catalogues.
- Add a specialist only when it contributes concerns, evidence, or failure
  modes that the selected panel does not already cover.
- Require relevant perspectives for material risk signals, such as Security for
  authorization, secrets, or supply-chain changes and DevOps/SRE for deployment
  and operational changes.
- Keep specialist analyses isolated, anonymize their outputs, and subject them
  to independent adversarial review before synthesis.
- Allow users to add, exclude, or explicitly select perspectives when the
  router's inferred panel does not fit the task.

### Routing controls and verification

- Bound specialist and reviewer counts through the existing deliberation-budget
  controls and stop expanding the panel when new perspectives repeat existing
  assumptions.
- Use different models or reasoning levels only when the host supports and
  verifies them; preserve accurate provenance when it does not.
- Extend execution receipts to report the selected tier and actual specialist
  and reviewer counts without exposing hidden reasoning.
- Degrade safely when worker capacity or budget cannot support the selected
  panel, and disclose any material effect on confidence.
- Add deterministic routing tests for specialist selection, mandatory risk
  perspectives, user overrides, overlap suppression, budget limits, and
  fallback behavior.

Because npm package versions are immutable, future work will not modify the
published `0.1.58`, `0.1.59`, or `0.1.60` packages. Future changes require
a new version.
