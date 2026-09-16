import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { planDeliberation, executionReceipt, dispatchEligibility } from '../scripts/deliberation-policy.mjs';

const fixtures = JSON.parse(readFileSync(new URL('./fixtures/deliberation-routing.json', import.meta.url), 'utf8'));
for (const fixture of fixtures) {
  test(fixture.name, () => {
    const plan = planDeliberation(fixture.input);
    assert.equal(plan.tier, fixture.tier);
    assert.equal(plan.reusedDecision, fixture.reusedDecision ?? false);
    if (plan.tier !== 'full') assert.deepEqual(plan.allocated, { candidates: 0, reviewers: 0 });
  });
}
const candidate = (id, extra = {}) => ({ id, role: 'candidate', valid: true, isolated: true, ...extra });
const reviewer = (id, extra = {}) => ({ id, role: 'reviewer', valid: true, isolated: true, fresh: true, independent: true, ...extra });

test('allocation defaults, explicit panels, caps, and sequential capacity', () => {
  for (const [input, allocated, cap] of [
    [{}, {candidates:3,reviewers:1},4],
    [{candidates:7}, {candidates:7,reviewers:1},8],
    [{reviewers:2}, {candidates:3,reviewers:2},5],
    [{candidates:1,reviewers:1}, {candidates:1,reviewers:1},2],
    [{candidates:7,reviewers:2,maxWorkers:4}, {candidates:2,reviewers:2},4],
    [{reviewers:8,maxWorkers:2}, {candidates:1,reviewers:1},2],
    [{capabilities:{concurrency:1}}, {candidates:3,reviewers:1},4],
  ]) {
    const plan = planDeliberation({level:'full', ...input});
    assert.deepEqual(plan.allocated, allocated);
    assert.equal(plan.maxWorkers, cap);
  }
  for (const maxWorkers of [0,1]) assert.equal(planDeliberation({level:'full',maxWorkers}).tier,'mini');
  assert.equal(planDeliberation({level:'full',capabilities:{isolatedWorkers:false}}).tier,'mini');
  assert.equal(planDeliberation({level:'full',capabilities:{concurrency:0}}).tier,'mini');
  assert.match(planDeliberation({level:'full',maxWorkers:2}).reasons.join(' '), /single candidate/i);
});

test('numeric controls reject unsafe, fractional, null, coerced, negative values even on explicit mini/direct', () => {
  for (const level of ['auto','direct','mini','full']) {
    for (const key of ['candidates','reviewers','maxWorkers']) {
      for (const value of [-1,1.5,'2',null,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]) {
        assert.throws(() => planDeliberation({level,[key]:value}), /integer/);
      }
    }
    for (const key of ['candidates','reviewers']) assert.throws(() => planDeliberation({level,[key]:0}), /integer/);
  }
  assert.throws(() => planDeliberation({level:'unknown'}), /level/);
  assert.throws(() => planDeliberation({candidates:Number.MAX_SAFE_INTEGER}), /integer/);
});

test('controls last one run and unused counts are disclosed', () => {
  assert.match(planDeliberation({level:'mini',candidates:5}).reasons.join(' '), /unused/i);
  planDeliberation({level:'full',candidates:9});
  assert.equal(planDeliberation().tier,'direct');
  assert.equal(planDeliberation({level:'full'}).targets.candidates,3);
});

test('reserve a review launch before dispatch and count failed replacements', () => {
  const plan = planDeliberation({level:'full',maxWorkers:3});
  const launches = [candidate('a',{valid:false}),candidate('b')];
  assert.equal(dispatchEligibility(plan,launches,'candidate').allowed,false);
  assert.equal(dispatchEligibility(plan,launches,'reviewer').allowed,true);
  launches.push(reviewer('r',{valid:false}));
  assert.equal(dispatchEligibility(plan,launches,'reviewer').allowed,false);
  const receipt = executionReceipt(plan,launches);
  assert.equal(receipt.totalLaunches,3);
  assert.deepEqual(receipt.launched,{candidates:2,reviewers:1});
  assert.deepEqual(receipt.valid,{candidates:1,reviewers:0});
  assert.equal(receipt.tier,'mini');
  assert.equal(receipt.provenance,'internal-simulation');
  assert.match(receipt.reasons.join(' '), /failed|invalid/i);
});

