---
name: quorum
description: "Multi-perspective decisions: ambiguity|stakes|persistent goals; isolated candidates→anonymous review→synthesis. Explicit project memory save/read/forget; routine lookup/fix→direct; leading Direct: bypasses deliberation, not authorization."
metadata:
  version: "0.1.75"
---

# Quorum

```sudo
requireRead(path): load current installed revision once per context; reuse already-loaded content, not stale references
Entry(request) {
  requireRead("references/protocol.sudo.md") // complete portable contract; before execution, including Direct:
  if (host == Codex) requireRead("references/codex-adapter.md")
  missing required reference => disclose; stop affected execution; never invent rules
  nonCodex => bind available capabilities; preserve portable invariants + declared fallbacks
  execute Quorum.run(request)
  before final, if receipt required: verify resolved requested/actual tiers, launches by role + total, maxWorkers, provenance, explorationApplied; repair omissions without rerunning operations
}
```
