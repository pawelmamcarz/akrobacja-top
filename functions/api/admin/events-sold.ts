// CRUD sprzedanych eventow + endpoint splitu kasy 3-way (Pawel/Magda/Maciej).
//
// Split per event:
//   Pawel    = samolot (dolot_min + pokaz_min) × 30 zl/min + 50% reszty marzy
//   Maciej   = paliwo ((dolot_min + pokaz_min) / 30 minutes_per_lot zaokr. w gore) × 200 zl
//              + smok (per event override) + 50% reszty marzy
//   Magda    = magda_share_pct × gross_amount (prowizja sprzedaz)
//   marza    = cena - samolot - paliwo - smok - prowizja_magdy
//   marza dzielona 50/50 miedzy Pawla i Macieja.

import { type Env } from '../../../src/lib/types';
import { checkAdminAuthAsync, getAdminUserAsync } from '../../../src/lib/admin-auth';

const AIRCRAFT_RATE_PER_MIN_GR = 3000;          // 30 zl/min (jak voucher-split)
const FUEL_PER_FLIGHT_GR = 20_000;              // 200 zl per lot (zakladamy 1 lot na 30 min)
const MINUTES_PER_TANK = 30;                    // 1 tankowanie = ~30 min lotu

interface EventCreateBody {
  event_date: string;
  client_name: string;
  location?: string;
  gross_amount_gr: number;
  dolot_minutes?: number;
  pokaz_minutes?: number;
  smok_cost_gr?: number;
  magda_share_pct?: number;
  status?: string;
  notes?: string;
}

interface EventPatchBody extends Partial<EventCreateBody> {
  id?: string;
}

interface EventRow {
  id: string;
  event_date: string;
  client_name: string;
  location: string | null;
  gross_amount_gr: number;
  dolot_minutes: number;
  pokaz_minutes: number;
  smok_cost_gr: number;
  magda_share_pct: number;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function computeSplit(e: EventRow) {
  const totalMinutes = (e.dolot_minutes || 0) + (e.pokaz_minutes || 0);
  const aircraftGr = totalMinutes * AIRCRAFT_RATE_PER_MIN_GR;
  const flights = Math.max(1, Math.ceil(totalMinutes / MINUTES_PER_TANK));
  const fuelGr = flights * FUEL_PER_FLIGHT_GR;
  const smokGr = e.smok_cost_gr || 0;
  const magdaCommissionGr = Math.round(e.gross_amount_gr * (e.magda_share_pct || 0) / 100);
  const costTotalGr = aircraftGr + fuelGr + smokGr + magdaCommissionGr;
  const marginGr = e.gross_amount_gr - costTotalGr;
  const marginHalf = Math.round(marginGr / 2);
  return {
    aircraft_gr: aircraftGr,
    fuel_gr: fuelGr,
    smok_gr: smokGr,
    magda_commission_gr: magdaCommissionGr,
    cost_total_gr: costTotalGr,
    margin_gr: marginGr,
    pawel_total_gr: aircraftGr + marginHalf,
    maciej_total_gr: fuelGr + smokGr + marginHalf,
    magda_total_gr: magdaCommissionGr,
  };
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (!(await checkAdminAuthAsync(ctx.request, ctx.env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(ctx.request.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const status = url.searchParams.get('status');

  const where: string[] = [];
  const binds: (string | number)[] = [];
  if (from) { where.push('event_date >= ?'); binds.push(from); }
  if (to) { where.push('event_date <= ?'); binds.push(to); }
  if (status) { where.push('status = ?'); binds.push(status); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const { results } = await ctx.env.DB.prepare(
    `SELECT * FROM events_sold ${whereSql} ORDER BY event_date DESC LIMIT 200`
  ).bind(...binds).all<EventRow>();

  const eventsWithSplit = (results || []).map(e => ({ ...e, split: computeSplit(e) }));

  const totals = eventsWithSplit.reduce((acc, e) => {
    acc.revenue_gr += e.gross_amount_gr;
    acc.cost_total_gr += e.split.cost_total_gr;
    acc.margin_gr += e.split.margin_gr;
    acc.pawel_gr += e.split.pawel_total_gr;
    acc.maciej_gr += e.split.maciej_total_gr;
    acc.magda_gr += e.split.magda_total_gr;
    return acc;
  }, { revenue_gr: 0, cost_total_gr: 0, margin_gr: 0, pawel_gr: 0, maciej_gr: 0, magda_gr: 0 });

  return Response.json({ events: eventsWithSplit, totals });
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const adminUser = await getAdminUserAsync(ctx.request, ctx.env);
  if (!adminUser) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = (await ctx.request.json().catch(() => null)) as (EventPatchBody & { action?: 'create' | 'update' | 'delete' }) | null;
  if (!body) return Response.json({ error: 'Brak body' }, { status: 400 });

  switch (body.action) {
    case 'create': {
      if (!body.event_date || !body.client_name || body.gross_amount_gr == null) {
        return Response.json({ error: 'event_date, client_name, gross_amount_gr wymagane' }, { status: 400 });
      }
      const id = crypto.randomUUID();
      await ctx.env.DB.prepare(`
        INSERT INTO events_sold (id, event_date, client_name, location, gross_amount_gr,
          dolot_minutes, pokaz_minutes, smok_cost_gr, magda_share_pct, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, body.event_date, body.client_name, body.location || null, body.gross_amount_gr,
        body.dolot_minutes ?? 30, body.pokaz_minutes ?? 30, body.smok_cost_gr ?? 40000,
        body.magda_share_pct ?? 10, body.status || 'planned', body.notes || null,
      ).run();
      return Response.json({ ok: true, id });
    }
    case 'update': {
      if (!body.id) return Response.json({ error: 'id wymagany' }, { status: 400 });
      const fields: string[] = [];
      const binds: (string | number | null)[] = [];
      const upd = (field: string, value: unknown) => {
        if (value !== undefined) { fields.push(`${field} = ?`); binds.push(value as never); }
      };
      upd('event_date', body.event_date);
      upd('client_name', body.client_name);
      upd('location', body.location ?? null);
      upd('gross_amount_gr', body.gross_amount_gr);
      upd('dolot_minutes', body.dolot_minutes);
      upd('pokaz_minutes', body.pokaz_minutes);
      upd('smok_cost_gr', body.smok_cost_gr);
      upd('magda_share_pct', body.magda_share_pct);
      upd('status', body.status);
      upd('notes', body.notes ?? null);
      if (!fields.length) return Response.json({ error: 'Brak pol' }, { status: 400 });
      fields.push("updated_at = datetime('now')");
      binds.push(body.id);
      await ctx.env.DB.prepare(`UPDATE events_sold SET ${fields.join(', ')} WHERE id = ?`).bind(...binds).run();
      return Response.json({ ok: true });
    }
    case 'delete': {
      if (!body.id) return Response.json({ error: 'id wymagany' }, { status: 400 });
      await ctx.env.DB.prepare('DELETE FROM events_sold WHERE id = ?').bind(body.id).run();
      return Response.json({ ok: true });
    }
    default:
      return Response.json({ error: 'Nieznana akcja' }, { status: 400 });
  }
};
