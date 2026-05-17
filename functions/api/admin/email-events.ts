// GET /api/admin/email-events - lista ostatnich 200 events + stats 30 dni.
// Wymaga Bearer ADMIN_PASSWORD. Dane z tabeli email_events (Resend webhook).
//
// Query params:
//   ?type=email.bounced  - filtruj po typie eventu
//   ?sender=voucher@akrobacja.com
//   ?tag=voucher
//   ?limit=200 (default 200, max 500)

import { type Env } from '../../../src/lib/types';
import { checkAdminAuth } from '../../../src/lib/admin-auth';

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (!checkAdminAuth(ctx.request, ctx.env)) {
    return new Response('unauthorized', { status: 401 });
  }

  const url = new URL(ctx.request.url);
  const type = url.searchParams.get('type');
  const sender = url.searchParams.get('sender');
  const tag = url.searchParams.get('tag');
  const limit = Math.min(Number(url.searchParams.get('limit') || 200), 500);

  const conditions: string[] = [];
  const params: any[] = [];
  if (type) {
    conditions.push('type = ?');
    params.push(type);
  }
  if (sender) {
    conditions.push("sender LIKE ?");
    params.push(`%${sender}%`);
  }
  if (tag) {
    conditions.push('tag_type = ?');
    params.push(tag);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const recent = await ctx.env.DB.prepare(
    `SELECT id, resend_id, type, sender, recipient, subject, tag_type, tag_extra, created_at
     FROM email_events ${where}
     ORDER BY created_at DESC
     LIMIT ?`,
  )
    .bind(...params, limit)
    .all();

  // Stats: ostatnie 30 dni
  const stats30 = await ctx.env.DB.prepare(
    `SELECT type, COUNT(*) as n
     FROM email_events
     WHERE created_at >= datetime('now', '-30 days')
     GROUP BY type
     ORDER BY n DESC`,
  ).all();

  const bySender30 = await ctx.env.DB.prepare(
    `SELECT COALESCE(sender, '(unknown)') as sender, COUNT(*) as n
     FROM email_events
     WHERE created_at >= datetime('now', '-30 days')
     GROUP BY sender
     ORDER BY n DESC`,
  ).all();

  const byTag30 = await ctx.env.DB.prepare(
    `SELECT COALESCE(tag_type, '(no-tag)') as tag, COUNT(*) as n
     FROM email_events
     WHERE created_at >= datetime('now', '-30 days')
     GROUP BY tag_type
     ORDER BY n DESC`,
  ).all();

  // Bounces / complaints w 7 dni (alerty)
  const alerts7 = await ctx.env.DB.prepare(
    `SELECT type, sender, recipient, subject, created_at
     FROM email_events
     WHERE created_at >= datetime('now', '-7 days')
       AND type IN ('email.bounced', 'email.complained', 'email.failed')
     ORDER BY created_at DESC
     LIMIT 50`,
  ).all();

  return Response.json({
    recent: recent.results || [],
    stats30: stats30.results || [],
    bySender30: bySender30.results || [],
    byTag30: byTag30.results || [],
    alerts7: alerts7.results || [],
  });
};
