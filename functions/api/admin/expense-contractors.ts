// CRUD whitelisty kontrahentow, ktorych faktury kosztowe zaciagamy z wFirmy.
// Uzywane przez cron sync-wfirma-expenses (filtr przy zaciaganiu + przycinanie
// rekordow niepasujacych). Match po fragmencie nazwy (case-insensitive) lub NIP.
//
// GET  -> { contractors: [...] }
// POST { action:'create', match_name, nip?, label? }
//      { action:'toggle', id, active }
//      { action:'delete', id }
//
// Auth: Bearer ADMIN_PASSWORD / sesja DB (checkAdminAuthAsync).

import { type Env } from '../../../src/lib/types';
import { checkAdminAuthAsync } from '../../../src/lib/admin-auth';

interface Body {
  action?: 'create' | 'toggle' | 'delete';
  id?: number;
  match_name?: string;
  nip?: string;
  label?: string;
  active?: boolean;
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (!(await checkAdminAuthAsync(ctx.request, ctx.env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { results } = await ctx.env.DB.prepare(
    'SELECT id, match_name, nip, label, active, created_at FROM expense_contractors ORDER BY active DESC, match_name'
  ).all();
  return Response.json({ contractors: results });
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!(await checkAdminAuthAsync(ctx.request, ctx.env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = (await ctx.request.json().catch(() => null)) as Body | null;
  if (!body) return Response.json({ error: 'Brak body' }, { status: 400 });

  switch (body.action) {
    case 'create': {
      const matchName = String(body.match_name || '').trim();
      if (!matchName) return Response.json({ error: 'match_name (nazwa / fragment) wymagana' }, { status: 400 });
      const nip = String(body.nip || '').replace(/\D/g, '') || null;
      if (nip && !/^\d{10}$/.test(nip)) {
        return Response.json({ error: 'NIP musi miec 10 cyfr (albo zostaw puste)' }, { status: 400 });
      }
      const dup = await ctx.env.DB.prepare(
        'SELECT id FROM expense_contractors WHERE lower(match_name) = lower(?)'
      ).bind(matchName).first();
      if (dup) return Response.json({ error: 'Taki kontrahent juz jest na liscie' }, { status: 409 });
      const res = await ctx.env.DB.prepare(
        'INSERT INTO expense_contractors (match_name, nip, label, active, created_at) VALUES (?, ?, ?, 1, ?)'
      ).bind(matchName, nip, String(body.label || '').trim() || null, Math.floor(Date.now() / 1000)).run();
      return Response.json({ ok: true, id: res.meta.last_row_id });
    }
    case 'toggle': {
      if (!body.id) return Response.json({ error: 'id wymagane' }, { status: 400 });
      const flag = body.active ? 1 : 0;
      await ctx.env.DB.prepare('UPDATE expense_contractors SET active = ? WHERE id = ?')
        .bind(flag, body.id).run();
      return Response.json({ ok: true, active: flag });
    }
    case 'delete': {
      if (!body.id) return Response.json({ error: 'id wymagane' }, { status: 400 });
      await ctx.env.DB.prepare('DELETE FROM expense_contractors WHERE id = ?').bind(body.id).run();
      return Response.json({ ok: true });
    }
    default:
      return Response.json({ error: 'Nieznana akcja' }, { status: 400 });
  }
};
