---
name: quorum
description: "Structured second opinions for AI assistants. Use Quorum to examine consequential questions in coding or general chat, challenge plans, compare options, review code, or save and revisit project decisions. It adapts review depth to task stakes, with independent review when supported. Direct handles routine requests; explicit Super can assign model and effort per agent. Load entry/core before task tools; Direct never bypasses authorization."
metadata:
  version: "0.1.84"
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
