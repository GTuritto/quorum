# Testing and quality

Status: initial quality framework, 2026-11-06. It describes evidence required
for future changes; it does not certify current host behavior or decision quality.

## Quality means more than passing tests

Quorum quality has four separately reported dimensions: protocol and safety
boundaries, usefulness of the final decision, accuracy of evidence and receipts,
and time/usage. A single aggregate score must not hide a boundary violation or
an unsupported claim. Repeated agreement among agents is not independent proof.

| Level | Evidence | Typical command or procedure | What it does not prove |
| --- | --- | --- | --- |
| L0: source and package contract | Version, references, lazy-loading contract, packlist, docs and diff checks | `npm test`, `npm run dist`, `git diff --check` | Host instruction order or answer quality |
| L1: deterministic behavior | Reference-policy, helper, and failure-path unit tests | `npm run test:unit` | That a live model follows the prompt protocol |
| L2: installation and upgrade | Disposable target installs, updates, uninstall, archive checks | `npm run test:integration` and release procedure | Behavior in a fresh host session |
| L3: host behavior | Fresh-session tool actions, worker dispatch, final artifacts and receipts for affected hosts | Versioned smoke procedures in this directory | Every host version or future run |
| L4: decision quality | Repeated, task-matched, blinded assessment of artifacts, with usage and latency | [Benchmark procedure](../../benchmarks/README.md) | Universal superiority or permanent model rankings |

L0 through L2 are the fast automated gate for source changes. A change to a
prompt, adapter, mode, or host-facing claim also needs relevant L3 evidence
before release. A claim that a new panel, model choice, or reasoning process
improves outcomes needs L4 comparison. Record failures and incomplete runs;
do not convert a timeout, accepted dispatch argument, or plausible answer into
a pass. If a level cannot run, name the missing evidence in release notes.

## Evidence record

For L3 and L4, retain the exact source revision, installed payload version,
host and host version, task and controls, actual tool/worker actions, final
artifact, receipt, evaluation rubric, and observed latency/usage when exposed.
Keep raw hidden reasoning, secrets, and personal data out of the public corpus.
Separate requested model settings from host-observed settings. Include the
comparator and assessor protocol for quality claims.

The [public benchmark corpus](../../benchmarks/README.md) begins with synthetic
decision tasks. Its manifest check verifies case structure only. It cannot run
Quorum, grade an answer, or repair the host-ordering failures recorded in the
[0.1.84 follow-up](0.1.84-release.md). Public cases are suitable for regression
and workflow practice; reserve unseen cases for a stronger quality claim.
The [initial baseline](quality-baseline-2026-11-06.md) records which levels
were actually checked when this framework was introduced.

## Versioned baseline history

`npm run quality:record` reruns L0 through L2 and writes an append-only JSON
snapshot in `benchmarks/results/`. With `-- --benchmark <observed-runs.json>`
it also stores sanitized per-run scores and compares each case/variant against
the latest earlier snapshot with the same suite, unchanged case definition,
host, and configuration. It
does not execute models. A snapshot with no observed benchmark runs records
L4 as not run, not as a zero score. Keep the associated artifact evidence for
every scored run; the snapshot deliberately omits artifact contents and local
paths. Review new snapshots before committing or sharing them.

The next update uses the latest recorded QA result as its QA baseline. A new
benchmark result uses the latest compatible scored result, which may be older
than the latest QA-only snapshot. Changed hosts or model settings produce a
new series with no direct score comparison. Keep prior snapshots, including
failures, so a regression cannot be erased by rerunning the command.
