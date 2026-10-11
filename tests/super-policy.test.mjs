import assert from 'node:assert/strict';
import test from 'node:test';
import { planDeliberation, dispatchEligibility, executionReceipt } from '../scripts/deliberation-policy.mjs';
import { profileForSlot } from '../scripts/super-policy.mjs';

// Synthetic host metadata: tests validate policy, never assert live availability.
const capabilities = () => ({
  isolatedWorkers: true,
  inference: {
    provider: 'provider-a', inherited: { model: 'large', effort: 'high' },
    perAgentModel: true, perAgentEffort: true,
    models: [
      { id: 'large', provider: 'provider-a', efforts: ['low', 'medium', 'high'] },
      { id: 'small', provider: 'provider-a', efforts: ['low', 'medium'] },
      { id: 'foreign', provider: 'provider-b', efforts: ['high'] },
    ],
  },
});
const input = (overrides = {}) => ({
  level: 'super', candidates: 1, reviewers: 1,
  inference: { defaults: { model: 'large', effort: 'high' }, agents: { 'candidate-1': { model: 'small', effort: 'low' } } },
  capabilities: capabilities(), ...overrides,
});
const launch = (plan, slot, extra = {}) => ({
  id: slot, slot, role: slot.startsWith('candidate') ? 'candidate' : 'reviewer',
  valid: true, isolated: true, fresh: true, independent: true,
  ...profileForSlot(plan, slot), modelVerified: true, effortVerified: true, providerVerified: true,
  ...extra,
});

test('Super is explicit; signals and profiles alone never silently escalate', () => {
  const auto = planDeliberation({ signals: { consequential: true, uncertain: true, independentValue: true } });
  assert.equal(auto.tier, 'full');
  for (const level of ['auto', 'direct', 'mini', 'full']) {
    assert.throws(() => planDeliberation(input({ level })), /explicit level=super/);
  }
  const plan = planDeliberation(input({ decision: { available: true, compatible: true } }));
  assert.equal(plan.tier, 'super');
  assert.equal(plan.reusedDecision, false);
  assert.equal(plan.maxWorkers, 2);
  assert.deepEqual(plan.allocated, { candidates: 1, reviewers: 1 });
  assert.equal(planDeliberation().tier, 'direct');
  assert.equal(planDeliberation().inference, undefined);
});

test('leading Direct ignores invalid profiles and counts, but explicit direct does not', () => {
  const plan = planDeliberation(input({ directPrefix: true, inference: null, candidates: -1, maxWorkers: 'bad' }));
  assert.equal(plan.tier, 'direct');
  assert.equal(plan.inference, undefined);
  assert.equal(executionReceipt(plan, []).totalLaunches, 0);
});

test('profiles merge by field, inherit exact session values and stay request scoped', () => {
  const plan = planDeliberation(input({ inference: { defaults: { effort: 'medium' }, agents: { 'candidate-1': { model: 'small' } } } }));
  assert.deepEqual(profileForSlot(plan, 'candidate-1'), { provider: 'provider-a', model: 'small', effort: 'medium' });
  assert.deepEqual(profileForSlot(plan, 'reviewer-1'), { provider: 'provider-a', model: 'large', effort: 'medium' });
  const inherited = planDeliberation(input({ inference: { agents: { 'candidate-1': { effort: 'low' } } } }));
  assert.equal(profileForSlot(inherited, 'reviewer-1').effort, 'high');
  assert.equal(planDeliberation({ level: 'full' }).inference, undefined);
});

test('malformed and ambiguous profiles are rejected before dispatch', () => {
  for (const inference of [undefined, null, [], {}, { defaults: {} }, { defaults: { model: 'inherit' } },
    { defaults: null }, { defaults: { model: '' } }, { defaults: { effort: 5 } },
    { defaults: { model: ' large' } }, { defaults: { thinking: 'high' } },
    { provider: 'provider-a' }, { agents: [] },
    { agents: { coordinator: { model: 'large' } } },
    { agents: { 'candidate-0': { model: 'large' } } },
    { agents: { 'candidate-01': { model: 'large' } } },
    { agents: { 'candidate-2': { model: 'large' } } },
    { agents: { 'reviewer-9007199254740992': { model: 'large' } } },
  ]) assert.throws(() => planDeliberation(input({ inference })), TypeError);
});

