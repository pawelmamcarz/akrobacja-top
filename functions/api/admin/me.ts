// GET /api/admin/me
// Zwraca { user: 'pawel'|'magda', loggedAt } i opcjonalnie zapisuje login
// do admin_logins (debounce 1h per (user, ip) zeby nie spamowac tabeli).

import { type Env } from '../../../src/lib/types';
import { getAdminIdentityAsync } from '../../../src/lib/admin-auth';
import { clientIp } from '../../../src/lib/rate-limit';

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const identity = await getAdminIdentityAsync(ctx.request, ctx.env);
  if (!identity) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const user = identity.user;

  const ip = clientIp(ctx.request);
  const userAgent = (ctx.request.headers.get('user-agent') || '').slice(0, 500);

  // Debounce: zapisz nowy login tylko jezeli ostatni dla (user, ip) byl > 1h temu.
  try {
    const recent = await ctx.env.DB.prepare(
      `SELECT 1 FROM admin_logins
        WHERE username = ? AND ip = ?
          AND logged_at > datetime('now', '-1 hour')
        LIMIT 1`
    ).bind(user, ip).first();

    if (!recent) {
      await ctx.env.DB.prepare(
        `INSERT INTO admin_logins (id, username, ip, user_agent) VALUES (?, ?, ?, ?)`
      ).bind(crypto.randomUUID(), user, ip, userAgent).run();
    }
  } catch (err) {
    console.error('[admin/me] login log failed:', err);
  }

  return Response.json({ user, role: identity.role, loggedAt: new Date().toISOString() });
};
