# Harbor evaluation bridge

Status: development bridge prepared for the unreleased Quorum 0.2.1 candidate.
The initial host baseline completed on 2026-11-09; its single-assessor scores
remain provisional and do not establish a Quorum decision-quality improvement.

Harbor runs agents and models against containerized tasks. Quorum uses it only as
an optional L4 execution harness. Harbor is not a Quorum runtime dependency and
is excluded from the npm package and installed skill.

## Export and run

Install Harbor separately according to its upstream documentation. Export the
public Quorum suite to a disposable directory:

```sh
npm run harbor:export -- --output /tmp/quorum-harbor
harbor datasets init gturitto/quorum -o /tmp/quorum-harbor \
  --author "Giuseppe Turitto" \
  --description "Quorum decision-quality baseline"
```

The export creates one Harbor 1.4 task per public case. Each task asks the agent
to write its final artifact to `/app/quorum-answer.md`. The verifier gives a
binary completion reward based only on whether that file is nonempty. It does
not inspect semantics or establish decision quality.
`harbor datasets init` creates the dataset manifest and discovers the generated
task directories. Harbor 0.25.0 does not scan a directory without that manifest
during `harbor run`.

Run a fixed agent/model configuration with at least three attempts:

```sh
harbor run -p /tmp/quorum-harbor -a codex -m "<model>" -k 3 \
  -o /path/to/private/jobs --job-name quorum-fixed-full
```

Use separate jobs for each variant. Keep the prompt, agent, model, effort,
concurrency policy, and task set fixed when comparing variants. Record requested
settings separately from runtime-observed settings.

## Assess

Keep raw jobs and assessment notes outside the public repository. Give assessors
anonymized final artifacts and the rubric from
`/tmp/quorum-harbor/assessment.json`. Do not expose the rubric to the evaluated
agent. Two assessors should score independently when practical.

Create an assessment file with this shape:

```json
{
  "schemaVersion": 1,
  "runs": [
    {
      "caseId": "manual-export-dependency",
      "variant": "fixed-full",
      "host": "Harbor version and agent adapter version",
      "configuration": "model, effort, cap and verified-setting status",
      "sourceRevision": "Quorum commit",
      "artifact": "stable private evidence identifier",
      "scores": {"separate-flows": 2, "honest-limits": 2, "next-test": 1},
      "hardFailure": false,
      "latencyMs": 1000,
      "tokens": null
    }
  ]
}
```

Convert it to Quorum's observed-run format, then record the append-only quality
snapshot:

```sh
npm run harbor:report -- \
  --assessments /path/to/private/assessments.json \
  --output /tmp/observed-runs.json
npm run quality:record -- --benchmark /tmp/observed-runs.json
```

The report command validates case IDs, complete criterion scores, hard-failure
flags, and required provenance. It does not judge artifacts or infer missing
latency, usage, model identity, or cost. Telemetry validity and consistent source
revisions within each comparison group are checked by the benchmark scorer
during `quality:record`; successful conversion alone does not establish that
the report passes those checks.

## Evidence boundary

Public Quorum may retain sanitized scores through its existing append-only
quality snapshots. Keep provider credentials, raw transcripts, private tasks,
hidden reasoning, personal data, and unpublished model comparisons in private
evidence storage. A successful Harbor job proves only that the configured trial
ran. A completion reward proves only that the required artifact was written.

The [initial host baseline](0.2.1-harbor-baseline.md) records the first completed
run and its limitations.
