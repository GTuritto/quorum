import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSuite } from './benchmark.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const suitePath = join(root, 'benchmarks/cases.json');
const answerPath = '/app/quorum-answer.md';

function requireText(value, label) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${label} must be nonempty text`);
  return value.trim();
}

function tomlString(value) {
  return JSON.stringify(value);
}

function taskToml(item) {
  return `schema_version = "1.4"

[task]
name = ${tomlString(`gturitto/quorum-${item.id}`)}
version = "1.0.0"
authors = []
keywords = ["quorum", "decision-quality", ${tomlString(item.category)}]

[metadata]
author_name = "Giuseppe Turitto"
difficulty = "medium"
category = ${tomlString(item.category)}
tags = ["quorum", "human-scored"]

[verifier]
timeout_sec = 60.0

[agent]
timeout_sec = 600.0

[environment]
build_timeout_sec = 600.0
cpus = 1
memory_mb = 2048
storage_mb = 4096
gpus = 0
mcp_servers = []

[verifier.env]

[solution.env]
`;
}

function instruction(item) {
  return `${item.prompt.trim()}

Write only your final decision artifact to \`${answerPath}\`. Include the recommendation, supporting evidence or assumptions, material uncertainty, and the next check that could change the recommendation. Do not include hidden reasoning.
`;
}

const dockerfile = `FROM ubuntu:24.04

WORKDIR /app
`;

const verifier = `#!/bin/sh
set -eu

answer="${answerPath}"
if [ -s "$answer" ]; then
  printf '1\\n' > /logs/verifier/reward.txt
else
  printf '0\\n' > /logs/verifier/reward.txt
fi
`;

export function exportHarborDataset(suite, outputDir) {
  const cases = validateSuite(suite);
  if (existsSync(outputDir) && readdirSync(outputDir).length > 0) {
    throw new Error(`output directory must be empty: ${outputDir}`);
  }
  mkdirSync(outputDir, { recursive: true });
  const assessment = { schemaVersion: 1, suiteVersion: suite.suiteVersion, cases: [] };
  for (const [id, item] of cases) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
      throw new Error(`case id is not safe for a Harbor task path: ${id}`);
    }
    const taskDir = join(outputDir, id);
    mkdirSync(join(taskDir, 'environment'), { recursive: true });
    mkdirSync(join(taskDir, 'tests'), { recursive: true });
    writeFileSync(join(taskDir, 'task.toml'), taskToml(item));
    writeFileSync(join(taskDir, 'instruction.md'), instruction(item));
    writeFileSync(join(taskDir, 'environment', 'Dockerfile'), dockerfile);
    writeFileSync(join(taskDir, 'tests', 'test.sh'), verifier, { mode: 0o755 });
    assessment.cases.push({
      caseId: id,
      taskName: `gturitto/quorum-${id}`,
      answerPath,
      criteria: item.criteria,
      hardFailures: item.hardFailures,
    });
  }
  writeFileSync(join(outputDir, 'assessment.json'), `${JSON.stringify(assessment, null, 2)}\n`);
  return cases.size;
}

export function buildObservedReport(assessments, suite) {
  const cases = validateSuite(suite);
  if (assessments?.schemaVersion !== 1 || !Array.isArray(assessments.runs) || assessments.runs.length === 0) {
    throw new Error('assessment file must have schemaVersion 1 and at least one run');
  }
  return {
    suiteVersion: suite.suiteVersion,
    runs: assessments.runs.map((run, index) => {
      const label = `assessment run ${index + 1}`;
      const item = cases.get(run.caseId);
      if (!item) throw new Error(`${label} has unknown case: ${run.caseId}`);
      const scores = {};
      for (const criterion of item.criteria) {
        const score = run.scores?.[criterion.id];
        if (!Number.isInteger(score) || score < 0 || score > 2) {
          throw new Error(`${label} must score ${criterion.id} from 0 to 2`);
        }
        scores[criterion.id] = score;
      }
      if (Object.keys(run.scores ?? {}).length !== item.criteria.length) {
        throw new Error(`${label} has unexpected or missing criterion scores`);
      }
      if (typeof run.hardFailure !== 'boolean') throw new Error(`${label} needs hardFailure boolean`);
      return {
        caseId: run.caseId,
        variant: requireText(run.variant, `${label} variant`),
        host: requireText(run.host, `${label} host`),
        configuration: requireText(run.configuration, `${label} configuration`),
        sourceRevision: requireText(run.sourceRevision, `${label} sourceRevision`),
        artifact: requireText(run.artifact, `${label} artifact`),
        scores,
        hardFailure: run.hardFailure,
        ...(run.latencyMs === undefined ? {} : { latencyMs: run.latencyMs }),
        ...(run.tokens === undefined ? {} : { tokens: run.tokens }),
      };
    }),
  };
}

function usage() {
  return 'usage: node scripts/harbor.mjs export --output <directory> | report --assessments <file> --output <file>';
}

function option(args, name) {
  const index = args.indexOf(name);
  if (index === -1 || index === args.length - 1) throw new Error(`${name} is required`);
  return args[index + 1];
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  const suite = JSON.parse(readFileSync(suitePath, 'utf8'));
  if (command === 'export' && args.length === 2) {
    const output = resolve(option(args, '--output'));
    const count = exportHarborDataset(suite, output);
    process.stdout.write(`Harbor dataset: ${output} (${count} tasks).\n`);
    return;
  }
  if (command === 'report' && args.length === 4) {
    const input = resolve(option(args, '--assessments'));
    const output = resolve(option(args, '--output'));
    const report = buildObservedReport(JSON.parse(readFileSync(input, 'utf8')), suite);
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
    process.stdout.write(`Observed benchmark report: ${output} (${report.runs.length} runs).\n`);
    return;
  }
  throw new Error(usage());
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
