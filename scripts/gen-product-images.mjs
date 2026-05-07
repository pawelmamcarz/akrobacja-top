/**
 * Generuje 4 obrazki produktowe 1200×1200 PNG dla katalogu Meta/Facebook.
 * Layout: zasada 3 podziałów — identyfikacja (top) / cena (środek) / CTA (dół)
 *
 * Output: public/ads/product-pierwszy-lot.png
 *         public/ads/product-adrenalina.png
 *         public/ads/product-masterclass.png
 *         public/ads/product-fcl900-akrobacja.png
 */
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dir, '..');
const ADS   = join(ROOT, 'public', 'ads');

// ── Fonty z polskimi diakrytykami (Arial z macOS) ─────────────────
const FONT_DIR = '/System/Library/Fonts/Supplemental';
GlobalFonts.registerFromPath(join(FONT_DIR, 'Arial.ttf'),           'Arial');
GlobalFonts.registerFromPath(join(FONT_DIR, 'Arial Bold.ttf'),      'Arial');
GlobalFonts.registerFromPath(join(FONT_DIR, 'Arial Italic.ttf'),    'Arial');

const FONT_REG  = '400 {SIZE}px Arial';
const FONT_BOLD = 'bold {SIZE}px Arial';
const f = (size, bold = false) =>
  (bold ? FONT_BOLD : FONT_REG).replace('{SIZE}', size);

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
};

// ── Produkty ──────────────────────────────────────────────────────
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
    oldPrice    : '6 000',
    price       : '4 999',
    currency    : 'PLN',
    perUnit     : '/ osoba',
    vatNote     : null,
    ctaText     : null,
    bullets     : [
      'Do 50 min (2 loty)',
      'Zaawansowane wiązanki akrobacyjne',
      'Pełny debriefing + analiza lotu',
      'Certyfikat uczestnictwa',
      'Samolot Extra 300L SP-EKS',
    ],
    accent      : '#5A0090',
    statsMiddle : ['Extra 300L SP-EKS', 'EPRP RADOM-PIASTÓW'],
  },
  {
    file        : 'product-fcl900-akrobacja.png',
    tag         : 'KURS PILOTAŻU  ·  UPRAWNIENIE EASA',
    name        : 'SZKOLENIE\nFCL.900',
    sub         : 'Uprawnienie Akrobacja — EASA DTO',
    promoLine   : 'CERTYFIKAT EASA  ·  UPRAWNIENIE AKROBACJA',
    promoGold   : true,
    oldPrice    : null,
    price       : '19 999',
    currency    : 'PLN',
    perUnit     : null,
    priceSuffix : 'netto',
    vatNote     : '24 599 PLN brutto (z VAT 23%)',
    ctaText     : 'ZAPISZ SIĘ NA SZKOLENIE  →',
    bullets     : [
      'Min. 5 h lotu na Extra 300L SP-EKS',
      'Teoria: przepisy, ograniczenia, bezpieczeństwo',
      'Instruktor z uprawnieniami FI(A)',
      'Uprawnienie wpisane do licencji',
      'Możliwość dofinansowania UE',
    ],
    accent      : C.gold,
    statsMiddle : ['FCL.900', 'UPRAWNIENIE EASA'],
  },
];

// ── Helpers ───────────────────────────────────────────────────────
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

function hline(ctx, y, x0 = 40, x1 = 1160) {
  ctx.strokeStyle = C.greyLine;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(x1, y);
  ctx.stroke();
}

// Rysuje obraz w trybie "cover" (bez zniekształceń, przyciął od środka)
function drawCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw    = img.width  * scale;
  const dh    = img.height * scale;
  const dx    = x + (w - dw) / 2;
  const dy    = y + (h - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);
}

