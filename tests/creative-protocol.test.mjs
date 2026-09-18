import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const surfaces = ["SKILL.md", "references/protocol.sudo.md", "references/codex-adapter.md"];

for (const file of surfaces) {
  test(`${file} defines request-scoped creative exploration`, async () => {
    const text = await readFile(new URL(`../${file}`, import.meta.url), "utf8");

    for (const contract of [
      /exploration[\s\S]{0,100}auto[\s\S]{0,40}on[\s\S]{0,40}off/i,
      /request-scoped|current request/i,
      /explicit[^\n]{0,80}(on|off)[^\n]{0,80}override/i,
      /Direct:[\s\S]{0,240}(bypass|ignore)/i,
      /exploratoryIntent/,
      /newAlternatives/,
      /(explicit[^\n]{0,80}on|newAlternatives)[\s\S]{0,180}invalidat/i,
      /auto[\s\S]{0,300}(mini|full)/i,
      /explorationApplied/,
      /idea\s+count|option\s+count/i,
    ]) assert.match(text, contract, `${file}: missing exploration contract ${contract}`);
  });

  test(`${file} preserves grounded option generation and evaluation`, async () => {
    const text = await readFile(new URL(`../${file}`, import.meta.url), "utf8");

    for (const contract of [
      /baseline/i,
      /exploratory alternatives?/i,
      /mechanism/i,
      /expected\s*benefit/i,
      /evidence|analogy/i,
      /material assumptions?/i,
      /constraints?/i,
      /validation experiment|smallest test/i,
      /usefulness[\s\S]{0,180}originality[\s\S]{0,180}feasibility[\s\S]{0,180}cost[\s\S]{0,180}risk/i,
      /opaque/i,
      /anonym/i,
      /conditional/i,
      /fabricat/i,
      /fallback/i,
    ]) assert.match(text, contract, `${file}: missing option contract ${contract}`);

    assert.ok(
      text.search(/generat(?:e|ion)[\s\S]{0,1600}(?:review|evaluat)/i) >= 0,
      `${file}: generation must precede evaluation`,
    );
  });
}

test("portable protocol resolves exploration before routing and keeps worker allocation independent", async () => {
  const text = await readFile(new URL("../references/protocol.sudo.md", import.meta.url), "utf8");
  const run = text.slice(text.indexOf("  run(input) {"), text.indexOf("## Interpretation notes"));
  const resolveExploration = run.indexOf("resolveExploration");
  const route = run.indexOf("route(");

  assert.ok(resolveExploration >= 0 && route > resolveExploration);
  assert.match(text, /exploration does not (increase|change)[\s\S]{0,140}(worker|candidate|reviewer)/i);
  assert.match(text, /at least one practical baseline[\s\S]{0,160}two materially different exploratory alternatives/i);
});
