// POST /api/admin/finance/voucher-cost
// Body: { voucher_code, fuel_gr?, aircraft_minutes_actual?, notes? }
// Upsert per-voucher override. NULL = wyczysc override (powrot do defaultu).

import { type Env } from '../../../../src/lib/types';
import { checkAdminAuthAsync, getAdminUserAsync } from '../../../../src/lib/admin-auth';

interface Body {
  voucher_code?: string;
  fuel_gr?: number | null;
  aircraft_minutes_actual?: number | null;
  notes?: string | null;
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!(await checkAdminAuthAsync(ctx.request, ctx.env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const adminUser = await getAdminUserAsync(ctx.request, ctx.env);

  const body = (await ctx.request.json().catch(() => null)) as Body | null;
  if (!body?.voucher_code) {
    return Response.json({ error: 'voucher_code wymagane' }, { status: 400 });
  }

  // Walidacja - przyjmujemy null (clear) lub liczbe >= 0
  const fuel = body.fuel_gr === undefined ? undefined : body.fuel_gr;
  const minutes = body.aircraft_minutes_actual === undefined ? undefined : body.aircraft_minutes_actual;

  if (fuel !== undefined && fuel !== null && (typeof fuel !== 'number' || fuel < 0)) {
    return Response.json({ error: 'fuel_gr musi byc >= 0 lub null' }, { status: 400 });
  }
  if (minutes !== undefined && minutes !== null && (typeof minutes !== 'number' || minutes < 0)) {
    return Response.json({ error: 'aircraft_minutes_actual musi byc >= 0 lub null' }, { status: 400 });
  }

  // Upsert. ON CONFLICT update tylko podane pola (zachowuje istniejace gdy partial update).
  await ctx.env.DB.prepare(`
    INSERT INTO voucher_costs (voucher_code, fuel_gr, aircraft_minutes_actual, notes, updated_at, updated_by)
    VALUES (?, ?, ?, ?, datetime('now'), ?)
    ON CONFLICT(voucher_code) DO UPDATE SET
      fuel_gr = COALESCE(excluded.fuel_gr, fuel_gr),
      aircraft_minutes_actual = COALESCE(excluded.aircraft_minutes_actual, aircraft_minutes_actual),
      notes = COALESCE(excluded.notes, notes),
      updated_at = datetime('now'),
      updated_by = excluded.updated_by
  `).bind(
    body.voucher_code,
    fuel ?? null,
    minutes ?? null,
    body.notes ?? null,
    adminUser || 'admin',
  ).run();

  return Response.json({ ok: true });
};

// DELETE /api/admin/finance/voucher-cost?voucher_code=XXX&field=fuel|minutes|all
// Czysci override dla danego pola (powrot do defaultu).
export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  if (!(await checkAdminAuthAsync(ctx.request, ctx.env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(ctx.request.url);
  const voucherCode = url.searchParams.get('voucher_code');
  const field = url.searchParams.get('field') || 'all';
  if (!voucherCode) return Response.json({ error: 'voucher_code wymagane' }, { status: 400 });

  if (field === 'fuel') {
    await ctx.env.DB.prepare('UPDATE voucher_costs SET fuel_gr = NULL WHERE voucher_code = ?').bind(voucherCode).run();
  } else if (field === 'minutes') {
    await ctx.env.DB.prepare('UPDATE voucher_costs SET aircraft_minutes_actual = NULL WHERE voucher_code = ?').bind(voucherCode).run();
  } else {
    await ctx.env.DB.prepare('DELETE FROM voucher_costs WHERE voucher_code = ?').bind(voucherCode).run();
  }
  return Response.json({ ok: true });
};
