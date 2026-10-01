# Codex Adapter

```sudo
CodexBinding {
  core already loaded by Entry; canonical semantics, no local routing override
  WorkerPool: when selectedTier == full, bind CodexWorkerPool from references/full.sudo.md before discovery/dispatch
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
  ArtifactStore {
    conversation by default; files only with authorized project changes or explicit persistence request
    compact Markdown|YAML|JSON RecoveryCapsule; no private reasoning; validate revision/assumptions on recovery
  }
  Memory: only after memory.sudo.md is loaded, bind canonical Memory to installed references/memory.mjs; never host-global memory
  Output { portable Decision + required receipt; coordinator synthesis; no hidden deliberation }
  authority: worker analysis never authorizes commit/push/deploy/publish/messages/purchases/deletion
}
```
