import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { PACKAGES, type PackageId } from './types';
import { INTER_REGULAR_B64, INTER_BOLD_B64, b64ToUint8 } from './fonts/inter';

// Inter pokrywa Latin (PL/CZ/HU), Cyrylice, Greke. Cokolwiek poza tym -> '?'
// zeby embedFont nie wywalil sie na emoji / CJK w imieniu uczestnika.
const SAFE_MAP: Record<string, string> = {
  '-': '-', '–': '–', '·': '·', '°': '°', '−': '-', '„': '„', '”': '”', '’': "'", '‘': "'",
};
function sanitizeUserText(text: string): string {
  return text.replace(/[^ -ɏͰ-ϿЀ-ӿḀ-ỿ -⁯₠-⃏]/g, ch => SAFE_MAP[ch] ?? '?');
}

const MIES_PL = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MIES_PL[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export async function generateDiplomaPdf(opts: {
  participantName: string;
  packageId: PackageId;
  flightDate: string;      // ISO - data lotu (redeemed_at)
  voucherCode: string;
  pilotName?: string;      // domyslnie Maciej Kulaszewski (mistrz za sterami = USP)
  pilotTitle?: string;
}): Promise<Uint8Array> {
  const pkg = PACKAGES[opts.packageId];
  const pilotName = opts.pilotName?.trim() || 'Maciej Kulaszewski';
  const pilotTitle = opts.pilotTitle?.trim() || 'Mistrz Świata Akrobacji 2022';

  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const W = 841.89;
  const H = 595.28; // A4 poziomy
  const page = doc.addPage([W, H]);

  const fontBold = await doc.embedFont(b64ToUint8(INTER_BOLD_B64));
  const font = await doc.embedFont(b64ToUint8(INTER_REGULAR_B64));

  const navy = rgb(10 / 255, 47 / 255, 124 / 255);
  const red = rgb(225 / 255, 30 / 255, 38 / 255);
  const grey = rgb(107 / 255, 122 / 255, 144 / 255);

  const center = (text: string, y: number, size: number, f = font, color = navy) => {
    const t = sanitizeUserText(text);
    const x = (W - f.widthOfTextAtSize(t, size)) / 2;
    page.drawText(t, { x, y, size, font: f, color });
  };

  // Ramka ozdobna (podwojna)
  page.drawRectangle({ x: 24, y: 24, width: W - 48, height: H - 48, borderColor: navy, borderWidth: 2 });
  page.drawRectangle({ x: 31, y: 31, width: W - 62, height: H - 62, borderColor: rgb(0.78, 0.83, 0.9), borderWidth: 1 });

  // Naglowek marki
  center('akrobacja.com', H - 78, 18, fontBold, navy);
  center('Extra 300L · SP-EKS · Lotnisko Radom-Piastów (EPRP)', H - 98, 10, font, grey);

  // Czerwony akcent
  page.drawRectangle({ x: W / 2 - 30, y: H - 116, width: 60, height: 3, color: red });

  // Tytul
  center('DYPLOM UCZESTNIKA', H - 170, 40, fontBold, navy);

  // Potwierdzenie
  center('Niniejszym potwierdzamy, że', H - 215, 13, font, grey);

  // Imie uczestnika
  center(opts.participantName, H - 268, 34, fontBold, navy);

  // Tresc
  center('odbył(a) lot akrobacyjny samolotem Extra 300L SP-EKS', H - 318, 14, font, navy);
  center(`w pakiecie ${pkg.name}  ·  ${pkg.duration}`, H - 344, 14, font, navy);
  center(`dnia ${formatDate(opts.flightDate)}`, H - 370, 14, font, navy);

  // Linia podpisu pilota-mistrza (prawa strona)
  const sigW = 240;
  const sigX = W - 80 - sigW;
  const sigY = 110;
  page.drawRectangle({ x: sigX, y: sigY, width: sigW, height: 1, color: navy });
  page.drawText(pilotName, { x: sigX + (sigW - fontBold.widthOfTextAtSize(pilotName, 13)) / 2, y: sigY - 18, size: 13, font: fontBold, color: navy });
  const titleX = sigX + (sigW - font.widthOfTextAtSize(pilotTitle, 9)) / 2;
  page.drawText(pilotTitle, { x: titleX, y: sigY - 32, size: 9, font, color: grey });
  page.drawText('Pilot prowadzący', { x: sigX + (sigW - font.widthOfTextAtSize('Pilot prowadzący', 8)) / 2, y: sigY - 44, size: 8, font, color: grey });

  // Miejsce i kod (lewa strona)
  page.drawText('Radom-Piastów', { x: 80, y: sigY - 18, size: 11, font: fontBold, color: navy });
  page.drawText('Miejsce lotu', { x: 80, y: sigY - 32, size: 8, font, color: grey });

  // Kod vouchera (stopka)
  center(`Voucher: ${opts.voucherCode}  ·  akrobacja.com`, 50, 8, font, grey);

  return doc.save();
}
