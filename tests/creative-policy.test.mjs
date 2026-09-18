import assert from 'node:assert/strict';
import test from 'node:test';
import { executionReceipt, planDeliberation } from '../scripts/deliberation-policy.mjs';

const candidate = (id, extra = {}) => ({ id, role: 'candidate', valid: true, isolated: true, ...extra });
const reviewer = (id, extra = {}) => ({
  id, role: 'reviewer', valid: true, isolated: true, fresh: true, independent: true, ...extra,
});

test('auto exploration intent selects mini without allocating workers', () => {
  for (const signal of ['exploratoryIntent', 'newAlternatives']) {
    const plan = planDeliberation({ signals: { [signal]: true } });
    assert.equal(plan.requestedExploration, 'auto');
    assert.equal(plan.explorationActive, true);
    assert.equal(plan.tier, 'mini');
    assert.deepEqual(plan.allocated, { candidates: 0, reviewers: 0 });
  }
});

test('consequential auto exploration still selects full with unchanged allocation', () => {
  const plan = planDeliberation({
    exploration: 'on',
    signals: { consequential: true, uncertain: true, independentValue: true },
  });
  assert.equal(plan.tier, 'full');
  assert.equal(plan.explorationActive, true);
  assert.deepEqual(plan.allocated, { candidates: 3, reviewers: 1 });
  assert.equal(plan.maxWorkers, 4);
});

test('explicit off disables structured exploration without changing ordinary routing', () => {
  const ordinary = planDeliberation({ exploration: 'off', signals: { exploratoryIntent: true } });
  assert.equal(ordinary.requestedExploration, 'off');
  assert.equal(ordinary.explorationActive, false);
  assert.equal(ordinary.tier, 'direct');

  const ambiguous = planDeliberation({ exploration: 'off', signals: { boundedAmbiguity: true } });
  assert.equal(ambiguous.explorationActive, false);
  assert.equal(ambiguous.tier, 'mini');
});

test('exploration validates as a request-scoped enum except for leading Direct bypass', () => {
  for (const value of [null, '', 'yes', 1, false]) {
    assert.throws(() => planDeliberation({ exploration: value }), /exploration/);
    assert.throws(() => planDeliberation({ level: 'direct', exploration: value }), /exploration/);
    assert.doesNotThrow(() => planDeliberation({ directPrefix: true, exploration: value }));
  }
  const bypass = planDeliberation({ directPrefix: true, exploration: null, signals: { exploratoryIntent: true } });
  assert.equal(bypass.requestedExploration, 'auto');
  assert.equal(bypass.explorationActive, false);
  assert.equal(bypass.tier, 'direct');

  const explicitDirect = planDeliberation({ level: 'direct', exploration: 'on' });
  assert.equal(explicitDirect.requestedExploration, 'on');
  assert.equal(explicitDirect.explorationActive, false);
  assert.equal(explicitDirect.tier, 'direct');
});

test('creative intent prevents routine and compatible-decision shortcuts', () => {
  for (const input of [
    { exploration: 'on' },
    { signals: { exploratoryIntent: true } },
    { exploration: 'off', signals: { newAlternatives: true } },
  ]) {
    const plan = planDeliberation({
      ...input,
      signals: { routine: true, ...input.signals },
      decision: { available: true, compatible: true },
    });
    assert.equal(plan.reusedDecision, false);
    if (input.exploration !== 'off') assert.equal(plan.tier, 'mini');
  }
});

test('new alternatives invalidate reuse even when exploration is off', () => {
  const plan = planDeliberation({
    exploration: 'off',
    signals: { newAlternatives: true },
    decision: { available: true, compatible: true },
  });
  assert.equal(plan.reusedDecision, false);
  assert.equal(plan.explorationActive, false);
  assert.equal(plan.tier, 'direct');
});

test('exploration controls reset between calls', () => {
  planDeliberation({ exploration: 'on' });
  const next = planDeliberation();
  assert.equal(next.requestedExploration, 'auto');
  assert.equal(next.explorationActive, false);
  assert.equal(next.tier, 'direct');
});

test('receipts report exploration from the final tier across fallback paths', () => {
  const mini = executionReceipt(planDeliberation({ exploration: 'on' }), []);
  assert.equal(mini.explorationApplied, true);
  assert.equal(mini.requestedExploration, 'on');

  const degraded = executionReceipt(
    planDeliberation({ level: 'full', exploration: 'on' }),
    [candidate('a')],
  );
  assert.equal(degraded.tier, 'mini');
  assert.equal(degraded.explorationApplied, true);

  const prelaunchDegraded = executionReceipt(
    planDeliberation({ level: 'full', exploration: 'on', maxWorkers: 1 }),
    [],
  );
  assert.equal(prelaunchDegraded.tier, 'mini');
  assert.equal(prelaunchDegraded.explorationApplied, true);

  const spent = executionReceipt(
    planDeliberation({ level: 'full', exploration: 'on' }),
    [candidate('a', { valid: false })],
    { miniAvailable: false },
  );
  assert.equal(spent.tier, 'direct');
  assert.equal(spent.explorationApplied, false);
  assert.equal(spent.totalLaunches, 1);
  assert.deepEqual(spent.launched, { candidates: 1, reviewers: 0 });
  assert.match(spent.reasons.join(' '), /exploration.*not applied|incomplete exploration/i);
});

test('Direct bypass is disclosed without claiming exploration or worker spend', () => {
  const receipt = executionReceipt(
    planDeliberation({ directPrefix: true, exploration: null, signals: { newAlternatives: true } }),
    [],
  );
  assert.equal(receipt.requestedExploration, 'auto');
  assert.equal(receipt.explorationApplied, false);
  assert.equal(receipt.totalLaunches, 0);
  assert.match(receipt.reasons.join(' '), /Leading Direct: bypasses/);
});

test('successful full exploration preserves panel and reports application', () => {
  const plan = planDeliberation({ level: 'full', exploration: 'on', candidates: 1, reviewers: 1 });
  const receipt = executionReceipt(plan, [candidate('a'), reviewer('r')]);
  assert.deepEqual(receipt.allocated, { candidates: 1, reviewers: 1 });
  assert.equal(receipt.explorationApplied, true);
});
