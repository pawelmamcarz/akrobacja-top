// GET /api/admin/login-history
// Lista ostatnich 100 logowan + agregacja per uzytkownik w 30 dniach.
//
// Auth: Bearer admin token.

import { type Env } from '../../../src/lib/types';
import { checkAdminAuth } from '../../../src/lib/admin-auth';

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (!checkAdminAuth(ctx.request, ctx.env)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [recentRes, byUser30Res, byUser7Res] = await Promise.all([
    ctx.env.DB.prepare(
      `SELECT username, ip, user_agent, logged_at
         FROM admin_logins
        ORDER BY logged_at DESC
        LIMIT 100`
    ).all(),
    ctx.env.DB.prepare(
      `SELECT username, COUNT(*) AS cnt
         FROM admin_logins
        WHERE logged_at >= datetime('now', '-30 days')
        GROUP BY username
        ORDER BY cnt DESC`
    ).all(),
    ctx.env.DB.prepare(
      `SELECT username, COUNT(*) AS cnt
         FROM admin_logins
        WHERE logged_at >= datetime('now', '-7 days')
        GROUP BY username
        ORDER BY cnt DESC`
    ).all(),
  ]);

  return Response.json({
    recent: recentRes.results ?? [],
    byUser30: byUser30Res.results ?? [],
    byUser7: byUser7Res.results ?? [],
  });
};