// ── Rysowanie jednego obrazka ─────────────────────────────────────
async function drawProduct(p, bg) {
  const S   = 1200;
  const PAD = 40;
  const canvas = createCanvas(S, S);
  const ctx    = canvas.getContext('2d');

  // ── Tło ──────────────────────────────────────────────────────
  const bgG = ctx.createLinearGradient(0, 0, S, S);
  bgG.addColorStop(0,   C.bg0);
  bgG.addColorStop(0.5, C.bg1);
  bgG.addColorStop(1,   C.bg2);
  ctx.fillStyle = bgG;
  ctx.fillRect(0, 0, S, S);

  // Zdjęcie samolotu — cover fit, przyciemnione
  if (bg) {
    ctx.save();
    ctx.globalAlpha = 0.30;
    drawCover(ctx, bg, 0, 0, S, S);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Gradient vignette (czytelność tekstu nad zdjęciem)
  const vig = ctx.createLinearGradient(0, 0, 0, S);
  vig.addColorStop(0,   'rgba(4,16,28,0.65)');
  vig.addColorStop(0.35,'rgba(4,16,28,0.30)');
  vig.addColorStop(0.60,'rgba(4,16,28,0.40)');
  vig.addColorStop(1,   'rgba(4,16,28,0.75)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, S, S);

  // Accent diagonal band
  ctx.save();
  ctx.strokeStyle = p.accent;
  ctx.globalAlpha = 0.18;
  ctx.lineWidth   = 380;
  ctx.lineCap     = 'butt';
  ctx.beginPath();
  ctx.moveTo(-140, S + 140);
  ctx.lineTo(S * 0.55, -140);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();

  // Pasek akcentu — lewa krawędź
  ctx.fillStyle   = p.accent;
  ctx.globalAlpha = 0.9;
  ctx.fillRect(0, 0, 8, S);
  ctx.globalAlpha = 1;

  // ─── STREFA GÓRNA  0–400  (identyfikacja) ────────────────────

  // Logo tekstowe: "AKROBACJA" bold white + ".COM" accent
  ctx.font      = f(28, true);
  ctx.fillStyle = C.white;
  ctx.fillText('AKROBACJA', PAD, 58);
  const aW = ctx.measureText('AKROBACJA').width;
  ctx.fillStyle = p.accent;
  ctx.fillText('.COM', PAD + aW, 58);

  // Linia pod logo
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, 70); ctx.lineTo(PAD + aW + ctx.measureText('.COM').width, 70);
  ctx.stroke();

  // Odznaka prawy górny róg
  ctx.fillStyle = C.red;
  roundRect(ctx, S - 330, 22, 298, 46, 23);
  ctx.fill();
  ctx.fillStyle   = C.white;
  ctx.font        = f(14, true);
  ctx.textAlign   = 'center';
  ctx.fillText('★  MISTRZ ŚWIATA AKROBACJI', S - 181, 51);
  ctx.textAlign   = 'left';

  // Chip tagu
  ctx.font = f(15, true);
  const tagTW = ctx.measureText(p.tag).width;
  ctx.fillStyle   = p.accent;
  ctx.globalAlpha = 0.9;
  roundRect(ctx, PAD, 100, tagTW + 28, 36, 5);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = C.white;
  ctx.fillText(p.tag, PAD + 14, 124);

  // Nazwa produktu
  ctx.fillStyle = C.white;
  if (p.name.includes('\n')) {
    const [l1, l2] = p.name.split('\n');
    ctx.font = f(82, true);
    ctx.fillText(l1, PAD, 244);
    ctx.fillText(l2, PAD, 340);
    ctx.fillStyle = C.chrome;
    ctx.font      = f(21, false);
    ctx.fillText(p.sub, PAD, 376);
  } else {
    ctx.font = f(94, true);
    ctx.fillText(p.name, PAD, 316);
    ctx.fillStyle = C.chrome;
    ctx.font      = f(22, false);
    ctx.fillText(p.sub, PAD, 362);
  }

  // Linia 1/3
  hline(ctx, 400);

  // ─── STREFA CENY  400–800 ───────────────────────────────────

  let PY = 422;

  // Baner promo
  if (p.promoLine) {
    ctx.fillStyle = p.promoGold ? C.gold : C.red;
    roundRect(ctx, PAD, PY, S - PAD * 2, 56, 5);
    ctx.fill();
    ctx.fillStyle = p.promoGold ? C.navyDeep : C.white;
    ctx.font      = f(18, true);
    ctx.textAlign = 'center';
    ctx.fillText(p.promoLine, S / 2, PY + 36);
    ctx.textAlign = 'left';
    PY += 76;
  } else {
    PY += 18;
  }

  // Stara cena (skreślona) — czytelna, ~55px
  if (p.oldPrice) {
    const oldStr = `${p.oldPrice} PLN`;
    ctx.font      = f(55, false);
    ctx.fillStyle = 'rgba(200,212,224,0.70)';
    ctx.fillText(oldStr, PAD, PY + 52);
    const oldW = ctx.measureText(oldStr).width;
    ctx.strokeStyle = 'rgba(200,212,224,0.58)';
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.moveTo(PAD, PY + 32);
    ctx.lineTo(PAD + oldW, PY + 32);
    ctx.stroke();
    PY += 72;
  }

  // Nowa cena — DUŻA
  ctx.fillStyle = C.white;
  ctx.font      = f(52, true);
  ctx.fillText(p.currency, PAD, PY + 108);

  ctx.font = f(134, true);
  const priceX = PAD + 124;
  ctx.fillText(p.price, priceX, PY + 120);
  const priceW = ctx.measureText(p.price).width;

  const suffix = p.priceSuffix || p.perUnit;
  if (suffix) {
    ctx.font      = f(23, false);
    ctx.fillStyle = C.chrome;
    ctx.fillText(suffix, priceX + priceW + 16, PY + 120);
  }

  PY += 142;

  if (p.vatNote) {
    ctx.fillStyle = C.chrome;
    ctx.font      = f(19, false);
    ctx.fillText(p.vatNote, PAD, PY);
  }

  // Linia 2/3
  hline(ctx, 800);

  // ─── STREFA CECH + CTA  800–1110 ───────────────────────────

  // Bullets — 2 kolumny (3 lewa, 2 prawa)
  const colR = S / 2 + 20;
  const bY0  = 836;
  p.bullets.forEach((b, i) => {
    const col = (p.bullets.length > 3 && i >= 3) ? colR : PAD;
    const row = (p.bullets.length > 3 && i >= 3) ? i - 3 : i;
    const by  = bY0 + row * 44;
    ctx.fillStyle = C.red;
    ctx.fillRect(col, by - 14, 10, 10);
    ctx.fillStyle = C.white;
    ctx.font      = f(20, false);
    ctx.fillText(b, col + 26, by);
  });

  // CTA button
  const ctaY = 984;
  ctx.fillStyle = C.red;
  roundRect(ctx, PAD, ctaY, S - PAD * 2, 82, 6);
  ctx.fill();

  ctx.fillStyle = C.white;
  ctx.font      = f(27, true);
  ctx.textAlign = 'center';
  const cta = p.ctaText ?? `KUP VOUCHER  ·  ${p.price} ZŁ  →`;
  ctx.fillText(cta, S / 2, ctaY + 51);
  ctx.textAlign = 'left';

  // Drobny druk
  ctx.fillStyle = C.chrome;
  ctx.font      = f(14, false);
  ctx.textAlign = 'center';
  ctx.fillText(
    'Voucher PDF  ·  Ważny 12 miesięcy  ·  Dostawa e-mail natychmiast  ·  akrobacja.com',
    S / 2, 1088
  );
  ctx.textAlign = 'left';

  // ─── PASEK STATYSTYK  1110–1200 ──────────────────────────────

  const barY = 1112;
  ctx.fillStyle = 'rgba(4,10,20,0.97)';
  ctx.fillRect(0, barY, S, S - barY);

  const stats = [
    ['4000h+',  'NALOT ŁĄCZNY'],
    p.statsMiddle,
    ['3000h+',  'AKROBACJA EXTRA'],
  ];
  const cW = S / 3;
  stats.forEach(([main, sub], i) => {
    const cx = cW * i + cW / 2;
    ctx.textAlign = 'center';
    ctx.fillStyle = i === 1 ? p.accent : C.white;
    ctx.font      = f(22, true);
    ctx.fillText(main, cx, barY + 28);
    ctx.fillStyle = C.chrome;
    ctx.font      = f(11, true);
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

  // Zapis
  const buf = canvas.toBuffer('image/png');
  writeFileSync(join(ADS, p.file), buf);
  console.log(`✓  ${p.file}  (${(buf.length / 1024).toFixed(0)} KB)`);
}

// ── Main ─────────────────────────────────────────────────────────
const bgPath = join(ROOT, 'public', 'speks-city.jpg');
const bg     = existsSync(bgPath)
  ? await loadImage(bgPath).catch(() => null)
  : null;

for (const p of PRODUCTS) {
  await drawProduct(p, bg);
}
console.log('\nWszystkie grafiki → public/ads/');