test('resolved profiles and receipt requests stay frozen across replacement attempts', () => {
  const request = input();
  const plan = planDeliberation(request);
  request.inference.agents['candidate-1'].effort = 'medium';
  assert.equal(profileForSlot(plan, 'candidate-1').effort, 'low');
  assert.throws(() => { profileForSlot(plan, 'candidate-1').effort = 'medium'; }, TypeError);
  assert.throws(() => { plan.inference.agents['candidate-1'] = plan.inference.defaults; }, TypeError);
  assert.throws(() => { plan.inference.requested.defaults.effort = 'low'; }, TypeError);
  const receipt = executionReceipt(plan, [launch(plan, 'candidate-1'), launch(plan, 'reviewer-1')]);
  assert.equal(receipt.inference.attempts[0].requested.effort, 'low');
});

test('host metadata, provider and per-model effort support are mandatory', () => {
  for (const defaults of [
    { model: 'missing' }, { model: 'foreign' }, { model: 'small', effort: 'high' },
    { model: 'small', effort: 'inherit' }, { effort: 'ultra' },
  ]) assert.throws(() => planDeliberation(input({ inference: { defaults } })), /Unsupported|cross-provider/);
  assert.throws(() => planDeliberation(input({ capabilities: {} })), /metadata/);
  const duplicate = capabilities(); duplicate.inference.models.push({ ...duplicate.inference.models[0] });
  assert.throws(() => planDeliberation(input({ capabilities: duplicate })), /Unsupported/);
  for (const field of ['perAgentModel', 'perAgentEffort']) {
    const caps = capabilities(); caps.inference[field] = false;
    assert.throws(() => planDeliberation(input({ capabilities: caps })), /Host cannot apply/);
  }
});

test('capacity fallback keeps requested Super and unused profiles without model discovery', () => {
  for (const overrides of [{ maxWorkers: 1 }, { capabilities: { isolatedWorkers: false } }, { capabilities: { concurrency: 0 } }]) {
    const plan = planDeliberation(input(overrides));
    const receipt = executionReceipt(plan, []);
    assert.equal(receipt.requestedTier, 'super');
    assert.equal(receipt.tier, 'mini');
    assert.equal(receipt.inference.applied, false);
    assert.equal(receipt.inference.attempts.length, 0);
    assert.equal(receipt.totalLaunches, 0);
    assert.ok(receipt.inference.requested);
  }
  assert.throws(() => planDeliberation(input({ maxWorkers: 1, inference: {} })), /concrete/);
});

test('cap reduction does not enlarge panel or skip validation of specified unused slots', () => {
  const plan = planDeliberation(input({ candidates: 3, maxWorkers: 2 }));
  assert.deepEqual(plan.allocated, { candidates: 1, reviewers: 1 });
  assert.throws(() => profileForSlot(plan, 'candidate-2'), /out-of-range/);
  assert.throws(() => planDeliberation(input({ candidates: 3, maxWorkers: 2,
    inference: { agents: { 'candidate-3': { model: 'missing' } } },
  })), /Unsupported/);
  const receipt = executionReceipt(plan, [launch(plan, 'candidate-1'), launch(plan, 'reviewer-1')]);
  assert.equal(receipt.tier, 'super');
  assert.equal(receipt.targets.candidates, 3);
  assert.match(receipt.reasons.join(' '), /reduces/);
});

test('Super uses the existing launch reserve, fresh review and failed-attempt cap', () => {
  const plan = planDeliberation(input({ maxWorkers: 3 }));
  assert.equal(dispatchEligibility(plan, [], 'candidate', 'candidate-1').allowed, true);
  assert.equal(dispatchEligibility(plan, [], 'candidate', 'reviewer-1').allowed, false);
  assert.equal(dispatchEligibility(plan, [], 'candidate').allowed, false);
  const failed = launch(plan, 'candidate-1', { id: 'failed', valid: false });
  assert.equal(dispatchEligibility(plan, [failed], 'candidate', 'candidate-1').allowed, true);
  const candidate = launch(plan, 'candidate-1', { id: 'replacement' });
  assert.equal(dispatchEligibility(plan, [failed, candidate], 'candidate', 'candidate-1').allowed, false);
  assert.equal(dispatchEligibility(plan, [failed, candidate], 'reviewer', 'reviewer-1').allowed, true);
  const receipt = executionReceipt(plan, [failed, candidate, launch(plan, 'reviewer-1')]);
  assert.equal(receipt.tier, 'super');
  assert.equal(receipt.totalLaunches, 3);
  assert.equal(receipt.inference.attempts.length, 3);
  const capped = planDeliberation(input());
  assert.equal(dispatchEligibility(capped, [failed], 'candidate', 'candidate-1').allowed, false);
  assert.equal(executionReceipt(capped, [failed]).tier, 'mini');
  assert.equal(executionReceipt(capped, [failed], { miniAvailable: false }).tier, 'direct');
});

