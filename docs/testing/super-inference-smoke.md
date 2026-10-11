# Super inference verification

Date: 2026-10-11. Version 0.1.82 release candidate against the published
0.1.81 baseline. Tests use disposable project installations; active user
installations are unchanged.

## Automated evidence

- `npm test`: 193 tests pass, including existing routing, exploration, storage,
  installer and receipt tests, plus 20 new Super policy/contract checks.
- Installer integration passes, including the available PowerShell smoke.
- `npm run dist`: exact npm allowlist, TGZ, ZIP and checksums pass; packed installer
  coverage compares every installed reference file byte-for-byte with source.
- `git diff --check` passes. No dependency, extra runtime model call, or automatic
  host setting modification is introduced.
- Reference-policy coverage checks explicit-only routing, Direct bypass, profile
  inheritance and slot bounds, provider/model/effort support, effective host
  overrides, capacity fallback, reservations, failed replacements, pending slots,
  independent review, missing settings evidence, substitution, slot coverage,
  same-model provenance, and exploration receipts.
- Contract checks require lazy loading after Direct normalization, pre-dispatch
  profile binding, both host bindings, setting-aware receipts and packaged paths.

These tests exercise the development JavaScript reference policy and the shipped
instruction text. They do not execute host agents or prove compliance by an LLM.
The reference policy is excluded from the shipped skill; host execution follows
the portable protocol. Aliases must be resolved by the host, not the test fixtures.

## Fresh-host observations

Tested Codex CLI 0.160.1 and Claude Code 2.1.220 in disposable source-built
project installations. Each CLI case started a fresh process. Only tool actions,
final answers and usage metadata were retained; private reasoning was discarded.
The tested requests were read-only, with no subprocess LLMs or worker launches
allowed inside the CLI cases. They establish bounded routing/loading behavior,
not full multi-agent operation or an exhaustive host certification.

The first Direct test returned the correct value and zero-worker receipts on
both hosts, but both read the task fixture before the core rules. The entry and
skill description now explicitly require loading the core before task tool calls.
Codex followed that order in one repeat but batched entry and fixture in another.
Claude's final native `/quorum` invocation, with its `Skill` tool enabled, loaded
the core before reading the fixture and did not read Super. Earlier manual-file
Claude tests sometimes loaded its Super-only adapter unnecessarily. These are
observed prompt-adherence limitations, not passing loading-order checks. A prompt
skill cannot provide a deterministic host-side tool gate.

### CLI matrix results

| Case | Codex | Claude Code |
| --- | --- | --- |
| Direct with malformed unused Super controls | Correct value, Direct receipt, zero workers; loading order inconsistent across repeats | Native Skill-tool repeat passes; earlier manual-file path violated loading gates |
| Mini JSON/CSV comparison | Mini receipt; deliberation read, no Full/Super read | Mini receipt; deliberation read, no Full/Super read; premature fixture read |
| Full with maxWorkers=1 | Mini fallback, zero launches, original cap retained | Core/deliberation/Full read; unnecessary Claude Super adapter read; timed out at 60 seconds, no result |
| Super without profiles | Asked for model/effort, no dispatch | Asked for profiles, no dispatch; module order imperfect |
| Super with nonexistent settings and no-worker constraint | Mini fallback with profiles unused, no discovery or launches; unsupported-setting rejection not exercised | Timed out at 60 seconds; no completed verdict |
| Direct memory status | Memory module then helper; enabled=false, no records retrieved | Memory module then helper; enabled=false, no records retrieved |
| Missing Super module | Disclosed missing file, stopped comparison | Disclosed missing file, stopped comparison |

These are observed outcomes, not an all-pass matrix. Timeouts count as incomplete
cases; an exit code of zero alone does not establish protocol adherence. The
unsupported-profile policy is covered deterministically by the reference tests,
not established by the no-worker live case. The final native-invocation repeat
added Claude's `Skill` tool; earlier manual-file cases permitted `Read` and `Bash`
only. Codex ran with a read-only sandbox. No CLI case launched council workers.

Reproduction outline: install with `node installer/install.mjs --targets
codex,claude --project-root /absolute/disposable/project`; place `Sample value:
7` in `fixture.txt`; start a new process for each case. Codex used `exec
--ephemeral --sandbox read-only --skip-git-repo-check --json -C <project>`.
Claude used `-p --permission-mode dontAsk --setting-sources project
--strict-mcp-config --mcp-config '{"mcpServers":{}}' --no-session-persistence
--output-format stream-json --verbose`, with tools restricted as described above.
Prompt the project-local skill explicitly, include the case controls, prohibit
mutations/network/worker launches, and inspect tool actions as well as receipts.
Retain only tool actions, final artifacts and usage; discard thinking blocks.
Use a 60-second case timeout. Do not infer correctness from the final answer alone.

