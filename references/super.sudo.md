# Quorum Super Inference

Extends Full only for an explicit, task-scoped Super request. Paths resolve from
the installed skill root. No model catalog or effort scale is assumed portable.

```sudo
Quorum.Super {
  Activation {
    level=super requires explicit user intent for this task; auto routing never chooses super
    reserve for tasks needing a deliberate model/effort allocation; stakes/complexity alone never activate it
    reset profiles with the request; no persistent preference, automatic escalation, extra coordinator or larger cap
    full rules apply unchanged: generation, anonymity, independent review, reservations, failures, replacements, synthesis
    same provider as the coordinator; different models allowed, never required as a quality or independence guarantee
    strip provider/model/effort identity from anonymous artifacts before review; private slot mapping stays with coordinator
    coordinator keeps current model/effort; this feature configures workers only
  }
  Controls {
    inference={defaults?:{model?,effort?}, agents?:{"candidate-1":{model?,effort?},"reviewer-1":{model?,effort?}}}
    normalize natural-language thinking level to effort; not extended-thinking on/off or a numeric token budget
    one-based slots bounded by requested candidate/reviewer counts; reject duplicates, unknown fields/slots, coordinator assignments
    model/effort = nonempty exact host-supported string | inherit; omitted field inherits; slot field overrides default field
    require at least one concrete model/effort assignment; missing profile => ask one focused question for settings or task-specific allocation brief
    explicit permission to choose profiles => propose task-grounded settings from current host metadata before dispatch; never assume maximum effort
    profiles do not imply panel counts; use existing defaults or explicit counts; Direct: ignores profiles before any Super load/validation
    explicit direct|mini|full|auto with inference => clarify that assignments require super; never silently activate it
    validate syntax before dependent work, even if memory-only or capacity later falls back
  }
  prepare(plan, input, capabilities) {
    requestedProfiles = validated input.inference
    if (plan.tier != super) return unusedProfiles(requestedProfiles, disclosedReason) // includes storageOnly; no model discovery
    discover exact IDs, provider, inherited settings, allowed per-model efforts and permitted overrides through metadata/help only
    resolve aliases only when host mapping verified; unsupported/unknown/ambiguous settings => stop dispatch; ask for supported choice
    merge defaults + slot overrides; resolve inherit to current coordinator model/effort; validate inherited effort against selected model too
    verify every specified combination and same-provider mapping before launch, including slots reduced by the cap
    no silent substitutions, fabricated availability or settings changes through prompt text; no inference probes/test agents
    no global configuration writes, additional provider credentials, environment overrides or unauthorized model changes
    retain reduced/unlaunched slot counts and requested profiles; allocation and maxWorkers still come from Full
    freeze resolved profiles for this run; replacements use the failed slot's profile, consume cap and reserve review launches
    pending/successful slot => no duplicate dispatch; generation cannot resume after review begins
    mismatch observed => stop further dispatch for clarification, preserve completed evidence and all spent launches
    return resolvedProfiles(defaults,slotOverrides,provider) // bind this frozen allocation on every native dispatch
  }
  Receipt {
    extend common receipt with requested + resolved + observed provider/model/effort per launch, slot, role, attempt ID, verification status
    actual values only from reliable host metadata/results; worker self-report or passing an argument is not verification
    absent evidence => actual unknown; status=verified|unverified|mismatch|invalid-slot; never fill actual from requested values
    replacements and failed attempts remain visible; summarize unlaunched/reduced slots without exposing anonymous source mapping to reviewers
    super success requires Full's valid independent results AND every allocated slot completed with verified matching settings
    valid Full evidence but settings/coverage unverified or mismatched => actual tier full, disclose unapplied Super; no retry to manufacture proof
    insufficient independent results => mini/direct under Full fallback; preserve requestedTier=super, ledger and setting outcomes
    memory-only/capacity fallback => assignments unused, zero setting claims; common receipt remains mandatory
    reasoning effort is not a token cap or cross-provider equivalence; no invented billing, cost, latency or quality gains
  }
  HostBinding {
    if (host == Codex) {
      use supported model + reasoning_effort arguments on fresh worker contexts; fork_turns=none when that control exists
      check current tool metadata for permitted model/effort combinations; never copy a static list from training or documentation
      omit inherited controls only if their resolved value is verified; host authority and override restrictions prevail
    }
    if (host == ClaudeCode) requireRead("references/claude-code-adapter.md")
    other hosts => Super only with verified per-agent control and setting evidence; otherwise stop unsupported assignment dispatch
  }
}
```
