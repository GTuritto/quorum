import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { bannerLines, BANNER_COLORS, BANNER_COLUMNS } from '../installer/selector.mjs';

const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

export function renderLogo() {
  const rows = bannerLines('').slice(0, 5).map((line, row) => {
    const letters = BANNER_COLORS.map((color, index) => {
      const fragment = line.slice(BANNER_COLUMNS[index], BANNER_COLUMNS[index + 1]);
      // Position glyphs explicitly so SVG renderers cannot collapse ASCII spaces.
      const glyphs = [...fragment].flatMap((glyph, column) => glyph === ' ' ? [] :
        [`      <text x="${32 + (BANNER_COLUMNS[index] + column) * 12}" y="${42 + row * 25}">${escape(glyph)}</text>`]);
      return `    <g fill="${color.hex}">\n${glyphs.join('\n')}\n    </g>`;
    });
    return letters.join('\n');
  }).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="580" height="174" viewBox="0 0 580 174" role="img" aria-labelledby="title desc">
  <title id="title">Quorum</title>
  <desc id="desc">The original terminal ASCII logo, with one muted blue or teal color per letter.</desc>
  <rect width="580" height="174" rx="8" fill="#0d1117"/>
  <g font-family="Menlo, Consolas, monospace" font-size="20" xml:space="preserve">
${rows}
  </g>
</svg>
`;
}

if (import.meta.url === (process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '')) {
  await writeFile(new URL('../assets/quorum-logo.svg', import.meta.url), renderLogo());
}
