# Quorum Full Execution

Extends the loaded core protocol; load only at its declared feature gate.

```sudo
Quorum {
  Full {
    discover capabilities via metadata/help/version only, never inference probes or test workers; every delegated agent/model invocation consumes cap, even an accidental probe (failed candidate attempt, disclose)
    ledger=appendOnlyLaunchLedger; reserve planned review launches before every generator/replacement
    log every dispatch attempt before awaiting; failures never refunded; replacements consume launches
    launch-tool call starts the attempt: shell/CLI argument/startup/permission errors still consume cap; retrying dispatch is a new launch, not same-worker repair
    example cap=2 + first candidate launch fails => mini with 1 spent launch; cannot fund replacement candidate + reserved reviewer
    replacement only for unmet valid-result target within remaining cap; never promised
    malformed result => at most one repair in same worker, then exclude if invalid
    fresh isolated waves when concurrency limited; never share earlier candidates with later generators
    capacity waves => disclose if materially weakening independence
    require one valid candidate + one valid fresh independent review; otherwise fallback retaining ledger
    unverified isolation cannot satisfy minimum, even if role labels differ
    coordinator synthesizes; no extra Chairman worker
  }
}

if (host == Codex) CodexWorkerPool {
    fresh isolated workers with no inherited conversation when available
    generator receives only problem, required context, one frame, canonical Authority + Generation + schema
    reviewer receives only anonymous content/context, assigned lenses, canonical Authority + ReviewPolicy + Review schema
    reviewer also receives applicable exploration constraints + minority-preservation rule; output structured artifacts, not private reasoning
    no generators reviewing themselves; no peer outputs/reviews; obey canonical ledger/reservations
    schedule fresh waves within concurrency; never recurse into Quorum/ADHD
    unavailable/unverified isolation => portable fallback + honest provenance
    bounded waits; no unchanged polling narration; announce costly full scope when useful
}
```
