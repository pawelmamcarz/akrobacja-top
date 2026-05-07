/**
 * Generuje 4 obrazki produktowe 1200×1200 PNG dla katalogu Meta/Facebook.
 * Layout: zasada 3 podziałów — identyfikacja (top) / cena (środek) / CTA (dół)
 * Logo: Extra 300L SP-EKS + AKROBACJA.COM (ads/logo-landscape.png)
 *
 * Output: public/ads/product-pierwszy-lot.png
 *         public/ads/product-adrenalina.png
 *         public/ads/product-masterclass.png
 *         public/ads/product-fcl900-akrobacja.png
 */
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dir, '..');
const ADS   = join(ROOT, 'public', 'ads');

const C = {
  bg0      : '#04101C',
  bg1      : '#0A1428',
  bg2      : '#0F1E38',
  navyDeep : '#0A1428',
  red      : '#C41E3A',
  white    : '#FFFFFF',
  chrome   : '#9AAEC2',
  greyLine : 'rgba(154,174,194,0.18)',
  gold     : '#C8960C',
  goldLt   : '#F0C040',
};

// ── Product definitions ────────────────────────────────────────────
const PRODUCTS = [
  {
    file        : 'product-pierwszy-lot.png',
    tag         : 'PIERWSZY RAZ',
    name        : 'PIERWSZY LOT',
    sub         : 'Twój pierwszy kontakt z akrobacją',
    promoLine   : '-20% DO KOŃCA MIESIĄCA',
    promoGold   : false,
    oldPrice    : '2 499',
    price       : '1 999',
    currency    : 'PLN',
    perUnit     : '/ osoba',
    vatNote     : null,
    ctaText     : null,
    bullets     : [
      'Do 15 min w powietrzu',
      'Briefing naziemny (20 min)',
      'Do +4G / -2G',
      'Podstawowe figury akrobacyjne',
      'Doświadczenie nie wymagane',
    ],
    accent      : '#1B4DB5',
    statsMiddle : ['Extra 300L SP-EKS', 'EPRP RADOM-PIASTÓW'],
  },
  {
    file        : 'product-adrenalina.png',
    tag         : 'DLA ODWAŻNYCH',
    name        : 'ADRENALINA',
    sub         : 'Pełny program akrobacyjny do +6G',
    promoLine   : null,
    promoGold   : false,
    oldPrice    : null,
    price       : '2 999',
    currency    : 'PLN',
    perUnit     : '/ osoba',
    vatNote     : null,
    ctaText     : null,
    bullets     : [
      'Do 20 min w powietrzu',
      'Pełny program akrobacyjny',
      'Do +6G / -3G',
      'Zaawansowane figury',
      'Debriefing po locie',
    ],
    accent      : '#8B0000',
    statsMiddle : ['Extra 300L SP-EKS', 'EPRP RADOM-PIASTÓW'],
  },
  {
    file        : 'product-masterclass.png',
    tag         : 'Z MISTRZEM ŚWIATA',
    name        : 'MASTERCLASS',
    sub         : 'Sesja szkoleniowa — 2 loty, do 50 min',
    promoLine   : null,
    promoGold   : false,
    oldPrice    : null,
    price       : '4 999',
    currency    : 'PLN',
    perUnit     : '/ osoba',
    vatNote     : null,
    ctaText     : null,
    bullets     : [
      'Do 50 min (2 loty)',
      'Zaawansowane figury konkursowe',
      'Pełny debriefing + analiza lotu',
      'Certyfikat uczestnictwa',
      'Samolot Extra 300L SP-EKS',
    ],
    accent      : '#5A0090',
    statsMiddle : ['Extra 300L SP-EKS', 'EPRP RADOM-PIASTÓW'],
  },
  {
    file        : 'product-fcl900-akrobacja.png',
    tag         : 'KURS PILOTAŻU · UPRAWNIENIE EASA',
    name        : 'SZKOLENIE\nFCL.900',
    sub         : 'Uprawnienie Akrobacja EASA DTO',
    promoLine   : 'CERTYFIKAT EASA  ·  UPRAWNIENIE DO AKROBACJI ZAROBKOWEJ',
    promoGold   : true,
    oldPrice    : null,
    price       : '20 900',
    currency    : 'PLN',
    perUnit     : null,
    priceSuffix : 'netto',
    vatNote     : '25 707 PLN brutto (z VAT 23%)',
    ctaText     : 'ZAPISZ SIĘ NA SZKOLENIE  →',
    bullets     : [
      'Min. 15 h lotu na Extra 300L SP-EKS',
      'Teoria: przepisy, ograniczenia, bezpieczeństwo',
      'Instruktor z uprawnieniami FI(A)',
      'Egzamin praktyczny EASA',
      'Możliwość dofinansowania UE',
    ],
    accent      : C.gold,
    statsMiddle : ['FCL.900', 'UPRAWNIENIE EASA'],
  },
];

// ── Helpers ────────────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function hline(ctx, y, x0 = 28, x1 = 1172) {
  ctx.strokeStyle = C.greyLine;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(x0, y); ctx.lineTo(x1, y);
  ctx.stroke();
}

