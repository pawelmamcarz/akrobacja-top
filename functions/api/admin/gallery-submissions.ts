// /api/admin/gallery-submissions
// GET  ?status=pending|approved|rejected — list submissions (default: pending first)
// POST { id, action: 'approve' | 'reject' | 'delete' | 'update', caption?, photographer_name?, photographer_instagram? }
//
// Approve flips status -> 'approved' and stamps approved_at/approved_by.
// Reject keeps the row (audit trail) but flips status -> 'rejected'.
// Delete removes both the R2 object and the row — irreversible.
//
// Auth: Bearer ADMIN_PASSWORD (or MAGDA_PASSWORD via getAdminUser).

import { type Env } from '../../../src/lib/types';
import { checkAdminAuthAsync, getAdminUserAsync } from '../../../src/lib/admin-auth';

interface Row {
  id: number;
  r2_key: string;
  width: number;
  height: number;
  photographer_name: string;
  photographer_city: string | null;
  photographer_instagram: string | null;
  photographer_email: string | null;
  caption: string | null;
  event_tag: string | null;
  status: string;
  submitted_at: number;
  approved_at: number | null;
  approved_by: string | null;
  submitter_ip: string | null;
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (!(await checkAdminAuthAsync(ctx.request, ctx.env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(ctx.request.url);
  const status = (url.searchParams.get('status') || 'pending').toLowerCase();
  const allowedStatuses = new Set(['pending', 'approved', 'rejected', 'all']);
  if (!allowedStatuses.has(status)) {
    return Response.json({ error: 'Bad status' }, { status: 400 });
  }

  const sql = status === 'all'
    ? `SELECT id, r2_key, width, height, photographer_name, photographer_city,
              photographer_instagram, photographer_email, caption, event_tag, status,
              submitted_at, approved_at, approved_by, submitter_ip
       FROM gallery_submissions ORDER BY submitted_at DESC LIMIT 200`
    : `SELECT id, r2_key, width, height, photographer_name, photographer_city,
              photographer_instagram, photographer_email, caption, event_tag, status,
              submitted_at, approved_at, approved_by, submitter_ip
       FROM gallery_submissions WHERE status = ?
       ORDER BY submitted_at DESC LIMIT 200`;

  const stmt = status === 'all'
    ? ctx.env.DB.prepare(sql)
    : ctx.env.DB.prepare(sql).bind(status);
  const rows = await stmt.all<Row>();

  const stats = await ctx.env.DB.prepare(
    `SELECT status, COUNT(*) as c FROM gallery_submissions GROUP BY status`,
  ).all<{ status: string; c: number }>();
  const counts: Record<string, number> = { pending: 0, approved: 0, rejected: 0 };
  for (const r of stats.results || []) counts[r.status] = r.c;

  return Response.json({ submissions: rows.results || [], counts });
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getAdminUserAsync(ctx.request, ctx.env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await ctx.request.json().catch(() => null) as {
    id?: number; action?: string;
    caption?: string;
    photographer_name?: string;
    photographer_instagram?: string;
  } | null;
  if (!body?.id || !body.action) {
    return Response.json({ error: 'Brak id lub action' }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);

  if (body.action === 'approve') {
    await ctx.env.DB.prepare(
      `UPDATE gallery_submissions
       SET status='approved', approved_at=?, approved_by=?
       WHERE id=?`,
    ).bind(now, user, body.id).run();
    return Response.json({ ok: true });
  }

  if (body.action === 'reject') {
    await ctx.env.DB.prepare(
      `UPDATE gallery_submissions SET status='rejected', approved_at=?, approved_by=? WHERE id=?`,
    ).bind(now, user, body.id).run();
    return Response.json({ ok: true });
  }

  if (body.action === 'delete') {
    const row = await ctx.env.DB.prepare(
      `SELECT r2_key FROM gallery_submissions WHERE id=?`,
    ).bind(body.id).first<{ r2_key: string }>();
    if (row?.r2_key) {
      await ctx.env.VOUCHER_BUCKET.delete(row.r2_key).catch(() => {});
    }
    await ctx.env.DB.prepare(`DELETE FROM gallery_submissions WHERE id=?`).bind(body.id).run();
    return Response.json({ ok: true });
  }

  if (body.action === 'update') {
    const fields: string[] = [];
    const binds: Array<string | null> = [];
    if (typeof body.caption === 'string') { fields.push('caption=?'); binds.push(body.caption.slice(0, 200) || null); }
    if (typeof body.photographer_name === 'string' && body.photographer_name.trim()) {
      fields.push('photographer_name=?'); binds.push(body.photographer_name.trim().slice(0, 80));
    }
    if (typeof body.photographer_instagram === 'string') {
      fields.push('photographer_instagram=?'); binds.push(body.photographer_instagram.trim().slice(0, 60) || null);
    }
    if (fields.length === 0) return Response.json({ error: 'Nic do zapisania' }, { status: 400 });
    binds.push(String(body.id));
    await ctx.env.DB.prepare(
      `UPDATE gallery_submissions SET ${fields.join(', ')} WHERE id=?`,
    ).bind(...binds).run();
    return Response.json({ ok: true });
  }

  return Response.json({ error: 'Nieznana akcja' }, { status: 400 });
};
