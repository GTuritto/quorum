---
name: quorum
description: "Load entry/core before task tools. Multi-perspective decisions: ambiguity|stakes|persistent goals; isolated candidates→anonymous review→synthesis. Opt-in project capture; memory on/off/save/read/forget; Explicit Super: per-agent model/effort for specific tasks; routine lookup/fix→direct; leading Direct: bypasses deliberation, not authorization."
metadata:
  version: "0.1.82"
---

# Quorum

Load the entry's required references before any task tool call, including reads.
Do not batch a task read with the skill-entry read. Finish loading the core (and
Codex adapter on Codex) first, then follow its feature gates.

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
