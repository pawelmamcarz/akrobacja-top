import { type Env } from '../../../src/lib/types';
import { checkAdminAuth } from '../../../src/lib/admin-auth';

// GET /api/admin/failed-deliveries — last 200 audit rows + grouped counts last 24h.
// Header: Authorization: Bearer ${ADMIN_PASSWORD}
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (!checkAdminAuth(ctx.request, ctx.env)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { results: recent } = await ctx.env.DB.prepare(`
    SELECT id, channel, ref_id, recipient, error_message, created_at
      FROM failed_deliveries
     ORDER BY created_at DESC
     LIMIT 200
  `).all();

  const { results: countsLast24h } = await ctx.env.DB.prepare(`
    SELECT channel, COUNT(*) AS cnt
      FROM failed_deliveries
     WHERE created_at >= datetime('now', '-1 day')
     GROUP BY channel
     ORDER BY cnt DESC
  `).all();

  return Response.json({ recent, countsLast24h });
};
