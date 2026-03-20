import { type Env } from '../../src/lib/types';
import { normalizePhone } from '../../src/lib/phone';

// POST /api/subscribe { phone, name, source }
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const { phone, name, source } = (await ctx.request.json()) as { phone: string; name?: string; source?: string };

    if (!phone || phone.replace(/\D/g, '').length < 9) {
      return Response.json({ error: 'Podaj prawidłowy numer telefonu' }, { status: 400 });
    }

    const normalized = normalizePhone(phone);

    // Check if already subscribed
    const existing = await ctx.env.DB.prepare(
      'SELECT id, active FROM subscribers WHERE phone = ?'
    ).bind(normalized).first<{ id: string; active: number }>();

    if (existing) {
      if (existing.active) {
        return Response.json({ ok: true, message: 'Już jesteś na liście!' });
      }
      // Reactivate
      await ctx.env.DB.prepare('UPDATE subscribers SET active = 1 WHERE id = ?').bind(existing.id).run();
      return Response.json({ ok: true, message: 'Ponownie zapisany!' });
    }

    await ctx.env.DB.prepare(
      'INSERT INTO subscribers (id, phone, name, source) VALUES (?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), normalized, name || null, source || 'website').run();

    return Response.json({ ok: true, message: 'Zapisano! Będziemy informować o pokazach i nowościach.' });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Błąd' }, { status: 500 });
  }
};
