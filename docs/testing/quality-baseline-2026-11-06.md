# Initial quality baseline

Date: 2026-11-06, Europe/Madrid. Source checkout version: 0.1.84. This records
the introduction of the quality ladder and benchmark tooling, not a new skill
release or a host certification.

| Level | Result | Limit |
| --- | --- | --- |
| L0 source/package | `git diff --check` and `TZ=UTC npm run dist` passed; both archive hashes passed against `dist/SHA256SUMS`. | The distribution includes the unchanged 0.1.84 skill payload; benchmark tooling is a development artifact. |
| L1 deterministic | `npm test` passed 200 Node tests, including four benchmark and quality-history tests. | Reference-policy and manifest checks do not execute host prompts. |
| L2 integration | Installer integration passed in `npm test`. | Does not cover every host version or real user installation. |
| L3 host behavior | No new run for this quality change. The existing [0.1.84 follow-up](0.1.84-release.md) records bounded Codex CLI failures. | Core-loading order and receipt issues remain open. |
| L4 decision quality | Four synthetic cases validated with `npm run benchmark:check`; zero model runs were scored. | No improvement over Full, ADHD, or another comparator is established. |

The scorer only summarizes human-entered ratings and preserves hard-failure
counts. Before claiming improved decisions, run repeated task-matched
comparisons with preserved artifacts and independent assessment where practical.
The append-only [QA snapshots](../../benchmarks/results/) record the checks and
explicitly mark decision-quality benchmarking as not run.
