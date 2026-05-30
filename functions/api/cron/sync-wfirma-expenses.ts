// Daily cron: pull last 90 days of wFirma expenses (faktury kosztowe), upsert
// into D1 expenses table keyed by wfirma_id. Idempotent - re-running just
// refreshes mutable fields (gross, contractor, etc.) without touching
// manual_category which the admin may have set manually.
//
// Trigger: external scheduler (cron-job.org / GH Actions) hitting
//   GET /api/cron/sync-wfirma-expenses
//   Authorization: Bearer ${CRON_SECRET}

import { type Env } from '../../../src/lib/types';
import { listWfirmaExpenses, type WfirmaExpenseRow } from '../../../src/lib/wfirma';

// Data graniczna: zaciagamy WYLACZNIE faktury wystawione od tego dnia w gore.
// Wszystko starsze jest ignorowane przy pull i przycinane z bazy przy sync.
const EXPENSES_SINCE = '2026-01-01';
const PAGE_SIZE = 50;
const MAX_PAGES = 40;

async function pullAll(env: Env, from: string, to: string): Promise<WfirmaExpenseRow[]> {
  const out: WfirmaExpenseRow[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await listWfirmaExpenses(env, { from, to, page, limit: PAGE_SIZE });
    out.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return out;
}

interface WhitelistTerm { name: string; nip: string }

async function loadWhitelist(env: Env): Promise<WhitelistTerm[]> {
  const { results } = await env.DB.prepare(
    'SELECT match_name, nip FROM expense_contractors WHERE active = 1'
  ).all<{ match_name: string; nip: string | null }>();
  return (results || [])
    .map((r) => ({ name: (r.match_name || '').toLowerCase().trim(), nip: (r.nip || '').replace(/\D/g, '') }))
    .filter((t) => t.name || t.nip);
}

// Faktura "nalezy" do whitelisty gdy nazwa kontrahenta zawiera ktorys fragment
// (case-insensitive) ALBO NIP zgadza sie dokladnie.
function matchesWhitelist(contractorName: string | null, contractorNip: string | null, wl: WhitelistTerm[]): boolean {
  const name = (contractorName || '').toLowerCase();
  const nip = (contractorNip || '').replace(/\D/g, '');
  return wl.some((t) => (t.name && name.includes(t.name)) || (t.nip && nip && nip === t.nip));
}

export async function syncWfirmaExpenses(
  env: Env,
): Promise<{ processed: number; matched: number; inserted: number; updated: number; pruned: number; whitelist: number; skipped?: boolean }> {
  const wl = await loadWhitelist(env);
  // Pusta whitelista = nie wiadomo kogo zaciagac. Nic nie pobieramy i nic nie
  // kasujemy (zabezpieczenie przed przypadkowym wyczyszczeniem calej bazy).
  if (wl.length === 0) {
    return { processed: 0, matched: 0, inserted: 0, updated: 0, pruned: 0, whitelist: 0, skipped: true };
  }

  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const from = EXPENSES_SINCE;

  const all = await pullAll(env, from, to);
  // Podwojny guard: data >= granica ORAZ kontrahent na whiteliscie.
  const rows = all.filter((r) => r.issue_date >= EXPENSES_SINCE && matchesWhitelist(r.contractor_name, r.contractor_nip, wl));
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
      // meta.changes is 1 for both insert and update on conflict - disambiguate via last_row_id.
      if (res.meta.last_row_id && res.meta.last_row_id > 0) inserted++;
      else updated++;
    }
  }

  // Przytnij: skasuj rekordy source='wfirma' ktore nie spelniaja kryteriow
  // (data < granicy LUB kontrahent spadl z whitelisty / zostal dezaktywowany).
  // Wpisy 'manual' nie sa ruszane.
  const existing = await env.DB.prepare(
    `SELECT id, contractor_name, contractor_nip, issue_date FROM expenses WHERE source = 'wfirma'`
  ).all<{ id: number; contractor_name: string | null; contractor_nip: string | null; issue_date: string }>();
  const toDelete = (existing.results || [])
    .filter((e) => e.issue_date < EXPENSES_SINCE || !matchesWhitelist(e.contractor_name, e.contractor_nip, wl))
    .map((e) => e.id);
  let pruned = 0;
  for (let i = 0; i < toDelete.length; i += 50) {
    const chunk = toDelete.slice(i, i + 50);
    const placeholders = chunk.map(() => '?').join(',');
    await env.DB.prepare(`DELETE FROM expenses WHERE id IN (${placeholders})`).bind(...chunk).run();
    pruned += chunk.length;
  }

  return { processed: all.length, matched: rows.length, inserted, updated, pruned, whitelist: wl.length };
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);
  const isDump = url.searchParams.get('dump') === '1';

  // Dump endpoint: dostepny dla admin (przez Bearer w przegladarce) ALBO CRON_SECRET.
  // Cron sync: tylko CRON_SECRET.
  if (isDump) {
    const { checkAdminAuthAsync } = await import('../../../src/lib/admin-auth');
    const isAdmin = await checkAdminAuthAsync(ctx.request, ctx.env);
    const expectedCron = ctx.env.CRON_SECRET;
    const authHeader = ctx.request.headers.get('Authorization') || '';
    const isCron = expectedCron && authHeader === `Bearer ${expectedCron}`;
    if (!isAdmin && !isCron) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    try {
      const { listWfirmaExpensesRaw } = await import('../../../src/lib/wfirma');
      const sample = await listWfirmaExpensesRaw(ctx.env, { page: 1, limit: 1 });
      return Response.json({ sample }, { status: 200 });
    } catch (err) {
      return Response.json({ dump_error: err instanceof Error ? err.message : String(err) }, { status: 500 });
    }
  }

  const expected = ctx.env.CRON_SECRET;
  if (!expected) return Response.json({ error: 'Cron not configured' }, { status: 500 });
  const auth = ctx.request.headers.get('Authorization') || '';
  if (auth !== `Bearer ${expected}`) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const result = await syncWfirmaExpenses(ctx.env);
    return Response.json({ ok: true, ...result, timestamp: new Date().toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown';
    const stack = err instanceof Error ? err.stack?.split('\n').slice(0, 5).join('\n') : undefined;
    const envCheck = {
      has_access_key: !!ctx.env.WFIRMA_ACCESS_KEY,
      has_secret_key: !!ctx.env.WFIRMA_SECRET_KEY,
      has_app_key: !!ctx.env.WFIRMA_APP_KEY,
      has_company_id: !!ctx.env.WFIRMA_COMPANY_ID,
    };
    return Response.json({ error: msg, stack, envCheck }, { status: 500 });
  }
};

export const onRequestPost = onRequestGet;
