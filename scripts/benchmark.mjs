import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const suitePath = fileURLToPath(new URL('../benchmarks/cases.json', import.meta.url));

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function requireText(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be nonempty text`);
  }
}

export function validateSuite(suite) {
  if (suite?.suiteVersion !== 1 || !Array.isArray(suite.cases) || suite.cases.length === 0) {
    throw new Error('benchmark suite must have version 1 and at least one case');
  }
  const caseIds = new Set();
  for (const item of suite.cases) {
    requireText(item.id, 'case id');
    requireText(item.category, `${item.id} category`);
    requireText(item.prompt, `${item.id} prompt`);
    if (caseIds.has(item.id)) throw new Error(`duplicate case id: ${item.id}`);
    caseIds.add(item.id);
    if (!Array.isArray(item.criteria) || item.criteria.length === 0) {
      throw new Error(`${item.id} needs criteria`);
    }
    const criterionIds = new Set();
    for (const criterion of item.criteria) {
      requireText(criterion.id, `${item.id} criterion id`);
      requireText(criterion.description, `${item.id} criterion description`);
      if (criterionIds.has(criterion.id)) {
        throw new Error(`${item.id} has duplicate criterion: ${criterion.id}`);
      }
      criterionIds.add(criterion.id);
    }
    if (!Array.isArray(item.hardFailures) || item.hardFailures.length === 0) {
      throw new Error(`${item.id} needs hard-failure definitions`);
    }
    item.hardFailures.forEach((failure, index) => requireText(failure, `${item.id} hard failure ${index}`));
  }
  return new Map(suite.cases.map((item) => [item.id, item]));
}

export function caseFingerprint(item) {
  return createHash('sha256').update(JSON.stringify(item)).digest('hex');
}

export function summarizeReport(report, suite) {
  const cases = validateSuite(suite);
  if (report?.suiteVersion !== suite.suiteVersion || !Array.isArray(report.runs) || report.runs.length === 0) {
    throw new Error('report must match the suite version and contain observed runs');
  }
  const groups = new Map();
  for (const [index, run] of report.runs.entries()) {
    const label = `run ${index + 1}`;
    const item = cases.get(run.caseId);
    if (!item) throw new Error(`${label} has unknown case: ${run.caseId}`);
    for (const field of ['variant', 'host', 'configuration', 'sourceRevision', 'artifact']) {
      requireText(run[field], `${label} ${field}`);
    }
    if (typeof run.hardFailure !== 'boolean') throw new Error(`${label} needs hardFailure boolean`);
    if (run.latencyMs !== undefined && (!Number.isFinite(run.latencyMs) || run.latencyMs < 0)) {
      throw new Error(`${label} has invalid latencyMs`);
    }
    if (run.tokens !== undefined && run.tokens !== null && (!Number.isSafeInteger(run.tokens) || run.tokens < 0)) {
      throw new Error(`${label} has invalid tokens`);
    }
    const expected = item.criteria.map((criterion) => criterion.id);
    if (!run.scores || typeof run.scores !== 'object' || Array.isArray(run.scores) ||
        Object.keys(run.scores).length !== expected.length ||
        expected.some((id) => !Number.isInteger(run.scores[id]) || run.scores[id] < 0 || run.scores[id] > 2)) {
      throw new Error(`${label} must score every criterion from 0 to 2, with no extras`);
    }
    const key = `${run.variant}\u0000${run.caseId}\u0000${run.host}\u0000${run.configuration}`;
    const group = groups.get(key) ?? {
      variant: run.variant, caseId: run.caseId, caseFingerprint: caseFingerprint(item), host: run.host,
      configuration: run.configuration, sourceRevision: run.sourceRevision,
      count: 0, scoreTotal: 0,
      criterionTotals: Object.fromEntries(expected.map((id) => [id, 0])),
      hardFailures: 0, latencyCount: 0, latencyTotal: 0, tokenCount: 0, tokenTotal: 0,
    };
    if (group.sourceRevision !== run.sourceRevision) {
      throw new Error(`${label} mixes source revisions within one case/variant/host/configuration group`);
    }
    group.count++;
    group.scoreTotal += expected.reduce((total, id) => total + run.scores[id], 0) / (2 * expected.length);
    for (const id of expected) group.criterionTotals[id] += run.scores[id];
    group.hardFailures += Number(run.hardFailure);
    if (run.latencyMs !== undefined) {
      group.latencyCount++;
      group.latencyTotal += run.latencyMs;
    }
    if (run.tokens !== undefined && run.tokens !== null) {
      group.tokenCount++;
      group.tokenTotal += run.tokens;
    }
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.variant.localeCompare(b.variant) ||
    a.caseId.localeCompare(b.caseId) || a.host.localeCompare(b.host) ||
    a.configuration.localeCompare(b.configuration))
    .map((group) => ({
      variant: group.variant,
      caseId: group.caseId,
      caseFingerprint: group.caseFingerprint,
      host: group.host,
      configuration: group.configuration,
      sourceRevision: group.sourceRevision,
      runs: group.count,
      meanCriterionFraction: Number((group.scoreTotal / group.count).toFixed(3)),
      meanCriteria: Object.fromEntries(Object.entries(group.criterionTotals)
        .map(([id, total]) => [id, Number((total / group.count).toFixed(3))])),
      hardFailures: group.hardFailures,
      observedLatencyRuns: group.latencyCount,
      meanLatencyMs: group.latencyCount ? Number((group.latencyTotal / group.latencyCount).toFixed(1)) : null,
      observedTokenRuns: group.tokenCount,
      meanTokens: group.tokenCount ? Number((group.tokenTotal / group.tokenCount).toFixed(1)) : null,
    }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const suite = readJson(suitePath);
    const cases = validateSuite(suite);
    if (process.argv.length !== 2) throw new Error('usage: node scripts/benchmark.mjs');
    process.stdout.write(`Benchmark v${suite.suiteVersion}: ${cases.size} cases validated; no models run.\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
