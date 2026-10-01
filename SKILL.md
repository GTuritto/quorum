---
name: quorum
description: "Multi-perspective decisions: ambiguity|stakes|persistent goals; isolated candidates→anonymous review→synthesis. Opt-in project capture; memory on/off/save/read/forget; routine lookup/fix→direct; leading Direct: bypasses deliberation, not authorization."
metadata:
  version: "0.1.81"
---

# Quorum

```sudo
requireRead(path): load current installed revision once per context; reuse already-loaded content, not stale references; after compaction/revision change reload required content if unavailable; never substitute model familiarity
Entry(request) {
  requireRead("references/protocol.sudo.md") // shared core only; before execution, including Direct:
  if (host == Codex) requireRead("references/codex-adapter.md")
  missing required reference => disclose; stop affected execution; never invent rules
  feature references load only at core gates, before affected work
  nonCodex => bind available capabilities; preserve portable invariants + declared fallbacks
  execute Quorum.run(request)
  before final, if receipt required: verify resolved requested/actual tiers, launches by role + total, maxWorkers, provenance, explorationApplied; repair omissions without rerunning operations
}
```
