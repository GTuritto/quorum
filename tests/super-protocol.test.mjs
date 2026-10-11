import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('Super is loaded only by explicit input after the leading Direct bypass', async () => {
  const core = await read('references/protocol.sudo.md');
  const run = core.slice(core.indexOf('  run(input) {'));
  const bypass = run.indexOf('removePrefixAndIgnoreDeliberationControls');
  const load = run.indexOf('if (input.level == super) requireRead("references/super.sudo.md")');
  assert.ok(bypass >= 0 && load > bypass);
  assert.ok(run.indexOf('} else {') < load);
  assert.ok(load < run.indexOf('validateControlsOrAskOneFocusedQuestion'));
  assert.match(core, /auto never selects super/);
  const route = core.slice(core.indexOf('  route('), core.indexOf('  allocate('));
  assert.match(route, /if \(level in \[direct,mini,full,super\]\) return level/);
  assert.doesNotMatch(route, /return super/);
  const entry = await read('SKILL.md');
  assert.match(entry, /Load entry\/core before task tools/);
  assert.match(entry, /Do not batch a task read with the skill-entry read/);
  assert.doesNotMatch(entry, /requireRead\("references\/(super|claude-code-adapter)/);
});

test('Super binds profiles before dispatch while retaining Full and common receipt gates', async () => {
  const core = await read('references/protocol.sudo.md');
  const run = core.slice(core.indexOf('  run(input) {'));
  assert.ok(run.indexOf('Super.prepare(') < run.indexOf('result ='));
  assert.match(core, /requestedTier==super => include Super.Receipt/);
  assert.match(core, /finalTier in \[mini,full,super\]/);
  assert.match(await read('references/full.sudo.md'), /before each dispatch bind the resolved profile/);
  const superText = await read('references/super.sudo.md');
  assert.match(superText, /strip provider\/model\/effort identity from anonymous artifacts/);
  for (const rule of [
    /same provider as the coordinator/, /coordinator keeps current model\/effort/,
    /before launch, including slots reduced by the cap/, /no silent substitutions/,
    /replacements use the failed slot's profile/, /consume cap and reserve review/,
    /worker self-report or passing an argument is not verification/,
    /absent evidence => actual unknown/, /allocated slot completed with verified matching settings/,
    /actual tier full/, /memory-only\/capacity fallback => assignments unused/,
    /reasoning effort is not a token cap/, /stop further dispatch for clarification/,
  ]) assert.match(superText, rule);
});

test('both host bindings use real settings and disclose missing capability or overriding policy', async () => {
  const superText = await read('references/super.sudo.md');
  assert.match(superText, /model \+ reasoning_effort/);
  assert.match(superText, /fork_turns=none/);
  assert.match(superText, /if \(host == ClaudeCode\) requireRead\("references\/claude-code-adapter.md"\)/);
  const claude = await read('references/claude-code-adapter.md');
  for (const rule of [/model \+ effort/, /v2.1.292/, /environment\/managed overrides/,
    /CLAUDE_CODE_EFFORT_LEVEL/, /no global settings writes/, /on\/off is inherited/,
    /verify resulting settings or report unknown\/mismatch/, /stop affected Super dispatch/]) assert.match(claude, rule);
});

test('nested feature references are present in the exact installable package', async () => {
  const manifest = JSON.parse(await read('package.json'));
  for (const file of ['references/super.sudo.md', 'references/claude-code-adapter.md']) {
    assert.ok(manifest.files.includes(file), file);
    for (const match of (await read(file)).matchAll(/requireRead\("([^"\n]+)"\)/g)) {
      assert.ok(manifest.files.includes(match[1]), match[1]);
      assert.ok((await read(match[1])).length > 0);
    }
  }
});
