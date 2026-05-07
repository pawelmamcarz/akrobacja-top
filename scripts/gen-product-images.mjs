/**
 * Generuje 4 obrazki produktowe 1200×1200 PNG (Meta/Facebook catalog).
 * Zasada: mniej elementów, większy tekst, więcej oddechu.
 */
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dir, '..');
const ADS   = join(ROOT, 'public', 'ads');
const GAL   = join(ROOT, 'public', 'gallery');

// ── Fonty z polskimi diakrytykami ────────────────────────────────
const FDIR = '/System/Library/Fonts/Supplemental';
GlobalFonts.registerFromPath(join(FDIR, 'Arial.ttf'),       'Arial');
GlobalFonts.registerFromPath(join(FDIR, 'Arial Bold.ttf'),  'Arial');
GlobalFonts.registerFromPath(join(FDIR, 'Arial Italic.ttf'),'Arial');

const f = (size, bold = false) =>
  `${bold ? 'bold' : '400'} ${size}px Arial`;

const C = {
  bg0  : '#04101C',
  bg1  : '#0A1428',
  navy : '#0A1428',
  red  : '#C41E3A',
  white: '#FFFFFF',
  grey : '#8AACC4',
  gold : '#C8960C',
};

// ── Produkty ─────────────────────────────────────────────────────
const PRODUCTS = [
  {
    file      : 'product-pierwszy-lot.png',
    bg        : join(GAL, '2024_10_25_ATAM32_Warszawa_hesja_033.jpg'),
    accent    : '#1B4DB5',
    tag       : 'PIERWSZY RAZ',
    name      : 'PIERWSZY LOT',
    sub       : 'Twój pierwszy kontakt z akrobacją',
    promoLine : '-20% DO KOŃCA MIESIĄCA',
    promoGold : false,
    oldPrice  : '2 499',
    price     : '1 999',
    currency  : 'PLN',
    suffix    : '/ osoba',
    bullets   : [
      'Do 15 min w powietrzu',
      'Przeciążenia do +4G / −2G',
      'Doświadczenie nie wymagane',
    ],
    ctaText   : null,
  },
  {
    file      : 'product-adrenalina.png',
    bg        : join(GAL, 'ATAM33_Slawek_hesja_Krajniewski_007.jpg'),
    accent    : '#C41E3A',
    tag       : 'DLA ODWAŻNYCH',
    name      : 'ADRENALINA',
    sub       : 'Pełny program akrobacyjny do +6G',
    promoLine : null,
    promoGold : false,
    oldPrice  : null,
    price     : '2 999',
    currency  : 'PLN',
    suffix    : '/ osoba',
    bullets   : [
      'Do 20 min w powietrzu',
      'Przeciążenia do +6G / −3G',
      'Debriefing po każdym locie',
    ],
    ctaText   : null,
  },
  {
    file      : 'product-masterclass.png',
    bg        : join(GAL, 'ATAM33_Slawek_hesja_Krajniewski_005.jpg'),
    accent    : '#5A0090',
    tag       : 'Z MISTRZEM ŚWIATA',
    name      : 'MASTERCLASS',
    sub       : '2 loty z Mistrzem Świata Akrobacji',
    promoLine : null,
    promoGold : false,
    oldPrice  : '6 000',
    price     : '4 999',
    currency  : 'PLN',
    suffix    : '/ osoba',
    bullets   : [
      'Do 50 min łącznie (2 loty)',
      'Zaawansowane wiązanki akrobacyjne',
      'Pełny debriefing + analiza lotu',
    ],
    ctaText   : null,
  },
  {
    file      : 'product-fcl900-akrobacja.png',
    bg        : join(GAL, 'ATAM33_Slawek_hesja_Krajniewski_001.jpg'),
    accent    : C.gold,
    tag       : 'KURS  ·  UPRAWNIENIE EASA',
    name      : 'SZKOLENIE\nFCL.900',
    sub       : 'Uprawnienie Akrobacja — EASA DTO',
    promoLine : 'CERTYFIKAT EASA  ·  UPRAWNIENIE AKROBACJA',
    promoGold : true,
    oldPrice  : null,
    price     : '19 999',
    currency  : 'PLN',
    suffix    : 'netto',
    vatNote   : '24 599 PLN brutto',
    bullets   : [
      'Min. 5 h lotu na Extra 300L SP-EKS',
      'Uprawnienie wpisane do licencji',
      'Możliwość dofinansowania UE',
    ],
    ctaText   : 'ZAPISZ SIĘ NA SZKOLENIE  →',
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

function drawCover(ctx, img, x, y, w, h) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width  * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

// ── Rysowanie ────────────────────────────────────────────────────
async function drawProduct(p) {
  const S   = 1200;
  const PAD = 52;

  const bg = p.bg && existsSync(p.bg)
    ? await loadImage(p.bg).catch(() => null)
    : null;

  const canvas = createCanvas(S, S);
  const ctx    = canvas.getContext('2d');

  // Tło — ciemny gradient
  const bgG = ctx.createLinearGradient(0, 0, 0, S);
  bgG.addColorStop(0, C.bg0);
  bgG.addColorStop(1, '#0F1E38');
  ctx.fillStyle = bgG;
  ctx.fillRect(0, 0, S, S);

  // Zdjęcie (cover-fit)
  if (bg) {
    ctx.save();
    ctx.globalAlpha = 0.42;
    drawCover(ctx, bg, 0, 0, S, S);
    ctx.restore();
  }

  // Winiety — ciemne rogi, jasny środek-prawa
  const vigTop = ctx.createLinearGradient(0, 0, 0, S * 0.5);
  vigTop.addColorStop(0,   'rgba(4,16,28,0.82)');
  vigTop.addColorStop(0.4, 'rgba(4,16,28,0.25)');
  vigTop.addColorStop(1,   'rgba(4,16,28,0)');
  ctx.fillStyle = vigTop;
  ctx.fillRect(0, 0, S, S * 0.5);

  const vigBot = ctx.createLinearGradient(0, S, 0, S * 0.45);
  vigBot.addColorStop(0,   'rgba(4,16,28,0.92)');
  vigBot.addColorStop(0.5, 'rgba(4,16,28,0.45)');
  vigBot.addColorStop(1,   'rgba(4,16,28,0)');
  ctx.fillStyle = vigBot;
  ctx.fillRect(0, 0, S, S);

  const vigLeft = ctx.createLinearGradient(0, 0, S * 0.55, 0);
  vigLeft.addColorStop(0,   'rgba(4,16,28,0.78)');
  vigLeft.addColorStop(0.6, 'rgba(4,16,28,0.20)');
  vigLeft.addColorStop(1,   'rgba(4,16,28,0)');
  ctx.fillStyle = vigLeft;
  ctx.fillRect(0, 0, S, S);

  // Pasek akcentu — lewa krawędź
  ctx.fillStyle   = p.accent;
  ctx.globalAlpha = 0.95;
  ctx.fillRect(0, 0, 9, S);
  ctx.globalAlpha = 1;

  // ── GÓRNA STREFA (0–380): marka + nazwa ──────────────────────

  // Marka
  ctx.font      = f(30, true);
  ctx.fillStyle = C.white;
  ctx.fillText('AKROBACJA', PAD, 58);
  const aW = ctx.measureText('AKROBACJA').width;
  ctx.fillStyle = p.accent;
  ctx.fillText('.COM', PAD + aW, 58);

  // Odznaka prawa górna
  ctx.fillStyle = C.red;
  roundRect(ctx, S - 344, 22, 310, 48, 24);
  ctx.fill();
  ctx.font      = f(14, true);
  ctx.fillStyle = C.white;
  ctx.textAlign = 'center';
  ctx.fillText('★  MISTRZ ŚWIATA AKROBACJI', S - 189, 52);
  ctx.textAlign = 'left';

  // Chip tagu
  ctx.font = f(15, true);
  const tW = ctx.measureText(p.tag).width + 30;
  ctx.fillStyle   = p.accent;
  ctx.globalAlpha = 0.88;
  roundRect(ctx, PAD, 94, tW, 38, 5);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = C.white;
  ctx.fillText(p.tag, PAD + 15, 119);

  // Nazwa produktu — DOMINUJĄCA
  ctx.fillStyle = C.white;
  if (p.name.includes('\n')) {
    const [l1, l2] = p.name.split('\n');
    ctx.font = f(88, true);
    ctx.fillText(l1, PAD, 236);
    ctx.fillText(l2, PAD, 336);
    ctx.fillStyle = C.grey;
    ctx.font      = f(22, false);
    ctx.fillText(p.sub, PAD, 374);
  } else {
    ctx.font = f(108, true);
    ctx.fillText(p.name, PAD, 320);
    ctx.fillStyle = C.grey;
    ctx.font      = f(22, false);
    ctx.fillText(p.sub, PAD, 364);
  }

  // Linia 1/3
  ctx.strokeStyle = 'rgba(140,180,220,0.20)';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, 400); ctx.lineTo(S - PAD, 400);
  ctx.stroke();

  // ── STREFA CENY (400–760) ──────────────────────────────────

  let PY = 424;

  // Baner promo
  if (p.promoLine) {
    ctx.fillStyle = p.promoGold ? C.gold : C.red;
    roundRect(ctx, PAD, PY, S - PAD * 2, 58, 6);
    ctx.fill();
    ctx.font      = f(19, true);
    ctx.fillStyle = p.promoGold ? C.navy : C.white;
    ctx.textAlign = 'center';
    ctx.fillText(p.promoLine, S / 2, PY + 37);
    ctx.textAlign = 'left';
    PY += 78;
  } else {
    PY += 16;
  }

  // Stara cena — skreślona (czytelna: ~55% nowej)
  if (p.oldPrice) {
    const oldStr = `${p.oldPrice} PLN`;
    ctx.font      = f(62, false);
    ctx.fillStyle = 'rgba(180,205,224,0.65)';
    ctx.fillText(oldStr, PAD, PY + 56);
    const oW = ctx.measureText(oldStr).width;
    ctx.strokeStyle = 'rgba(180,205,224,0.55)';
    ctx.lineWidth   = 3.5;
    ctx.beginPath();
    ctx.moveTo(PAD, PY + 33);
    ctx.lineTo(PAD + oW, PY + 33);
    ctx.stroke();
    PY += 78;
  }

  // Nowa cena — MONUMENTALNA
  ctx.fillStyle = C.white;
  ctx.font      = f(58, true);
  ctx.fillText(p.currency, PAD, PY + 118);

  ctx.font = f(152, true);
  const px = PAD + 136;
  ctx.fillText(p.price, px, PY + 132);
  const pW = ctx.measureText(p.price).width;

  if (p.suffix) {
    ctx.font      = f(26, false);
    ctx.fillStyle = C.grey;
    ctx.fillText(p.suffix, px + pW + 18, PY + 132);
  }

  PY += 158;

  if (p.vatNote) {
    ctx.font      = f(21, false);
    ctx.fillStyle = C.grey;
    ctx.fillText(p.vatNote, PAD, PY);
    PY += 34;
  }

  // Linia 2/3
  const lineY2 = Math.max(PY + 30, 760);
  ctx.strokeStyle = 'rgba(140,180,220,0.20)';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, lineY2); ctx.lineTo(S - PAD, lineY2);
  ctx.stroke();

  // ── 3 BULLETS — DUŻE, PRZESTRONNE ─────────────────────────

  let bY = lineY2 + 52;
  for (const b of p.bullets) {
    // Okrąg zamiast kwadratu — bardziej graficznie
    ctx.beginPath();
    ctx.arc(PAD + 8, bY - 10, 9, 0, Math.PI * 2);
    ctx.fillStyle = p.accent;
    ctx.fill();
    // Biały punkcik środkowy
    ctx.beginPath();
    ctx.arc(PAD + 8, bY - 10, 4, 0, Math.PI * 2);
    ctx.fillStyle = C.white;
    ctx.fill();

    ctx.fillStyle = C.white;
    ctx.font      = f(26, false);
    ctx.fillText(b, PAD + 32, bY);
    bY += 60;
  }

  // ── CTA — PEŁNA SZEROKOŚĆ, MOCNY ──────────────────────────

  const ctaY = bY + 30;
  // Cień przycisku
  ctx.save();
  ctx.shadowColor   = `${p.accent}88`;
  ctx.shadowBlur    = 28;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = C.red;
  roundRect(ctx, PAD, ctaY, S - PAD * 2, 92, 8);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = C.white;
  ctx.font      = f(30, true);
  ctx.textAlign = 'center';
  const cta = p.ctaText ?? `KUP VOUCHER  ·  ${p.price} ZŁ  →`;
  ctx.fillText(cta, S / 2, ctaY + 58);
  ctx.textAlign = 'left';

  // Zapis
  const buf = canvas.toBuffer('image/png');
  writeFileSync(join(ADS, p.file), buf);
  console.log(`✓  ${p.file}  (${(buf.length / 1024).toFixed(0)} KB)`);
}

// ── Main ─────────────────────────────────────────────────────────
for (const p of PRODUCTS) {
  await drawProduct(p);
}
console.log('\nWszystkie grafiki → public/ads/');
