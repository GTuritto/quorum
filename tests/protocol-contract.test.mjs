import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// These checks detect drift in shipped instructions, not host compliance.
for (const file of ["SKILL.md", "references/protocol.sudo.md", "references/codex-adapter.md"]) {
  test(`${file} exposes the portable controls and preserves core invariants`, async () => {
    const text = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    for (const control of ["level", "candidates", "reviewers", "maxWorkers", "Direct:"]) {
      assert.ok(text.includes(control), `${file} must document ${control}`);
    }
    assert.match(text, /zero delegated workers/i);
    assert.match(text, /total (worker )?launches/i);
    assert.match(text, /coordinator/i);
    assert.match(text, /independent review/i);
    assert.match(text, /internal-simulation/);
    assert.match(text, /verified-distinct-models/);
    assert.match(text, /hidden (chain of thought|reasoning)/i);
    for (const requirement of [
      /three candidate|three candidates|defaultCandidateCount = 3/i,
      /one (fresh |independent )?reviewer|defaultReviewerCount = 1/i,
      /reserve[\s\S]{0,160}review/i,
      /min\(requestedReviewers, cap - 1\)/,
      /min\(requestedCandidates, cap - reviewers\)/,
      /one valid candidate[\s\S]{0,35}one\s+valid fresh independent\s+review/i,
      /fail(ed|ures)[\s\S]{0,80}(launch|replacement)/i,
      /invalid[\s\S]{0,100}(clarification|clarify)|clarification[\s\S]{0,80}invalid/i,
      /changed[\s\S]{0,180}constraints[\s\S]{0,180}invalidat/i,
      /provenance[\s\S]{0,40}`none`|`none`:[\s\S]{0,40}direct/i,
    ]) assert.match(text, requirement, `${file}: missing contract ${requirement}`);
    assert.doesNotMatch(text, /three to five isolated candidates|frames = selectDistinctCognitiveFrames\(3\.\./);
  });
}

test("Direct bypass retains shared required-input and goal lifecycle", async () => {
  const protocol = await readFile(new URL("../references/protocol.sudo.md", import.meta.url), "utf8");
  const run = protocol.slice(protocol.indexOf("  run(input) {"), protocol.indexOf("## Interpretation notes"));
  const resolution = run.indexOf("resolved = resolveRequiredInputs(input)");
  assert.ok(resolution > 0);
  assert.doesNotMatch(run.slice(0, resolution), /return /);
  assert.match(run, /goal = attachGoal\(resolved\)/);
  assert.match(run, /GoalStore.update\(capsule\)/);
});

test("development reference policy stays outside the shipped payload", async () => {
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.ok(!manifest.files.some((file) => file.startsWith("scripts") || file.startsWith("tests")));
});
