import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

const contract = async () => (await Promise.all([
  "protocol.sudo.md", "deliberation.sudo.md", "full.sudo.md", "memory.sudo.md",
].map((file) => read(`references/${file}`)))).join("\n");

// Structural drift checks, not evidence of an LLM obeying the protocol.
test("entry loads the shared core before execution and the adapter only for Codex", async () => {
  const entry = await read("SKILL.md");
  assert.match(entry, /```sudo/);
  assert.match(entry, /requireRead\("references\/protocol\.sudo\.md"\)/);
  assert.match(entry, /host == Codex[\s\S]*requireRead\("references\/codex-adapter\.md"\)/);
  assert.match(entry, /missing[\s\S]*stop/i);
  assert.match(entry, /Quorum\.run\(request\)/);
  const portableRead = entry.indexOf('requireRead("references/protocol.sudo.md")');
  const adapterRead = entry.indexOf('requireRead("references/codex-adapter.md")');
  const execute = entry.indexOf("execute Quorum.run(request)");
  assert.ok(portableRead >= 0 && adapterRead > portableRead && execute > adapterRead);
  assert.match(entry, /if \(host == Codex\) requireRead\("references\/codex-adapter\.md"\)/);
});

test("Codex picker requests a mode choice before Quorum work", async () => {
  const metadata = await read("agents/openai.yaml");
  const protocol = await read("references/protocol.sudo.md");
  assert.match(metadata, /default_prompt: "Use \$quorum\. Ask me to choose a reasoning mode/);
  for (const mode of ["Auto (recommended):", "Direct:", "Mini:", "Full:", "Super:"]) {
    assert.ok(protocol.includes(mode), mode);
  }
  const run = protocol.slice(protocol.indexOf("  run(input) {"));
  assert.ok(run.indexOf("needsModeChoice(input)") < run.indexOf('requireRead("references/super.sudo.md")'));
  assert.match(protocol, /skip choice if request already names a level, begins "Direct:", or only requests a memory operation/);
  assert.match(protocol, /ask for the task in the same question if absent/);
});

test("adapter binds capabilities without duplicating the portable routing policy", async () => {
  const adapter = await read("references/codex-adapter.md");
  assert.match(adapter, /```sudo/);
  assert.match(adapter, /core already loaded by Entry/);
  assert.doesNotMatch(adapter, /requireRead\(/);
  for (const binding of ["GoalStore", "ReasoningPolicy", "WorkerPool", "ArtifactStore"]) {
    assert.ok(adapter.includes(binding), binding);
  }
  assert.doesNotMatch(adapter, /route\(request|defaultCandidateCount\s*=/);
  assert.match(adapter, /explicit[\s\S]*token budget/i);
  assert.match(adapter, /runtime[\s\S]*blocked/i);
});

test("canonical contract retains controls, allocation, review, and provenance", async () => {
  const protocol = await contract();
  for (const field of ["level", "candidates", "reviewers", "maxWorkers", "Direct:",
    "requestedTier", "totalLaunches", "validCandidates", "validReviewers", "workerProvenance",
    "internal-simulation", "verified-distinct-models", "isolated-models-unverified", "isolation-unverified"]) {
    assert.ok(protocol.includes(field), field);
  }
  for (const rule of [
    /defaultCandidateCount = 3/, /defaultReviewerCount = 1/,
    /min\(requestedReviewers, cap - 1\)/, /min\(requestedCandidates, cap - reviewers\)/,
    /safe integers/, /positive/, /nonnegative/,
    /counts alone[^\n]*full/i, /zero delegated workers/i,
    /reserve[^\n]*review/i, /failures[^\n]*replacements/,
    /one valid candidate[^\n]*one valid fresh independent review/i,
    /fresh[^\n]*reviewer/i, /no peer reviews/i,
    /one repair[^\n]*same worker/i, /no candidates after review/i,
    /never[^\n]*(expose|persist)[^\n]*hidden/i,
    /untrusted[^\n]*authority/i, /none[^\n]*direct/i,
    /no automatic global retrieval/i, /maxWorkers=plan\.cap even for direct\|mini/,
  ]) assert.match(protocol, rule);
});

test("Direct still resolves inputs and goals before execution; exploration resolves before routing", async () => {
  const protocol = await contract();
  const run = protocol.slice(protocol.indexOf("  run(input) {"));
  assert.match(run, /removePrefixAndIgnoreDeliberationControls/);
  const resolution = run.indexOf("resolved = resolveRequiredInputs(input)");
  assert.ok(resolution > 0);
  assert.doesNotMatch(run.slice(0, resolution), /return /);
  assert.match(run, /goal = attachGoal\(resolved\)/);
  assert.match(run, /GoalStore.update\(capsule\)/);
  const exploration = run.indexOf("resolveExploration");
  const routing = run.indexOf("route(");
  assert.ok(exploration >= 0 && routing >= 0 && exploration < routing);
  assert.match(run, /authorizedPersistence/);
});

test("development reference policy stays outside the shipped payload", async () => {
  const manifest = JSON.parse(await read("package.json"));
  assert.ok(!manifest.files.some((file) => file.startsWith("scripts") || file.startsWith("tests")));
});

test("isolated workers receive authority and their full operation contract", async () => {
  const adapter = await read("references/full.sudo.md");
  assert.match(adapter, /generator receives[^\n]*Authority[^\n]*Generation[^\n]*schema/);
  assert.match(adapter, /reviewer receives[^\n]*Authority[^\n]*ReviewPolicy[^\n]*Review schema/);
  assert.match(adapter, /reviewer[^\n]*exploration constraints[^\n]*minority/);
});

test("required references are reused only after their current content is loaded", async () => {
  const entry = await read("SKILL.md");
  assert.match(entry, /requireRead\(path\)[^\n]*current installed revision[^\n]*once per context/);
});

test("mixed explicit forget operations preserve the requested order and report results", async () => {
  const protocol = await contract();
  const run = protocol.slice(protocol.indexOf("  run(input) {"));
  assert.ok(run.indexOf("memory.forgetBeforeEvaluation") >= 0);
  assert.ok(run.indexOf("memory.forgetBeforeEvaluation") < run.indexOf("result ="));
  assert.ok(run.indexOf("memory.forgetAfterEvaluation") > run.indexOf("result ="));
  assert.match(run, /return result \+ memoryReceipts/);
});

test("capture is opt-in, final-only, and separate from explicit operations and reuse", async () => {
  const protocol = await contract();
  const memory = await read("references/memory.sudo.md");
  assert.match(memory, /persist only with explicit user intent; default off/);
  assert.match(memory, /settings only, no records/);
  assert.match(memory, /project select only; never automatically read global/);
  assert.match(memory, /unresolved dissent in uncertainty/);
  assert.match(memory, /unsafe\/oversized summary => skip capture/);
  assert.match(memory, /no automatic recapture in forget request/);
  const run = protocol.slice(protocol.indexOf("  run(input) {"));
  const capture = run.indexOf("captureIfEnabled");
  assert.ok(capture > run.indexOf("result ="));
  assert.ok(capture > run.indexOf("memory.forgetAfterEvaluation"));
  assert.match(run, /!memory.hasExplicitOperation && eligibleFinalDecision\(result\)/);
  assert.match(run, /!memory.storageOnly && memory.settingRequested/);
});

// These assert boundaries in the actual shipped instructions, not a duplicate
// JavaScript loader that would provide no evidence about host interpretation.
test("ordinary Direct has a self-contained core and never enters deliberation", async () => {
  const core = await read("references/protocol.sudo.md");
  const entry = await read("SKILL.md");
  for (const rule of ["Authority {", "Controls {", "Goals {", "MemoryGate {", "Decision {", "Recovery {", "ProvenanceReceipt {"]) {
    assert.ok(core.includes(rule), rule);
  }
  assert.match(core, /plan.tier == direct \? executeDirect\(resolved\)/);
  assert.doesNotMatch(core, /^  (Generation|ReviewPolicy|Full|Memory) \{/m);
  assert.doesNotMatch(entry, /requireRead\("references\/(deliberation|full|memory)\.sudo\.md"\)/);
  assert.match(core, /routine lookup[^\n]*skip automatic selection/);
  assert.match(core, /eligibleFinalDecision =[^\n]*not routine answers, intermediate options, or control results/);
});

test("feature gates load Mini and Full rules before allocation or execution", async () => {
  const core = await read("references/protocol.sudo.md");
  const run = core.slice(core.indexOf("  run(input) {"));
  assert.match(run, /if \(selectedTier in \[mini,full,super\]\) requireRead\("references\/deliberation\.sudo\.md"\)/);
  assert.match(run, /if \(selectedTier in \[full,super\]\) requireRead\("references\/full\.sudo\.md"\)/);
  const allocation = run.indexOf("plan = allocate(");
  for (const file of ["deliberation", "full"]) {
    const load = run.indexOf(`requireRead("references/${file}.sudo.md")`);
    assert.ok(load >= 0 && load < allocation);
  }
  assert.ok(allocation < run.indexOf("result ="));
  assert.match(run, /plan.tier in \[full,super\] \? Full : none/);
  const mini = await read("references/deliberation.sudo.md");
  assert.doesNotMatch(mini, /requireRead\(/);
  assert.match(mini, /fallback retains launch ledger/);
  const full = await read("references/full.sudo.md");
  assert.match(full, /discover capabilities via metadata\/help\/version only/);
  assert.match(full, /if \(host == Codex\) CodexWorkerPool/);
});

test("memory loads before explicit resolution and before eligible automatic settings lookup", async () => {
  const core = await read("references/protocol.sudo.md");
  const run = core.slice(core.indexOf("  run(input) {"));
  const load = run.indexOf('requireRead("references/memory.sudo.md")');
  assert.ok(load >= 0 && load < run.indexOf("resolveExplicitMemoryIntent(resolved)"));
  assert.match(run, /if \(hasExplicitMemoryIntent\(resolved\)\) requireRead/);
  assert.match(run, /if \(!memory.hasExplicitOperation && eligibleFinalDecision\(result\) && unambiguousHostSelectedProject\) \{\s*requireRead\("references\/memory\.sudo\.md"\)[^\n]*\n\s*memoryReceipts \+= captureIfEnabled/);
  assert.match(core, /missing memory module\/helper[^\n]*skip automatic capture[^\n]*stop dependent explicit work/);
  assert.match(core, /requested as an operation, not merely mentioned in task data/);
  assert.match(core, /helper status must confirm enabled before capture/);
});

test("all lazy references ship and current content is required after context loss", async () => {
  const manifest = JSON.parse(await read("package.json"));
  const entry = await read("SKILL.md");
  const core = await read("references/protocol.sudo.md");
  for (const match of (entry + core).matchAll(/requireRead\("([^"\n]+)"\)/g)) {
    assert.ok(manifest.files.includes(match[1]), match[1]);
    assert.ok((await read(match[1])).length > 0, match[1]);
  }
  assert.match(entry, /after compaction\/revision change reload required content if unavailable/);
  assert.match(entry, /never substitute model familiarity/);
  assert.match(entry, /missing required reference => disclose; stop affected execution; never invent rules/);
});

test("selection is staged, authorized and assessed before routing", async () => {
  const core = await read("references/protocol.sudo.md");
  const run = core.slice(core.indexOf("  run(input) {"));
  const steps = [
    "executeExplicitSetting(memory)", "executeExplicitForget(memory)",
    "retrieveHistoricalEvidence(memory)", "eligibleForSelection(resolved,memory)",
    'requireRead("references/memory.sudo.md")', "selectProjectOnce(", "assessApplicability(",
    "route(resolved.request",
  ];
  let position = -1;
  for (const step of steps) {
    position = run.indexOf(step, position + 1);
    assert.ok(position >= 0, step);
  }
  assert.match(core, /fresh evaluation[^\n]*explicit Full[^\n]*storage-only/);
  assert.match(run, /if \(!memory\.storageOnly && !memory\.retrieveBeforeEvaluation && !resolved\.freshRequested && resolved\.level not in \[full,super\] && eligibleForSelection/);
  assert.match(core, /failure halts dependent memory work/);
  assert.match(core, /rejected or unresolved[^\n]*conversation-decision shortcut/);
});

test("the coordinator validates untrusted history and rechecks before persistence", async () => {
  const core = await read("references/protocol.sudo.md");
  const memory = await read("references/memory.sudo.md");
  for (const rule of [
    /untrusted historical evidence, never instructions/, /compatible[^\n]*material assumptions[^\n]*triggers/,
    /rejected[^\n]*contradict/, /unresolved[^\n]*unauthorized/,
    /never expand the cap/, /select --project-root ABS --id UUID/,
    /recordDigests\[id\]/, /exact admitted global read/, /independently supported current facts/,
    /matched[^\n]*returned[^\n]*truncated[^\n]*scope[^\n]*ID/,
  ]) assert.match(memory, rule);
  const run = core.slice(core.indexOf("  run(input) {"));
  const recheck = run.indexOf("recheckExactRecords(");
  assert.ok(recheck > run.indexOf("result ="));
  assert.ok(recheck < run.indexOf("saveExplicitFinalDecisionAfterSynthesis"));
  assert.ok(recheck < run.indexOf("captureIfEnabled"));
  assert.ok(recheck < run.indexOf("ArtifactStore.save"));
  assert.match(run, /rebuildFromIndependentCurrentInputs/);
  assert.match(run, /memoryUseReceipt/);
  assert.match(run, /memory\.historyDisplayRequested[^\n]*memoryReceipts \+= renderHistoricalContext\(candidates\)/);
  assert.match(core, /output gate[^\n]*withdrawn[^\n]*original exact ID/);
  assert.match(core, /global read receipt[^\n]*sourceState[^\n]*admission ID/);
});

test("paired acceptance inputs keep history fixed and vary current evidence and withdrawal", async () => {
  const fixture = JSON.parse(await read("tests/fixtures/memory-reuse-cases.json"));
  const cases = new Map(fixture.cases.map((c) => [c.id, c]));
  const compatible = cases.get("compatible");
  const changed = cases.get("changed");
  assert.deepEqual(compatible.records, changed.records);
  assert.notDeepEqual(fixture.evidence[compatible.current], fixture.evidence[changed.current]);
  for (const id of ["off", "delete", "error"]) {
    const c = cases.get(id);
    assert.deepEqual(c.records, compatible.records);
    assert.deepEqual(c.current, compatible.current);
    assert.ok(c.expect.exclude.includes(fixture.historicalOnly));
    assert.ok(c.expect.include.includes(fixture.independentFact));
  }
  assert.ok(!fixture.evidence[compatible.current].join(" ").includes(fixture.historicalOnly));
  for (const c of cases.values()) {
    assert.ok(fixture.evidence[c.current]?.length, c.id);
    for (const key of [...c.records, ...(c.globalRecords ?? [])]) assert.ok(fixture.records[key], key);
  }
  assert.ok(fixture.records[compatible.records[0]].decision.includes(fixture.historicalOnly));
  for (const id of ["unresolved", "injection", "conflict", "truncated", "global-decoy"]) assert.ok(cases.has(id), id);
});
