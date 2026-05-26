/**
 * Generates product image for FCL.800 Aerobatics training (1200×1200 PNG).
 * Output: public/ads/product-fcl800-akrobacja.png
 */
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = join(__dir, '..');
const ADS   = join(ROOT, 'public', 'ads');

const C = {
  navyDeep : '#0A1428',
  navy     : '#1B4DB5',
  red      : '#C41E3A',
  white    : '#FFFFFF',
  chrome   : '#7A8FA6',
  gold     : '#C8960C',
  goldLt   : '#F0C040',
};

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

const SIZE = 1200;
const canvas = createCanvas(SIZE, SIZE);
const ctx    = canvas.getContext('2d');

// ── Background ──────────────────────────────────────────────────
const bgGrad = ctx.createLinearGradient(0, 0, SIZE, SIZE);
bgGrad.addColorStop(0,   '#04101C');
bgGrad.addColorStop(0.5, '#0A1428');
bgGrad.addColorStop(1,   '#0F1E38');
ctx.fillStyle = bgGrad;
ctx.fillRect(0, 0, SIZE, SIZE);

try {
  const bgPath = join(ROOT, 'public', 'speks-city.jpg');
  if (existsSync(bgPath)) {
    const img = await loadImage(bgPath);
    ctx.globalAlpha = 0.22;
    ctx.drawImage(img, 0, 0, SIZE, SIZE);
    ctx.globalAlpha = 1;
  }
} catch (_) {}

// Gold diagonal accent (premium / certification feel)
ctx.save();
ctx.strokeStyle = C.gold;
ctx.globalAlpha = 0.28;
ctx.lineWidth = 260;
ctx.beginPath();
ctx.moveTo(-80, SIZE + 80);
ctx.lineTo(SIZE * 0.55, -80);
ctx.stroke();
ctx.globalAlpha = 1;
ctx.restore();

// ── Logo ─────────────────────────────────────────────────────────
try {
  const logo = await loadImage(join(ROOT, 'public', 'akrobacja-logo-light.png'));
  ctx.drawImage(logo, 36, 30, 160, 68);
} catch (_) {
  ctx.fillStyle = C.white;
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('akrobacja.com', 36, 72);
}

// ── Top-right badge ───────────────────────────────────────────────
ctx.fillStyle = C.red;
roundRect(ctx, SIZE - 296, 30, 264, 42, 4);
ctx.fill();
ctx.fillStyle = C.white;
ctx.font      = 'bold 14px sans-serif';
ctx.textAlign = 'center';
ctx.fillText('★  MISTRZ ŚWIATA AKROBACJI', SIZE - 164, 57);
ctx.textAlign = 'left';

// ── White card ───────────────────────────────────────────────────
const CX = 52, CY = 130, CW = SIZE - 104, CH = SIZE - 220;
ctx.shadowColor   = 'rgba(0,0,0,0.5)';
ctx.shadowBlur    = 32;
ctx.shadowOffsetY = 8;
roundRect(ctx, CX, CY, CW, CH, 10);
ctx.fillStyle = C.white;
ctx.fill();
ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;

const PX = CX + 44;
let   PY = CY + 44;

// Tag
ctx.fillStyle = C.gold;
ctx.font      = 'bold 16px sans-serif';
ctx.fillText('KURS PILOTAŻU  ·  UPRAWNIENIE LOTNICZE', PX, PY);

PY += 14;
ctx.strokeStyle = '#E0E6ED';
ctx.lineWidth   = 1;
ctx.beginPath();
ctx.moveTo(PX, PY); ctx.lineTo(CX + CW - 44, PY);
ctx.stroke();
PY += 40;

// Name
ctx.fillStyle = C.navyDeep;
ctx.font      = 'bold 50px sans-serif';
ctx.fillText('SZKOLENIE', PX, PY);
PY += 60;
ctx.font = 'bold 50px sans-serif';
ctx.fillText('FCL.800', PX, PY);
PY += 14;

// Subtitle
ctx.fillStyle = C.chrome;
ctx.font      = '400 20px sans-serif';
ctx.fillText('Uprawnienie Akrobacja - EASA DTO', PX, PY);
PY += 36;

