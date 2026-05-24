// GET /api/admin/wa-clicks - admin view klikniec w WhatsApp CTA.
// Header: Authorization: Bearer ${ADMIN_PASSWORD}
//
// Zwraca:
//   - recent: top 200 ostatnich klikniec (zawiera target_number)
//   - last24h: liczba klikniec w ostatnie 24h
//   - last7d: liczba klikniec w ostatnie 7 dni
//   - byPage: grupowanie po page (top 10)
//   - byLocation: grupowanie po location (top 10)
//   - byTarget: grupowanie po target_number (ostatnie 30 dni, bez NULL)

import { type Env } from '../../../src/lib/types';
import { checkAdminAuthAsync } from '../../../src/lib/admin-auth';

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (!(await checkAdminAuthAsync(ctx.request, ctx.env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [recentRes, last24hRes, last7dRes, byPageRes, byLocationRes, byTargetRes] = await Promise.all([
    ctx.env.DB.prepare(`
      SELECT id, page, location, prefilled_text, target_number, referer, created_at
        FROM wa_clicks
       ORDER BY created_at DESC
       LIMIT 200
    `).all(),
    ctx.env.DB.prepare(
      "SELECT COUNT(*) AS cnt FROM wa_clicks WHERE created_at >= datetime('now', '-1 day')"
    ).first<{ cnt: number }>(),
    ctx.env.DB.prepare(
      "SELECT COUNT(*) AS cnt FROM wa_clicks WHERE created_at >= datetime('now', '-7 days')"
    ).first<{ cnt: number }>(),
    ctx.env.DB.prepare(`
      SELECT page, COUNT(*) AS cnt
        FROM wa_clicks
       WHERE created_at >= datetime('now', '-30 days')
       GROUP BY page
       ORDER BY cnt DESC
       LIMIT 10
    `).all(),
    ctx.env.DB.prepare(`
      SELECT location, COUNT(*) AS cnt
        FROM wa_clicks
       WHERE created_at >= datetime('now', '-30 days') AND location IS NOT NULL
       GROUP BY location
       ORDER BY cnt DESC
       LIMIT 10
    `).all(),
    ctx.env.DB.prepare(`
      SELECT target_number, COUNT(*) AS cnt
        FROM wa_clicks
       WHERE created_at >= datetime('now', '-30 days') AND target_number IS NOT NULL
       GROUP BY target_number
       ORDER BY cnt DESC
    `).all(),
  ]);

  return Response.json({
    recent: recentRes.results ?? [],
    last24h: last24hRes?.cnt ?? 0,
    last7d: last7dRes?.cnt ?? 0,
    byPage: byPageRes.results ?? [],
    byLocation: byLocationRes.results ?? [],
    byTarget: byTargetRes.results ?? [],
  });
};
