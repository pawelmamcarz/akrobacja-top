import { type Env, PACKAGES, type PackageId } from './types';

interface EmailParams {
  to: string;
  customerName: string;
  voucherCode: string;
  packageId: PackageId;
  pdfBytes: Uint8Array;
  siteUrl: string;
}

export async function sendVoucherEmail(env: Env, params: EmailParams): Promise<void> {
  const pkg = PACKAGES[params.packageId];
  const pdfBase64 = uint8ToBase64(params.pdfBytes);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'akrobacja.com <voucher@akrobacja.com>',
      to: [params.to],
      subject: `Twój voucher ${pkg.name} — ${params.voucherCode}`,
      html: buildHtml(params),
      attachments: [
        {
          filename: `voucher-${params.voucherCode}.pdf`,
          content: pdfBase64,
          content_type: 'application/pdf',
        },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend error ${res.status}: ${text}`);
  }
}

function buildHtml(p: EmailParams): string {
  const pkg = PACKAGES[p.packageId];
  return `
<!DOCTYPE html>
<html lang="pl">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f7fa">
  <div style="max-width:600px;margin:0 auto;background:#fff">
    <div style="background:#0A2F7C;padding:40px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:28px">akrobacja.com</h1>
      <p style="color:rgba(255,255,255,0.7);margin:8px 0 0;font-size:13px">Extra 300L · SP-EKS</p>
    </div>
    <div style="padding:40px">
      <h2 style="color:#0A2F7C;margin:0 0 8px;font-size:22px">Cześć ${p.customerName}!</h2>
      <p style="color:#6B7A90;line-height:1.6;margin:0 0 24px">
        Dziękujemy za zakup vouchera <strong>${pkg.name}</strong>. Twoja przygoda z akrobacją lotniczą właśnie się zaczyna!
      </p>

      <div style="background:#f0f3f7;padding:24px;margin-bottom:24px">
        <p style="color:#6B7A90;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 8px">Kod Vouchera</p>
        <p style="color:#0A2F7C;font-size:28px;font-weight:bold;margin:0;letter-spacing:0.05em">${p.voucherCode}</p>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <tr><td style="padding:8px 0;color:#6B7A90;font-size:13px;border-bottom:1px solid #eee">Pakiet</td><td style="padding:8px 0;color:#0A2F7C;font-size:13px;font-weight:600;border-bottom:1px solid #eee;text-align:right">${pkg.name}</td></tr>
        <tr><td style="padding:8px 0;color:#6B7A90;font-size:13px;border-bottom:1px solid #eee">Czas lotu</td><td style="padding:8px 0;color:#0A2F7C;font-size:13px;font-weight:600;border-bottom:1px solid #eee;text-align:right">${pkg.duration}</td></tr>
        <tr><td style="padding:8px 0;color:#6B7A90;font-size:13px">Lotnisko</td><td style="padding:8px 0;color:#0A2F7C;font-size:13px;font-weight:600;text-align:right">Radom-Piastów (EPRP)</td></tr>
      </table>

      <p style="color:#6B7A90;line-height:1.6;font-size:14px;margin:0 0 24px">
        Voucher PDF znajdziesz w załączniku tego maila. Możesz też pobrać go w dowolnym momencie:
      </p>

      <a href="${p.siteUrl}/api/voucher/${p.voucherCode}" style="display:inline-block;background:#E11E26;color:#fff;text-decoration:none;padding:14px 28px;font-weight:700;font-size:14px">
        Pobierz Voucher PDF
      </a>

      <hr style="border:none;border-top:1px solid #eee;margin:32px 0">
      <p style="color:#6B7A90;font-size:13px;line-height:1.6;margin:0">
        <strong>Jak umówić lot?</strong><br>
        Zadzwoń pod <a href="tel:+48535535221" style="color:#0A2F7C">+48 535 535 221</a> lub napisz na <a href="mailto:dto@akrobacja.com" style="color:#0A2F7C">dto@akrobacja.com</a> podając kod vouchera.
      </p>
    </div>
    <div style="background:#0A2F7C;padding:24px;text-align:center">
      <p style="color:rgba(255,255,255,0.5);font-size:11px;margin:0">
        akrobacja.com · Lotnisko Radom-Piastów (EPRP) · +48 535 535 221
      </p>
    </div>
  </div>
</body>
</html>`;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
