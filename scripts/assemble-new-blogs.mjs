#!/usr/bin/env node
// Sklada 3 nowe blog posty z Bielik output (.final.html) + template z istniejacego
// blogu (jak-przygotowac-sie-do-lotu-akrobacyjnego.html) - zachowuje nav + footer +
// meta + schema.org, podmienia tylko head metadata + article body.

import { readFileSync, writeFileSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), '..');

const TEMPLATE_PATH = join(ROOT, 'public/blog/jak-przygotowac-sie-do-lotu-akrobacyjnego.html');
const BIELIK_DIR = join(ROOT, 'polish-pass-output/new-blogs');
const OUT_DIR = join(ROOT, 'public/blog');

const TODAY = '2026-05-26';

const TOPICS = [
  {
    slug: 'waga-pasazera-lot-akrobacyjny',
    h1: 'Jak waga wpływa na latanie akrobacyjne',
    description: 'Limit wagi w Extra 300L SP-EKS: 110 kg standardowo, do 130 kg z redukcją paliwa. Jak waga pasażera wpływa na środek ciężkości i czas lotu. Konkretne liczby.',
    keywords: 'waga pasażera akrobacja, limit waga lot akrobacyjny, Extra 300L masa, ciężar pasażera akrobacja, ile ważyć żeby polecieć, 130 kg lot akrobacyjny',
    ogShortDesc: '110 kg standardowo, do 130 kg z redukcją paliwa. Jak waga zmienia środek ciężkości i osiągi Extra 300L.',
    twitterTitle: 'Jak waga wpływa na lot akrobacyjny',
    highlightBox: 'Standardowy limit wagi pasażera w Extra 300L SP-EKS to 110 kg. Do 130 kg możliwy lot ze zredukowanym paliwem i krótszym czasem w powietrzu - skontaktuj się przed rezerwacją. Powyżej 130 kg fizycznie się nie zmieścimy w MTOW.',
  },
  {
    slug: 'historia-polskiej-akrobacji-lotniczej',
    h1: 'Historia polskiej akrobacji lotniczej',
    description: 'Od Franciszka Żwirki (Challenge 1932) i Bolesława Orlińskiego, przez polską szkołę PRL, do Macieja Kulaszewskiego (Mistrz Świata 2022) i Artura Kielaka (Red Bull Air Race).',
    keywords: 'historia polskiej akrobacji, polscy piloci akrobacja, Franciszek Żwirko, Bolesław Orliński, Artur Kielak, Maciej Kulaszewski Mistrz Świata, polska szkoła akrobacji',
    ogShortDesc: 'Od Żwirki i Wigury (Challenge 1932) do Mistrza Świata 2022. Sto lat polskiej akrobacji.',
    twitterTitle: 'Historia polskiej akrobacji lotniczej',
    highlightBox: 'Polska akrobacja sięga lat 30 (Żwirko + Wigura, Challenge 1932; Orliński, Warszawa-Tokio 1926). Po PRL i transformacji nazwiska Artura Kielaka (Red Bull Air Race) i Macieja Kulaszewskiego (Mistrz Świata 2022 na Yak-52, Cumulusy I 2024) wracają polską flagę na podium światowe.',
  },
  {
    slug: 'akrobacja-extra-300l-vs-odrzutowce',
    h1: 'Czym się różni akrobacja na Extra 300L od akrobacji na odrzutowcach',
    description: 'Extra 300L vs F-16 vs MiG-29: przeciążenia, prędkości, manewrowość, dostępność dla cywila, koszt. Porównanie samolot tłokowy vs odrzutowy w akrobacji.',
    keywords: 'Extra 300L vs odrzutowiec, akrobacja samolot tłokowy odrzutowy, F-16 akrobacja, lot na myśliwcu Polska, akrobacja sportowa vs taktyczna',
    ogShortDesc: 'Extra 300L vs F-16: przeciążenia 6G vs 9G, ceny, dostępność dla cywila. Konkretne porównanie.',
    twitterTitle: 'Akrobacja na Extra 300L vs odrzutowce',
    highlightBox: 'Extra 300L i F-16 robią inną akrobację. Extra: 6G, 100-400 km/h, lot 1999 zł, dostępny dla każdego. F-16: 9G, 2000 km/h, lot kilka tysięcy euro, w PL praktycznie niedostępny dla cywila. Obie maszyny dają identyczne przeciążenia pasażerowi, ale różny kontekst.',
  },
];

function loadTemplate() {
  return readFileSync(TEMPLATE_PATH, 'utf8');
}

function loadBielikBody(slug) {
  return readFileSync(join(BIELIK_DIR, `${slug}.final.html`), 'utf8');
}

