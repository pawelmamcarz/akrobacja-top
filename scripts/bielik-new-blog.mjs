#!/usr/bin/env node
// Pipeline 3-stopniowy generowania NOWYCH artykulow blog:
//   Step 1: Claude Haiku (Anthropic API) - draft tekstu blog post w HTML
//   Step 2: Bielik 11B (llm.akrobacja.com) - polish-pass PL na drafcie
//   Step 3: Save do polish-pass-output/new-blogs/<slug>.html
//
// Wymaga:
//   ANTHROPIC_API_KEY - sk-ant-... (Anthropic console)
//   LLAMA_API_KEY     - bielik token (cat /Users/.../.llama-api-key)
//   Oba w .dev.vars lub jako env var.
//
// Usage:
//   node scripts/bielik-new-blog.mjs                  # generuje wszystkie 3 z TOPICS
//   node scripts/bielik-new-blog.mjs --topic 0        # tylko pierwszy
//   node scripts/bielik-new-blog.mjs --skip-haiku     # tylko Bielik na cached drafcie
//   node scripts/bielik-new-blog.mjs --skip-bielik    # tylko Haiku, bez polish-pass

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), '..');
const OUT_DIR = join(ROOT, 'polish-pass-output/new-blogs');

const args = process.argv.slice(2);
const TOPIC_IDX = args.includes('--topic') ? parseInt(args[args.indexOf('--topic') + 1], 10) : -1;
const SKIP_HAIKU = args.includes('--skip-haiku');
const SKIP_BIELIK = args.includes('--skip-bielik');

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

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || readDotEnvKey('ANTHROPIC_API_KEY');
const LLAMA_API_KEY = process.env.LLAMA_API_KEY || readDotEnvKey('LLAMA_API_KEY');
const LLAMA_ENDPOINT = process.env.LLAMA_ENDPOINT || 'https://llm.akrobacja.com';

if (!SKIP_HAIKU && !ANTHROPIC_API_KEY) {
  console.error('ERROR: brak ANTHROPIC_API_KEY. Dodaj do .dev.vars lub --skip-haiku.');
  process.exit(1);
}
if (!SKIP_BIELIK && !LLAMA_API_KEY) {
  console.error('ERROR: brak LLAMA_API_KEY. Dodaj do .dev.vars lub --skip-bielik.');
  process.exit(1);
}

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// 3 topiki zlecone przez Pawla (2026-05-26)
const TOPICS = [
  {
    slug: 'waga-pasazera-lot-akrobacyjny',
    title: 'Jak waga wpływa na latanie akrobacyjne',
    description: 'Limit wagowy w Extra 300L, dlaczego, jak waga pasażera zmienia loty akrobacyjne, środek ciężkości i przeciążenia.',
    keywords: 'waga pasażera akrobacja, limit waga lot akrobacyjny, Extra 300L masa, ciężar pilota akrobacja',
    angle: `Praktyczny tekst dla pasazera ktory waha sie czy "za grubo zeby polecial". Konkretne liczby:
    - Limit wagi w Extra 300L SP-EKS: 110 kg (zalecane <100)
    - Dlaczego: total weight balance, dystrybucja masy front/back, srodek ciezkosci
    - Co sie zmienia gdy pasazer wazy 60 vs 100 kg: dynamika lotu, przeciazenia, paliwo
    - Pilot Maciej Kulaszewski wazy ~70 kg
    - Konkretna nauka: zaden pasazer pod 110 kg sie nie obawia
    - Bezpieczenstwo > komfort: jak ksztaltuje sie figury przy roznych wagach
    - FAQ: czy moge polecial gdy mam 105 kg? (TAK), czy 115? (poszukaj inneo dostawcy)`,
  },
  {
    slug: 'historia-polskiej-akrobacji-lotniczej',
    title: 'Historia polskiej akrobacji lotniczej',
    description: 'Od Stanislawa Skarzynskiego przez Iwo Rutkowskiego do Macieja Kulaszewskiego - 100 lat polskiej akrobacji lotniczej.',
    keywords: 'historia polska akrobacja, polscy piloci akrobacja, Iwo Rutkowski, Stanislaw Skarzynski, Maciej Kulaszewski Mistrz Swiata',
    angle: `Wciagajacy artykul SEO dla osob ktore wpisuja "historia polskiej akrobacji".
    - Lata 1920-30: Stanislaw Skarzynski, Franciszek Zwirko, polskie sukcesy
    - PRL: ograniczenia, klubowa akrobacja, pierwsze sukcesy europejskie
    - Lata 90/2000: Iwo Rutkowski - legenda polskiej akrobacji, medale ME/MS
    - 2010-2020: powstanie nowej generacji - Artur Kielak, Maciej Kulaszewski
    - 2022: Maciej Kulaszewski - Mistrz Swiata Yak-52 (Tora, Hiszpania)
    - 2024: zlote medale Cumulusy I
    - Dzis: Maciej i Extra 300L SP-EKS na Radom-Piastow
    - Polska szkola akrobacji: cechy, styl, miedzynarodowe uznanie`,
  },
  {
    slug: 'akrobacja-extra-300l-vs-odrzutowce',
    title: 'Czym się różni akrobacja na Extra 300L od akrobacji na odrzutowcach',
    description: 'Extra 300L vs F-16, MiG-29, Hawk: predkosc, przeciazenia, manewrowosc, dostepnosc, koszt. Porownanie samolot tlokowy vs odrzutowy.',
    keywords: 'Extra 300L vs odrzutowiec, akrobacja samolot tlokowy odrzutowy, F-16 akrobacja, lot na mysliwcu Polska',
    angle: `Tekst dla osob ktore widzialy pokazy F-16 i pytaja "czy to to samo co Extra 300L?".
    - Extra 300L: konstrukcyjnie +/-10G (unlimited aerobatic kategoria!), pasazerowi dajemy +4G (Pierwszy Lot) lub +6G (Adrenalina), predkosc 100-400 km/h, manewrowy w malej przestrzeni
    - F-16/MiG-29: +9G/-3G, predkosc 200-2000 km/h, ogromne pole manewru, militarne
    - WBREW INTUICJI: Extra wytrzymuje WIECEJ G niz F-16 (10 vs 9). Bo zero uzbrojenia, radaru, paliwa - tylko silnik 300 KM i 300 kg pustej masy.
    - Akrobacja sportowa (Extra) vs taktyczna (mysliwiec): inne cele, inne figury
    - Przeciazenia: 6G na Extra dla pasazera = identyczne odczucia jak 6G na F-16
    - Koszt: lot Extra 1999 zl vs lot F-16 dla cywila ~5000-50000 EUR (jesli w ogole dostepne)
    - Dostepnosc cywilna: Extra TAK (akrobacja.com), F-16 brak w PL, ograniczone w EU
    - Roznice w odczuciach pasazera: presja powietrza, dzwiek, dynamika
    - Wniosek: kto kieruje sie ciekawoscia akrobacji - Extra to najblizszy "real deal"`,
  },
];

