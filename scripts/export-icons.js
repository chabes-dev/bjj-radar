// Renders public/icons/icon.svg to the PNG sizes iOS and the PWA manifest need.
// Usage: node scripts/export-icons.js [path/to/icon.svg]
import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const src = process.argv[2] ?? 'public/icons/icon.svg';
const svg = readFileSync(src, 'utf8');
if (src !== 'public/icons/icon.svg') writeFileSync('public/icons/icon.svg', svg);
const sizes = { 'apple-touch-icon-180': 180, 'icon-192': 192, 'icon-512': 512, 'favicon-32': 32 };
for (const [name, w] of Object.entries(sizes)) {
  writeFileSync(`public/icons/${name}.png`, new Resvg(svg, { fitTo: { mode: 'width', value: w } }).render().asPng());
}
console.log('icons written from', src);
