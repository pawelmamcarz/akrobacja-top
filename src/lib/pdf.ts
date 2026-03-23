import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { PACKAGES, type PackageId } from './types';

// Replace Polish diacritics with ASCII equivalents (StandardFonts don't support them)
function ascii(text: string): string {
  const map: Record<string, string> = {
    'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
    'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N', 'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z',
    '—': '-', '·': '-', '°': 'o', '−': '-',
  };
  return text.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ—·°−]/g, ch => map[ch] || ch);
}

export async function generateVoucherPdf(opts: {
  voucherCode: string;
  packageId: PackageId;
  customerName: string;
  videoAddon: boolean;
  expiresAt: string;
}): Promise<Uint8Array> {
  const pkg = PACKAGES[opts.packageId];
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4

  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);

  const navy = rgb(10 / 255, 47 / 255, 124 / 255);
  const red = rgb(225 / 255, 30 / 255, 38 / 255);
  const grey = rgb(107 / 255, 122 / 255, 144 / 255);
  const white = rgb(1, 1, 1);

  const W = 595.28;
  const H = 841.89;

  // Navy header background
  page.drawRectangle({ x: 0, y: H - 200, width: W, height: 200, color: navy });

  // Brand
  page.drawText('akrobacja.com', {
    x: 50, y: H - 60, size: 14, font: helveticaBold, color: white,
  });
  page.drawText('Extra 300L - SP-EKS', {
    x: 50, y: H - 80, size: 9, font: helvetica, color: rgb(0.6, 0.7, 0.85),
  });

  // Title
  page.drawText('VOUCHER', {
    x: 50, y: H - 130, size: 42, font: helveticaBold, color: white,
  });

  // Red accent line
  page.drawRectangle({ x: 50, y: H - 145, width: 60, height: 4, color: red });

  // Package name
  page.drawText(ascii(pkg.name.toUpperCase()), {
    x: 50, y: H - 175, size: 18, font: helveticaBold, color: white,
  });

  // Voucher code box
  const codeBoxY = H - 270;
  page.drawRectangle({
    x: 50, y: codeBoxY, width: W - 100, height: 50,
    color: rgb(0.94, 0.95, 0.97),
  });
  page.drawText('KOD VOUCHERA', {
    x: 60, y: codeBoxY + 32, size: 8, font: helveticaBold, color: grey,
  });
  page.drawText(opts.voucherCode, {
    x: 60, y: codeBoxY + 8, size: 20, font: helveticaBold, color: navy,
  });

  // Details section
  let y = codeBoxY - 40;

  const drawField = (label: string, value: string) => {
    page.drawText(ascii(label), { x: 50, y, size: 8, font: helveticaBold, color: grey });
    page.drawText(ascii(value), { x: 50, y: y - 16, size: 13, font: helvetica, color: navy });
    y -= 45;
  };

  drawField('PAKIET', `${pkg.name} - ${pkg.subtitle}`);
  drawField('CZAS LOTU', pkg.duration);
  drawField('DLA', opts.customerName);
  drawField('WAZNY DO', formatDate(opts.expiresAt));

  if (opts.videoAddon) {
    drawField('DODATEK', 'Video 360 z lotu (montaz 90 sek - MP4 w 48h)');
  }

  // Features
  y -= 10;
  page.drawText('CO ZAWIERA PAKIET:', {
    x: 50, y, size: 9, font: helveticaBold, color: navy,
  });
  y -= 20;

  for (const feat of pkg.features) {
    page.drawText(ascii(`-  ${feat}`), { x: 55, y, size: 10, font: helvetica, color: grey });
    y -= 18;
  }

  // Preparation section
  y -= 20;
  page.drawRectangle({ x: 50, y: y - 5, width: W - 100, height: 2, color: rgb(0.9, 0.92, 0.95) });
  y -= 25;
  page.drawText('JAK SIE PRZYGOTOWAC DO LOTU:', {
    x: 50, y, size: 9, font: helveticaBold, color: navy,
  });
  y -= 20;

  const tips = [
    'Lekki posilek 2h przed lotem - nie lataj na czczo ani po obfitym posilku',
    'Pij duzo wody - nawodnienie obniza ryzyko choroby lokomocyjnej',
    'Wygodne sportowe ubranie i buty (nie klapki) - spadochron i kask zapewniamy',
    'Zabierz okulary przeciwsloneczne i dowod tozsamosci',
    'Badz na lotnisku 30 min przed planowanym lotem (briefing)',
    'Przeciwwskazania: ciaza, epilepsja, ciezkie schorzenia serca, alkohol',
    'Max waga: 110 kg | Wiek: 13+ (niepelnoletni - zgoda rodzica)',
  ];

  for (const tip of tips) {
    if (y < 100) break;
    page.drawText(ascii(`-  ${tip}`), { x: 55, y, size: 8, font: helvetica, color: grey });
    y -= 14;
  }

  y -= 10;
  page.drawText(ascii('Wiecej: akrobacja.com/blog/10-rzeczy-przed-lotem-akrobacyjnym'), {
    x: 55, y, size: 7, font: helvetica, color: navy,
  });

  // Footer
  page.drawRectangle({ x: 0, y: 0, width: W, height: 80, color: navy });
  page.drawText(ascii('Lotnisko Radom-Piastow (EPRP)  -  +48 535 535 221  -  dto@akrobacja.com'), {
    x: 50, y: 45, size: 9, font: helvetica, color: rgb(0.6, 0.7, 0.85),
  });
  page.drawText(ascii('Voucher jest imienny i niezbywalny. Rezerwacja terminu: dto@akrobacja.com lub telefonicznie.'), {
    x: 50, y: 25, size: 7, font: helvetica, color: rgb(0.45, 0.55, 0.7),
  });

  return doc.save();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const months = ['stycznia','lutego','marca','kwietnia','maja','czerwca','lipca','sierpnia','wrzesnia','pazdziernika','listopada','grudnia'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}