test('review reserve follows requested allocation and generation stops when review starts', () => {
  const plan = planDeliberation({level:'full',candidates:1,reviewers:2,maxWorkers:4});
  assert.equal(dispatchEligibility(plan,[candidate('a'),candidate('b')],'candidate').allowed,false);
  assert.equal(dispatchEligibility(plan,[candidate('a'),reviewer('r'),reviewer('s')],'candidate').allowed,false);
});

test('full needs fresh independent isolated review and isolated valid candidate', () => {
  const plan = planDeliberation({level:'full'});
  for (const extra of [{fresh:false},{independent:false},{isolated:false},{valid:false}]) {
    assert.equal(executionReceipt(plan,[candidate('a'),reviewer('r',extra)]).tier,'mini');
  }
  assert.equal(executionReceipt(plan,[candidate('a',{isolated:false}),reviewer('r')]).tier,'mini');
  assert.equal(executionReceipt(plan,[candidate('a'),reviewer('a')]).tier,'mini');
  assert.equal(executionReceipt(plan,[reviewer('r'),candidate('a')]).tier,'mini');
});

test('verified provenance, launch accounting, exhaustion, and receipt display', () => {
  const plan = planDeliberation({level:'full'});
  const launches = [candidate('a',{model:'one',modelVerified:true}),reviewer('r',{model:'two',modelVerified:true})];
  assert.equal(executionReceipt(plan,launches).provenance,'verified-distinct-models');
  assert.equal(executionReceipt(plan,launches.map(x=>({...x,modelVerified:false}))).provenance,'isolated-models-unverified');
  assert.equal(executionReceipt(plan,launches.map(x=>({...x,model:'one'}))).provenance,'isolated-same-model');
  const fallback = executionReceipt(plan,[candidate('a',{valid:false})],{miniAvailable:false});
  assert.equal(fallback.tier,'direct');
  assert.equal(fallback.totalLaunches,1);
  assert.equal(fallback.requestedTier,'full');
  assert.equal(executionReceipt(planDeliberation(),[]).showReceipt,false);
  assert.equal(executionReceipt(planDeliberation({invoked:true}),[]).showReceipt,true);
  assert.equal(executionReceipt(planDeliberation({level:'mini'}),[]).totalLaunches,0);
  assert.equal(executionReceipt(planDeliberation({level:'mini'}),[],{miniAvailable:false}).tier,'direct');
});

test('malformed launch records and cap violations cannot silently yield a successful receipt', () => {
  const plan = planDeliberation({level:'full',maxWorkers:2});
  assert.throws(()=>executionReceipt(plan,[candidate('a'),reviewer('r'),candidate('b')]),/cap/);
  assert.throws(()=>executionReceipt(plan,[{role:'chairman',id:'c'}]),/role/);
  assert.throws(()=>executionReceipt(plan,[{role:'candidate'}]),/id/);
  assert.throws(()=>executionReceipt(planDeliberation({level:'mini'}),[candidate('a')]),/zero/);
  assert.equal(dispatchEligibility(planDeliberation({level:'mini'}),[],'candidate').allowed,false);
});


test('failed reviewer reserves replacement capacity and in-context repair consumes no launch', () => {
  const plan = planDeliberation({level:'full',maxWorkers:3});
  const launches = [candidate('a'),reviewer('r',{valid:false})];
  assert.equal(dispatchEligibility(plan,launches,'candidate').allowed,false);
  assert.equal(dispatchEligibility(plan,launches,'reviewer').allowed,true);
  launches[1] = reviewer('r');
  const receipt = executionReceipt(plan,launches);
  assert.equal(receipt.totalLaunches,2);
  assert.equal(receipt.tier,'full');
  assert.match(receipt.reasons.join(' '), /single valid candidate/i);
  assert.equal(dispatchEligibility(plan,[],'reviewer').allowed,false);
});

test('unverified identities and failed distinct models cannot imply distinct-model participation', () => {
  const plan = planDeliberation({level:'full'});
  const receipt = executionReceipt(plan,[
    candidate('failed',{valid:false,model:'other',modelVerified:true}),
    candidate('a',{model:'same',modelVerified:true}),
    reviewer('r',{model:'same',modelVerified:true}),
  ]);
  assert.equal(receipt.tier,'full');
  assert.notEqual(receipt.provenance,'verified-distinct-models');
  assert.equal(executionReceipt(plan,[candidate('a'),reviewer('r')]).provenance,'isolated-models-unverified');
});


