import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildObservedReport, exportHarborDataset } from '../scripts/harbor.mjs';
import { summarizeReport } from '../scripts/benchmark.mjs';

const suite = JSON.parse(readFileSync(new URL('../benchmarks/cases.json', import.meta.url), 'utf8'));

test('exports each public case as a Harbor task without leaking its rubric', () => {
  const output = mkdtempSync(join(tmpdir(), 'quorum-harbor-'));
  assert.equal(exportHarborDataset(suite, output), suite.cases.length);
  const first = suite.cases[0];
  const instruction = readFileSync(join(output, first.id, 'instruction.md'), 'utf8');
  const config = readFileSync(join(output, first.id, 'task.toml'), 'utf8');
  const assessment = JSON.parse(readFileSync(join(output, 'assessment.json'), 'utf8'));
  assert.match(config, new RegExp(`name = "gturitto/quorum-${first.id}"`));
  assert.match(config, /authors = \[\]/);
  assert.match(instruction, /\/app\/quorum-answer\.md/);
  assert.doesNotMatch(instruction, new RegExp(first.criteria[0].description));
  assert.deepEqual(assessment.cases[0].criteria, first.criteria);
  assert.throws(() => exportHarborDataset(suite, output), /must be empty/);
});

test('rejects case identifiers that are unsafe as task paths', () => {
  const output = mkdtempSync(join(tmpdir(), 'quorum-harbor-'));
  const unsafe = structuredClone(suite);
  unsafe.cases[0].id = '../outside';
  assert.throws(() => exportHarborDataset(unsafe, output), /not safe/);
});

test('converts human Harbor assessments into the existing observed-run format', () => {
  const item = suite.cases[0];
  const input = {
    schemaVersion: 1,
    runs: [{
      caseId: item.id,
      variant: 'full',
      host: 'harbor 0.x / codex',
      configuration: 'model requested; actual model unverified',
      sourceRevision: 'abc123',
      artifact: 'jobs/example/trial/agent/quorum-answer.md',
      scores: Object.fromEntries(item.criteria.map(({ id }) => [id, 2])),
      hardFailure: false,
      latencyMs: 1200,
      tokens: null,
    }],
  };
  const report = buildObservedReport(input, suite);
  assert.equal(report.suiteVersion, suite.suiteVersion);
  assert.deepEqual(report.runs[0].scores, input.runs[0].scores);
  assert.equal(report.runs[0].tokens, null);
});

test('rejects incomplete assessment scores', () => {
  const item = suite.cases[0];
  assert.throws(() => buildObservedReport({
    schemaVersion: 1,
    runs: [{
      caseId: item.id, variant: 'full', host: 'host', configuration: 'config',
      sourceRevision: 'revision', artifact: 'artifact', scores: {}, hardFailure: false,
    }],
  }, suite), /must score/);
});

function assessmentRun(overrides = {}) {
  const item = suite.cases[0];
  return {
    caseId: item.id, variant: 'host-baseline', host: 'synthetic host',
    configuration: 'test fixture', sourceRevision: 'fixture', artifact: 'private-evidence-id',
    scores: Object.fromEntries(item.criteria.map(({ id }) => [id, 2])),
    hardFailure: false, ...overrides,
  };
}

for (const field of ['variant', 'host', 'configuration', 'sourceRevision', 'artifact']) {
  test(`rejects an assessment without ${field} provenance`, () => {
    for (const value of [undefined, '', '   ']) {
      assert.throws(() => buildObservedReport({
        schemaVersion: 1, runs: [assessmentRun({ [field]: value })],
      }, suite), new RegExp(field));
    }
  });
}

test('rejects malformed assessment envelopes and unknown cases', () => {
  for (const input of [{ schemaVersion: 2, runs: [assessmentRun()] }, { schemaVersion: 1, runs: [] }]) {
    assert.throws(() => buildObservedReport(input, suite), /schemaVersion 1 and at least one run/);
  }
  assert.throws(() => buildObservedReport({
    schemaVersion: 1, runs: [assessmentRun({ caseId: 'unknown-case' })],
  }, suite), /unknown case/);
});

test('rejects invalid, extra scores and ambiguous hard-failure flags', () => {
  const run = assessmentRun();
  const criterion = suite.cases[0].criteria[0].id;
  for (const score of [-1, 3, 1.5, '2']) {
    assert.throws(() => buildObservedReport({
      schemaVersion: 1, runs: [{ ...run, scores: { ...run.scores, [criterion]: score } }],
    }, suite), /must score/);
  }
  assert.throws(() => buildObservedReport({
    schemaVersion: 1, runs: [{ ...run, scores: { ...run.scores, extra: 2 } }],
  }, suite), /unexpected or missing/);
  for (const hardFailure of [undefined, 'false', 0]) {
    assert.throws(() => buildObservedReport({
      schemaVersion: 1, runs: [assessmentRun({ hardFailure })],
    }, suite), /hardFailure boolean/);
  }
});

test('converted assessments preserve failures and missing telemetry in the scorer', () => {
  const report = buildObservedReport({
    schemaVersion: 1,
    runs: [assessmentRun({ hardFailure: true }), assessmentRun()],
  }, suite);
  const [summary] = summarizeReport(report, suite);
  assert.equal(summary.runs, 2);
  assert.equal(summary.hardFailures, 1);
  assert.equal(summary.meanCriterionFraction, 1);
  assert.equal(summary.meanLatencyMs, null);
  assert.equal(summary.meanTokens, null);
});
