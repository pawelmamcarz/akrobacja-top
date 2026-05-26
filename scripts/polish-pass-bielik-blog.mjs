#!/usr/bin/env node
// Bielik rewriter blog postow akrobacja.com.
// Iteruje public/blog/*.html, wyciaga <article> body, wysyla do Bielika z promptem
// polish-pass (wyczysc AI-tells, zachowaj sens, fakty, dlugosc, cytaty pasazerow).
// Output: per file polish-pass-output/{slug}.diff.md z BEFORE/AFTER.
//
// Usage:
//   node scripts/polish-pass-bielik-blog.mjs [--limit N] [--apply] [--file PATTERN]
//   --limit N     pierwszych N plikow (domyslnie wszystkie)
//   --apply       nadpisuje pliki HTML (DOMYSLNIE: dry-run, tylko diff w polish-pass-output/)
//   --file PAT    tylko pliki ktorych nazwa zawiera PAT
//
// Wymaga env LLAMA_API_KEY (lokalnie: .dev.vars) lub przekazania przez --api-key.
//
// Concurrency: 1 slot Bielika - serializacja. Per file ~30-60s. 72 blogi = 36-72 min.

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from 'fs';
import { join, resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), '..');
const OUT_DIR = join(ROOT, 'polish-pass-output');

const args = process.argv.slice(2);
const LIMIT = parseInt(args.find((a, i, arr) => arr[i - 1] === '--limit') || '0', 10) || 0;
const APPLY = args.includes('--apply');
const FILE_PATTERN = args.find((a, i, arr) => arr[i - 1] === '--file') || '';
const API_KEY = process.env.LLAMA_API_KEY
  || readDotEnvKey('LLAMA_API_KEY');
const ENDPOINT = process.env.LLAMA_ENDPOINT || 'https://llm.akrobacja.com';

function readDotEnvKey(key) {
  for (const f of ['.dev.vars', '.env.local', '.env']) {
    try {
      const raw = readFileSync(join(ROOT, f), 'utf8');
      const m = raw.match(new RegExp(`^${key}\\s*=\\s*"?([^"\\n]+)"?`, 'm'));
      if (m) return m[1].trim();
    } catch {}
  }
  return null;
}

if (!API_KEY) {
  console.error('ERROR: brak LLAMA_API_KEY. Ustaw env LLAMA_API_KEY="..." lub dodaj do .dev.vars');
  process.exit(1);
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

function listBlogs() {
  const dir = join(ROOT, 'public/blog');
  return readdirSync(dir)
    .filter(f => f.endsWith('.html'))
    .filter(f => !FILE_PATTERN || f.includes(FILE_PATTERN))
    .map(f => join(dir, f))
    .sort();
}

function extractArticleBody(html) {
  // Wyciagnij <article>...</article>. Jesli brak, wyciagnij <main>.
  const articleMatch = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) return { tag: 'article', body: articleMatch[1], match: articleMatch[0] };
  const mainMatch = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) return { tag: 'main', body: mainMatch[1], match: mainMatch[0] };
  return null;
}

async function callBielik(prompt) {
  // stream: true bo CF Tunnel idle timeout 100s - dla dluzszych generacji
  // (rewrite 4000+ tokenow) potrzebny SSE, kazdy chunk resetuje timer.
  const r = await fetch(`${ENDPOINT}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}`, 'Accept': 'text/event-stream' },
    body: JSON.stringify({
      model: 'bielik',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
      temperature: 0.3,
      stream: true,
    }),
    signal: AbortSignal.timeout(600000),  // 10 min total
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Bielik HTTP ${r.status}: ${t.substring(0, 300)}`);
  }

  // Parse SSE chunks
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  const reader = r.body.getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const j = JSON.parse(payload);
        const delta = j.choices?.[0]?.delta?.content || '';
        if (delta) content += delta;
      } catch {}
    }
  }
  return content.trim();
}

function buildPrompt(title, html) {
  return `Jestes redaktorem polskiego copywritingu. Otrzymales fragment HTML bloga akrobacja.com (Extra 300L SP-EKS, loty akrobacyjne).

ZADANIE: Wyczysc tekst z AI-tells, zachowaj sens i fakty.

ZAKAZANE slowa/zwroty (zamien lub przeformuluj):
- "kluczowy/kluczowe/kluczowa"
- "warto pamietac/zaznaczyc"
- "w erze"
- "niesamowity/niesamowite/niesamowita" (chyba ze w cudzyslowach jako cytat klienta)
- "wspanialy/wspaniale/wspaniala" (jak wyzej)
- "fascynujace/fascynujacy"
- "uchwycic ducha", "promowac pasje", "ducha i emocje", "pasja i zaangazowanie"
- "swiat pelen", "jak nigdy dotad"
- "nie tylko... ale takze"
- em-dashy (—) tylko zwykle myslniki (-)

WYMOGI:
- NIE zmieniaj faktow, liczb, nazw wlasnych (Maciej, Extra 300L, EPRP, Tomasz Filipiak, ATAM 37, etc.)
- NIE zmieniaj cytatow w cudzyslowach „..." ani <em>...</em>
- NIE zmieniaj struktury HTML (h1, h2, h3, p, ul, li, strong, a) - zachowaj tagi
- NIE zmieniaj linkow <a href="..."> ani classes
- Zachowaj dlugosc (+/- 10%)
- Ton: konkretny, polski, bez przesladzania

Tytul: ${title}

HTML do poprawy:

\`\`\`html
${html}
\`\`\`

Zwroc TYLKO poprawiony HTML (bez \`\`\` ani komentarzy), gotowy do wklejenia 1:1 zamiast oryginalu.`;
}

