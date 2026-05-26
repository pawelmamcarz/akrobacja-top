// POST /api/admin/auth/password-reset { email }
// Generates a 1-hour, single-use token, stores it on the user row, mails the
// passenger a magic link /admin/reset?token=… that takes them to a "set new
// password" form. Always returns 200 (don't leak whether email exists).

import { type Env } from '../../../../src/lib/types';
import { randomToken } from '../../../../src/lib/admin-auth';
import { rateLimit, clientIp } from '../../../../src/lib/rate-limit';
import { escapeHtml } from '../../../../src/lib/email';

const RESET_TTL_SECONDS = 3600;

async function sendResetEmail(env: Env, to: string, name: string, link: string): Promise<void> {
  const firstName = (name || '').split(/\s+/)[0] || '';
  const greeting = firstName ? `Cześć ${escapeHtml(firstName)}!` : 'Cześć!';
  const html = `<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:'Montserrat',Arial,sans-serif;background:#f5f7fa">
  <div style="max-width:560px;margin:0 auto;background:#ffffff">
    <div style="background:#0A2F7C;padding:32px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:800">akrobacja.com Admin</h1>
    </div>
    <div style="padding:32px">
      <h2 style="color:#0A2F7C;margin:0 0 16px;font-size:20px">${greeting}</h2>
      <p style="color:#333;line-height:1.7;font-size:15px;margin:0 0 24px">
        Ktoś (mam nadzieję, że Ty) poprosił o reset hasła do panelu admina.
        Klik w przycisk poniżej zabierze Cię do strony, gdzie ustawisz nowe hasło. Link działa <strong>1 godzinę</strong>.
      </p>
      <p style="text-align:center;margin:32px 0">
        <a href="${link}" style="display:inline-block;background:#E11E26;color:#fff;text-decoration:none;padding:16px 36px;font-weight:800;font-size:14px;letter-spacing:0.06em;text-transform:uppercase">Ustaw nowe hasło →</a>
      </p>
      <p style="color:#6B7A90;font-size:13px;line-height:1.6;margin:24px 0 0">
        Jeśli to nie Ty prosiłeś - zignoruj tę wiadomość. Twoje obecne hasło nadal działa, dopóki ktoś nie kliknie linku powyżej.
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:32px 0 16px">
      <p style="color:#6B7A90;font-size:12px;line-height:1.6;margin:0;word-break:break-all">
        Link bezpośredni: ${escapeHtml(link)}
      </p>
    </div>
  </div>
</body></html>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from: 'akrobacja.com <system@akrobacja.com>',
      to: [to],
      reply_to: 'info@akrobacja.com',
      tags: [{ name: 'type', value: 'admin-password-reset' }],
      subject: 'Reset hasła do panelu admina',
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
  const ip = clientIp(ctx.request);
  const rl = await rateLimit(ctx.env, `admin-reset:${ip}`, 3, 600);
  if (!rl.ok) return Response.json({ ok: true });

  const body = await ctx.request.json().catch(() => null) as { email?: string } | null;
  const email = (body?.email || '').trim().toLowerCase();
  // Always 200 - generic response so the endpoint can't be used to probe accounts.
  if (!email) return Response.json({ ok: true });

  const user = await ctx.env.DB.prepare(
    `SELECT id, name FROM admin_users WHERE email = ?`,
  ).bind(email).first<{ id: number; name: string }>();
  if (!user) return Response.json({ ok: true });

  const token = randomToken();
  const expires = Math.floor(Date.now() / 1000) + RESET_TTL_SECONDS;
  await ctx.env.DB.prepare(
    `UPDATE admin_users SET password_reset_token = ?, password_reset_expires_at = ? WHERE id = ?`,
  ).bind(token, expires, user.id).run();

  const siteUrl = ctx.env.SITE_URL || 'https://akrobacja.com';
  const link = `${siteUrl}/admin/reset?token=${encodeURIComponent(token)}`;

  // Don't await - fire-and-forget so timing of response doesn't leak success.
  ctx.waitUntil(sendResetEmail(ctx.env, email, user.name, link).catch(err => {
    console.error('admin password reset email failed:', err);
  }));

  return Response.json({ ok: true });
};
