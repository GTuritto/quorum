import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateSuite, summarizeReport, caseFingerprint } from '../scripts/benchmark.mjs';

const suite = JSON.parse(readFileSync(new URL('../benchmarks/cases.json', import.meta.url), 'utf8'));

test('benchmark corpus has unique, assessable cases', () => {
  assert.equal(validateSuite(suite).size, 4);
  const duplicate = structuredClone(suite);
  duplicate.cases.push(structuredClone(duplicate.cases[0]));
  assert.throws(() => validateSuite(duplicate), /duplicate case id/);
});

test('report requires every criterion and preserves hard failures', () => {
  const report = {
    suiteVersion: 1,
    runs: [{
      caseId: 'manual-export-dependency', variant: 'fixed-full',
      host: 'synthetic test host', configuration: 'fixed cap and model',
      sourceRevision: 'fixture', artifact: 'fixture artifact',
      scores: { 'separate-flows': 2, 'honest-limits': 2, 'next-test': 1 },
      hardFailure: true,
    }],
  };
  assert.deepEqual(summarizeReport(report, suite), [{
    variant: 'fixed-full', caseId: 'manual-export-dependency',
    caseFingerprint: caseFingerprint(suite.cases[0]),
    host: 'synthetic test host', configuration: 'fixed cap and model', runs: 1,
    sourceRevision: 'fixture',
    meanCriterionFraction: 0.833,
    meanCriteria: { 'separate-flows': 2, 'honest-limits': 2, 'next-test': 1 },
    hardFailures: 1, observedLatencyRuns: 0, meanLatencyMs: null,
    observedTokenRuns: 0, meanTokens: null,
  }]);
  delete report.runs[0].scores['next-test'];
  assert.throws(() => summarizeReport(report, suite), /score every criterion/);
});

test('report does not pool revisions under one variant', () => {
  const base = {
    caseId: 'manual-export-dependency', variant: 'fixed-full', host: 'host-v1',
    configuration: 'sol-medium-cap4', artifact: 'evidence',
    scores: { 'separate-flows': 2, 'honest-limits': 2, 'next-test': 2 },
    hardFailure: false,
  };
  const report = { suiteVersion: 1, runs: [
    { ...base, sourceRevision: 'before' },
    { ...base, sourceRevision: 'after' },
  ] };
  assert.throws(() => summarizeReport(report, suite), /mixes source revisions/);
});
