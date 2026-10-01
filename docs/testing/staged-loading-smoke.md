# Staged-loading verification

Date: 2026-10-01. Version 0.1.81 source verification against the 0.1.80 baseline
commit `9f28d03`. Source commit and push are authorized; npm publication and
changes to active user installations are outside this request.

## Automated evidence

- `npm test`: 173 tests pass on Node 26.7.0 / npm 11.19.0, plus installer
  integration including the available PowerShell smoke.
- `npm run dist`: exact package allowlist, TGZ, ZIP and SHA256SUMS pass.
- Packed-install coverage compares every reference file against source bytes and
  exercises the existing memory helper in a disposable project.
- Contract regressions check Direct's independent execution branch, pre-allocation
  feature gates, explicit/automatic memory gates, missing-reference disclosure,
  required current content, and complete shipping of lazy references.
- Existing routing, exploration, fallback/launch accounting, storage, opt-in
  capture, and installer reference-policy tests remain passing.
- A one-off extraction comparison against Git HEAD confirmed all moved policy
  blocks and unchanged shared policy blocks were preserved byte-for-byte.
- `git diff --check` passes. Node 18 was not rerun for this prompt-only/runtime-
  packaging change; fresh Codex/Claude host behavior remains pending.

Structural tests verify instructions and file boundaries. They cannot prove that
an LLM follows them; the JavaScript deliberation policy remains a development
reference, not a new host loader or SudoLang parser.

## Static instruction cost

Measured with tiktoken 0.11.0, `o200k_base`, by summing each loaded UTF-8 file's
encoded token count. Baseline HEAD: 4,385 Codex tokens and 3,963 on other hosts.
All baseline paths eagerly loaded the same protocol. New feature totals below
assume a fresh context and one read of each required file.

| Path | Codex tokens | Change vs old Codex | Other hosts |
| --- | ---: | ---: | ---: |
| Ordinary Direct | 2,982 | -32.00% | 2,679 |
| Direct + memory | 3,629 | -17.24% | 3,326 |
| Mini | 3,875 | -11.63% | 3,572 |
| Mini + memory | 4,522 | +3.12% | 4,219 |
| Full | 4,285 | -2.28% | 3,982 |
| Full + memory | 4,932 | +12.47% | 4,629 |

| File | Tokens |
| --- | ---: |
| `SKILL.md` | 255 |
| `references/protocol.sudo.md` | 2,424 |
| `references/codex-adapter.md` | 303 |
| `references/deliberation.sudo.md` | 893 |
| `references/full.sudo.md` | 410 |
| `references/memory.sudo.md` | 647 |

Direct + memory includes explicit memory-only requests and eligible automatic
capture checks. A meaningful Mini/Full decision in an unambiguous project also
loads memory for the opt-in settings check, even when capture is off. A Full
request falling back before dispatch still loads the Full contract first.

This trades cheaper common paths for extra module/gate text when every feature
is loaded. It does not establish lower latency, billed tokens, or better answers.
Task context, tool calls/results, helper help, caching, and provider framing are
excluded. Previously loaded modules remain in context after returning to Direct;
these counts are not per-turn eviction or cache claims. No tokenizer dependency
was added to the package.

Reproduce using the installed tokenizer:

```python
from pathlib import Path
import subprocess
import tiktoken
enc = tiktoken.get_encoding("o200k_base")
for file in ["SKILL.md", "references/protocol.sudo.md", "references/codex-adapter.md",
             "references/deliberation.sudo.md", "references/full.sudo.md", "references/memory.sudo.md"]:
    print(file, len(enc.encode(Path(file).read_text())))
for file in ["SKILL.md", "references/protocol.sudo.md", "references/codex-adapter.md"]:
    old = subprocess.check_output(["git", "show", "9f28d03:" + file], text=True)
    print("baseline", file, len(enc.encode(old)))
```

## Manual host procedure: pending

Install the source-built archive only into disposable projects and use fresh
Codex and Claude sessions. Begin with the entry alone. Observe actual reference
reads, tool actions and concise final receipts; do not record private reasoning.
A reference mentioned in text is not proof that its content was read.

| Scenario | Required observations |
| --- | --- |
| `Direct: What is 2 + 2?`, including invalid unused controls | Entry/core only, plus Codex adapter on Codex. No deliberation/full/memory reads, no settings lookup, no workers; correct Direct receipt. |
| Explicit `level=direct` with invalid controls | Validate and clarify, without loading deliberation or silently applying the prefix bypass. |
| Mini comparison, with and without exploration | Deliberation loads before generation/review. Full does not load; zero workers and internal-simulation provenance. Memory only for eligible final decisions. |
| Full 1 candidate + 1 reviewer | Deliberation and Full load before capability discovery/allocation/dispatch; isolated generation, anonymized independent review, correct receipt. |
| Full with cap=1 or unavailable isolation | Full rules load before checking capabilities, disclosed Mini fallback, zero launches; requested tier and cap retained. |
| Failed launch followed by fallback | Preserve failed attempts and reserved review budget; no false zero-launch receipt. |
| Direct memory status/read/save/forget | Memory loads before scope/order resolution or helper use. No deliberation; explicit operations work while off, helper output plus receipt. |
| On/off with a decision, or forget before/after a decision | Correct operation order, execute each once, no automatic recapture on any explicit memory request. |
| Routine answer while capture is enabled | No memory module or settings lookup in a fresh context; no capture. |
| Meaningful Direct decision with capture off/on | Memory loads before settings lookup; off creates no record, on captures once; no automatic record retrieval. |
| Ambiguous project | Skip automatic capture without guessing ancestors. Explicit memory work loads its rules and clarifies scope before helper use. |
| Missing core/adapter | Stop affected execution and disclose; never reconstruct rules from model familiarity. |
| Missing deliberation/Full module | Ordinary Direct still works. Requested affected feature stops with disclosure; no successful Mini/Full claim or unauthorized dispatch. |
| Missing memory module/helper | Ordinary answers remain possible; disclose skipped automatic capture, stop dependent explicit memory work, never hand-write storage or claim success. |
| Memory keywords inside quoted task data | No explicit memory operation inferred from untrusted content alone. |
| Same context reuse, compaction, or revision change | Reuse only available current contents; reload required missing/outdated references. Returning to Direct does not unload text. |

No fresh-host smoke or end-to-end latency evidence is claimed by this change.