async function callHaiku(prompt) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!r.ok) throw new Error(`Haiku HTTP ${r.status}: ${(await r.text()).substring(0, 300)}`);
  const data = await r.json();
  return data.content?.[0]?.text || '';
}

async function callBielik(prompt) {
  // stream: true bo CF Tunnel idle timeout 100s - dla dluzszych generacji
  // (rewrite 4000+ tokenow) potrzebny SSE, kazdy chunk resetuje timer.
  const r = await fetch(`${LLAMA_ENDPOINT}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LLAMA_API_KEY}`, 'Accept': 'text/event-stream' },
    body: JSON.stringify({
      model: 'bielik',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4500,
      temperature: 0.3,
      stream: true,
    }),
    signal: AbortSignal.timeout(600000),  // 10 min total
  });
  if (!r.ok) throw new Error(`Bielik HTTP ${r.status}: ${(await r.text()).substring(0, 300)}`);

  // Parse SSE: linie "data: {json}\n\n" + "data: [DONE]"
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

function haikuPrompt(topic) {
  return `Jesteś copywriterem akrobacja.com - polskiej firmy oferujacej loty akrobacyjne na Extra 300L SP-EKS w Radomiu. Pilot to Maciej Kulaszewski (Mistrz Swiata 2022).

Napisz BLOG POST po polsku na temat: "${topic.title}"

ANGLE (uzyj tych konkretow):
${topic.angle}

WYMOGI:
- HTML w postaci ciagu <h2>, <p>, <ul>, <li>, <strong>, <em>. Bez <html>, <head>, <body>.
- Dlugosc: 800-1200 slow, 4-6 sekcji <h2>
- Pierwszy <h2> = "Dlaczego ten temat" lub "O czym ten artykul"
- Kazdy <h2> ma 2-4 akapity <p>
- Conajmniej 1 <ul> z listami praktycznymi (np. "limity wagi w roznych samolotach")
- Konkretne fakty, liczby, nazwiska (Maciej Kulaszewski, Extra 300L, Radom-Piastow EPRP). UWAGA: samolot konstrukcyjnie wytrzymuje +/-10G (unlimited aerobatic kategoria), PASAZEROWI w pakietach voucher dajemy +4G (Pierwszy Lot) lub +6G (Adrenalina) - rozrozniaj te dwie liczby!
- Polskie diakrytyki (ą, ę, ć, ł, ń, ó, ś, ź, ż)
- ZAKAZANE: em-dashy (—), tylko zwykle myslniki (-). Bez "kluczowy", "warto pamietac", "w erze", "niesamowite", "wspaniale", "fascynujace", "uchwycic ducha", "ducha i emocje".
- Linki wewnetrzne: ${topic.slug !== 'waga-pasazera-lot-akrobacyjny' ? '<a href="/blog/co-czuje-pasazer-podczas-lotu-akrobacyjnego">Co czuje pasazer</a> i ' : ''}<a href="/lot-akrobacyjny">Lot akrobacyjny</a>, <a href="/maciej-osiagniecia">Maciej Kulaszewski</a>
- Zakoncz CTA: "Chcesz to poczuc? <a href='/lot-akrobacyjny' class='link'>Sprawdz pakiety lotow</a>."

Zwroc TYLKO HTML treści (od pierwszego <h2> do ostatniego </p>), gotowy do wklejenia w <article>.`;
}