// ── Draw ──────────────────────────────────────────────────────────
async function drawProduct(p, logo, bg) {
  const S   = 1200;
  const PAD = 28;
  const canvas = createCanvas(S, S);
  const ctx    = canvas.getContext('2d');

  // ── Background ────────────────────────────────────────────────
  const bgG = ctx.createLinearGradient(0, 0, S, S);
  bgG.addColorStop(0,   C.bg0);
  bgG.addColorStop(0.5, C.bg1);
  bgG.addColorStop(1,   C.bg2);
  ctx.fillStyle = bgG;
  ctx.fillRect(0, 0, S, S);

  if (bg) {
    ctx.globalAlpha = 0.28;
    ctx.drawImage(bg, 0, 0, S, S);
    ctx.globalAlpha = 1;
  }

  // Accent diagonal band (bottom-left → upper-right, rule of thirds anchor)
  ctx.save();
  ctx.strokeStyle = p.accent;
  ctx.globalAlpha = 0.20;
  ctx.lineWidth   = 360;
  ctx.lineCap     = 'butt';
  ctx.beginPath();
  ctx.moveTo(-120, S + 120);
  ctx.lineTo(S * 0.54, -120);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();

  // Left accent bar (rule-of-thirds: left edge marker)
  ctx.fillStyle   = p.accent;
  ctx.globalAlpha = 0.88;
  ctx.fillRect(0, 0, 7, S);
  ctx.globalAlpha = 1;

  // ─── TOP ZONE  0–400  (identyfikacja produktu) ────────────────

  // Logo pill: biały zaokrąglony prostokąt z logo
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  roundRect(ctx, PAD, 22, 234, 66, 7);
  ctx.fill();
  if (logo) {
    ctx.drawImage(logo, PAD + 6, 27, 222, 56);
  } else {
    ctx.fillStyle = C.navyDeep;
    ctx.font      = 'bold 20px sans-serif';
    ctx.fillText('AKROBACJA.COM', PAD + 10, 62);
  }

  // Top-right badge
  ctx.fillStyle = C.red;
  roundRect(ctx, S - 318, 22, 290, 46, 23);
  ctx.fill();
  ctx.fillStyle   = C.white;
  ctx.font        = 'bold 14px sans-serif';
  ctx.textAlign   = 'center';
  ctx.fillText('★  MISTRZ ŚWIATA AKROBACJI', S - 173, 50);
  ctx.textAlign   = 'left';

  // Tag chip
  ctx.font = 'bold 15px sans-serif';
  const tagW = ctx.measureText(p.tag).width + 30;
  ctx.fillStyle   = p.accent;
  ctx.globalAlpha = 0.92;
  roundRect(ctx, PAD, 108, tagW, 36, 5);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle   = C.white;
  ctx.fillText(p.tag, PAD + 14, 131);

  // Nazwa produktu — DUŻA (rule-of-thirds: 1/4 od góry = y≈300)
  ctx.fillStyle = C.white;
  if (p.name.includes('\n')) {
    // Dwuliniowa nazwa (FCL.900)
    const [l1, l2] = p.name.split('\n');
    ctx.font = 'bold 80px sans-serif';
    ctx.fillText(l1, PAD, 240);
    ctx.fillText(l2, PAD, 330);
    // Podtytuł
    ctx.fillStyle = C.chrome;
    ctx.font      = '400 21px sans-serif';
    ctx.fillText(p.sub, PAD, 368);
  } else {
    ctx.font = 'bold 92px sans-serif';
    ctx.fillText(p.name, PAD, 310);
    // Podtytuł
    ctx.fillStyle = C.chrome;
    ctx.font      = '400 22px sans-serif';
    ctx.fillText(p.sub, PAD, 358);
  }

  // Linia podziału 1/3 (y=400)
  hline(ctx, 400);

  // ─── PRICE ZONE  400–800  (oferta) ──────────────────────────

  let PY = 420;

  // Baner promocyjny
  if (p.promoLine) {
    const bc = p.promoGold ? C.gold : C.red;
    ctx.fillStyle = bc;
    roundRect(ctx, PAD, PY, S - PAD * 2, 56, 5);
    ctx.fill();
    ctx.fillStyle = p.promoGold ? C.navyDeep : C.white;
    ctx.font      = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.promoLine, S / 2, PY + 35);
    ctx.textAlign = 'left';
    PY += 76;
  } else {
    PY += 20;
  }

  // Skreślona cena (OLD) — wyraźna, ~58px ≈ ~45% rozmiaru nowej
  if (p.oldPrice) {
    const oldStr = `${p.oldPrice} PLN`;
    ctx.font      = '400 58px sans-serif';
    ctx.fillStyle = 'rgba(200,212,224,0.72)';
    ctx.fillText(oldStr, PAD, PY + 54);
    const oldW = ctx.measureText(oldStr).width;
    ctx.strokeStyle = 'rgba(200,212,224,0.60)';
    ctx.lineWidth   = 3.5;
    ctx.beginPath();
    ctx.moveTo(PAD, PY + 33);
    ctx.lineTo(PAD + oldW, PY + 33);
    ctx.stroke();
    PY += 76;
  }

  // Nowa cena — GIGANTYCZNA
  ctx.fillStyle = C.white;
  ctx.font      = 'bold 54px sans-serif';
  ctx.fillText(p.currency, PAD, PY + 112);

  ctx.font = 'bold 136px sans-serif';
  const priceX = PAD + 130;
  ctx.fillText(p.price, priceX, PY + 124);
  const priceW = ctx.measureText(p.price).width;

  const suffix = p.priceSuffix || p.perUnit;
  if (suffix) {
    ctx.font      = '400 23px sans-serif';
    ctx.fillStyle = C.chrome;
    ctx.fillText(suffix, priceX + priceW + 16, PY + 124);
  }

  PY += 146;

  if (p.vatNote) {
    ctx.fillStyle = C.chrome;
    ctx.font      = '400 19px sans-serif';
    ctx.fillText(p.vatNote, PAD, PY);
    PY += 30;
  }

  // Linia podziału 2/3 (y=800)
  hline(ctx, 800);

  // ─── FEATURES + CTA  800–1110 ──────────────────────────────

  // Bullets — 2 kolumny (3 lewa, 2 prawa) dla 5 punktów
  const colR = S / 2 + 16;
  let   bY   = 832;
  p.bullets.forEach((b, i) => {
    const col = (p.bullets.length > 3 && i >= 3) ? colR : PAD;
    const row = (p.bullets.length > 3 && i >= 3) ? i - 3 : i;
    const by  = bY + row * 42;
    ctx.fillStyle = C.red;
    ctx.fillRect(col, by - 13, 10, 10);
    ctx.fillStyle = C.white;
    ctx.font      = '400 20px sans-serif';
    ctx.fillText(b, col + 26, by);
  });

  // CTA button — pełna szerokość
  const ctaY = 984;
  ctx.fillStyle = C.red;
  roundRect(ctx, PAD, ctaY, S - PAD * 2, 82, 6);
  ctx.fill();
  // Gradient na przycisku (lewy ciemniejszy, prawy jaśniejszy)
  const btnG = ctx.createLinearGradient(PAD, 0, S - PAD, 0);
  btnG.addColorStop(0, 'rgba(0,0,0,0.10)');
  btnG.addColorStop(1, 'rgba(255,255,255,0.06)');
  ctx.fillStyle = btnG;
  roundRect(ctx, PAD, ctaY, S - PAD * 2, 82, 6);
  ctx.fill();

  ctx.fillStyle = C.white;
  ctx.font      = 'bold 27px sans-serif';
  ctx.textAlign = 'center';
  const cta = p.ctaText ?? `KUP VOUCHER  ·  ${p.price} ZŁ  →`;
  ctx.fillText(cta, S / 2, ctaY + 51);
  ctx.textAlign = 'left';

  // Drobny druk
  ctx.fillStyle = C.chrome;
  ctx.font      = '400 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    'Voucher PDF  ·  Ważny 12 miesięcy  ·  Dostawa e-mail natychmiast  ·  akrobacja.com',
    S / 2, 1088
  );
  ctx.textAlign = 'left';

  // ─── STATS BAR  1110–1200 ─────────────────────────────────

  const barY = 1112;
  ctx.fillStyle = 'rgba(4,10,20,0.97)';
  ctx.fillRect(0, barY, S, S - barY);

  const stats = [
    ['4000h+',             'NALOT ŁĄCZNY'],
    p.statsMiddle,
    ['3000h+',             'AKROBACJA EXTRA'],
  ];
  const cW = S / 3;
  stats.forEach(([main, sub], i) => {
    const cx = cW * i + cW / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = i === 1 ? p.accent : C.white;
    ctx.font      = 'bold 22px sans-serif';
    ctx.fillText(main, cx, barY + 28);
    ctx.fillStyle = C.chrome;
    ctx.font      = 'bold 11px sans-serif';
    ctx.fillText(sub, cx, barY + 48);
  });

  ctx.strokeStyle = C.chrome;
  ctx.globalAlpha = 0.20;
  ctx.lineWidth   = 1;
  [1, 2].forEach(i => {
    ctx.beginPath();
    ctx.moveTo(cW * i, barY + 8);
    ctx.lineTo(cW * i, S - 8);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
  ctx.textAlign   = 'left';

  // ── Zapis ─────────────────────────────────────────────────
  const buf = canvas.toBuffer('image/png');
  writeFileSync(join(ADS, p.file), buf);
  console.log(`✓  ${p.file}  (${(buf.length / 1024).toFixed(0)} KB)`);
}

// ── Main ──────────────────────────────────────────────────────────
const logo = await loadImage(join(ADS, 'logo-landscape.png')).catch(() => null);
const bg   = existsSync(join(ROOT, 'public', 'speks-city.jpg'))
  ? await loadImage(join(ROOT, 'public', 'speks-city.jpg')).catch(() => null)
  : null;

for (const p of PRODUCTS) {
  await drawProduct(p, logo, bg);
}
console.log('\nWszystkie grafiki → public/ads/');
