// POST /api/admin/auth/login { email, password } → { token, expires_at, user: {email, name} }
// Issues a 30-day session token. Same shape as the legacy Bearer ADMIN_PASSWORD,
// so the existing admin.html `localStorage.setItem('admin_token', ...)` just
// stores the session token instead of the raw password.

import { type Env } from '../../../../src/lib/types';
import { verifyPassword, randomToken, type AdminUserRow } from '../../../../src/lib/admin-auth';
import { rateLimit, clientIp } from '../../../../src/lib/rate-limit';

const SESSION_DAYS = 30;

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const ip = clientIp(ctx.request);
  const rl = await rateLimit(ctx.env, `admin-login:${ip}`, 8, 300);
  if (!rl.ok) return Response.json({ error: 'Zbyt wiele prób, spróbuj za 5 minut' }, { status: 429 });

  const body = await ctx.request.json().catch(() => null) as { email?: string; password?: string } | null;
  const email = (body?.email || '').trim().toLowerCase();
  const password = body?.password || '';
  if (!email || !password) return Response.json({ error: 'Email i hasło wymagane' }, { status: 400 });

  const user = await ctx.env.DB.prepare(
    `SELECT id, email, name, password_hash, password_salt, role, last_login_at
     FROM admin_users WHERE email = ?`,
  ).bind(email).first<AdminUserRow>();
  // Generic error message - don't leak whether the email exists.
  if (!user) return Response.json({ error: 'Nieprawidłowy email lub hasło' }, { status: 401 });

  const ok = await verifyPassword(password, user.password_salt, user.password_hash);
  if (!ok) return Response.json({ error: 'Nieprawidłowy email lub hasło' }, { status: 401 });

  const token = randomToken();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + SESSION_DAYS * 86400;
  const ua = ctx.request.headers.get('user-agent')?.slice(0, 240) || '';

  await ctx.env.DB.prepare(
    `INSERT INTO admin_sessions (token, user_id, created_at, expires_at, ip, user_agent, last_used_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(token, user.id, now, expiresAt, ip, ua, now).run();

  await ctx.env.DB.prepare(`UPDATE admin_users SET last_login_at = ? WHERE id = ?`)
    .bind(now, user.id).run();

  return Response.json({
    token,
    expires_at: expiresAt,
    user: { email: user.email, name: user.name, role: user.role },
  });
};