test('pending slots cannot be reused and review waits for all generators', () => {
  const plan = planDeliberation(input({ candidates: 2, maxWorkers: 4 }));
  const pending = launch(plan, 'candidate-1', { valid: undefined });
  assert.equal(dispatchEligibility(plan, [pending], 'candidate', 'candidate-1').allowed, false);
  const other = launch(plan, 'candidate-2');
  assert.equal(dispatchEligibility(plan, [pending, other], 'reviewer', 'reviewer-1').allowed, false);
});

test('verified model and effort assignments produce a Super receipt with per-attempt evidence', () => {
  const plan = planDeliberation(input({ exploration: 'on' }));
  const receipt = executionReceipt(plan, [launch(plan, 'candidate-1'), launch(plan, 'reviewer-1')]);
  assert.equal(receipt.tier, 'super');
  assert.equal(receipt.inference.applied, true);
  assert.equal(receipt.explorationApplied, true);
  assert.equal(receipt.provenance, 'verified-distinct-models');
  assert.equal(receipt.synthesis, 'coordinator');
  assert.equal(receipt.inference.attempts[0].actual.effort, 'low');
});

test('unverified settings cannot be promoted from requested values or worker claims', () => {
  const plan = planDeliberation(input());
  for (const field of ['modelVerified', 'effortVerified', 'providerVerified']) {
    const receipt = executionReceipt(plan, [launch(plan, 'candidate-1', { [field]: false }), launch(plan, 'reviewer-1')]);
    assert.equal(receipt.tier, 'full');
    assert.equal(receipt.inference.applied, false);
    assert.equal(receipt.inference.attempts[0].status, 'unverified');
    assert.equal(receipt.inference.attempts[0].actual[field.replace('Verified', '')], null);
  }
});

test('host substitution is reported, prevents more dispatch and never claims Super', () => {
  const plan = planDeliberation(input());
  for (const changed of [{ model: 'large' }, { effort: 'medium' }, { provider: 'provider-b' }]) {
    const candidate = launch(plan, 'candidate-1', changed);
    assert.equal(dispatchEligibility(plan, [candidate], 'reviewer', 'reviewer-1').allowed, false);
    const receipt = executionReceipt(plan, [candidate, launch(plan, 'reviewer-1')]);
    assert.equal(receipt.tier, 'full');
    assert.equal(receipt.inference.attempts[0].status, 'mismatch');
    assert.equal(receipt.totalLaunches, 2);
  }
});

test('missing, duplicate and wrong-role slot evidence cannot satisfy Super coverage', () => {
  const plan = planDeliberation(input({ candidates: 2, maxWorkers: 3 }));
  for (const altered of [{ slot: undefined }, { slot: 'reviewer-1' }, { slot: 'candidate-2' }]) {
    const receipt = executionReceipt(plan, [launch(plan, 'candidate-1', altered), launch(plan, 'candidate-2'), launch(plan, 'reviewer-1')]);
    assert.equal(receipt.tier, 'full');
    assert.equal(receipt.inference.applied, false);
  }
  const partial = executionReceipt(plan, [launch(plan, 'candidate-1'), launch(plan, 'reviewer-1')]);
  assert.equal(partial.tier, 'full');
});

test('one model with different efforts is Super, but never distinct-model provenance', () => {
  const plan = planDeliberation(input({ inference: { agents: { 'candidate-1': { effort: 'low' } } } }));
  const receipt = executionReceipt(plan, [launch(plan, 'candidate-1'), launch(plan, 'reviewer-1')]);
  assert.equal(receipt.tier, 'super');
  assert.equal(receipt.provenance, 'isolated-same-model');
});


test('effective host overrides are checked before requesting a conflicting configuration', () => {
  for (const override of [{ forcedModel: 'large' }, { forcedEffort: 'high' }]) {
    const caps = capabilities(); Object.assign(caps.inference, override);
    assert.throws(() => planDeliberation(input({ capabilities: caps })), /Host override conflicts/);
  }
});