// Gold certification banner
ctx.fillStyle = C.gold;
roundRect(ctx, PX, PY, CW - 88, 48, 4);
ctx.fill();
ctx.fillStyle = C.navyDeep;
ctx.font      = 'bold 17px sans-serif';
ctx.textAlign = 'center';
ctx.fillText('CERTYFIKAT EASA  ·  UPRAWNIENIE AKROBACJI SAMOLOTOWEJ', PX + (CW - 88) / 2, PY + 31);
ctx.textAlign = 'left';
PY += 68;

// Price block. Szkolenia lotnicze są zwolnione z VAT (art. 43 ust. 1 pkt 29 lit. a
// ustawy o VAT) - pokazujemy więc jedną cenę i CTA o dofinansowaniu.
ctx.fillStyle = C.navyDeep;
ctx.font      = 'bold 44px sans-serif';
ctx.fillText('PLN', PX, PY + 60);
ctx.font = 'bold 106px sans-serif';
ctx.fillText('20 900', PX + 96, PY + 72);
ctx.fillStyle = C.chrome;
ctx.font      = '400 18px sans-serif';
ctx.fillText('zwolnione z VAT', PX + 96, PY + 98);
// Funding upsell
ctx.font      = '400 17px sans-serif';
ctx.fillText('Dofinansowanie BUR / KFS / PUP - do 90%', PX, PY + 118);
PY += 138;

// Bullets
const bullets = [
  'Min. 5 h lotu na samolocie akrobacyjnym (FCL.800)',
  'Teoria: przepisy, ograniczenia, bezpieczeństwo',
  'Samolot Extra 300L SP-EKS',
  'Egzamin praktyczny EASA',
  'Instruktor FI(A) - Mistrz Świata Akrobacji',
  'Dofinansowanie BUR / KFS / PUP',
];
for (const b of bullets) {
  ctx.fillStyle = C.red;
  ctx.fillRect(PX, PY - 12, 9, 9);
  ctx.fillStyle = C.navyDeep;
  ctx.font      = '400 19px sans-serif';
  ctx.fillText(b, PX + 22, PY);
  PY += 32;
}
PY += 10;

// CTA
const btnW = CW - 88;
ctx.fillStyle = C.red;
roundRect(ctx, PX, PY, btnW, 64, 4);
ctx.fill();
ctx.fillStyle = C.white;
ctx.font      = 'bold 21px sans-serif';
ctx.textAlign = 'center';
ctx.fillText('ZAPISZ SIĘ NA SZKOLENIE  →', PX + btnW / 2, PY + 40);
ctx.textAlign = 'left';
PY += 78;

// Small print
ctx.fillStyle = C.chrome;
ctx.font      = '400 14px sans-serif';
ctx.fillText('Lotnisko Radom-Piastów EPRP  ·  Certyfikat EASA  ·  akrobacja.com', PX, PY);
ctx.fillText('20 900 PLN - usługa szkoleniowa zwolniona z VAT', PX, PY + 20);

// ── Bottom stats bar ─────────────────────────────────────────────
const barY = SIZE - 74;
ctx.fillStyle = 'rgba(4,10,20,0.95)';
ctx.fillRect(0, barY, SIZE, 74);

const stats = [
  ['4000h+', 'NALOT ŁĄCZNY'],
  ['FCL.800', 'UPRAWNIENIE EASA'],
  ['3000h+', 'AKROBACJA EXTRA'],
];
const colW = SIZE / 3;
stats.forEach(([main, sub], i) => {
  const cx = colW * i + colW / 2;
  ctx.textAlign = 'center';
  ctx.fillStyle = i === 1 ? C.goldLt : C.white;
  ctx.font      = 'bold 26px sans-serif';
  ctx.fillText(main, cx, barY + 32);
  ctx.fillStyle = C.chrome;
  ctx.font      = 'bold 11px sans-serif';
  ctx.fillText(sub, cx, barY + 52);
});
ctx.textAlign = 'left';

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

// ── Save ─────────────────────────────────────────────────────────
const outPath = join(ADS, 'product-fcl800-akrobacja.png');
const buf     = canvas.toBuffer('image/png');
writeFileSync(outPath, buf);
console.log(`✓ product-fcl800-akrobacja.png  (${(buf.length / 1024).toFixed(0)} KB)`);
