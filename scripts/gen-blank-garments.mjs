#!/usr/bin/env node
// Step 1: Generate blank (no-graphic) garment photos via Flux AI
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
const OUT  = join(ROOT, 'public/merch/blanks');
mkdirSync(OUT, { recursive: true });

const ACCOUNT_ID = '7677e3539ca70e9db1ec09c8196b29dd';
const TOKEN = process.env.CF_AI_TOKEN || 'y9e3B8YkRaj_IUYt8-JfaQT05BD8yQK83U8MgLTgt6Y.mBPhCyBbAjqNRxJe97iXWdoHGBDc8HNm0np1i8xq4l4';
const MODEL = '@cf/black-forest-labs/flux-1-schnell';
const AI_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${MODEL}`;

const garments = [
  { file: 'blank-tshirt-navy.jpg',
    prompt: 'professional e-commerce product photo, plain blank solid dark navy blue cotton t-shirt on ghost mannequin, absolutely no text no logo no print no graphics no design, pure white background, soft studio lighting, sharp fabric texture, front view, centered' },

  { file: 'blank-tshirt-cyan.jpg',
    prompt: 'professional e-commerce product photo, plain blank solid bright electric cyan blue cotton t-shirt on ghost mannequin, absolutely no text no logo no print no graphics, pure white background, soft studio lighting, sharp fabric texture, front view, centered' },

  { file: 'blank-hoodie-navy.jpg',
    prompt: 'professional e-commerce product photo, plain blank solid dark navy blue pullover hoodie sweatshirt on ghost mannequin, no text no logo no print no design, pure white background, soft studio lighting, front view, centered, kangaroo pocket visible' },

  { file: 'blank-hoodie-cyan.jpg',
    prompt: 'professional e-commerce product photo, plain blank solid bright cyan blue pullover hoodie sweatshirt on ghost mannequin, no text no logo no print no design, pure white background, soft studio lighting, front view, centered' },

  { file: 'blank-polo-navy.jpg',
    prompt: 'professional e-commerce product photo, plain blank solid dark navy blue polo shirt on ghost mannequin, no text no logo no print no design, pure white background, soft studio lighting, front view, centered, collar buttons visible' },

  { file: 'blank-cap-navy.jpg',
    prompt: 'professional e-commerce product photo, plain blank solid dark navy blue structured 6-panel baseball cap, 3/4 front angle view, no text no logo no embroidery, pure white background, soft studio lighting, flat brim, snapback closure' },

  { file: 'blank-mug-white.jpg',
    prompt: 'professional e-commerce product photo, plain blank white ceramic coffee mug, 3/4 angle view, no text no logo no design, light gray background, soft studio lighting, glossy surface, handle visible on right side' },

  { file: 'blank-softshell-navy.jpg',
    prompt: 'professional e-commerce product photo, plain blank solid dark navy blue softshell zip-up jacket on ghost mannequin, no text no logo no print, pure white background, soft studio lighting, front view, centered, zipper visible' },
];

async function gen(g) {
  console.log(`Generating: ${g.file}`);
  const res = await fetch(AI_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: g.prompt, num_steps: 20 }),
  });
  if (!res.ok) { console.error(`  ✗ ${res.status}`); return; }
  const ct = res.headers.get('content-type') || '';
  let buf;
  if (ct.includes('application/json')) {
    const j = await res.json();
    buf = Buffer.from(j.result.image, 'base64');
  } else {
    buf = Buffer.from(await res.arrayBuffer());
  }
  writeFileSync(join(OUT, g.file), buf);
  console.log(`  ✓ ${g.file} (${buf.length} bytes)`);
}

for (const g of garments) {
  await gen(g);
  await new Promise(r => setTimeout(r, 300));
}
console.log('\nBlanks done.');