function buildBlogHtml(template, topic, bielikBody) {
  const canonical = `https://akrobacja.com/blog/${topic.slug}`;
  let html = template;

  // <title>
  html = html.replace(
    /<title>[^<]+<\/title>/,
    `<title>${topic.h1} | akrobacja.com</title>`
  );

  // <meta name="description">
  html = html.replace(
    /<meta name="description" content="[^"]+">/,
    `<meta name="description" content="${topic.description}">`
  );

  // <meta name="keywords">
  html = html.replace(
    /<meta name="keywords" content="[^"]+">/,
    `<meta name="keywords" content="${topic.keywords}">`
  );

  // <link rel="canonical">
  html = html.replace(
    /<link rel="canonical" href="[^"]+">/,
    `<link rel="canonical" href="${canonical}">`
  );

  // og:url
  html = html.replace(
    /<meta property="og:url" content="[^"]+">/,
    `<meta property="og:url" content="${canonical}">`
  );
  // og:title
  html = html.replace(
    /<meta property="og:title" content="[^"]+">/,
    `<meta property="og:title" content="${topic.h1}">`
  );
  // og:description
  html = html.replace(
    /<meta property="og:description" content="[^"]+">/,
    `<meta property="og:description" content="${topic.ogShortDesc}">`
  );
  // og:image:alt
  html = html.replace(
    /<meta property="og:image:alt" content="[^"]+">/,
    `<meta property="og:image:alt" content="${topic.h1}">`
  );
  // article:published_time + dateModified
  html = html.replace(
    /<meta property="article:published_time" content="[^"]+">/,
    `<meta property="article:published_time" content="${TODAY}">`
  );

  // Twitter card
  html = html.replace(
    /<meta name="twitter:title" content="[^"]+">/,
    `<meta name="twitter:title" content="${topic.twitterTitle}">`
  );
  html = html.replace(
    /<meta name="twitter:description" content="[^"]+">/,
    `<meta name="twitter:description" content="${topic.ogShortDesc}">`
  );

  // Schema.org Article - replace headline + description + datePublished + dateModified + URL
  html = html.replace(
    /"headline":\s*"[^"]+",/,
    `"headline": "${topic.h1}",`
  );
  html = html.replace(
    /"@type":\s*"Article",\s*"headline":\s*"[^"]+",\s*"description":\s*"[^"]+",/s,
    `"@type": "Article",\n  "headline": "${topic.h1}",\n  "description": "${topic.description}",`
  );
  html = html.replace(
    /"datePublished":\s*"[^"]+",/,
    `"datePublished": "${TODAY}",`
  );
  html = html.replace(
    /"dateModified":\s*"[^"]+",/,
    `"dateModified": "${TODAY}",`
  );
  html = html.replace(
    /"@id":\s*"https:\/\/akrobacja\.com\/blog\/[^"]+"/,
    `"@id": "${canonical}"`
  );

  // BreadcrumbList - last item name + item URL
  html = html.replace(
    /"position":\s*3,\s*"name":\s*"[^"]+",\s*"item":\s*"[^"]+"/s,
    `"position": 3,\n      "name": "${topic.h1}",\n      "item": "${canonical}"`
  );

  // Article body - zamien cala zawartosc <article class="blog-article">...</article>
  const articleBody = `<article class="blog-article">

  <p class="meta">${formatDatePl(TODAY)} &middot; Czas czytania: ${estimateReadTime(bielikBody)} min &middot; Autor: Maciej Kulaszewski</p>

  <h1>${topic.h1}</h1>

  <div class="highlight-box">
    <strong>Krótka wersja:</strong> ${topic.highlightBox}
  </div>

${bielikBody}

</article>`;

  html = html.replace(
    /<article class="blog-article">[\s\S]*?<\/article>/,
    articleBody
  );

  return html;
}

function formatDatePl(iso) {
  const months = ['stycznia','lutego','marca','kwietnia','maja','czerwca','lipca','sierpnia','września','października','listopada','grudnia'];
  const [y, m, d] = iso.split('-');
  return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]} ${y}`;
}

function estimateReadTime(html) {
  const text = html.replace(/<[^>]+>/g, '');
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(3, Math.ceil(words / 200));
}

function main() {
  const template = loadTemplate();
  for (const topic of TOPICS) {
    try {
      const bielikBody = loadBielikBody(topic.slug);
      const fullHtml = buildBlogHtml(template, topic, bielikBody);
      const outPath = join(OUT_DIR, `${topic.slug}.html`);
      writeFileSync(outPath, fullHtml, 'utf8');
      console.log(`OK ${topic.slug}.html (${fullHtml.length} chars)`);
    } catch (err) {
      console.error(`FAIL ${topic.slug}: ${err.message}`);
    }
  }
  console.log('\nUploaded files:');
  for (const t of TOPICS) console.log(`  https://akrobacja.com/blog/${t.slug}`);
}

main();