### Native Codex worker-control smoke

A separate bounded panel used fresh `fork_turns=none` contexts, one candidate
requested as `gpt-6-luna`/`low` and one reviewer as `gpt-6-sol`/`medium`, cap 2.
Those combinations came from the live dispatch tool metadata. Both requests
completed. The reviewer received an anonymous artifact, no model/effort labels
or candidate conversation, and caught an unsupported provider-verification claim.
No replacement, extra coordinator, recursive skill or worker tool call was used.

The spawn/list results exposed no effective provider/model/effort metadata.
Requested controls are therefore **unverified**, not copied into actual fields.
Receipt: requested Super → actual Full; 1 candidate + 1 reviewer = 2 launches;
maxWorkers 2; isolated-models-unverified; explorationApplied false. Actual
provider/model/effort are unknown for both attempts. This demonstrates dispatch
acceptance, isolation and honest downgrade, not verified Super execution.

### Claude effort limitation

Claude Code 2.1.220 predates documented v2.1.292 per-invocation effort support.
Its CLI exposes session-level `--effort`, which is not evidence of per-subagent
control. Scoped definition support and effective per-agent settings were not
established on this installation. No upgrade or global configuration change was
performed. Verified mixed-model/effort Super remains unproven on this host.

## Static prompt cost

Measured with tiktoken 0.11.0, `o200k_base`, summing file encodings.
These are fresh-context Codex instruction paths, not billed usage or latency.

| Path | Without memory module | With memory module |
| --- | ---: | ---: |
| Direct | 3,191 | 3,838 |
| Mini | 4,098 | 4,745 |
| Full | 4,575 | 5,222 |
| Super | 5,618 | 6,265 |

The Direct baseline at Git HEAD was 2,982 tokens; this extension adds
209 tokens (7.0%) to the common entry/core/Codex binding.
The 1,043-token Super module loads only for an explicit Super request.
Claude Code Super additionally loads its 318-token binding and does not load
the 306-token Codex binding. Previously loaded text remains in context.
No claim about the cost of model generations, reviewer quality or savings follows
from these static measurements. The larger module is reserved for explicit tasks.

## Extended host procedure and remaining coverage

Use disposable source-built installations. Start a fresh session for each loading
case, except the explicit reuse test. Use supported model IDs from actual host
metadata. Observe tool launch arguments, host-confirmed settings, artifacts and
receipts. Worker self-reports do not verify model identity or effort.

| Scenario | Required observations |
| --- | --- |
| Routine and consequential Auto requests | Original Direct/Mini/Full routing; never Super, even for difficult work. No Super or Claude binding read. |
| Direct prefix with malformed Super profiles | Normalize Direct before profile validation or Super reads; zero workers. |
| Explicit Full with inference profiles | Clarify that profiles require Super, without silently escalating. |
| Super without profiles | Ask for profiles or a task-specific allocation brief; no launches or maximum-effort assumption. |
| Super 3+1 with mixed models and efforts | Resolve supported same-provider settings and apply by slot. Coordinator unchanged; reviewers receive no model/effort identity cues. |
| Same model, different efforts | Valid Super when actual settings are verified; no distinct-model provenance claim. |
| Unsupported model/effort, cross-provider choice, forced host override | Stop before dispatch and request a supported choice; no global settings writes or silent substitution. |
| Full/Super cap below 2 or unavailable isolation | Disclosed Mini fallback, profiles unused, zero launches; requested tier and cap preserved. |
| Reduced panel | Validate specified profiles and report excluded slots; assignments do not create extra workers. |
| Failed launch, replacement, review reserve | Reuse failed slot profile; every attempt consumes cap; review reserve remains enforced. |
| Runtime substitution or absent setting evidence | Actual settings reported as mismatched/unknown. No successful Super claim; valid independent evidence can support disclosed Full. |
| Super memory-only operation | Common Direct memory operation and receipt; zero workers, assignments unused; no model discovery. |
| Later unrelated task | Super settings do not persist or raise the default tier. |
| Missing Super/Claude binding | Stop affected Super work and disclose; ordinary modes remain available. |
| Claude Code version/environment/managed overrides | Verify effective controls, preserve session thinking on/off, and detect overridden effort/model. No unsupported per-invocation call. |

The bounded host observations above do not establish the entire extended matrix.
Same-context reuse, forced compaction, mixed memory mutations, failure/replacement
injection, and verified effective settings remain follow-up acceptance work. No
latency, billed-token savings or decision-quality improvement is claimed.
