# Claude Code Super Binding

Loaded only by Super. Shared portable rules and Full still govern this host.

```sudo
ClaudeCodeSuperBinding {
  use non-fork, isolated subagents; bind model + effort through supported Agent arguments or scoped agent definitions
  verify installed version, exposed controls, allowed models/efforts and effective environment/managed overrides before dispatch
  per-invocation effort requires support (documented from v2.1.292); version alone does not establish permission or model support
  if using definitions: model + effort in frontmatter; only scoped files with existing user authorization; no global settings writes
  CLAUDE_CODE_EFFORT_LEVEL can override requested effort; forced subagent model and managed policies can override model choices
  verify resulting settings or report unknown/mismatch; never claim that a prompt changed model or effort
  extended-thinking on/off is inherited from the main session; effort does not independently toggle it
  model aliases must resolve to verified exact IDs within the same provider; do not silently substitute unavailable models
  tool/config support absent => stop affected Super dispatch and offer supported settings or ordinary Full; do not impersonate success
  retain Full isolation/anonymity/launch accounting and Super per-attempt receipt; no candidate/reviewer identity cues
}
```

Capability reference (checked 2026-10-11):
[Claude Code subagent model and effort controls](https://code.claude.com/docs/en/sub-agents#choose-an-effort-level).
Runtime metadata and actual host restrictions take precedence over this reference.
