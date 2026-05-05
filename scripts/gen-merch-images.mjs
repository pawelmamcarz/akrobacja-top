#!/usr/bin/env node
// One-shot: generate product mockup images via CF AI, save to public/merch/, update D1
import { writeFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
const OUT = join(ROOT, 'public/merch');
mkdirSync(OUT, { recursive: true });

const ACCOUNT_ID = '7677e3539ca70e9db1ec09c8196b29dd';
const TOKEN = '_Nod2H0kT2vfGchvi5B_y65Q0kganAWjmUYQ4JNN760.k65w4FvCn4FG__DFTHCxxZLJ8K9wWK7dLSWd0fwez8M';
const MODEL = '@cf/black-forest-labs/flux-1-schnell';
const AI_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${MODEL}`;

const products = [
  { id: 'p1',       file: 'polo-navy.jpg',        prompt: 'product photo of a navy blue technical polo shirt, flat lay on dark background, embroidered aircraft logo on chest, cyan accents on collar, professional studio lighting, clean product photography, no text' },
  { id: 'koszulka', file: 'tshirt-akrobacja.jpg',  prompt: 'product photo of a dark navy cotton t-shirt, flat lay on dark background, white and cyan Extra 300 aerobatic airplane graphic print on chest, professional studio lighting, clean product photography, no text' },
  { id: 'p2',       file: 'tshirt-cyan.jpg',       prompt: 'product photo of a vivid cyan blue cotton t-shirt, flat lay on dark background, dark navy aircraft silhouette print on chest, professional studio lighting, clean product photography, no text' },
  { id: 'czapka',   file: 'czapka-pilot.jpg',      prompt: 'product photo of a dark navy baseball cap, front view on dark background, embroidered Extra 300 aircraft logo on front panel, structured 6-panel snapback, professional studio lighting, no text' },
  { id: 'p3',       file: 'tshirt-navy.jpg',       prompt: 'product photo of a dark navy blue cotton t-shirt, flat lay on dark background, subtle monochrome aircraft print, professional studio lighting, clean product photography, no text' },
  { id: 'bluza',    file: 'softshell-bluza.jpg',   prompt: 'product photo of a dark navy softshell zip-up jacket, front view on dark background, embroidered logo on chest, ribbed collar and cuffs, professional studio product photography, no text' },
  { id: 'p4',       file: 'jacket-softshell.jpg',  prompt: 'product photo of a dark navy pilot softshell jacket, front view on dark background, embroidered aircraft insignia on chest and sleeve, professional aviation apparel, studio lighting, no text' },
  { id: 'zawieszka',file: 'zawieszka-remove.jpg',  prompt: 'product photo of a bright red aviation "Remove Before Flight" flag tag keychain, fabric with white embroidered text, hanging on dark background, studio lighting, no text on background' },
  { id: 'p5',       file: 'hoodie-navy.jpg',       prompt: 'product photo of a dark navy pullover hoodie sweatshirt, flat lay on dark background, large aircraft graphic print on chest, kangaroo pocket, professional studio lighting, no text' },
  { id: 'p6',       file: 'hoodie-cyan.jpg',       prompt: 'product photo of a vivid cyan blue pullover hoodie sweatshirt, flat lay on dark background, dark aircraft silhouette graphic on chest, professional studio lighting, no text' },
  { id: 'p7',       file: 'snapback-cap.jpg',      prompt: 'product photo of a premium dark navy snapback baseball cap, side angle on dark background, flat brim, embroidered aircraft logo, structured crown, professional studio lighting, no text' },
  { id: 'p8',       file: 'aluchain.jpg',           prompt: 'product photo of a laser-engraved aluminum metal keychain, dark background, aviation Extra 300 aircraft silhouette engraved on brushed aluminum surface, studio lighting macro shot, no text' },
  { id: 'p9',       file: 'sticker-pack.jpg',      prompt: 'product photo of a set of 4 vinyl stickers, dark background, aviation themed, Extra 300 aerobatic airplane silhouette designs in cyan and white, waterproof glossy stickers arranged flat, studio lighting, no text' },
];

async function generateImage(product) {
  console.log(`Generating: ${product.id} → ${product.file}`);
  const res = await fetch(AI_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt: product.prompt, num_steps: 8 }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`  ✗ ${product.id}: HTTP ${res.status} — ${err.slice(0, 200)}`);
    return null;
  }

  const ct = res.headers.get('content-type') || '';
  let imgBuf;
  if (ct.includes('application/json')) {
    const json = await res.json();
    if (json.result?.image) {
      imgBuf = Buffer.from(json.result.image, 'base64');
    } else {
      console.error(`  ✗ ${product.id}: unexpected JSON`, JSON.stringify(json).slice(0, 200));
      return null;
    }
  } else {
    imgBuf = Buffer.from(await res.arrayBuffer());
  }

  const outPath = join(OUT, product.file);
  writeFileSync(outPath, imgBuf);
  console.log(`  ✓ saved ${product.file} (${imgBuf.length} bytes)`);
  return `/merch/${product.file}`;
}

const updates = [];

for (const p of products) {
  const url = await generateImage(p);
  if (url) updates.push({ id: p.id, url });
  await new Promise(r => setTimeout(r, 500)); // rate limit
}

console.log('\nUpdating D1...');
for (const { id, url } of updates) {
  const sql = `UPDATE products SET image_url='${url}' WHERE id='${id}'`;
  execSync(`wrangler d1 execute akrobacja-db --remote --command "${sql}"`, { cwd: ROOT, stdio: 'pipe' });
  console.log(`  ✓ ${id} → ${url}`);
}

console.log(`\nDone. ${updates.length}/${products.length} images generated.`);
