// /api/admin/flight-share
// POST   { voucher_code, expires_days?=180, notify?=true } → creates share token,
//        optionally sends email/SMS to passenger with the link
// POST   { token, action: 'notify' } → re-send notification
// POST   { token, action: 'extend', expires_days } → push expiry forward
// DELETE { token } → invalidate share (media files preserved)
//
// Token = 64-char URL-safe random (two UUIDs concatenated, dashes stripped).
// Default share lifetime = 180 days. Public surface at /lot/[token].
// Auth: Bearer ADMIN_PASSWORD.

import { type Env, PACKAGES, type PackageId } from '../../../src/lib/types';
import { checkAdminAuthAsync, getAdminUserAsync } from '../../../src/lib/admin-auth';
import { escapeHtml } from '../../../src/lib/email';
import { recordFailedDelivery } from '../../../src/lib/audit';

const FROM_EMAIL = 'akrobacja.com <info@akrobacja.com>';
const SITE_ORIGIN = 'https://akrobacja.com';
const DEFAULT_DAYS = 180;

interface OrderRow {
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  package_id: string;
}

function newToken(): string {
  const u = () => (crypto as { randomUUID?: () => string }).randomUUID?.()
    ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
  return (u() + u()).replace(/-/g, '');
}

async function sendNotifyEmail(env: Env, to: string, name: string, packageId: string, link: string): Promise<void> {
  const pkg = PACKAGES[packageId as PackageId];
  const pkgName = pkg?.name || 'lotu';
  const firstName = (name || '').split(/\s+/)[0] || '';
  const greeting = firstName ? `Cześć ${escapeHtml(firstName)}!` : 'Cześć!';
  const html = `<!DOCTYPE html>
<html lang="pl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Montserrat',Arial,sans-serif;background:#f5f7fa">
  <div style="max-width:600px;margin:0 auto;background:#ffffff">
    <div style="background:#0A2F7C;padding:40px;text-align:center">
      <img src="https://akrobacja.com/assets/logo-mark-white.png" alt="" width="60" height="49" style="display:block;margin:0 auto 14px;height:49px;width:auto;border:0" />
      <h1 style="color:#fff;margin:0;font-size:26px;font-weight:800;letter-spacing:0.02em">akrobacja.com</h1>
      <p style="color:rgba(255,255,255,0.6);margin:8px 0 0;font-size:13px">Twoje zdjęcia i filmy z lotu</p>
    </div>
    <div style="padding:40px">
      <h2 style="color:#0A2F7C;margin:0 0 16px;font-size:22px">${greeting}</h2>
      <p style="color:#333;line-height:1.7;margin:0 0 24px;font-size:15px">
        Mamy gotowe zdjęcia i filmy z Twojego lotu <strong>${escapeHtml(pkgName)}</strong>.
        Wszystko czeka pod jednym linkiem - kliknij, pobieraj, dziel się ze znajomymi.
      </p>
      <p style="text-align:center;margin:32px 0">
        <a href="${link}" style="display:inline-block;background:#E11E26;color:#fff;text-decoration:none;padding:18px 40px;font-weight:800;font-size:14px;letter-spacing:0.08em;text-transform:uppercase">Zobacz materiał z lotu →</a>
      </p>
      <p style="color:#6B7A90;font-size:13px;line-height:1.7;margin:24px 0 0">
        Link działa <strong>180 dni</strong>. Po tym czasie pliki znikają z serwera - jeśli chcesz dłuższy dostęp, pobierz je teraz.
        Materiał możesz udostępniać dalej tym samym linkiem.
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:32px 0 24px">
      <p style="color:#6B7A90;font-size:13px;line-height:1.7;margin:0">
        Pytania? Odpisz na ten mail lub zadzwoń <a href="tel:+48535535221" style="color:#0A2F7C;font-weight:600">+48 535 535 221</a>.
      </p>
    </div>
    <div style="background:#0A2F7C;padding:24px;text-align:center">
      <p style="color:rgba(255,255,255,0.5);font-size:11px;margin:0">
        akrobacja.com &middot; Lotnisko Radom-Piast&oacute;w (EPRP)
      </p>
    </div>
  </div>
</body></html>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      reply_to: 'info@akrobacja.com',
      tags: [{ name: 'type', value: 'flight-media' }],
      subject: `${firstName ? firstName + ', ' : ''}zdjęcia i filmy z Twojego lotu są gotowe`,
      html,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend ${res.status}: ${text}`);
  }
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getAdminUserAsync(ctx.request, ctx.env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await ctx.request.json().catch(() => null) as {
    voucher_code?: string; token?: string; action?: string;
    expires_days?: number; notify?: boolean;
  } | null;

  // Existing-share actions: notify | extend | (delete handled separately)
  if (body?.token) {
    const share = await ctx.env.DB.prepare(
      `SELECT token, voucher_code, expires_at FROM flight_shares WHERE token = ?`,
    ).bind(body.token).first<{ token: string; voucher_code: string; expires_at: number }>();
    if (!share) return Response.json({ error: 'Share nie istnieje' }, { status: 404 });

    if (body.action === 'extend') {
      const days = body.expires_days && body.expires_days > 0 ? body.expires_days : DEFAULT_DAYS;
      const newExpires = Math.floor(Date.now() / 1000) + days * 86400;
      await ctx.env.DB.prepare(`UPDATE flight_shares SET expires_at = ? WHERE token = ?`)
        .bind(newExpires, body.token).run();
      return Response.json({ ok: true, expires_at: newExpires });
    }

    if (body.action === 'notify') {
      const order = await ctx.env.DB.prepare(
        `SELECT customer_name, customer_email, customer_phone, package_id FROM orders WHERE voucher_code = ?`,
      ).bind(share.voucher_code).first<OrderRow>();
      if (!order?.customer_email) return Response.json({ error: 'Brak emaila klienta' }, { status: 400 });
      const link = `${SITE_ORIGIN}/lot?t=${body.token}`;
      try {
        await sendNotifyEmail(ctx.env, order.customer_email, order.customer_name, order.package_id, link);
        await ctx.env.DB.prepare(`UPDATE flight_shares SET notify_sent_at = ? WHERE token = ?`)
          .bind(Math.floor(Date.now() / 1000), body.token).run();
        return Response.json({ ok: true, sent_to: order.customer_email });
      } catch (err) {
        await recordFailedDelivery(ctx.env, { channel: 'flight_media_email', refId: body.token, recipient: order.customer_email, error: err });
        return Response.json({ error: err instanceof Error ? err.message : 'Mail failed' }, { status: 500 });
      }
    }

    return Response.json({ error: 'Nieznana action' }, { status: 400 });
  }

  // New share
  if (!body?.voucher_code) return Response.json({ error: 'voucher_code required' }, { status: 400 });
  const order = await ctx.env.DB.prepare(
    `SELECT customer_name, customer_email, customer_phone, package_id FROM orders WHERE voucher_code = ?`,
  ).bind(body.voucher_code).first<OrderRow>();
  if (!order) return Response.json({ error: 'Voucher nie istnieje' }, { status: 404 });

  const hasMedia = await ctx.env.DB.prepare(
    `SELECT COUNT(*) as c FROM flight_media WHERE voucher_code = ?`,
  ).bind(body.voucher_code).first<{ c: number }>();
  if (!hasMedia?.c) return Response.json({ error: 'Brak mediów dla tego voucha - wgraj zdjęcia/filmy najpierw' }, { status: 400 });

  const days = body.expires_days && body.expires_days > 0 ? body.expires_days : DEFAULT_DAYS;
  const token = newToken();
  const now = Math.floor(Date.now() / 1000);
  const expires_at = now + days * 86400;

  await ctx.env.DB.prepare(
    `INSERT INTO flight_shares (token, voucher_code, created_at, expires_at, created_by)
     VALUES (?, ?, ?, ?, ?)`,
  ).bind(token, body.voucher_code, now, expires_at, user).run();

  const link = `${SITE_ORIGIN}/lot?t=${token}`;
  let notify_status: string | null = null;
  if (body.notify !== false && order.customer_email) {
    try {
      await sendNotifyEmail(ctx.env, order.customer_email, order.customer_name, order.package_id, link);
      await ctx.env.DB.prepare(`UPDATE flight_shares SET notify_sent_at = ? WHERE token = ?`).bind(now, token).run();
      notify_status = `sent to ${order.customer_email}`;
    } catch (err) {
      await recordFailedDelivery(ctx.env, { channel: 'flight_media_email', refId: token, recipient: order.customer_email, error: err });
      notify_status = `mail_failed: ${err instanceof Error ? err.message : 'unknown'}`;
    }
  }

  return Response.json({ ok: true, token, link, expires_at, notify_status });
};

export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  if (!(await checkAdminAuthAsync(ctx.request, ctx.env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await ctx.request.json().catch(() => null) as { token?: string } | null;
  if (!body?.token) return Response.json({ error: 'token required' }, { status: 400 });
  await ctx.env.DB.prepare(`DELETE FROM flight_shares WHERE token = ?`).bind(body.token).run();
  return Response.json({ ok: true });
};
