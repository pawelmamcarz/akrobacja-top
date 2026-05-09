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
const TOKEN = process.env.CF_AI_TOKEN || 'H-5PWy6QxlPQ3aNj_52BTjlxs1wxygmGPb1zwpr5_yQ.NK_4lfmCRSOzb5q27ZZytJNHKQl8Tli2X7FH6Pv9oQ8';
const MODEL = '@cf/black-forest-labs/flux-1-schnell';
const AI_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${MODEL}`;

const products = [
  // --- original IDs ---
  { id: 'p1',                    file: 'polo-navy.jpg',           prompt: 'professional e-commerce product photo, navy blue technical polo shirt, ghost mannequin front view, pure white background, embroidered small airplane logo on left chest, clean studio lighting, soft shadows, high detail' },
  { id: 'koszulka',              file: 'tshirt-akrobacja.jpg',    prompt: 'professional e-commerce product photo, dark navy cotton t-shirt, ghost mannequin front view, pure white background, white aerobatic airplane graphic print on chest, bold design, clean studio lighting, soft shadows' },
  { id: 'p2',                    file: 'tshirt-cyan.jpg',         prompt: 'professional e-commerce product photo, vivid electric cyan blue t-shirt, ghost mannequin front view, pure white background, small dark navy airplane silhouette on chest, clean studio lighting, soft drop shadow' },
  { id: 'czapka',                file: 'czapka-pilot.jpg',        prompt: 'professional e-commerce product photo, dark navy structured 6-panel baseball cap, 3/4 front view, pure white background, embroidered airplane logo on front panel, flat brim, clean studio lighting, soft shadow' },
  { id: 'p3',                    file: 'tshirt-navy.jpg',         prompt: 'professional e-commerce product photo, dark navy blue cotton t-shirt, ghost mannequin front view, pure white background, subtle white monochrome aircraft silhouette print on chest, clean studio lighting, soft shadows' },
  { id: 'bluza',                 file: 'softshell-bluza.jpg',     prompt: 'professional e-commerce product photo, dark navy softshell zip-up jacket, ghost mannequin front view, pure white background, small embroidered logo on left chest, ribbed collar and cuffs, clean studio lighting, soft shadows' },
  { id: 'p4',                    file: 'jacket-softshell.jpg',    prompt: 'professional e-commerce product photo, dark navy pilot softshell jacket, ghost mannequin front view, pure white background, embroidered aircraft insignia on chest, technical aviation apparel look, clean studio lighting' },
  { id: 'zawieszka',             file: 'zawieszka-remove.jpg',    prompt: 'professional e-commerce product photo, bright red "Remove Before Flight" aviation fabric tag keychain, hanging against pure white background, white embroidered letters visible, macro studio shot, clean bright lighting, crisp detail' },
  { id: 'p5',                    file: 'hoodie-navy.jpg',         prompt: 'professional e-commerce product photo, dark navy pullover hoodie sweatshirt, ghost mannequin front view, pure white background, white aircraft graphic print on chest, kangaroo pocket, clean studio lighting, soft drop shadow' },
  { id: 'p6',                    file: 'hoodie-cyan.jpg',         prompt: 'professional e-commerce product photo, bright cyan blue pullover hoodie sweatshirt, ghost mannequin front view, pure white background, small dark navy airplane logo on chest, clean studio lighting, soft drop shadow' },
  { id: 'p7',                    file: 'snapback-cap.jpg',        prompt: 'professional e-commerce product photo, dark navy premium snapback baseball cap, 3/4 front angle, pure white background, flat brim, embroidered aircraft logo on crown, structured look, clean studio lighting, soft shadow' },
  { id: 'p8',                    file: 'aluchain.jpg',            prompt: 'professional e-commerce product photo, brushed aluminum metal keychain, macro close-up, pure white background, laser-engraved aerobatic airplane silhouette on surface, carabiner clip, clean studio lighting, crisp metallic detail' },
  { id: 'p9',                    file: 'sticker-pack.jpg',        prompt: 'professional e-commerce product photo, set of 4 round vinyl stickers laid flat, pure white background, aviation themed designs in cyan and navy, glossy waterproof finish, clean studio lighting, slight overhead angle' },
  // --- v1 variant IDs ---
  { id: 'polo-navy-v1',          file: 'polo-navy-v1.jpg',        prompt: 'professional e-commerce product photo, dark navy blue polo shirt, ghost mannequin front view, pure white background, embroidered small logo on left chest, pique fabric texture, clean studio lighting, soft drop shadow' },
  { id: 'tshirt-akrobacja-v1',   file: 'tshirt-akrobacja-v1.jpg', prompt: 'professional e-commerce product photo, dark navy cotton t-shirt flat lay, pure white background, bold white and cyan aerobatic airplane graphic on chest, premium print quality, overhead view, clean studio lighting' },
  { id: 'tshirt-cyan-v1',        file: 'tshirt-cyan-v1.jpg',      prompt: 'professional e-commerce product photo, bright electric cyan t-shirt flat lay, pure white background, small dark airplane logo print, overhead view, clean studio lighting, soft shadow' },
  { id: 'tshirt-navy-v1',        file: 'tshirt-navy-v1.jpg',      prompt: 'professional e-commerce product photo, dark navy blue t-shirt flat lay, pure white background, small white airplane silhouette print on chest, overhead view, clean studio lighting, soft shadow' },
  { id: 'jacket-softshell-v1',   file: 'jacket-softshell-v1.jpg', prompt: 'professional e-commerce product photo, dark navy softshell jacket, ghost mannequin front view, pure white background, full-zip, embroidered logo on chest, technical outdoor apparel, clean studio lighting' },
  { id: 'snapback-v1',           file: 'snapback-v1.jpg',         prompt: 'professional e-commerce product photo, dark navy snapback cap, front view, pure white background, embroidered airplane logo on front, adjustable snapback closure visible, clean studio lighting, soft shadow' },
  { id: 'brelok-alu-v1',         file: 'brelok-alu-v1.jpg',       prompt: 'professional e-commerce product photo, silver brushed aluminum keychain, macro shot, pure white background, engraved Extra 300 airplane silhouette, split ring, clean studio lighting, crisp metallic shine' },
  { id: 'remove-before-flight-v1', file: 'remove-before-flight-v1.jpg', prompt: 'professional e-commerce product photo, bright red fabric "Remove Before Flight" tag, white streamers, pure white background, white embroidered text, classic aviation accessory, clean studio macro lighting, crisp detail' },
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
