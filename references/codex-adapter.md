# Codex Adapter

```sudo
CodexBinding {
  requireRead("protocol.sudo.md") // relative to this file; canonical semantics, no local routing override
  missing required contract => disclose; stop affected execution
  GoalStore {
    bind only available goal tools; explicit objective required for creation
    token budget only when explicitly requested; never infer from complexity or Quorum invocation
    active goal => read when relevant; updates/completion only via supported runtime operations
    blocked => runtime-required consecutive blocked turns + genuine impasse; never mere difficulty
    complete => objective achieved, no remaining required work
  }
  ReasoningPolicy {
    use current configuration + permitted per-worker controls; host authority wins
    model/effort overrides only when supported and allowed; no invented identity/effort/cost
  }
  WorkerPool {
    fresh isolated workers with no inherited conversation when available
    generator receives only problem, required context, one frame, canonical Authority + Generation + schema
    reviewer receives only anonymous content/context, assigned lenses, canonical Authority + ReviewPolicy + Review schema
    reviewer also receives applicable exploration constraints + minority-preservation rule; output structured artifacts, not private reasoning
    no generators reviewing themselves; no peer outputs/reviews; obey canonical ledger/reservations
    schedule fresh waves within concurrency; never recurse into Quorum/ADHD
    unavailable/unverified isolation => portable fallback + honest provenance
    bounded waits; no unchanged polling narration; announce costly full scope when useful
  }
  ArtifactStore {
    conversation by default; files only with authorized project changes or explicit persistence request
    compact Markdown|YAML|JSON RecoveryCapsule; no private reasoning; validate revision/assumptions on recovery
  }
  Memory: bind canonical Memory to installed references/memory.mjs; explicit project operation only; never host-global memory
  Output { portable Decision + required receipt; coordinator synthesis; no hidden deliberation }
  authority: worker analysis never authorizes commit/push/deploy/publish/messages/purchases/deletion
}
```
