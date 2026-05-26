// POST /api/admin/auth/password-reset/confirm { token, new_password }
// Validates the magic-link token, sets the new password, invalidates all of
// that user's existing sessions (force re-login everywhere) and clears the token.

import { type Env } from '../../../../src/lib/types';
import { hashPassword } from '../../../../src/lib/admin-auth';
import { rateLimit, clientIp } from '../../../../src/lib/rate-limit';

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const ip = clientIp(ctx.request);
  const rl = await rateLimit(ctx.env, `admin-reset-confirm:${ip}`, 10, 600);
  if (!rl.ok) return Response.json({ error: 'Zbyt wiele prób' }, { status: 429 });

  const body = await ctx.request.json().catch(() => null) as { token?: string; new_password?: string } | null;
  const token = (body?.token || '').trim();
  const newPassword = body?.new_password || '';
  if (!token || !newPassword) return Response.json({ error: 'token i new_password wymagane' }, { status: 400 });
  if (newPassword.length < 12) return Response.json({ error: 'Hasło musi mieć min. 12 znaków' }, { status: 400 });

  const now = Math.floor(Date.now() / 1000);
  const user = await ctx.env.DB.prepare(
    `SELECT id, email FROM admin_users
     WHERE password_reset_token = ? AND password_reset_expires_at > ?`,
  ).bind(token, now).first<{ id: number; email: string }>();
  if (!user) return Response.json({ error: 'Link wygasł lub jest nieprawidłowy' }, { status: 410 });

  const { hash, salt } = await hashPassword(newPassword);
  await ctx.env.DB.prepare(`
    UPDATE admin_users
    SET password_hash = ?, password_salt = ?, password_changed_at = ?,
        password_reset_token = NULL, password_reset_expires_at = NULL
    WHERE id = ?
  `).bind(hash, salt, now, user.id).run();

  // Invalidate every existing session for this user - force re-login on all devices.
  await ctx.env.DB.prepare(`DELETE FROM admin_sessions WHERE user_id = ?`).bind(user.id).run();

  return Response.json({ ok: true, email: user.email });
};
