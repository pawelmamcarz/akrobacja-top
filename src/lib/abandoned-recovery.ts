// Shared between the abandoned-checkouts cron and the admin "Wyslij recovery"
// button on the orders panel. Both call sendRecoveryEmail; the cron also enforces
// the 1-48h window and the abandon_email_sent_at debounce - manual admin override
// re-sends regardless of when the previous one went out.

import { type Env, PACKAGES, type PackageId } from './types';
import { escapeHtml } from './email';

export const RECOVERY_DISCOUNT_CODE = 'WRACAM5';
export const RECOVERY_DISCOUNT_PCT = 5;
const FROM_EMAIL = 'akrobacja.com <info@akrobacja.com>';

export function buildRecoveryEmail(o: {
  customerName: string;
  packageId: PackageId;
  amountGrosze: number;
}): string {
  const pkg = PACKAGES[o.packageId];
  const pricePLN = o.amountGrosze / 100;
  const discountPLN = Math.round(pricePLN * RECOVERY_DISCOUNT_PCT) / 100;
  const finalPLN = Math.round((pricePLN - discountPLN) * 100) / 100;
  const firstName = (o.customerName || '').split(/\s+/)[0] || '';
  const greeting = firstName ? `Cześć ${escapeHtml(firstName)}!` : 'Cześć!';
  const recoveryUrl = `https://akrobacja.com/voucher-prezent?pkg=${encodeURIComponent(o.packageId)}&discount=${RECOVERY_DISCOUNT_CODE}&utm_source=email&utm_medium=recovery&utm_campaign=abandoned_cart`;

  return `<!DOCTYPE html>
<html lang="pl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Montserrat',Arial,sans-serif;background:#f5f7fa">
  <div style="max-width:600px;margin:0 auto;background:#ffffff">
    <div style="background:#0A2F7C;padding:40px;text-align:center">
      <img src="https://akrobacja.com/assets/logo-mark-white.png" alt="" width="60" height="49" style="display:block;margin:0 auto 14px;height:49px;width:auto;border:0" />
      <h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:800;letter-spacing:0.02em">akrobacja.com</h1>
      <p style="color:rgba(255,255,255,0.6);margin:8px 0 0;font-size:13px">Voucher czeka na Ciebie</p>
    </div>

    <div style="padding:40px">
      <h2 style="color:#0A2F7C;margin:0 0 16px;font-size:22px">${greeting}</h2>
      <p style="color:#333;line-height:1.7;margin:0 0 20px;font-size:15px">
        Widzimy, że zainteresował Cię voucher <strong>${escapeHtml(pkg.name)}</strong>, ale zakup nie doszedł do końca.
        Rozumiemy, że życie bywa szybkie, dlatego przygotowaliśmy dla Ciebie coś, co ułatwi decyzję:
      </p>

      <div style="background:#0A2F7C;padding:28px;text-align:center;margin:24px 0">
        <p style="color:rgba(255,255,255,0.7);font-size:11px;text-transform:uppercase;letter-spacing:0.15em;margin:0 0 8px">Twój kod rabatowy</p>
        <p style="color:#00E5FF;font-size:34px;font-weight:900;margin:0 0 8px;letter-spacing:0.08em;font-family:monospace">${RECOVERY_DISCOUNT_CODE}</p>
        <p style="color:#ffffff;font-size:16px;font-weight:700;margin:0 0 8px">−${RECOVERY_DISCOUNT_PCT}% na voucher</p>
        <p style="color:rgba(255,255,255,0.65);font-size:12px;margin:0">ważny 48 godzin</p>
      </div>

      <table style="width:100%;border-collapse:collapse;margin:0 0 24px">
        <tr><td style="padding:10px 0;color:#6B7A90;border-bottom:1px solid #eee;font-size:14px">Pakiet</td><td style="padding:10px 0;font-weight:600;border-bottom:1px solid #eee;text-align:right;font-size:14px">${escapeHtml(pkg.name)}</td></tr>
        <tr><td style="padding:10px 0;color:#6B7A90;border-bottom:1px solid #eee;font-size:14px">Cena</td><td style="padding:10px 0;border-bottom:1px solid #eee;text-align:right;font-size:14px">${pricePLN.toLocaleString('pl-PL')} zł</td></tr>
        <tr><td style="padding:10px 0;color:#6B7A90;border-bottom:1px solid #eee;font-size:14px">Rabat ${RECOVERY_DISCOUNT_PCT}%</td><td style="padding:10px 0;color:#27ae60;border-bottom:1px solid #eee;text-align:right;font-size:14px">−${discountPLN.toLocaleString('pl-PL')} zł</td></tr>
        <tr><td style="padding:10px 0;font-weight:800;color:#0A2F7C;font-size:15px">Do zapłaty</td><td style="padding:10px 0;font-weight:800;color:#0A2F7C;text-align:right;font-size:18px">${finalPLN.toLocaleString('pl-PL')} zł</td></tr>
      </table>

      <p style="text-align:center;margin:0 0 24px">
        <a href="${recoveryUrl}" style="display:inline-block;background:#E11E26;color:#ffffff;text-decoration:none;padding:16px 36px;font-weight:800;font-size:14px;border-radius:4px;letter-spacing:0.08em;text-transform:uppercase">Dokończ zakup ze zniżką →</a>
      </p>

      <p style="color:#6B7A90;line-height:1.6;margin:24px 0 0;font-size:13px;text-align:center">
        Voucher PDF natychmiast po opłaceniu &middot; Ważny 12 miesięcy
      </p>

      <hr style="border:none;border-top:1px solid #eee;margin:32px 0 24px">
      <p style="color:#6B7A90;font-size:13px;line-height:1.7;margin:0">
        Masz pytania lub wątpliwości? Odpisz na tego maila lub zadzwoń:
        <a href="tel:+48535535221" style="color:#0A2F7C;font-weight:600">+48 535 535 221</a>
      </p>
    </div>

    <div style="background:#0A2F7C;padding:24px;text-align:center">
      <p style="color:rgba(255,255,255,0.5);font-size:11px;margin:0;line-height:1.6">
        akrobacja.com &middot; Lotnisko Radom-Piast&oacute;w (EPRP) &middot; +48 535 535 221
      </p>
    </div>
  </div>
</body>
</html>`;
}

// Sends recovery via Resend; throws on failure with .permanent flag set on 4xx (except 403/429).
export async function sendRecoveryEmail(
  env: Env,
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      reply_to: 'info@akrobacja.com',
      tags: [{ name: 'type', value: 'abandoned' }],
      subject,
      html,
      headers: {
        'List-Unsubscribe': '<mailto:info@akrobacja.com?subject=unsubscribe>, <https://akrobacja.com/unsubscribe>',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const text = await res.text();
    const err = new Error(`Resend ${res.status}: ${text}`) as Error & { status: number; permanent: boolean };
    err.status = res.status;
    err.permanent = res.status === 422 || (res.status >= 400 && res.status < 500 && res.status !== 403 && res.status !== 429);
    throw err;
  }
}
