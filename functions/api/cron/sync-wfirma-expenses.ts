// Daily cron: pull last 90 days of wFirma expenses (faktury kosztowe), upsert
// into D1 expenses table keyed by wfirma_id. Idempotent — re-running just
// refreshes mutable fields (gross, contractor, etc.) without touching
// manual_category which the admin may have set manually.
//
// Trigger: external scheduler (cron-job.org / GH Actions) hitting
//   GET /api/cron/sync-wfirma-expenses
//   Authorization: Bearer ${CRON_SECRET}

import { type Env } from '../../../src/lib/types';
import { listWfirmaExpenses, type WfirmaExpenseRow } from '../../../src/lib/wfirma';

const LOOKBACK_DAYS = 90;
const PAGE_SIZE = 50;
const MAX_PAGES = 20;

async function pullAll(env: Env, from: string, to: string): Promise<WfirmaExpenseRow[]> {
  const out: WfirmaExpenseRow[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await listWfirmaExpenses(env, { from, to, page, limit: PAGE_SIZE });
    out.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return out;
}

export async function syncWfirmaExpenses(env: Env): Promise<{ processed: number; inserted: number; updated: number }> {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const fromDate = new Date(today.getTime() - LOOKBACK_DAYS * 86400000);
  const from = fromDate.toISOString().slice(0, 10);

  const rows = await pullAll(env, from, to);
  const now = Math.floor(Date.now() / 1000);
  let inserted = 0;
  let updated = 0;

  for (const r of rows) {
    const res = await env.DB.prepare(`
      INSERT INTO expenses (source, wfirma_id, invoice_number, contractor_name, contractor_nip,
                            net_amount, vat_amount, gross_amount, currency, category,
                            issue_date, description, created_at)
      VALUES ('wfirma', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(wfirma_id) DO UPDATE SET
        invoice_number = excluded.invoice_number,
        contractor_name = excluded.contractor_name,
        contractor_nip = excluded.contractor_nip,
        net_amount = excluded.net_amount,
        vat_amount = excluded.vat_amount,
        gross_amount = excluded.gross_amount,
        currency = excluded.currency,
        category = excluded.category,
        issue_date = excluded.issue_date,
        description = excluded.description
    `).bind(
      r.wfirma_id, r.invoice_number, r.contractor_name, r.contractor_nip,
      r.net_amount, r.vat_amount, r.gross_amount, r.currency, r.category,
      r.issue_date, r.description, now,
    ).run();
    if (res.meta.changes > 0) {
      // meta.changes is 1 for both insert and update on conflict — disambiguate via last_row_id.
      if (res.meta.last_row_id && res.meta.last_row_id > 0) inserted++;
      else updated++;
    }
  }

  return { processed: rows.length, inserted, updated };
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const expected = ctx.env.CRON_SECRET;
  if (!expected) return Response.json({ error: 'Cron not configured' }, { status: 500 });
  const auth = ctx.request.headers.get('Authorization') || '';
  if (auth !== `Bearer ${expected}`) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const result = await syncWfirmaExpenses(ctx.env);
    return Response.json({ ok: true, ...result, timestamp: new Date().toISOString() });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Unknown' }, { status: 500 });
  }
};

export const onRequestPost = onRequestGet;
