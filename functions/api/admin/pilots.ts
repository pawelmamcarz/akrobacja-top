import { type Env } from '../../../src/lib/types';
import { checkAdminAuthAsync, randomToken } from '../../../src/lib/admin-auth';
import { normalizePhone } from '../../../src/lib/phone';

// GET /api/admin/pilots
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (!(await checkAdminAuthAsync(ctx.request, ctx.env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { results } = await ctx.env.DB.prepare(
    'SELECT id, phone, name, email, license_type, license_number, balance_minutes, verified, created_at, last_login, calendar_token, is_instructor FROM pilots ORDER BY created_at DESC'
  ).all();

  return Response.json({ pilots: results });
};

// POST /api/admin/pilots - manage pilot balance
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!(await checkAdminAuthAsync(ctx.request, ctx.env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await ctx.request.json()) as {
    action: string;
    pilot_id?: string;
    minutes?: number;
    reason?: string;
    phone?: string;
    name?: string;
    email?: string;
    license_type?: string;
    license_number?: string;
    balance_minutes?: number;
    is_instructor?: boolean | number;
  };

  switch (body.action) {
    case 'create': {
      if (!body.phone) {
        return Response.json({ error: 'Telefon jest wymagany' }, { status: 400 });
      }
      let phone: string;
      try {
        phone = normalizePhone(body.phone);
      } catch {
        return Response.json({ error: 'Nieprawidłowy numer telefonu' }, { status: 400 });
      }
      const existing = await ctx.env.DB.prepare(
        'SELECT id FROM pilots WHERE phone = ?'
      ).bind(phone).first();
      if (existing) {
        return Response.json({ error: 'Pilot z tym numerem już istnieje' }, { status: 409 });
      }
      const id = crypto.randomUUID();
      const initialBalance = body.balance_minutes ?? 0;
      await ctx.env.DB.prepare(
        `INSERT INTO pilots (id, phone, name, email, license_type, license_number, balance_minutes, verified)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
      ).bind(
        id, phone,
        body.name || null,
        body.email || null,
        body.license_type || null,
        body.license_number || null,
        initialBalance,
      ).run();
      if (initialBalance > 0) {
        await ctx.env.DB.prepare(
          'INSERT INTO balance_log (id, pilot_id, change_minutes, reason, created_by) VALUES (?, ?, ?, ?, ?)'
        ).bind(crypto.randomUUID(), id, initialBalance, 'Dodanie pilota ręcznie', 'admin').run();
      }
      return Response.json({ ok: true, id });
    }

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

      // Atomowy deduct: SELECT-then-UPDATE było race-prone - dwa równoległe
      // requesty mogły zejść poniżej zera. Pojedynczy UPDATE z guardem
      // (balance_minutes >= ?) eliminuje wyścig.
      const res = await ctx.env.DB.prepare(
        'UPDATE pilots SET balance_minutes = balance_minutes - ? WHERE id = ? AND balance_minutes >= ?'
      ).bind(body.minutes, body.pilot_id, body.minutes).run();

      if (res.meta.changes === 0) {
        // Mogło być: pilot nie istnieje albo niewystarczające saldo. Sprawdź.
        const pilot = await ctx.env.DB.prepare(
          'SELECT balance_minutes FROM pilots WHERE id = ?'
        ).bind(body.pilot_id).first<{ balance_minutes: number }>();
        if (!pilot) {
          return Response.json({ error: 'Pilot nie znaleziony' }, { status: 404 });
        }
        return Response.json({ error: `Niewystarczające saldo (${pilot.balance_minutes} min)` }, { status: 409 });
      }

      await ctx.env.DB.prepare(
        'INSERT INTO balance_log (id, pilot_id, change_minutes, reason, created_by) VALUES (?, ?, ?, ?, ?)'
      ).bind(crypto.randomUUID(), body.pilot_id, -body.minutes, body.reason, 'admin').run();

      const after = await ctx.env.DB.prepare(
        'SELECT balance_minutes FROM pilots WHERE id = ?'
      ).bind(body.pilot_id).first<{ balance_minutes: number }>();

      return Response.json({ ok: true, balance_minutes: after?.balance_minutes ?? 0 });
    }

    case 'get_history': {
      if (!body.pilot_id) return Response.json({ error: 'Podaj pilot_id' }, { status: 400 });
      const { results } = await ctx.env.DB.prepare(
        'SELECT * FROM balance_log WHERE pilot_id = ? ORDER BY created_at DESC LIMIT 50'
      ).bind(body.pilot_id).all();
      return Response.json({ history: results });
    }

    case 'generate_calendar_token': {
      if (!body.pilot_id) return Response.json({ error: 'Podaj pilot_id' }, { status: 400 });
      const token = randomToken();
      const res = await ctx.env.DB.prepare(
        'UPDATE pilots SET calendar_token = ? WHERE id = ?'
      ).bind(token, body.pilot_id).run();
      if (res.meta.changes === 0) {
        return Response.json({ error: 'Pilot nie znaleziony' }, { status: 404 });
      }
      return Response.json({ ok: true, calendar_token: token });
    }

    case 'revoke_calendar_token': {
      if (!body.pilot_id) return Response.json({ error: 'Podaj pilot_id' }, { status: 400 });
      await ctx.env.DB.prepare(
        'UPDATE pilots SET calendar_token = NULL WHERE id = ?'
      ).bind(body.pilot_id).run();
      return Response.json({ ok: true });
    }

    case 'set_instructor': {
      if (!body.pilot_id) return Response.json({ error: 'Podaj pilot_id' }, { status: 400 });
      const flag = body.is_instructor ? 1 : 0;
      await ctx.env.DB.prepare(
        'UPDATE pilots SET is_instructor = ? WHERE id = ?'
      ).bind(flag, body.pilot_id).run();
      return Response.json({ ok: true, is_instructor: flag });
    }

    default:
      return Response.json({ error: 'Nieznana akcja' }, { status: 400 });
  }
};
