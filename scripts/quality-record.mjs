import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { summarizeReport, validateSuite } from './benchmark.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const resultsDir = fileURLToPath(new URL('../benchmarks/results/', import.meta.url));
const suite = JSON.parse(readFileSync(new URL('../benchmarks/cases.json', import.meta.url), 'utf8'));

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function command(program, args, cwd = root, env = process.env) {
  const started = performance.now();
  const result = spawnSync(program, args, { cwd, env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  return {
    command: [program, ...args].join(' '),
    passed: result.status === 0 && !result.error,
    exitCode: result.status,
    durationMs: Math.round(performance.now() - started),
    outputSha256: digest(`${result.stdout ?? ''}${result.stderr ?? ''}`),
    ...(result.error ? { error: result.error.message } : {}),
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

function checksums() {
  const manifest = readFileSync(join(root, 'dist/SHA256SUMS'), 'utf8');
  const files = manifest.trim().split('\n').map((line) => {
    const match = /^([a-f0-9]{64})\s+\*?(.+)$/.exec(line.trim());
    if (!match) throw new Error('invalid SHA256SUMS entry');
    return { name: match[2], passed: digest(readFileSync(join(root, 'dist', match[2]))) === match[1] };
  });
  return { passed: files.length > 0 && files.every((file) => file.passed), files };
}

function priorSnapshots() {
  mkdirSync(resultsDir, { recursive: true });
  return readdirSync(resultsDir).filter((name) => name.endsWith('.json')).map((name) => {
    try {
      const snapshot = JSON.parse(readFileSync(join(resultsDir, name), 'utf8'));
      return snapshot.schemaVersion === 1 ? { name, snapshot } : null;
    } catch {
      return null;
    }
  }).filter(Boolean).sort((a, b) => b.snapshot.recordedAt.localeCompare(a.snapshot.recordedAt));
}

export function compareBenchmark(summary, snapshots, suiteVersion) {
  return summary.map((current) => {
    const prior = snapshots.find(({ snapshot }) => snapshot.benchmark?.suiteVersion === suiteVersion &&
      snapshot.benchmark.summary.some((row) =>
        row.caseId === current.caseId && row.variant === current.variant &&
        row.caseFingerprint === current.caseFingerprint &&
        row.host === current.host && row.configuration === current.configuration));
    if (!prior) return { caseId: current.caseId, variant: current.variant, baseline: null };
    const previous = prior.snapshot.benchmark.summary.find((row) =>
      row.caseId === current.caseId && row.variant === current.variant &&
      row.caseFingerprint === current.caseFingerprint &&
      row.host === current.host && row.configuration === current.configuration);
    return {
      caseId: current.caseId, variant: current.variant, baseline: prior.name,
      changeInMeanCriterionFraction: Number((current.meanCriterionFraction - previous.meanCriterionFraction).toFixed(3)),
      changeInCriteria: Object.fromEntries(Object.keys(current.meanCriteria).map((id) =>
        [id, Number((current.meanCriteria[id] - previous.meanCriteria[id]).toFixed(3))])),
      changeInHardFailures: current.hardFailures - previous.hardFailures,
      changeInMeanLatencyMs: current.meanLatencyMs !== null && previous.meanLatencyMs !== null
        ? Number((current.meanLatencyMs - previous.meanLatencyMs).toFixed(1)) : null,
      changeInMeanTokens: current.meanTokens !== null && previous.meanTokens !== null
        ? Number((current.meanTokens - previous.meanTokens).toFixed(1)) : null,
      currentRuns: current.runs, baselineRuns: previous.runs,
      provisional: current.runs < 3 || previous.runs < 3,
    };
  });
}

function main() {
  const args = process.argv.slice(2);
  if (args.length !== 0 && !(args.length === 2 && args[0] === '--benchmark')) {
    throw new Error('usage: npm run quality:record [-- --benchmark /path/to/observed-runs.json]');
  }
  validateSuite(suite);
  const benchmarkInput = args.length ? readFileSync(args[1]) : null;
  const report = benchmarkInput ? JSON.parse(benchmarkInput) : null;
  const summary = report ? summarizeReport(report, suite) : null;
  const prior = priorSnapshots();
  const gitHead = command('git', ['rev-parse', 'HEAD']);
  const gitStatus = command('git', ['status', '--short']);
  const checks = [
    command('npm', ['test']),
    command('npm', ['run', 'benchmark:check']),
    command('npm', ['run', 'dist'], root, { ...process.env, TZ: 'UTC' }),
    command('git', ['diff', '--check']),
  ];
  let archiveChecks;
  try {
    archiveChecks = checksums();
  } catch (error) {
    archiveChecks = { passed: false, error: error.message };
  }
  const testOutput = checks[0].output;
  const tests = {
    total: Number(/ℹ tests (\d+)/.exec(testOutput)?.[1] ?? 0),
    passed: Number(/ℹ pass (\d+)/.exec(testOutput)?.[1] ?? 0),
    failed: Number(/ℹ fail (\d+)/.exec(testOutput)?.[1] ?? 0),
    installerIntegrationPassed: testOutput.includes('Installer integration tests passed'),
  };
  const previousQa = prior[0] ?? null;
  const snapshot = {
    schemaVersion: 1,
    recordedAt: new Date().toISOString(),
    suiteVersion: suite.suiteVersion,
    source: {
      gitHead: gitHead.output.trim(),
      dirty: gitStatus.output.trim() !== '',
      statusAtStart: gitStatus.output.trim().split('\n').filter(Boolean),
      nodeVersion: process.version,
    },
    qa: {
      passed: checks.every((item) => item.passed) && archiveChecks.passed &&
        tests.total > 0 && tests.total === tests.passed && tests.failed === 0 && tests.installerIntegrationPassed,
      tests,
      checks: checks.map(({ output, ...item }) => item),
      archives: archiveChecks,
      baseline: previousQa?.name ?? null,
      changeInPassedTests: previousQa ? tests.passed - previousQa.snapshot.qa.tests.passed : null,
    },
    benchmark: report ? {
      suiteVersion: suite.suiteVersion,
      inputSha256: digest(benchmarkInput),
      summary,
      scores: report.runs.map((run) => ({
        caseId: run.caseId, variant: run.variant, host: run.host,
        configuration: run.configuration, sourceRevision: run.sourceRevision,
        scores: run.scores, hardFailure: run.hardFailure,
        latencyMs: run.latencyMs ?? null, tokens: run.tokens ?? null,
      })),
      comparison: compareBenchmark(summary, prior, suite.suiteVersion),
    } : null,
  };
  const fileName = `${snapshot.recordedAt.replace(/[:.]/g, '-')}-${snapshot.source.gitHead.slice(0, 8)}-${randomUUID().slice(0, 8)}.json`;
  writeFileSync(join(resultsDir, fileName), `${JSON.stringify(snapshot, null, 2)}\n`, { flag: 'wx' });
  process.stdout.write(`Quality snapshot: benchmarks/results/${fileName}\n`);
  process.stdout.write(`QA: ${snapshot.qa.passed ? 'passed' : 'failed'}; ${tests.passed}/${tests.total} tests passed.\n`);
  process.stdout.write(`QA baseline: ${snapshot.qa.baseline ?? 'none'}\n`);
  if (snapshot.benchmark) {
    process.stdout.write(`Benchmark groups: ${summary.length}; comparable baselines: ${snapshot.benchmark.comparison.filter((item) => item.baseline).length}.\n`);
  } else {
    process.stdout.write('Decision-quality benchmark: not run.\n');
  }
  if (!snapshot.qa.passed) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
