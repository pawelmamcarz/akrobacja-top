import { type Env } from '../../src/lib/types';
import { normalizePhone } from '../../src/lib/phone';
import { escapeHtml } from '../../src/lib/email';

// Notify owner about new subscriber via Resend
async function notifyOwner(env: Env, phone: string, name: string | null, source: string): Promise<void> {
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'akrobacja.com <system@akrobacja.com>',
        to: ['dto@akrobacja.com'],
        subject: `📲 Nowy subskrybent: ${phone}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto">
            <h2 style="color:#0A2F7C;margin:0 0 16px">Nowy subskrybent SMS</h2>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px 0;color:#6B7A90;border-bottom:1px solid #eee">Telefon</td><td style="padding:8px 0;font-weight:600;border-bottom:1px solid #eee;text-align:right"><a href="tel:${escapeHtml(phone)}">${escapeHtml(phone)}</a></td></tr>
              ${name ? `<tr><td style="padding:8px 0;color:#6B7A90;border-bottom:1px solid #eee">Imię</td><td style="padding:8px 0;font-weight:600;border-bottom:1px solid #eee;text-align:right">${escapeHtml(name)}</td></tr>` : ''}
              <tr><td style="padding:8px 0;color:#6B7A90;border-bottom:1px solid #eee">Źródło</td><td style="padding:8px 0;font-weight:600;border-bottom:1px solid #eee;text-align:right">${escapeHtml(source)}</td></tr>
              <tr><td style="padding:8px 0;color:#6B7A90">Data</td><td style="padding:8px 0;font-weight:600;text-align:right">${new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })}</td></tr>
            </table>
            <p style="color:#6B7A90;font-size:12px;margin-top:16px">
              <a href="https://akrobacja.com/admin" style="color:#0A2F7C">Panel admina</a> · Lista subskrybentów
            </p>
          </div>`,
      }),
    });
  } catch {
    // Non-critical — don't fail the subscription if notification fails
  }
}

// POST /api/subscribe { phone, name, source }
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const { phone, name, source, email } = (await ctx.request.json()) as { phone: string; name?: string; source?: string; email?: string };

    if (!phone || phone.replace(/\D/g, '').length < 9) {
      return Response.json({ error: 'Podaj prawidłowy numer telefonu' }, { status: 400 });
    }

    const normalized = normalizePhone(phone);
    const srcLabel = source || 'website';

    // Check if already subscribed
    const existing = await ctx.env.DB.prepare(
      'SELECT id, active FROM subscribers WHERE phone = ?'
    ).bind(normalized).first<{ id: string; active: number }>();

    if (existing) {
      if (existing.active) {
        // Update email if provided and not yet stored
        if (email) {
          await ctx.env.DB.prepare('UPDATE subscribers SET email = ? WHERE id = ? AND (email IS NULL OR email = ?)').bind(email, existing.id, '').run();
        }
        return Response.json({ ok: true, message: 'Już jesteś na liście!' });
      }
      // Reactivate
      await ctx.env.DB.prepare('UPDATE subscribers SET active = 1, email = COALESCE(?, email) WHERE id = ?').bind(email || null, existing.id).run();
      ctx.waitUntil(notifyOwner(ctx.env, normalized, name || null, srcLabel + ' (reactivated)'));
      return Response.json({ ok: true, message: 'Ponownie zapisany!' });
    }

    await ctx.env.DB.prepare(
      'INSERT INTO subscribers (id, phone, name, source, email) VALUES (?, ?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), normalized, name || null, srcLabel, email || null).run();

    // Notify owner in background (non-blocking)
    ctx.waitUntil(notifyOwner(ctx.env, normalized, name || null, srcLabel));

    return Response.json({ ok: true, message: 'Zapisano! Będziemy informować o pokazach i nowościach.' });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Błąd' }, { status: 500 });
  }
};
