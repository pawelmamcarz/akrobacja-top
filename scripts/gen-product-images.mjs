/**
 * Generates 3 product images (1200×1200 PNG) for Meta/Facebook catalog.
 * Output: public/ads/product-pierwszy-lot.png
 *         public/ads/product-adrenalina.png
 *         public/ads/product-masterclass.png
 */
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dir, '..');
const ADS   = join(ROOT, 'public', 'ads');

// ─── Brand palette ───────────────────────────────────────────────
const C = {
  navyDeep : '#0A1428',
  navy     : '#1B4DB5',
  red      : '#C41E3A',
  redDark  : '#A31830',
  white    : '#FFFFFF',
  greyLt   : '#C8D4E0',
  chrome   : '#7A8FA6',
  cardBg   : '#F4F6F9',
};

// ─── Products ────────────────────────────────────────────────────
const PRODUCTS = [
  {
    file      : 'product-pierwszy-lot.png',
    tag       : 'PIERWSZY RAZ',
    name      : 'PIERWSZY LOT',
    sub       : 'Twój pierwszy kontakt z akrobacją',
    promoLine : '-20% DO KOŃCA MIESIĄCA',
    oldPrice  : 'PLN 2 499',
    price     : '1999',
    currency  : 'PLN',
    perUnit   : '/ osoba',
    bullets   : [
      'Do 15 min w powietrzu',
      'Briefing naziemny (20 min)',
      'Do +4G / -2G',
      'Podstawowe figury akrobacyjne',
      'Doświadczenie nie jest wymagane',
    ],
    bgAccent  : C.navy,
  },
  {
    file      : 'product-adrenalina.png',
    tag       : 'DLA ODWAŻNYCH',
    name      : 'ADRENALINA',
    sub       : 'Pełny program akrobacyjny do +6G',
    promoLine : null,
    oldPrice  : null,
    price     : '2999',
    currency  : 'PLN',
    perUnit   : '/ osoba',
    bullets   : [
      'Do 20 min w powietrzu',
      'Pełny program akrobacyjny',
      'Do +6G / -3G',
      'Zaawansowane figury',
      'Debriefing po locie',
    ],
    bgAccent  : '#8B0000',
  },
  {
    file      : 'product-masterclass.png',
    tag       : 'Z MISTRZEM ŚWIATA',
    name      : 'MASTERCLASS',
    sub       : 'Sesja szkoleniowa — 2 loty, do 50 min',
    promoLine : null,
    oldPrice  : null,
    price     : '4999',
    currency  : 'PLN',
    perUnit   : '/ osoba',
    bullets   : [
      'Do 50 min (2 loty)',
      'Zaawansowane figury konkursowe',
      'Pełny debriefing + analiza lotu',
      'Certyfikat uczestnictwa',
      'Samolot Extra 300L SP-EKS',
    ],
    bgAccent  : '#4A0080',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────

function hex(ctx, color) { ctx.fillStyle = color; }
function stroke(ctx, color) { ctx.strokeStyle = color; }

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

function strikethrough(ctx, x, y, text, font, color) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  const w = ctx.measureText(text).width;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - 6);
  ctx.lineTo(x + w, y - 6);
  ctx.stroke();
}

// ─── Draw one product image ───────────────────────────────────────

