// /api/admin/leads
// GET: lista leadow (z filtrami ?status, ?category, ?priority, ?q)
//      + agregacja "stats": liczba per status i per category
// POST: multi-action {action: 'create' | 'update' | 'archive', ...fields}
//
// Auth: Bearer ADMIN_PASSWORD (zwykly admin).

import { type Env } from '../../../src/lib/types';
import { checkAdminAuth } from '../../../src/lib/admin-auth';

const VALID_STATUSES = ['new', 'contacted', 'responded', 'qualified', 'won', 'lost', 'archived'];
const VALID_PRIORITIES = ['high', 'medium', 'low'];
const VALID_CATEGORIES = [
  'event_agency', 'airshow', 'voucher_channel', 'b2b_benefit', 'municipal',
  'corp_b2b', 'wedding', 'automotive', 'influencer_agency', 'media',
  'foundation', 'csr_influencer', 'scraped_tender', 'other',
];

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (!checkAdminAuth(ctx.request, ctx.env)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(ctx.request.url);
  const status = url.searchParams.get('status') || '';
  const category = url.searchParams.get('category') || '';
  const priority = url.searchParams.get('priority') || '';
  const q = (url.searchParams.get('q') || '').trim().toLowerCase();

  const where: string[] = ['1=1'];
  const binds: (string | number)[] = [];
  if (status && VALID_STATUSES.includes(status)) { where.push('status = ?'); binds.push(status); }
  if (category && VALID_CATEGORIES.includes(category)) { where.push('category = ?'); binds.push(category); }
  if (priority && VALID_PRIORITIES.includes(priority)) { where.push('priority = ?'); binds.push(priority); }
  if (q) {
    where.push('(LOWER(name) LIKE ? OR LOWER(notes) LIKE ? OR LOWER(contact_person) LIKE ? OR LOWER(email) LIKE ?)');
    const like = `%${q}%`;
    binds.push(like, like, like, like);
  }

  const [listRes, byStatusRes, byCategoryRes] = await Promise.all([
    ctx.env.DB.prepare(
      `SELECT id, name, category, contact_person, email, phone, url, city,
              status, priority, source, value_estimate_pln, notes,
              next_action_at, last_contacted_at, created_at, updated_at
         FROM leads
        WHERE ${where.join(' AND ')}
        ORDER BY
          CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
          updated_at DESC
        LIMIT 500`
    ).bind(...binds).all(),
    ctx.env.DB.prepare(
      `SELECT status, COUNT(*) AS cnt FROM leads GROUP BY status`
    ).all(),
    ctx.env.DB.prepare(
      `SELECT category, COUNT(*) AS cnt FROM leads GROUP BY category ORDER BY cnt DESC`
    ).all(),
  ]);

  return Response.json({
    leads: listRes.results ?? [],
    byStatus: byStatusRes.results ?? [],
    byCategory: byCategoryRes.results ?? [],
  });
};

interface LeadInput {
  name?: string;
  category?: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  url?: string | null;
  city?: string | null;
  status?: string;
  priority?: string | null;
  source?: string | null;
  value_estimate_pln?: number | null;
  notes?: string | null;
  next_action_at?: string | null;
  last_contacted_at?: string | null;
}

function sanitizeStr(v: unknown, max = 500): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s.length === 0 ? null : s.slice(0, max);
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!checkAdminAuth(ctx.request, ctx.env)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { action?: string; id?: string } & LeadInput;
  try {
    body = await ctx.request.json();
  } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400 });
  }

  const action = body.action;

  if (action === 'create') {
    const name = sanitizeStr(body.name, 200);
    const category = sanitizeStr(body.category, 40);
    if (!name || !category || !VALID_CATEGORIES.includes(category)) {
      return Response.json({ error: 'name and valid category required' }, { status: 400 });
    }
    const id = `l-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 6)}`;
    const status = body.status && VALID_STATUSES.includes(body.status) ? body.status : 'new';
    const priority = body.priority && VALID_PRIORITIES.includes(body.priority) ? body.priority : null;

    try {
      await ctx.env.DB.prepare(
        `INSERT INTO leads (id, name, category, contact_person, email, phone, url, city,
                            status, priority, source, value_estimate_pln, notes,
                            next_action_at, last_contacted_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      ).bind(
        id, name, category,
        sanitizeStr(body.contact_person, 200),
        sanitizeStr(body.email, 200),
        sanitizeStr(body.phone, 80),
        sanitizeStr(body.url, 500),
        sanitizeStr(body.city, 100),
        status, priority,
        sanitizeStr(body.source, 100) || 'manual',
        typeof body.value_estimate_pln === 'number' && Number.isFinite(body.value_estimate_pln)
          ? Math.round(body.value_estimate_pln) : null,
        sanitizeStr(body.notes, 2000),
        sanitizeStr(body.next_action_at, 30),
        sanitizeStr(body.last_contacted_at, 30),
      ).run();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('UNIQUE')) return Response.json({ error: 'duplicate (name, category)' }, { status: 409 });
      console.error('[leads.create]', err);
      return Response.json({ error: 'insert failed' }, { status: 500 });
    }
    return Response.json({ ok: true, id });
  }

  if (action === 'update') {
    const id = sanitizeStr(body.id, 80);
    if (!id) return Response.json({ error: 'id required' }, { status: 400 });

    const updates: string[] = [];
    const binds: (string | number | null)[] = [];

    const addStr = (field: keyof LeadInput, max: number) => {
      if (field in body) {
        updates.push(`${field} = ?`);
        binds.push(sanitizeStr(body[field], max));
      }
    };
    addStr('name', 200);
    addStr('contact_person', 200);
    addStr('email', 200);
    addStr('phone', 80);
    addStr('url', 500);
    addStr('city', 100);
    addStr('notes', 2000);
    addStr('next_action_at', 30);
    addStr('last_contacted_at', 30);
    addStr('source', 100);

    if ('status' in body) {
      if (body.status && !VALID_STATUSES.includes(body.status)) {
        return Response.json({ error: 'invalid status' }, { status: 400 });
      }
      updates.push('status = ?'); binds.push(body.status ?? 'new');
    }
    if ('priority' in body) {
      if (body.priority && !VALID_PRIORITIES.includes(body.priority)) {
        return Response.json({ error: 'invalid priority' }, { status: 400 });
      }
      updates.push('priority = ?'); binds.push(body.priority ?? null);
    }
    if ('value_estimate_pln' in body) {
      const v = body.value_estimate_pln;
      updates.push('value_estimate_pln = ?');
      binds.push(typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null);
    }
    if ('category' in body) {
      if (body.category && !VALID_CATEGORIES.includes(body.category)) {
        return Response.json({ error: 'invalid category' }, { status: 400 });
      }
      updates.push('category = ?'); binds.push(body.category ?? 'other');
    }

    if (updates.length === 0) return Response.json({ error: 'no fields to update' }, { status: 400 });

    updates.push(`updated_at = datetime('now')`);
    binds.push(id);

    const res = await ctx.env.DB.prepare(
      `UPDATE leads SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...binds).run();
    return Response.json({ ok: true, changes: res.meta?.changes ?? 0 });
  }

  if (action === 'archive') {
    const id = sanitizeStr(body.id, 80);
    if (!id) return Response.json({ error: 'id required' }, { status: 400 });
    const res = await ctx.env.DB.prepare(
      `UPDATE leads SET status = 'archived', updated_at = datetime('now') WHERE id = ?`
    ).bind(id).run();
    return Response.json({ ok: true, changes: res.meta?.changes ?? 0 });
  }

  return Response.json({ error: 'unknown action' }, { status: 400 });
};
