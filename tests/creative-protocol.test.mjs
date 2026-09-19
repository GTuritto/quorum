import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const protocol = () => readFile(new URL("../references/protocol.sudo.md", import.meta.url), "utf8");

test("canonical exploration contract preserves activation, invalidation, and receipts", async () => {
  const text = await protocol();
  for (const contract of [
    /exploration = auto[^\n]*auto\|on\|off/,
    /request-scoped/, /explicit on\/off override/i,
    /exploratoryIntent/, /newAlternatives/, /explorationApplied/,
    /exploration == on/, /exploration == off/,
    /difficulty alone[^\n]*exploration/i,
    /newAlternatives[^\n]*invalidat/i,
    /idea count[^\n]*worker count/i,
    /exploration[^\n]*never changes[^\n]*allocation/i,
    /finalTier[^\n]*mini[^\n]*full/,
  ]) assert.match(text, contract);
});

test("option generation precedes evaluation and preserves constraints and testable uncertainty", async () => {
  const text = await protocol();
  for (const contract of [
    /baseline[^\n]*two materially different exploratory alternatives/,
    /generate before evaluat/i, /mechanism/, /expectedBenefit/,
    /evidenceOrAnalogy/, /materialAssumptions/, /constraints/, /uncertainties/,
    /validationExperiment/, /assumptionTested/, /supportingObservation/, /rejectingObservation/,
    /usefulness[^\n]*originality[^\n]*feasibility[^\n]*cost[^\n]*risk/,
    /opaque[^\n]*option IDs/i, /author[^\n]*frame/i,
    /conditional[^\n]*user agreement/i, /never fabricate/i,
    /proposing[^\n]*experiment[^\n]*authorize/i,
    /minority/, /fallback/,
  ]) assert.match(text, contract);
});

test("every exploratory option carries a validation experiment before review", async () => {
  assert.match(await protocol(), /each option[^\n]*validationExperiment[^\n]*support\/rejection/i);
});
