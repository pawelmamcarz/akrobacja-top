// POST /api/admin/auth/seed { email, name, password }
// One-shot helper to create the first admin_users row. Protected by legacy
// Bearer ADMIN_PASSWORD (the old auth path) — once a user exists with the
// given email, subsequent calls return 409 so the endpoint can't be abused
// to create extra accounts. Use this once, then ignore.

import { type Env } from '../../../../src/lib/types';
import { checkAdminAuth, hashPassword } from '../../../../src/lib/admin-auth';

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!checkAdminAuth(ctx.request, ctx.env)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await ctx.request.json().catch(() => null) as { email?: string; name?: string; password?: string } | null;
  const email = (body?.email || '').trim().toLowerCase();
  const name = (body?.name || '').trim();
  const password = body?.password || '';
  if (!email || !name || !password) {
    return Response.json({ error: 'email, name, password wymagane' }, { status: 400 });
  }
  if (password.length < 12) {
    return Response.json({ error: 'Hasło min. 12 znaków' }, { status: 400 });
  }

  const exists = await ctx.env.DB.prepare(`SELECT id FROM admin_users WHERE email = ?`)
    .bind(email).first();
  if (exists) return Response.json({ error: 'User z tym emailem już istnieje' }, { status: 409 });

  const { hash, salt } = await hashPassword(password);
  const res = await ctx.env.DB.prepare(`
    INSERT INTO admin_users (email, name, password_hash, password_salt, role, created_at, password_changed_at)
    VALUES (?, ?, ?, ?, 'admin', ?, ?)
  `).bind(email, name, hash, salt, Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000)).run();

  return Response.json({ ok: true, id: res.meta.last_row_id, email });
};
