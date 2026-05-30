import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { PACKAGES, type PackageId } from './types';
import { INTER_REGULAR_B64, INTER_BOLD_B64, b64ToUint8 } from './fonts/inter';
import { LOGO_MARK_WHITE_B64 } from './logo-pdf';

// Safety net for dedication text that may contain emoji / non-Latin codepoints
// outside Inter's coverage. Inter covers Latin (PL/CZ/HU/etc.), Cyrillic, Greek,
// Vietnamese - anything past that gets replaced so embedFont doesn't throw mid-flow.
const SAFE_MAP: Record<string, string> = {
  '-': '-', '–': '–', '·': '·', '°': '°', '−': '-', '„': '„', '”': '”', '’': "'", '‘': "'",
};
function sanitizeUserText(text: string): string {
  // Inter covers U+0000-024F (Latin) + U+0370-03FF (Greek) + U+0400-04FF (Cyrillic) + common punctuation.
  // Replace anything else with '?' rather than crash the PDF.
  return text.replace(
    /[^ -ɏͰ-ϿЀ-ӿḀ-ỿ -⁯₠-⃏]/g,
    ch => SAFE_MAP[ch] ?? '?',
  );
}

export async function generateVoucherPdf(opts: {
  voucherCode: string;
  packageId: PackageId;
  customerName: string;
  videoAddon: boolean;
  expiresAt: string;
  recipientName?: string | null;
  dedication?: string | null;
}): Promise<Uint8Array> {
  const pkg = PACKAGES[opts.packageId];
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const page = doc.addPage([595.28, 841.89]); // A4

  const fontBold = await doc.embedFont(b64ToUint8(INTER_BOLD_B64));
  const font = await doc.embedFont(b64ToUint8(INTER_REGULAR_B64));

  const navy = rgb(10 / 255, 47 / 255, 124 / 255);
  const red = rgb(225 / 255, 30 / 255, 38 / 255);
  const grey = rgb(107 / 255, 122 / 255, 144 / 255);
  const white = rgb(1, 1, 1);

  const W = 595.28;
  const H = 841.89;

  // Navy header background
  page.drawRectangle({ x: 0, y: H - 200, width: W, height: 200, color: navy });

  // Logo mark (white) - prawy górny róg nagłówka
  const logoMark = await doc.embedPng(b64ToUint8(LOGO_MARK_WHITE_B64));
  const logoH = 64;
  const logoW = logoH * (logoMark.width / logoMark.height);
  page.drawImage(logoMark, {
    x: W - 45 - logoW, y: H - 42 - logoH, width: logoW, height: logoH,
  });

  // Brand
  page.drawText('akrobacja.com', {
    x: 50, y: H - 60, size: 14, font: fontBold, color: white,
  });
  page.drawText('Extra 300L · SP-EKS', {
    x: 50, y: H - 80, size: 9, font, color: rgb(0.6, 0.7, 0.85),
  });

  // Title
  page.drawText('VOUCHER', {
    x: 50, y: H - 130, size: 42, font: fontBold, color: white,
  });

  // Red accent line
  page.drawRectangle({ x: 50, y: H - 145, width: 60, height: 4, color: red });

  // Package name
  page.drawText(pkg.name.toUpperCase(), {
    x: 50, y: H - 175, size: 18, font: fontBold, color: white,
  });

  // Voucher code box
  const codeBoxY = H - 270;
  page.drawRectangle({
    x: 50, y: codeBoxY, width: W - 100, height: 50,
    color: rgb(0.94, 0.95, 0.97),
  });
  page.drawText('KOD VOUCHERA', {
    x: 60, y: codeBoxY + 32, size: 8, font: fontBold, color: grey,
  });
  page.drawText(opts.voucherCode, {
    x: 60, y: codeBoxY + 8, size: 20, font: fontBold, color: navy,
  });

  // Details section
  let y = codeBoxY - 40;

  // Dedykacja (opcjonalna) - ramka pod kodem vouchera.
  if (opts.dedication && opts.dedication.trim().length > 0) {
    const dedText = sanitizeUserText(opts.dedication.trim());
    // Wrap tekstu do max ~60 znaków na linię, max 4 linie (limit 200 zn. na backendzie).
    const words = dedText.split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const w of words) {
      const next = current ? `${current} ${w}` : w;
      if (next.length > 60 && current) {
        lines.push(current);
        current = w;
      } else {
        current = next;
      }
      if (lines.length >= 4) break;
    }
    if (current && lines.length < 4) lines.push(current);

    const padX = 24;
    const padY = 18;
    const lineH = 16;
    const titleH = 18;
    const boxH = padY * 2 + titleH + lines.length * lineH;
    const boxY = y - boxH + 10;

    page.drawRectangle({
      x: 50, y: boxY, width: W - 100, height: boxH,
      color: rgb(0.985, 0.97, 0.97),
    });
    page.drawRectangle({
      x: 50, y: boxY, width: 3, height: boxH, color: red,
    });

    page.drawText('DEDYKACJA', {
      x: 50 + padX, y: boxY + boxH - padY - 8, size: 8, font: fontBold, color: red,
    });

    const dedFontSize = 12;
    let lineY = boxY + boxH - padY - titleH - 4;
    for (const line of lines) {
      const textWidth = font.widthOfTextAtSize(line, dedFontSize);
      const textX = 50 + (W - 100) / 2 - textWidth / 2;
      page.drawText(line, {
        x: textX, y: lineY, size: dedFontSize, font, color: navy,
      });
      lineY -= lineH;
    }

    y = boxY - 30;
  }

  const drawField = (label: string, value: string) => {
    page.drawText(label, { x: 50, y, size: 8, font: fontBold, color: grey });
    page.drawText(sanitizeUserText(value), { x: 50, y: y - 16, size: 13, font, color: navy });
    y -= 45;
  };

  drawField('PAKIET', `${pkg.name} - ${pkg.subtitle}`);
  drawField('CZAS LOTU', pkg.duration);
  // "DLA" - preferuj recipient_name (prezent), fallback na customer_name.
  drawField('DLA', opts.recipientName?.trim() || opts.customerName);
  drawField('WAŻNY DO', formatDate(opts.expiresAt));

  if (opts.videoAddon) {
    drawField('DODATEK', 'Video 360° z lotu (montaż 90 sek - MP4 w 48h)');
  }

  // Features
  y -= 10;
  page.drawText('CO ZAWIERA PAKIET:', {
    x: 50, y, size: 9, font: fontBold, color: navy,
  });
  y -= 20;

  for (const feat of pkg.features) {
    page.drawText(`•  ${feat}`, { x: 55, y, size: 10, font, color: grey });
    y -= 18;
  }

  // Preparation section
  y -= 20;
  page.drawRectangle({ x: 50, y: y - 5, width: W - 100, height: 2, color: rgb(0.9, 0.92, 0.95) });
  y -= 25;
  page.drawText('JAK SIĘ PRZYGOTOWAĆ DO LOTU:', {
    x: 50, y, size: 9, font: fontBold, color: navy,
  });
  y -= 20;

  const tips = [
    'Lekki posiłek 2h przed lotem - nie lataj na czczo ani po obfitym posiłku',
    'Pij dużo wody - nawodnienie obniża ryzyko choroby lokomocyjnej',
    'Wygodne sportowe ubranie i buty (nie klapki) - spadochron i kask zapewniamy',
    'Zabierz okulary przeciwsłoneczne i dowód tożsamości',
    'Bądź na lotnisku 30 min przed planowanym lotem (briefing)',
    'Przeciwwskazania: ciąża, epilepsja, ciężkie schorzenia serca, alkohol',
    'Max waga: 110 kg | Wiek: 13+ (niepełnoletni - zgoda rodzica)',
  ];

  for (const tip of tips) {
    if (y < 100) break;
    page.drawText(`•  ${tip}`, { x: 55, y, size: 8, font, color: grey });
    y -= 14;
  }

  y -= 10;
  page.drawText('Więcej: akrobacja.com/blog/10-rzeczy-przed-lotem-akrobacyjnym', {
    x: 55, y, size: 7, font, color: navy,
  });

  // Footer
  page.drawRectangle({ x: 0, y: 0, width: W, height: 80, color: navy });
  page.drawText('Lotnisko Radom-Piastów (EPRP)  ·  +48 739 158 131  ·  maciej@akrobacja.com', {
    x: 50, y: 45, size: 9, font, color: rgb(0.6, 0.7, 0.85),
  });
  page.drawText('Voucher jest imienny i niezbywalny. Rezerwacja terminu: maciej@akrobacja.com lub telefonicznie.', {
    x: 50, y: 25, size: 7, font, color: rgb(0.45, 0.55, 0.7),
  });

  return doc.save();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = ['stycznia','lutego','marca','kwietnia','maja','czerwca','lipca','sierpnia','września','października','listopada','grudnia'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