async function drawProduct(p) {
  const SIZE = 1200;
  const canvas = createCanvas(SIZE, SIZE);
  const ctx    = canvas.getContext('2d');

  // --- Background gradient (dark left → lighter right) -----------
  const bgGrad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  bgGrad.addColorStop(0,   '#04101C');
  bgGrad.addColorStop(0.5, '#0A1428');
  bgGrad.addColorStop(1,   '#0F1E38');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Try loading background photo
  try {
    const bgPath = join(ROOT, 'public', 'speks-city.jpg');
    if (existsSync(bgPath)) {
      const img = await loadImage(bgPath);
      ctx.globalAlpha = 0.22;
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      ctx.globalAlpha = 1;
    }
  } catch (_) { /* no-op */ }

  // --- Subtle diagonal accent line ---------------------------------
  ctx.save();
  ctx.strokeStyle = p.bgAccent;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 280;
  ctx.beginPath();
  ctx.moveTo(-80, SIZE + 80);
  ctx.lineTo(SIZE * 0.55, -80);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();

  // --- Logo area (top-left) ----------------------------------------
  try {
    const logo = await loadImage(join(ROOT, 'public', 'akrobacja-logo-light.png'));
    ctx.drawImage(logo, 36, 30, 160, 68);
  } catch (_) {
    ctx.fillStyle = C.white;
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('akrobacja.com', 36, 72);
  }

  // --- Top-right badge: EXTRA 300L ---------------------------------
  ctx.fillStyle = C.red;
  roundRect(ctx, SIZE - 296, 30, 264, 42, 4);
  ctx.fill();
  ctx.fillStyle = C.white;
  ctx.font      = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('★  MISTRZ ŚWIATA AKROBACJI', SIZE - 164, 57);
  ctx.textAlign = 'left';

  // --- White product card ------------------------------------------
  const CX = 52, CY = 130, CW = SIZE - 104, CH = SIZE - 220;
  ctx.shadowColor   = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur    = 32;
  ctx.shadowOffsetY = 8;
  roundRect(ctx, CX, CY, CW, CH, 10);
  ctx.fillStyle = C.white;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur  = 0;

  const PX = CX + 44;  // left padding inside card
  let   PY = CY + 44;  // current Y cursor

  // --- Tag label ---------------------------------------------------
  ctx.fillStyle = C.chrome;
  ctx.font      = 'bold 16px sans-serif';
  ctx.letterSpacing = '3px';
  ctx.fillText(p.tag.toUpperCase(), PX, PY);
  ctx.letterSpacing = '0px';

  PY += 14;
  // Separator
  ctx.strokeStyle = '#E0E6ED';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(PX, PY);
  ctx.lineTo(CX + CW - 44, PY);
  ctx.stroke();
  PY += 42;

  // --- Package name ------------------------------------------------
  ctx.fillStyle = C.navyDeep;
  ctx.font      = 'bold 62px sans-serif';
  ctx.fillText(p.name, PX, PY);
  PY += 14;

  // Subtitle
  ctx.fillStyle = C.chrome;
  ctx.font      = '400 20px sans-serif';
  ctx.fillText(p.sub, PX, PY);
  PY += 32;

  // --- Promo banner (optional) ------------------------------------
  if (p.promoLine) {
    ctx.fillStyle = C.red;
    roundRect(ctx, PX, PY, CW - 88, 48, 4);
    ctx.fill();
    ctx.fillStyle = C.white;
    ctx.font      = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.promoLine, PX + (CW - 88) / 2, PY + 31);
    ctx.textAlign = 'left';
    PY += 70;
  } else {
    PY += 10;
  }

  // --- Old price (optional) ----------------------------------------
  if (p.oldPrice) {
    strikethrough(ctx, PX, PY, p.oldPrice,
      '400 22px sans-serif', C.chrome);
    PY += 28;
  }

  // --- Main price --------------------------------------------------
  // "PLN" small
  ctx.fillStyle = C.navyDeep;
  ctx.font      = 'bold 46px sans-serif';
  ctx.fillText(p.currency, PX, PY + 68);
  // Big number
  ctx.font = 'bold 120px sans-serif';
  const numX = PX + ctx.measureText(p.currency + ' ').width;
  ctx.fillText(p.price, PX + 100, PY + 80);
  // /osoba
  ctx.fillStyle = C.chrome;
  ctx.font      = '400 18px sans-serif';
  const priceW  = ctx.measureText(p.price).width;
  ctx.font = 'bold 120px sans-serif';
  const bW = ctx.measureText(p.price).width;
  ctx.font = '400 18px sans-serif';
  ctx.fillText(p.perUnit, PX + 100 + bW + 10, PY + 80);
  PY += 106;

  // --- Bullet features --------------------------------------------
  for (const bullet of p.bullets) {
    // Red square bullet
    ctx.fillStyle = C.red;
    ctx.fillRect(PX, PY - 12, 9, 9);
    ctx.fillStyle = C.navyDeep;
    ctx.font      = '400 20px sans-serif';
    ctx.fillText(bullet, PX + 22, PY);
    PY += 34;
  }
  PY += 14;

  // --- CTA button --------------------------------------------------
  const btnW = CW - 88;
  ctx.fillStyle = C.red;
  roundRect(ctx, PX, PY, btnW, 68, 4);
  ctx.fill();
  // Button text
  ctx.fillStyle = C.white;
  ctx.font      = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`KUP VOUCHER, ${p.price} ZŁ`, PX + btnW / 2, PY + 42);
  ctx.textAlign = 'left';
  PY += 82;

  // --- Card footer: small print ------------------------------------
  ctx.fillStyle = C.chrome;
  ctx.font      = '400 15px sans-serif';
  ctx.fillText('Voucher PDF • Ważny 12 miesięcy • Dostawa e-mail natychmiast po zakupie', PX, PY);
  ctx.fillText('Extra 300L SP-EKS • Lotnisko Radom-Piastów EPRP • akrobacja.com', PX, PY + 22);

  // --- Bottom dark bar with stats -----------------------------------
  const barY = SIZE - 74;
  ctx.fillStyle = 'rgba(4,10,20,0.95)';
  ctx.fillRect(0, barY, SIZE, 74);

  // Stats
  const stats = [
    ['4000h+', 'NALOT ŁĄCZNY'],
    ['POZNAJ PILOTA', null],
    ['3000h+', 'AKROBACJA EXTRA'],
  ];
  const colW = SIZE / 3;
  stats.forEach(([main, sub], i) => {
    const cx = colW * i + colW / 2;
    ctx.textAlign = 'center';
    if (sub) {
      ctx.fillStyle = C.white;
      ctx.font      = 'bold 28px sans-serif';
      ctx.fillText(main, cx, barY + 32);
      ctx.fillStyle = C.chrome;
      ctx.font      = 'bold 12px sans-serif';
      ctx.fillText(sub, cx, barY + 52);
    } else {
      ctx.fillStyle = C.chrome;
      ctx.font      = 'bold 13px sans-serif';
      ctx.fillText(main, cx, barY + 42);
    }
  });
  ctx.textAlign = 'left';

  // Dividers
  ctx.strokeStyle = C.chrome;
  ctx.globalAlpha = 0.25;
  ctx.lineWidth   = 1;
  [1, 2].forEach(i => {
    ctx.beginPath();
    ctx.moveTo(colW * i, barY + 10);
    ctx.lineTo(colW * i, SIZE - 10);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;

  // ── Save PNG ──────────────────────────────────────────────────
  const outPath = join(ADS, p.file);
  const buf     = canvas.toBuffer('image/png');
  writeFileSync(outPath, buf);
  console.log(`✓ ${p.file}  (${(buf.length / 1024).toFixed(0)} KB)`);
}

// ─── Main ────────────────────────────────────────────────────────
for (const p of PRODUCTS) {
  await drawProduct(p);
}
console.log('\nWszystkie grafiki wygenerowane → public/ads/');
