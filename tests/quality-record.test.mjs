import assert from 'node:assert/strict';
import test from 'node:test';
import { compareBenchmark } from '../scripts/quality-record.mjs';

test('benchmark comparison uses only a matching suite, case, variant, host and configuration', () => {
  const current = [{
    caseId: 'case-a', variant: 'full', host: 'host-v1', configuration: 'sol-medium-cap4',
    caseFingerprint: 'case-hash-1',
    runs: 3, meanCriterionFraction: 0.75, meanCriteria: { a: 1.5 },
    hardFailures: 0, meanLatencyMs: 1200, meanTokens: 400,
  }];
  const snapshots = [
    { name: 'newer-other-host.json', snapshot: { benchmark: { suiteVersion: 1, summary: [{
      ...current[0], host: 'host-v2', meanCriterionFraction: 1,
    }] } } },
    { name: 'older-matching.json', snapshot: { benchmark: { suiteVersion: 1, summary: [{
      ...current[0], runs: 2, meanCriterionFraction: 0.5,
      meanCriteria: { a: 1 }, hardFailures: 1,
      meanLatencyMs: 1000, meanTokens: 500,
    }] } } },
  ];
  assert.deepEqual(compareBenchmark(current, snapshots, 1), [{
    caseId: 'case-a', variant: 'full', baseline: 'older-matching.json',
    changeInMeanCriterionFraction: 0.25, changeInHardFailures: -1,
    changeInCriteria: { a: 0.5 }, changeInMeanLatencyMs: 200,
    changeInMeanTokens: -100, currentRuns: 3, baselineRuns: 2,
    provisional: true,
  }]);
  assert.deepEqual(compareBenchmark(current, snapshots, 2), [{
    caseId: 'case-a', variant: 'full', baseline: null,
  }]);
  const changedCase = [{ ...current[0], caseFingerprint: 'revised-case' }];
  assert.equal(compareBenchmark(changedCase, snapshots, 1)[0].baseline, null);
});
