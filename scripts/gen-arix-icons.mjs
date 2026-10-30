// Arix Call icon generator — renders the brand mark into a full favicon/app-icon set.
// Mark: coral→amber gradient tile + white geometric "signal-peak A".
// Run from the frontend dir: `node scripts/gen-arix-icons.mjs`
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(ROOT, 'src', 'app');
const PUB = join(ROOT, 'public');
mkdirSync(PUB, { recursive: true });

// --- brand primitives -------------------------------------------------------
const AMBER = '#ffb547'; // accent-500 (top-left)
const CORAL = '#ff6542'; // primary-600 (bottom-right)

// White signal-peak "A": peak polyline + crossbar. Round caps read at 16px.
// Signal waves are added only at larger sizes (they'd turn to mud in a 16px tab).
const mark = (withWaves) => `
  ${
    withWaves
      ? `<g fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity="0.95">
           <path d="M64 34 Q75 25 86 27" />
           <path d="M62 24 Q78 12 94 18" />
         </g>`
      : ''
  }
  <g fill="none" stroke="#ffffff" stroke-width="11" stroke-linecap="round" stroke-linejoin="round">
    <path d="M30 78 L50 24 L70 78" />
    <path d="M39 58 H61" />
  </g>`;

const GRAD = `
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${AMBER}"/>
      <stop offset="1" stop-color="${CORAL}"/>
    </linearGradient>
  </defs>`;

// Rounded "squircle" tile (transparent corners) — browser tabs / PWA "any".
const squircle = (size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
    ${GRAD}
    <rect x="2" y="2" width="96" height="96" rx="24" fill="url(#g)"/>
    ${mark(size >= 96)}
  </svg>`;

// Full-bleed square (no transparent corners) — Apple touch icon + maskable.
const square = (size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
    ${GRAD}
    <rect x="0" y="0" width="100" height="100" fill="url(#g)"/>
    ${mark(size >= 96)}
  </svg>`;

const png = (svg) => sharp(Buffer.from(svg)).png().toBuffer();

// --- multi-size favicon.ico (PNG-in-ICO) ------------------------------------
function buildIco(imgs /* [{size, buf}] */) {
  const count = imgs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  const dir = Buffer.alloc(count * 16);
  let offset = 6 + count * 16;
  imgs.forEach((p, i) => {
    const b = i * 16;
    dir.writeUInt8(p.size >= 256 ? 0 : p.size, b + 0);
    dir.writeUInt8(p.size >= 256 ? 0 : p.size, b + 1);
    dir.writeUInt16LE(1, b + 4);
    dir.writeUInt16LE(32, b + 6);
    dir.writeUInt32LE(p.buf.length, b + 8);
    dir.writeUInt32LE(offset, b + 12);
    offset += p.buf.length;
  });
  return Buffer.concat([header, dir, ...imgs.map((p) => p.buf)]);
}

// --- emit -------------------------------------------------------------------
const icoImgs = await Promise.all(
  [16, 32, 48].map(async (size) => ({ size, buf: await png(squircle(size)) }))
);
writeFileSync(join(APP, 'favicon.ico'), buildIco(icoImgs));
writeFileSync(join(APP, 'icon.svg'), squircle(512)); // Next serves as SVG favicon
writeFileSync(join(APP, 'apple-icon.png'), await png(square(180)));

writeFileSync(join(PUB, 'arix-icon-192.png'), await png(squircle(192)));
writeFileSync(join(PUB, 'arix-icon-512.png'), await png(squircle(512)));
writeFileSync(join(PUB, 'arix-maskable-512.png'), await png(square(512)));
writeFileSync(join(PUB, 'arix-logo.png'), await png(squircle(256))); // admin sidebar logomark

console.log('Arix icon set generated:');
console.log('  src/app/favicon.ico  (16/32/48)');
console.log('  src/app/icon.svg     (512 squircle)');
console.log('  src/app/apple-icon.png (180 square)');
console.log('  public/arix-icon-192.png, arix-icon-512.png, arix-maskable-512.png, arix-logo.png');
