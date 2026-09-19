import assert from 'node:assert/strict';
import test from 'node:test';
import { bannerLines, formatBanner, bannerColorDepth, createSelectionState, renderSelector } from '../installer/selector.mjs';

const strip = text => text.replace(/\x1b\[[0-9;]*m/g, '');
test('colored banner preserves every original character and resets each letter', () => {
  const plain = formatBanner('0.1.65');
  for (const colorDepth of [8, 24]) {
    const colored = formatBanner('0.1.65', { colorDepth });
    assert.equal(strip(colored), plain);
    assert.equal((colored.match(/\x1b\[0m/g) ?? []).length, 30);
    for (const row of bannerLines('0.1.65', { colorDepth }).slice(0, 5)) {
      assert.equal((row.match(/\x1b\[38;/g) ?? []).length, 6);
    }
  }
  assert.doesNotMatch(plain, /\x1b/);
});
test('color detection respects output capabilities and explicit opt out', () => {
  const output = { isTTY: true, getColorDepth: () => 24 };
  assert.equal(bannerColorDepth(output, {}), 24);
  for (const env of [{ NO_COLOR: '1' }, { NO_COLOR: '' }, { TERM: 'dumb' }]) {
    assert.equal(bannerColorDepth(output, env), 0);
  }
  assert.equal(bannerColorDepth({ ...output, isTTY: false }, { FORCE_COLOR: '3' }), 0);
  assert.equal(bannerColorDepth({ isTTY: true, getColorDepth: () => 8 }, {}), 8);
  assert.equal(bannerColorDepth({ isTTY: true, getColorDepth: () => 4 }, {}), 0);
  assert.equal(bannerColorDepth({ isTTY: true }, {}), 0);
});
test('colored selector retains text and mouse row positions', () => {
  const state = createSelectionState();
  const plain = renderSelector(state, '0.1.65');
  const colored = renderSelector(state, '0.1.65', { colorDepth: 24 });
  assert.equal(strip(colored.text), plain.text);
  assert.deepEqual(colored.rows, plain.rows);
});

test('README logo matches the plain terminal ASCII banner', async () => {
  const { readFile } = await import('node:fs/promises');
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
  const version = (await readFile(new URL('../VERSION', import.meta.url), 'utf8')).trim();
  const logo = readme.split('```text\n')[1]?.split('```')[0];
  assert.equal(logo, formatBanner(version));
  assert.doesNotMatch(readme, /quorum-logo\.svg/);
});

test('installer uses terminal colors for help but keeps version output plain', async () => {
  const { main } = await import('../installer/install.mjs');
  for (const [argv, env, expectedColor] of [
    [['--help'], {}, true],
    [['--help'], { NO_COLOR: '1' }, false],
    [['--version'], {}, false],
  ]) {
    let text = '';
    const output = { isTTY: true, getColorDepth: () => 24, write: value => { text += value; } };
    assert.equal(await main({ argv, env, output }), 0);
    assert.equal(/\x1b\[38;2;/.test(text), expectedColor);
    if (argv[0] === '--version') assert.match(text, /^quorum-skill \d+\.\d+\.\d+\n$/);
  }
});
