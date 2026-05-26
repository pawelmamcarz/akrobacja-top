// CRUD whitelist NIPow ktorych faktury KSeF automatycznie zaciagamy do expenses.
// Wykorzystywane przez cron sync-ksef-invoices (do napisania).

import { type Env } from '../../../src/lib/types';
import { checkAdminAuthAsync } from '../../../src/lib/admin-auth';

interface Body {
  action?: 'create' | 'update' | 'delete' | 'toggle';
  nip?: string;
  name?: string;
  label?: string;
  active?: boolean;
}

function normalizeNip(s: string): string {
  return s.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (!(await checkAdminAuthAsync(ctx.request, ctx.env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { results } = await ctx.env.DB.prepare(
    'SELECT nip, name, label, active, created_at FROM ksef_whitelist ORDER BY active DESC, name'
  ).all();
  return Response.json({ whitelist: results });
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!(await checkAdminAuthAsync(ctx.request, ctx.env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = (await ctx.request.json().catch(() => null)) as Body | null;
  if (!body) return Response.json({ error: 'Brak body' }, { status: 400 });

  switch (body.action) {
    case 'create': {
      if (!body.nip || !body.name) return Response.json({ error: 'nip i name wymagane' }, { status: 400 });
      const nip = normalizeNip(body.nip);
      if (!/^[0-9]{10}$/.test(nip)) {
        return Response.json({ error: 'NIP musi byc 10 cyfr (bez kresek)' }, { status: 400 });
      }
      try {
        await ctx.env.DB.prepare(
          'INSERT INTO ksef_whitelist (nip, name, label, active) VALUES (?, ?, ?, 1)'
        ).bind(nip, body.name, body.label || null).run();
        return Response.json({ ok: true, nip });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.toLowerCase().includes('unique')) {
          return Response.json({ error: 'NIP juz na whitelist' }, { status: 409 });
        }
        throw e;
      }
    }
    case 'update': {
      if (!body.nip) return Response.json({ error: 'nip wymagany' }, { status: 400 });
      const nip = normalizeNip(body.nip);
      await ctx.env.DB.prepare(
        'UPDATE ksef_whitelist SET name = COALESCE(?, name), label = COALESCE(?, label) WHERE nip = ?'
      ).bind(body.name || null, body.label || null, nip).run();
      return Response.json({ ok: true });
    }
    case 'toggle': {
      if (!body.nip) return Response.json({ error: 'nip wymagany' }, { status: 400 });
      const nip = normalizeNip(body.nip);
      const flag = body.active ? 1 : 0;
      await ctx.env.DB.prepare(
        'UPDATE ksef_whitelist SET active = ? WHERE nip = ?'
      ).bind(flag, nip).run();
      return Response.json({ ok: true, active: flag });
    }
    case 'delete': {
      if (!body.nip) return Response.json({ error: 'nip wymagany' }, { status: 400 });
      const nip = normalizeNip(body.nip);
      await ctx.env.DB.prepare('DELETE FROM ksef_whitelist WHERE nip = ?').bind(nip).run();
      return Response.json({ ok: true });
    }
    default:
      return Response.json({ error: 'Nieznana akcja' }, { status: 400 });
  }
};