function extractTitle(html) {
  const m = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : 'blog post';
}

function makeDiff(before, after) {
  // Prosty diff: pokaz co zmienione (basic line-by-line)
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const lines = [];
  const max = Math.max(beforeLines.length, afterLines.length);
  for (let i = 0; i < max; i++) {
    const b = beforeLines[i] || '';
    const a = afterLines[i] || '';
    if (b === a) continue;
    if (b) lines.push(`- ${b}`);
    if (a) lines.push(`+ ${a}`);
  }
  return lines.join('\n');
}

async function processBlog(path, index, total) {
  const slug = basename(path, '.html');
  const startedAt = Date.now();
  console.log(`\n[${index + 1}/${total}] ${slug}`);

  const html = readFileSync(path, 'utf8');
  const extracted = extractArticleBody(html);
  if (!extracted) { console.log('  SKIP: brak <article>/<main>'); return null; }

  const title = extractTitle(html);
  const prompt = buildPrompt(title, extracted.body);
  console.log(`  prompt: ${prompt.length} chars, body: ${extracted.body.length} chars`);

  let rewritten;
  let lastErr = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      rewritten = await callBielik(prompt);
      break;
    } catch (err) {
      lastErr = err.message;
      const transient = /HTTP 5(0[234]|99)/.test(lastErr) || /timeout|524/i.test(lastErr);
      if (!transient || attempt === 3) break;
      const waitMs = attempt * 30000;  // 30s, 60s
      console.log(`  attempt ${attempt}/3 failed: ${lastErr.substring(0, 80)} - retry in ${waitMs/1000}s`);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
  if (!rewritten) {
    console.log(`  ERROR: ${lastErr.substring(0, 150)}`);
    return { slug, error: lastErr };
  }

  // Bielik moze zwrocic z otaczajacym ``` - strip
  rewritten = rewritten.replace(/^```html\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  const ratio = (rewritten.length / extracted.body.length * 100).toFixed(0);
  console.log(`  ${elapsed}s, ${rewritten.length} chars (${ratio}% oryginalu)`);

  // Save diff
  const diffPath = join(OUT_DIR, `${slug}.diff.md`);
  const out = `# ${slug}\n\n**Tytuł:** ${title}\n**Tag:** ${extracted.tag}\n**Czas Bielika:** ${elapsed}s\n**Stosunek:** ${ratio}%\n\n## BEFORE\n\n\`\`\`html\n${extracted.body}\n\`\`\`\n\n## AFTER (Bielik)\n\n\`\`\`html\n${rewritten}\n\`\`\`\n\n## DIFF (line-by-line)\n\n\`\`\`\n${makeDiff(extracted.body, rewritten)}\n\`\`\`\n`;
  writeFileSync(diffPath, out, 'utf8');
  console.log(`  -> ${diffPath.replace(ROOT, '')}`);

  if (APPLY) {
    // Zastap article body w pliku HTML
    const newArticle = extracted.tag === 'article'
      ? `<article${extracted.match.match(/<article\b([^>]*)>/i)[1]}>${rewritten}</article>`
      : `<main${extracted.match.match(/<main\b([^>]*)>/i)[1]}>${rewritten}</main>`;
    const newHtml = html.replace(extracted.match, newArticle);
    writeFileSync(path, newHtml, 'utf8');
    console.log(`  APPLIED to ${path.replace(ROOT, '')}`);
  }

  return { slug, elapsed, ratio };
}

async function main() {
  const blogs = listBlogs();
  const limited = LIMIT > 0 ? blogs.slice(0, LIMIT) : blogs;
  console.log(`Polish-pass Bielik: ${limited.length} blog posts${APPLY ? ' (APPLY mode)' : ' (DRY RUN - tylko diff w polish-pass-output/)'}`);
  console.log(`Endpoint: ${ENDPOINT}, concurrency: 1 (Bielik queue)\n`);

  const results = [];
  for (let i = 0; i < limited.length; i++) {
    const r = await processBlog(limited[i], i, limited.length);
    if (r) results.push(r);
  }

  console.log('\n=== SUMMARY ===');
  const ok = results.filter(r => !r.error);
  const failed = results.filter(r => r.error);
  console.log(`OK: ${ok.length}, Failed: ${failed.length}`);
  if (failed.length) failed.forEach(f => console.log(`  FAIL ${f.slug}: ${f.error}`));
  console.log(`\nReview: cat polish-pass-output/<slug>.diff.md`);
  console.log(`Apply selected: node scripts/polish-pass-bielik-blog.mjs --apply --file <slug>`);
}

main().catch(e => { console.error(e); process.exit(1); });
