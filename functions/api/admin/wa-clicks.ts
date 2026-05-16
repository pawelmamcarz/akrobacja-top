// GET /api/admin/wa-clicks - admin view klikniec w WhatsApp CTA.
// Header: Authorization: Bearer ${ADMIN_PASSWORD}
//
// Zwraca:
//   - recent: top 200 ostatnich klikniec
//   - last24h: liczba klikniec w ostatnie 24h
//   - last7d: liczba klikniec w ostatnie 7 dni
//   - byPage: grupowanie po page (top 10)
//   - byLocation: grupowanie po location (top 10)

import { type Env } from '../../../src/lib/types';
import { checkAdminAuth } from '../../../src/lib/admin-auth';

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (!checkAdminAuth(ctx.request, ctx.env)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [recentRes, last24hRes, last7dRes, byPageRes, byLocationRes] = await Promise.all([
    ctx.env.DB.prepare(`
      SELECT id, page, location, prefilled_text, referer, created_at
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
  ]);

  return Response.json({
    recent: recentRes.results ?? [],
    last24h: last24hRes?.cnt ?? 0,
    last7d: last7dRes?.cnt ?? 0,
    byPage: byPageRes.results ?? [],
    byLocation: byLocationRes.results ?? [],
  });
};
