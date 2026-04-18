import { type Env } from '../../../src/lib/types';
import { sendSms } from '../../../src/lib/sms';
import { checkAdminAuth } from '../../../src/lib/admin-auth';
import { normalizePhone } from '../../../src/lib/phone';

// GET /api/admin/subscribers
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (!checkAdminAuth(ctx.request, ctx.env)) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { results } = await ctx.env.DB.prepare(
    'SELECT * FROM subscribers ORDER BY created_at DESC'
  ).all();

  return Response.json({ subscribers: results });
};

// POST /api/admin/subscribers — send SMS blast or manage
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!checkAdminAuth(ctx.request, ctx.env)) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await ctx.request.json()) as { action: string; message?: string; id?: string; phone?: string; name?: string; email?: string };

  switch (body.action) {
    case 'create': {
      if (!body.phone) return Response.json({ error: 'Podaj numer telefonu' }, { status: 400 });
      let phone: string;
      try { phone = normalizePhone(body.phone); }
      catch { return Response.json({ error: 'Nieprawidłowy numer telefonu' }, { status: 400 }); }

      const existing = await ctx.env.DB.prepare(
        'SELECT id, active FROM subscribers WHERE phone = ?'
      ).bind(phone).first<{ id: string; active: number }>();
      if (existing) {
        if (existing.active === 0) {
          await ctx.env.DB.prepare(
            'UPDATE subscribers SET active = 1, name = COALESCE(?, name), email = COALESCE(?, email) WHERE id = ?'
          ).bind(body.name || null, body.email || null, existing.id).run();
          return Response.json({ ok: true, id: existing.id, reactivated: true });
        }
        return Response.json({ error: 'Numer już na liście' }, { status: 409 });
      }
      const id = crypto.randomUUID();
      await ctx.env.DB.prepare(
        `INSERT INTO subscribers (id, phone, name, email, source, active) VALUES (?, ?, ?, ?, 'manual', 1)`
      ).bind(id, phone, body.name || null, body.email || null).run();
      return Response.json({ ok: true, id });
    }

    case 'send_blast': {
      if (!body.message) return Response.json({ error: 'Podaj treść SMS' }, { status: 400 });

      const { results } = await ctx.env.DB.prepare(
        'SELECT phone FROM subscribers WHERE active = 1'
      ).all<{ phone: string }>();

      let sent = 0;
      let failed = 0;
      for (const sub of results) {
        try {
          await sendSms(ctx.env, sub.phone, body.message);
          sent++;
        } catch {
          failed++;
        }
      }
      return Response.json({ ok: true, sent, failed, total: results.length });
    }

    case 'remove': {
      if (!body.id) return Response.json({ error: 'Brak id' }, { status: 400 });
      await ctx.env.DB.prepare('UPDATE subscribers SET active = 0 WHERE id = ?').bind(body.id).run();
      return Response.json({ ok: true });
    }

    default:
      return Response.json({ error: 'Nieznana akcja' }, { status: 400 });
  }
};
