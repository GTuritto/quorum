# Decision-quality benchmark, v1

Status: initial corpus and scoring tool. No live benchmark results are claimed.
Cases are synthetic and public; give an agent only `prompt`, never the criteria.

Run `npm run benchmark:check` to validate the corpus. For an observed run, start
a fresh host session for each case and variant, record host version and Quorum
source revision, and save the final artifact, receipt, tool/worker actions, and
measured usage. Do not save hidden reasoning. Use the same task and comparable
host configuration for a fixed Full panel, a proposed variant, and ADHD where
the case admits open-ended alternatives. Randomize variant order and repeat at
least three times before drawing a comparison.

Two assessors should score anonymized final artifacts independently when
practical. For each case criterion use 0 (absent or contradicted), 1 (partial or
unsupported), or 2 (complete and supported). Record any hard failure separately;
it remains a failure regardless of the numeric score. Resolve assessor
disagreement by citing the artifact, not by averaging away a factual conflict.
Report scores per case and criterion, failures, runs, latency and token usage.
Do not infer cost when billing data is absent. More ideas or longer responses
are not automatically better decisions.

The scoring tool accepts a JSON record with this shape:

```json
{
  "suiteVersion": 1,
  "runs": [
    {
      "caseId": "manual-export-dependency",
      "variant": "fixed-full",
      "host": "host and version",
      "configuration": "model, effort, cap and verified-setting status",
      "sourceRevision": "commit or source identifier",
      "artifact": "path or stable evidence identifier",
      "scores": {"separate-flows": 2, "honest-limits": 2, "next-test": 1},
      "hardFailure": false,
      "latencyMs": 1000,
      "tokens": null
    }
  ]
}
```

`npm run quality:record -- --benchmark /path/to/observed-runs.json` validates
the records and stores per-variant, per-case mean scores and hard-failure
counts. The example above illustrates the input format, not an observed run.
The tool does not execute models or judge semantics. Keep any real run record
with its original artifacts so scores remain auditable. Add held-out cases and
calibrate assessors before using these results for a release quality claim.

After an update, run `npm run quality:record` for automated QA. If observed
benchmark scores are available, run `npm run quality:record -- --benchmark
/path/to/observed-runs.json`. Each invocation writes a new immutable snapshot
under `benchmarks/results/` and compares scores with the latest prior snapshot
having the same suite, unchanged case definition, variant, host and
configuration. It never fills
missing benchmark evidence with a synthetic score. Review and commit the
snapshot with the change when authorized; a local snapshot is not a published
baseline. The comparison includes per-criterion, hard-failure, latency and
token deltas when observed. Fewer than three runs on either side are flagged
as provisional. Run the same command after the next update to get a comparison.
