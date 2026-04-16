import { type Env } from '../../../src/lib/types';
import { checkAdminAuth } from '../../../src/lib/admin-auth';

// GET /api/admin/pilots
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (!checkAdminAuth(ctx.request, ctx.env)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { results } = await ctx.env.DB.prepare(
    'SELECT id, phone, name, email, license_type, license_number, balance_minutes, verified, created_at, last_login FROM pilots ORDER BY created_at DESC'
  ).all();

  return Response.json({ pilots: results });
};

// POST /api/admin/pilots — manage pilot balance
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!checkAdminAuth(ctx.request, ctx.env)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await ctx.request.json()) as {
    action: string;
    pilot_id: string;
    minutes?: number;
    reason?: string;
  };

  switch (body.action) {
    case 'add_balance': {
      if (!body.pilot_id || !body.minutes || !body.reason) {
        return Response.json({ error: 'Podaj pilot_id, minutes i reason' }, { status: 400 });
      }

      await ctx.env.DB.prepare(
        'UPDATE pilots SET balance_minutes = balance_minutes + ? WHERE id = ?'
      ).bind(body.minutes, body.pilot_id).run();

      await ctx.env.DB.prepare(
        'INSERT INTO balance_log (id, pilot_id, change_minutes, reason, created_by) VALUES (?, ?, ?, ?, ?)'
      ).bind(crypto.randomUUID(), body.pilot_id, body.minutes, body.reason, 'admin').run();

      const pilot = await ctx.env.DB.prepare(
        'SELECT balance_minutes FROM pilots WHERE id = ?'
      ).bind(body.pilot_id).first<{ balance_minutes: number }>();

      return Response.json({ ok: true, balance_minutes: pilot?.balance_minutes });
    }

    case 'deduct_balance': {
      if (!body.pilot_id || !body.minutes || !body.reason) {
        return Response.json({ error: 'Podaj pilot_id, minutes i reason' }, { status: 400 });
      }

      const pilot = await ctx.env.DB.prepare(
        'SELECT balance_minutes FROM pilots WHERE id = ?'
      ).bind(body.pilot_id).first<{ balance_minutes: number }>();

      if (!pilot || pilot.balance_minutes < body.minutes) {
        return Response.json({ error: `Niewystarczające saldo (${pilot?.balance_minutes || 0} min)` }, { status: 400 });
      }

      await ctx.env.DB.prepare(
        'UPDATE pilots SET balance_minutes = balance_minutes - ? WHERE id = ?'
      ).bind(body.minutes, body.pilot_id).run();

      await ctx.env.DB.prepare(
        'INSERT INTO balance_log (id, pilot_id, change_minutes, reason, created_by) VALUES (?, ?, ?, ?, ?)'
      ).bind(crypto.randomUUID(), body.pilot_id, -body.minutes, body.reason, 'admin').run();

      return Response.json({ ok: true, balance_minutes: pilot.balance_minutes - body.minutes });
    }

    case 'get_history': {
      if (!body.pilot_id) return Response.json({ error: 'Podaj pilot_id' }, { status: 400 });
      const { results } = await ctx.env.DB.prepare(
        'SELECT * FROM balance_log WHERE pilot_id = ? ORDER BY created_at DESC LIMIT 50'
      ).bind(body.pilot_id).all();
      return Response.json({ history: results });
    }

    default:
      return Response.json({ error: 'Nieznana akcja' }, { status: 400 });
  }
};
