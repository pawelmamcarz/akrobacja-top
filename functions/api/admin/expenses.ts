// /api/admin/expenses — operating costs ledger (wFirma sync + manual entries).
// GET   ?from=YYYY-MM-DD&to=YYYY-MM-DD&category=&contractor=
//       returns list + by_category / by_contractor aggregations
// POST  body { action: 'refresh' } → pulls from wFirma synchronously (button "Odśwież")
//       body without action = create manual expense
// PATCH body { id, manual_category } → admin override of category (survives re-sync)
// DELETE body { id } → only allowed for source='manual'
//
// Auth: Bearer ADMIN_PASSWORD (or MAGDA_PASSWORD via getAdminUser).

import { type Env } from '../../../src/lib/types';
import { checkAdminAuthAsync, getAdminUserAsync } from '../../../src/lib/admin-auth';
import { syncWfirmaExpenses } from '../cron/sync-wfirma-expenses';

interface ExpenseRow {
  id: number;
  source: string;
  wfirma_id: string | null;
  invoice_number: string | null;
  contractor_name: string | null;
  net_amount: number;
  vat_amount: number;
  gross_amount: number;
  currency: string;
  category: string | null;
  manual_category: string | null;
  issue_date: string;
  description: string | null;
  added_by: string | null;
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (!(await checkAdminAuthAsync(ctx.request, ctx.env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(ctx.request.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const category = url.searchParams.get('category');
  const contractor = url.searchParams.get('contractor');

  const where: string[] = [];
  const binds: Array<string | number> = [];
  if (from) { where.push('issue_date >= ?'); binds.push(from); }
  if (to) { where.push('issue_date <= ?'); binds.push(to); }
  if (category) { where.push('COALESCE(manual_category, category) = ?'); binds.push(category); }
  if (contractor) { where.push('contractor_name LIKE ?'); binds.push('%' + contractor + '%'); }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const rows = await ctx.env.DB.prepare(`
    SELECT id, source, wfirma_id, invoice_number, contractor_name, net_amount, vat_amount,
           gross_amount, currency, category, manual_category, issue_date, description, added_by
    FROM expenses ${whereSql}
    ORDER BY issue_date DESC, id DESC
    LIMIT 500
  `).bind(...binds).all<ExpenseRow>();

  const list = rows.results || [];
  const byCategory: Record<string, number> = {};
  const byContractor: Record<string, number> = {};
  let total = 0;
  for (const r of list) {
    const cat = r.manual_category || r.category || 'inne';
    byCategory[cat] = (byCategory[cat] || 0) + r.gross_amount;
    if (r.contractor_name) {
      byContractor[r.contractor_name] = (byContractor[r.contractor_name] || 0) + r.gross_amount;
    }
    total += r.gross_amount;
  }

  return Response.json({
    expenses: list,
    total_gross: total,
    count: list.length,
    by_category: byCategory,
    by_contractor: byContractor,
  });
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getAdminUserAsync(ctx.request, ctx.env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await ctx.request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: 'Bad body' }, { status: 400 });

  // Trigger sync
  if (body.action === 'refresh') {
    try {
      const result = await syncWfirmaExpenses(ctx.env);
      return Response.json({ ok: true, ...result });
    } catch (err) {
      return Response.json({ error: err instanceof Error ? err.message : 'Sync failed' }, { status: 500 });
    }
  }

  // Manual expense add
  const contractor = String(body.contractor_name || '').trim();
  const grossPln = Number(body.gross_amount);
  const issueDate = String(body.issue_date || '');
  if (!contractor) return Response.json({ error: 'contractor_name wymagane' }, { status: 400 });
  if (!Number.isFinite(grossPln) || grossPln <= 0) {
    return Response.json({ error: 'gross_amount wymagane (PLN > 0)' }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDate)) {
    return Response.json({ error: 'issue_date wymagana w formacie YYYY-MM-DD' }, { status: 400 });
  }
  const grossGrosze = Math.round(grossPln * 100);
  const vatGrosze = Number.isFinite(Number(body.vat_amount)) ? Math.round(Number(body.vat_amount) * 100) : 0;
  const netGrosze = Number.isFinite(Number(body.net_amount))
    ? Math.round(Number(body.net_amount) * 100)
    : Math.max(0, grossGrosze - vatGrosze);

  const res = await ctx.env.DB.prepare(`
    INSERT INTO expenses (source, contractor_name, contractor_nip, invoice_number, net_amount,
                          vat_amount, gross_amount, currency, category, issue_date, description,
                          created_at, added_by)
    VALUES ('manual', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    contractor,
    String(body.contractor_nip || '').trim() || null,
    String(body.invoice_number || '').trim() || null,
    netGrosze, vatGrosze, grossGrosze,
    String(body.currency || 'PLN'),
    String(body.category || '').trim() || null,
    issueDate,
    String(body.description || '').trim() || null,
    Math.floor(Date.now() / 1000),
    user,
  ).run();

  return Response.json({ ok: true, id: res.meta.last_row_id });
};

export const onRequestPatch: PagesFunction<Env> = async (ctx) => {
  if (!(await checkAdminAuthAsync(ctx.request, ctx.env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await ctx.request.json().catch(() => null) as { id?: number; manual_category?: string | null } | null;
  if (!body?.id) return Response.json({ error: 'id required' }, { status: 400 });
  const cat = body.manual_category && body.manual_category.trim() ? body.manual_category.trim().slice(0, 60) : null;
  await ctx.env.DB.prepare(`UPDATE expenses SET manual_category = ? WHERE id = ?`)
    .bind(cat, body.id).run();
  return Response.json({ ok: true });
};

export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  if (!(await checkAdminAuthAsync(ctx.request, ctx.env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await ctx.request.json().catch(() => null) as { id?: number } | null;
  if (!body?.id) return Response.json({ error: 'id required' }, { status: 400 });
  // Block deletion of wFirma-sourced rows — they would just come back at next sync.
  const row = await ctx.env.DB.prepare(`SELECT source FROM expenses WHERE id = ?`)
    .bind(body.id).first<{ source: string }>();
  if (!row) return Response.json({ error: 'Not found' }, { status: 404 });
  if (row.source !== 'manual') {
    return Response.json({ error: 'wFirma rows kasują się po stronie wFirmy — tutaj re-syncują się' }, { status: 400 });
  }
  await ctx.env.DB.prepare(`DELETE FROM expenses WHERE id = ?`).bind(body.id).run();
  return Response.json({ ok: true });
};
