import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

// Structural drift checks, not evidence of an LLM obeying the protocol.
test("entry loads the canonical protocol before execution and the adapter only for Codex", async () => {
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

test("adapter binds capabilities without duplicating the portable routing policy", async () => {
  const adapter = await read("references/codex-adapter.md");
  assert.match(adapter, /```sudo/);
  assert.match(adapter, /requireRead\("protocol\.sudo\.md"\)/);
  for (const binding of ["GoalStore", "ReasoningPolicy", "WorkerPool", "ArtifactStore"]) {
    assert.ok(adapter.includes(binding), binding);
  }
  assert.doesNotMatch(adapter, /route\(request|defaultCandidateCount\s*=/);
  assert.match(adapter, /explicit[\s\S]*token budget/i);
  assert.match(adapter, /runtime[\s\S]*blocked/i);
});

test("canonical contract retains controls, allocation, review, and provenance", async () => {
  const protocol = await read("references/protocol.sudo.md");
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
    /no automatic decision memory/i, /maxWorkers=plan\.cap even for direct\|mini/,
  ]) assert.match(protocol, rule);
});

test("Direct still resolves inputs and goals before execution; exploration resolves before routing", async () => {
  const protocol = await read("references/protocol.sudo.md");
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
  const adapter = await read("references/codex-adapter.md");
  assert.match(adapter, /generator receives[^\n]*Authority[^\n]*Generation[^\n]*schema/);
  assert.match(adapter, /reviewer receives[^\n]*Authority[^\n]*ReviewPolicy[^\n]*Review schema/);
  assert.match(adapter, /reviewer[^\n]*exploration constraints[^\n]*minority/);
});

test("required references are reused only after their current content is loaded", async () => {
  const entry = await read("SKILL.md");
  assert.match(entry, /requireRead\(path\)[^\n]*current installed revision[^\n]*once per context/);
});

test("mixed explicit forget operations preserve the requested order and report results", async () => {
  const protocol = await read("references/protocol.sudo.md");
  const run = protocol.slice(protocol.indexOf("  run(input) {"));
  assert.ok(run.indexOf("memory.forgetBeforeEvaluation") >= 0);
  assert.ok(run.indexOf("memory.forgetBeforeEvaluation") < run.indexOf("result ="));
  assert.ok(run.indexOf("memory.forgetAfterEvaluation") > run.indexOf("result ="));
  assert.match(run, /return result \+ memoryReceipts/);
});
