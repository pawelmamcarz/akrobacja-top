/**
 * Generuje wszystkie favicony z aktualnego logo (Extra 300L SP-EKS, akrobacja.com).
 * Źródło: public/assets/logo-mark-256.png (samolot bez tła tekstowego)
 * Większe ikony (≥192): public/ads/logo-square.png (samolot + AKROBACJA.COM)
 *
 * Output: public/favicon-{16,32,48,64,180,192,512}.png
 *         public/apple-touch-icon.png
 *         public/favicon.ico  (ICO format z PNG 32×32 i 48×48)
 */
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dir, '..');
const PUB   = join(ROOT, 'public');

const MARK   = join(PUB, 'assets', 'logo-mark-256.png');
const SQUARE = join(PUB, 'ads', 'logo-square.png');

async function resizePng(srcPath, size, padFrac = 0.05) {
  const canvas = createCanvas(size, size);
  const ctx    = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size, size);
  const img = await loadImage(srcPath);
  const pad = Math.round(size * padFrac);
  ctx.drawImage(img, pad, pad, size - pad * 2, size - pad * 2);
  return canvas.toBuffer('image/png');
}

function makeSingleIco(pngBuf, w, h) {
  const hdr = Buffer.alloc(6);
  hdr.writeUInt16LE(0, 0);
  hdr.writeUInt16LE(1, 2);
  hdr.writeUInt16LE(1, 4);

  const dir = Buffer.alloc(16);
  dir.writeUInt8(w % 256, 0);
  dir.writeUInt8(h % 256, 1);
  dir.writeUInt8(0, 2);
  dir.writeUInt8(0, 3);
  dir.writeUInt16LE(1, 4);
  dir.writeUInt16LE(32, 6);
  dir.writeUInt32LE(pngBuf.length, 8);
  dir.writeUInt32LE(22, 12);

  return Buffer.concat([hdr, dir, pngBuf]);
}

const sizes = [
  { size: 16,  src: MARK,   out: 'favicon-16.png',       pad: 0.05 },
  { size: 32,  src: MARK,   out: 'favicon-32.png',       pad: 0.05 },
  { size: 48,  src: MARK,   out: 'favicon-48.png',       pad: 0.05 },
  { size: 64,  src: MARK,   out: 'favicon-64.png',       pad: 0.05 },
  { size: 180, src: SQUARE, out: 'apple-touch-icon.png', pad: 0.06 },
  { size: 192, src: SQUARE, out: 'favicon-192.png',      pad: 0.06 },
  { size: 512, src: SQUARE, out: 'favicon-512.png',      pad: 0.06 },
];

for (const { size, src, out, pad } of sizes) {
  const buf = await resizePng(src, size, pad);
  writeFileSync(join(PUB, out), buf);
  console.log(`✓  ${out} (${size}×${size})`);
}

// favicon.ico - single PNG @ 48×48 opakowane w ICO header
const ico48 = await resizePng(MARK, 48, 0.05);
writeFileSync(join(PUB, 'favicon.ico'), makeSingleIco(ico48, 48, 48));
console.log('✓  favicon.ico (48×48 PNG w ICO)');

console.log('\nWszystkie favicony → public/');
