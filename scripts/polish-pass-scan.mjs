#!/usr/bin/env node
// Detector AI-tells w tekstach na akrobacja.com.
// Skanuje public/blog/*.html + public/*.html + src/lib/email.ts + abandoned-recovery.ts + lead-magnet.ts
// + functions/api/cron/welcome-emails.ts.
// Output: ranked lista plików po liczbie AI-tells (do polish-passu Bielikiem).
//
// Usage:
//   node scripts/polish-pass-scan.mjs           # console table
//   node scripts/polish-pass-scan.mjs --json    # JSON na stdout (do dalszego pipe)
//
// AI-tells (z memory feedback_no_emdash_aislop.md + obserwacji):
//   - em-dash (- lub - )
//   - "kluczowy/kluczowe/kluczowa/kluczowych"
//   - "warto pamietać"
//   - "w erze"
//   - "niesamowite/niesamowita/niesamowity"
//   - "wspaniale/wspaniała/wspaniały"
//   - "fascynujace/fascynująca/fascynujący"
//   - "doskonale" (jako AI-slop, nie matematyka)
//   - "uchwycić ducha"
//   - "inspirujące/inspirujaca"
//   - "promować/promowanie"
//   - "ducha i emocje"

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), '..');

// User-facing content tylko (HTML + email templates). Pomijamy kod TS/JS,
// asset bundles, panele administracyjne.
const SCAN = [
  'public',         // landing + blog (recursive)
];

// Whitelist konkretnych plikow TS gdzie sa user-facing template strings
const TS_TEMPLATES = [
  'src/lib/email.ts',
  'src/lib/abandoned-recovery.ts',
  'src/lib/lead-magnet.ts',
  'functions/api/cron/welcome-emails.ts',
  'functions/api/cron/post-flight-review-sms.ts',
];

const SKIP_FILES = new Set([
  // Panele/dev/checkout flow - nie user-facing copy
  'admin.html', 'galeria.html', 'kalendarz.html', 'konto.html',
  'test-konwersji.html', 'unsubscribe.html', 'sukces.html', '404.html',
  'wyslij-zdjecia.html', 'wyslij-zdjecia-debug.html',
  // Static legal - nie chcemy zmieniac
  'polityka-prywatnosci.html', 'regulamin.html',
]);

const SKIP_DIRS = new Set(['assets', 'admin', 'fonts', 'rolki']);

// Każdy tell ma waga (1-3) - im wyzsza tym wieksza wskazowka AI-slopu.
const TELLS = [
  { re: /-|- /g, name: 'em-dash', weight: 3 },
  { re: /\bkluczow[ayie][a-ząęłńóśźż]*\b/gi, name: 'kluczowy', weight: 3 },
  { re: /warto pamie?ta(c|ć)/gi, name: 'warto pamiętać', weight: 3 },
  { re: /\bw erze\b/gi, name: 'w erze', weight: 3 },
  { re: /\bniesamowi[a-ząęłńóśźż]+/gi, name: 'niesamowity', weight: 2 },
  { re: /\bwspania[lłł][a-ząęłńóśźż]*/gi, name: 'wspaniały', weight: 2 },
  { re: /\bfascynuj[ąa]c[a-ząęłńóśźż]+/gi, name: 'fascynujący', weight: 2 },
  { re: /\binspiruj[ąa]c[a-ząęłńóśźż]+/gi, name: 'inspirujący', weight: 2 },
  { re: /uchwy[ct]i[lłł]?\w*\s+ducha/gi, name: 'uchwycić ducha', weight: 3 },
  { re: /promo(c|ć)wa(c|ć)\w*\s+pasj/gi, name: 'promować pasję', weight: 3 },
  { re: /\bducha i emocj[a-ząęłńóśźż]+/gi, name: 'ducha i emocje', weight: 3 },
  { re: /\bpasja\s+i\s+zaangaż/gi, name: 'pasja i zaangażowanie', weight: 2 },
  { re: /\b(swiat|świat)\s+pe[lłł]en/gi, name: 'świat pełen', weight: 2 },
  { re: /jak nigdy dotąd/gi, name: 'jak nigdy dotąd', weight: 2 },
  { re: /\bwarto zaznaczy(c|ć)/gi, name: 'warto zaznaczyć', weight: 3 },
  { re: /nie tylko[^.]+ale tak[zż]e/gi, name: 'nie tylko... ale także', weight: 2 },
];

function listFiles(dir) {
  const out = [];
  try {
    const entries = readdirSync(dir);
    for (const e of entries) {
      const full = join(dir, e);
      const st = statSync(full);
      if (st.isDirectory()) {
        if (SKIP_DIRS.has(e)) continue;
        out.push(...listFiles(full));
      } else if (st.isFile()) {
        if (SKIP_FILES.has(e)) continue;
        if (/\.html$/.test(e)) out.push(full);  // tylko HTML user-facing
      }
    }
  } catch {}
  return out;
}

function stripUserQuotes(html) {
  // Wytnij autentyczne cytaty klientow + kod JS/CSS - zeby nie liczyly do AI-tells.
  return html
    .replace(/<div\s+class="[^"]*review-text[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')  // Google reviews
    .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<code\b[^>]*>[\s\S]*?<\/code>/gi, '')
    .replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/gi, '');
}

function scanFile(path) {
  let raw;
  try { raw = readFileSync(path, 'utf8'); } catch { return null; }
  const cleaned = path.endsWith('.html') ? stripUserQuotes(raw) : raw;
  const hits = [];
  let totalScore = 0;
  for (const t of TELLS) {
    const matches = cleaned.match(t.re);
    if (matches && matches.length) {
      hits.push({ tell: t.name, count: matches.length, weight: t.weight, samples: matches.slice(0, 3) });
      totalScore += matches.length * t.weight;
    }
  }
  if (totalScore === 0) return null;
  return { path: path.replace(ROOT, ''), score: totalScore, hits, bytes: raw.length };
}

async function main() {
  const files = [];
  for (const dir of SCAN) files.push(...listFiles(join(ROOT, dir)));
  // Dodatkowo email templates (TS template strings - user-facing copy)
  for (const tsFile of TS_TEMPLATES) {
    const full = join(ROOT, tsFile);
    try { statSync(full); files.push(full); } catch {}
  }
  const results = files.map(scanFile).filter(Boolean);
  results.sort((a, b) => b.score - a.score);

  const isJson = process.argv.includes('--json');
  if (isJson) {
    process.stdout.write(JSON.stringify(results, null, 2));
    return;
  }

  console.log(`\nPolish-pass scan: ${results.length} plików ma AI-tells (z ${files.length} przeskanowanych)\n`);
  console.log('SCORE | PLIK                                                          | TELLS');
  console.log('------+--------------------------------------------------------------+------');
  for (const r of results.slice(0, 30)) {
    const tellsSummary = r.hits.map(h => `${h.tell}×${h.count}`).join(', ');
    console.log(`${String(r.score).padStart(5)} | ${r.path.padEnd(60)} | ${tellsSummary}`);
  }
  console.log(`\n(top 30 z ${results.length}, sortowane DESC po score)\n`);
  console.log('Pelna lista: --json | jq');
}

main();