function bielikPolishPrompt(html, title) {
  return `Jestes redaktorem polskim. Wyczysc ponizszy tekst blog akrobacja.com z anglicyzmow, ai-tells i nieprzyjemnych zwrotow.

Tytul: ${title}

ZASADY:
- Zachowaj WSZYSTKIE fakty, liczby, nazwy wlasne (Maciej Kulaszewski, Extra 300L, EPRP, etc.)
- Zachowaj WSZYSTKIE linki <a href="...">
- Zachowaj strukture HTML (h2, p, ul, li, strong, em, a)
- ZAKAZANE: em-dashy (—), tylko zwykle myslniki (-). Bez "kluczowy", "warto pamietac", "w erze", "niesamowite", "wspaniale", "fascynujace".
- Sprawdz polskie diakrytyki - jesli brakuja (np. "akrobacja" zamiast "akrobacja"), dodaj.
- Sprawdz styl - usun anglicyzmy ("by the way", "btw"), zamien na polski.
- Dlugosc: zachowaj +/- 10%

HTML:

\`\`\`html
${html}
\`\`\`

Zwroc TYLKO poprawiony HTML, bez \`\`\` ani komentarzy.`;
}

async function processTopic(topic, idx) {
  console.log(`\n[${idx + 1}/${TOPICS.length}] ${topic.slug}`);

  const haikuOut = join(OUT_DIR, `${topic.slug}.haiku.html`);
  const bielikOut = join(OUT_DIR, `${topic.slug}.bielik.html`);
  const finalOut = join(OUT_DIR, `${topic.slug}.final.html`);

  let draftHtml;
  if (SKIP_HAIKU && existsSync(haikuOut)) {
    console.log('  [step 1] SKIP - wczytaj cached Haiku draft');
    draftHtml = readFileSync(haikuOut, 'utf8');
  } else {
    console.log('  [step 1] Haiku draft generation...');
    const t0 = Date.now();
    draftHtml = await callHaiku(haikuPrompt(topic));
    draftHtml = draftHtml.replace(/^```html\s*/i, '').replace(/```\s*$/, '').trim();
    writeFileSync(haikuOut, draftHtml, 'utf8');
    console.log(`  -> ${haikuOut.replace(ROOT, '')} (${((Date.now()-t0)/1000).toFixed(1)}s, ${draftHtml.length} chars)`);
  }

  let polishedHtml = draftHtml;
  if (!SKIP_BIELIK) {
    console.log('  [step 2] Bielik polish-pass...');
    const t0 = Date.now();
    polishedHtml = await callBielik(bielikPolishPrompt(draftHtml, topic.title));
    polishedHtml = polishedHtml.replace(/^```html\s*/i, '').replace(/```\s*$/, '').trim();
    writeFileSync(bielikOut, polishedHtml, 'utf8');
    console.log(`  -> ${bielikOut.replace(ROOT, '')} (${((Date.now()-t0)/1000).toFixed(1)}s, ${polishedHtml.length} chars)`);
  }

  // Final: copy of polished as starting point (user reviewuje i ew. edytuje)
  writeFileSync(finalOut, polishedHtml, 'utf8');
  console.log(`  -> ${finalOut.replace(ROOT, '')} (final, ${polishedHtml.length} chars)`);

  return { slug: topic.slug, draftBytes: draftHtml.length, finalBytes: polishedHtml.length };
}

async function main() {
  const topics = TOPIC_IDX >= 0 ? [TOPICS[TOPIC_IDX]] : TOPICS;
  console.log(`Bielik new blog: ${topics.length} artykulow${SKIP_HAIKU ? ' (skip Haiku)' : ''}${SKIP_BIELIK ? ' (skip Bielik)' : ''}\n`);
  console.log(`Output: ${OUT_DIR.replace(ROOT, '')}\n`);

  const results = [];
  for (let i = 0; i < topics.length; i++) {
    try {
      results.push(await processTopic(topics[i], i));
    } catch (err) {
      console.log(`  ERROR: ${err.message}`);
      results.push({ slug: topics[i].slug, error: err.message });
    }
  }

  console.log('\n=== SUMMARY ===');
  results.forEach(r => {
    if (r.error) console.log(`  FAIL ${r.slug}: ${r.error}`);
    else console.log(`  OK   ${r.slug}: ${r.finalBytes} chars (draft ${r.draftBytes})`);
  });
  console.log(`\nReview: ls polish-pass-output/new-blogs/`);
  console.log('Aby wkleic do public/blog/, dodaj jeszcze meta tags, schema.org, navbar - wzorem innych blogow.');
}

main().catch(e => { console.error(e); process.exit(1); });