test('surplus cap never enlarges the requested panel, including pending workers', () => {
  const plan = planDeliberation({level:'full',candidates:1,reviewers:1,maxWorkers:8});
  assert.equal(dispatchEligibility(plan,[candidate('a')],'candidate').allowed,false);
  assert.equal(dispatchEligibility(plan,[candidate('a',{valid:undefined})],'candidate').allowed,false);
  assert.equal(dispatchEligibility(plan,[candidate('a',{valid:false})],'candidate').allowed,true);
  assert.equal(dispatchEligibility(plan,[candidate('a'),reviewer('r')],'reviewer').allowed,false);
  assert.equal(dispatchEligibility(plan,[candidate('a'),reviewer('r',{valid:undefined})],'reviewer').allowed,false);
  assert.equal(dispatchEligibility(plan,[candidate('a'),reviewer('r',{valid:false})],'reviewer').allowed,true);
  assert.equal(dispatchEligibility(plan,[candidate('a'),reviewer('r')],'candidate').allowed,false);
});

test('changed decision context blocks approved and routine shortcuts consistently', () => {
  for (const key of ['newEvidence','changedGoal','changedConstraint','changedAssumptions','reconsider']) {
    for (const shortcut of ['routine','approvedImplementation']) {
      const plan = planDeliberation({signals:{[shortcut]:true,boundedAmbiguity:true},decision:{available:true,compatible:true,[key]:true}});
      assert.equal(plan.tier,'mini');
      assert.equal(plan.reusedDecision,false);
    }
  }
});

test('receipts retain requested counts and cap even after prelaunch degradation', () => {
  const receipt = executionReceipt(planDeliberation({level:'full',candidates:5,reviewers:2,maxWorkers:1}),[]);
  assert.deepEqual(receipt.targets,{candidates:5,reviewers:2});
  assert.deepEqual(receipt.allocated,{candidates:0,reviewers:0});
  assert.equal(receipt.maxWorkers,1);
  assert.equal(receipt.totalLaunches,0);
  assert.equal(receipt.tier,'mini');
  assert.equal(receipt.requestedTier,'full');
  assert.equal(executionReceipt(planDeliberation(),[]).provenance,'none');
  const fallback = executionReceipt(planDeliberation({level:'full'}),[candidate('a',{isolated:false})],{miniAvailable:false});
  assert.equal(fallback.provenance,'none');
  assert.equal(fallback.workerProvenance,'isolation-unverified');
});

test('reviews preceding a later generator do not count as reviews of the final panel', () => {
  const receipt = executionReceipt(planDeliberation({level:'full'}),[candidate('a'),reviewer('r'),candidate('b')]);
  assert.equal(receipt.tier,'mini');
  assert.equal(receipt.valid.reviewers,0);
  assert.equal(receipt.totalLaunches,3);
});


test('review waits for pending candidate workers and excess panel participation is disclosed', () => {
  const plan = planDeliberation({level:'full',candidates:2,reviewers:1,maxWorkers:8});
  assert.equal(dispatchEligibility(plan,[candidate('a'),candidate('b',{valid:undefined})],'reviewer').allowed,false);
  const receipt = executionReceipt(plan,[candidate('a'),candidate('b'),candidate('c'),reviewer('r')]);
  assert.equal(receipt.totalLaunches,4);
  assert.match(receipt.reasons.join(' '), /exceeds allocated targets/);
});

test('successful replacement provenance uses accepted artifacts while retaining failed-attempt uncertainty', () => {
  const plan = planDeliberation({level:'full',candidates:1,reviewers:1,maxWorkers:3});
  for (const [reviewModel, expected] of [['same','isolated-same-model'],['other','verified-distinct-models']]) {
    const receipt = executionReceipt(plan,[
      candidate('failed',{valid:false,isolated:undefined}),
      candidate('replacement',{model:'same',modelVerified:true}),
      reviewer('r',{model:reviewModel,modelVerified:true}),
    ]);
    assert.equal(receipt.tier,'full');
    assert.equal(receipt.provenance,expected);
    assert.equal(receipt.workerProvenance,'isolation-unverified');
    assert.equal(receipt.totalLaunches,3);
    assert.deepEqual(receipt.valid,{candidates:1,reviewers:1});
  }
});
