import { type Env } from '../../src/lib/types';
import { escapeHtml } from '../../src/lib/email';
import { isValidEmail } from '../../src/lib/validate';
import { rateLimit, clientIp } from '../../src/lib/rate-limit';
import { sendLeadMagnetEmail } from '../../src/lib/lead-magnet';
import { recordFailedDelivery } from '../../src/lib/audit';

async function notifyOwner(env: Env, email: string, name: string | null, source: string): Promise<void> {
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'akrobacja.com <system@akrobacja.com>',
        to: ['info@akrobacja.com'],
        tags: [{ name: 'type', value: 'lead-magnet-notify' }],
        subject: `Nowy lead (kurs mailowy): ${email}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto">
            <h2 style="color:#0A2F7C;margin:0 0 16px">Nowy lead - kurs mailowy</h2>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px 0;color:#6B7A90;border-bottom:1px solid #eee">Email</td><td style="padding:8px 0;font-weight:600;border-bottom:1px solid #eee;text-align:right"><a href="mailto:${encodeURIComponent(email)}">${escapeHtml(email)}</a></td></tr>
              ${name ? `<tr><td style="padding:8px 0;color:#6B7A90;border-bottom:1px solid #eee">Imię</td><td style="padding:8px 0;font-weight:600;border-bottom:1px solid #eee;text-align:right">${escapeHtml(name)}</td></tr>` : ''}
              <tr><td style="padding:8px 0;color:#6B7A90;border-bottom:1px solid #eee">Źródło</td><td style="padding:8px 0;font-weight:600;border-bottom:1px solid #eee;text-align:right">${escapeHtml(source)}</td></tr>
              <tr><td style="padding:8px 0;color:#6B7A90">Data</td><td style="padding:8px 0;font-weight:600;text-align:right">${new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })}</td></tr>
            </table>
          </div>`,
      }),
    });
  } catch (err) {
    console.error('lead-magnet notifyOwner failed:', err);
  }
}

// POST /api/lead-magnet
// Body: { email, name?, source?, utm_source?, utm_medium?, utm_campaign? }
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const ip = clientIp(ctx.request);
    const rl = await rateLimit(ctx.env, `lead-magnet:${ip}`, 5, 3600);
    if (!rl.ok) {
      return Response.json({ error: 'Zbyt wiele zapytań, spróbuj za chwilę' }, { status: 429 });
    }

    const body = (await ctx.request.json()) as {
      email?: string;
      name?: string;
      source?: string;
      utm_source?: string;
      utm_medium?: string;
      utm_campaign?: string;
    };

    const email = body.email?.trim().toLowerCase();
    if (!email || !isValidEmail(email)) {
      return Response.json({ error: 'Podaj prawidłowy adres email' }, { status: 400 });
    }

    const name = body.name?.trim().slice(0, 80) || null;
    const source = (body.source || 'lead_magnet_v1').slice(0, 40);
    const userAgent = ctx.request.headers.get('User-Agent')?.slice(0, 200) || null;

    const existing = await ctx.env.DB.prepare(
      'SELECT id, active FROM email_leads WHERE email = ?'
    ).bind(email).first<{ id: string; active: number }>();

    let leadId: string;
    let isNew = false;

    if (existing) {
      leadId = existing.id;
      if (existing.active) {
        return Response.json({ ok: true, already: true, message: 'Jesteś już na liście - sprawdź pocztę' });
      }
      // Reactivate
      await ctx.env.DB.prepare('UPDATE email_leads SET active = 1, name = COALESCE(?, name) WHERE id = ?')
        .bind(name, existing.id).run();
    } else {
      leadId = crypto.randomUUID();
      isNew = true;
      await ctx.env.DB.prepare(
        `INSERT INTO email_leads (id, email, source, name, utm_source, utm_medium, utm_campaign, ip, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        leadId, email, source, name,
        body.utm_source?.slice(0, 40) || null,
        body.utm_medium?.slice(0, 40) || null,
        body.utm_campaign?.slice(0, 80) || null,
        ip, userAgent,
      ).run();
    }

    // Krok 0 (welcome) - wyslij od razu. Pozostale (2, 4, 7, 14) wysle cron.
    ctx.waitUntil((async () => {
      try {
        await sendLeadMagnetEmail(ctx.env, { to: email, name, step: 0 });
        await ctx.env.DB.prepare(
          `INSERT OR IGNORE INTO lead_emails_sent (id, lead_id, step) VALUES (?, ?, 0)`
        ).bind(crypto.randomUUID(), leadId).run();
      } catch (err) {
        console.error('lead-magnet step 0 failed:', err);
        await recordFailedDelivery(ctx.env, {
          channel: 'lead_magnet_email', refId: leadId, recipient: email, error: err,
        });
      }
    })());

    if (isNew) {
      ctx.waitUntil(notifyOwner(ctx.env, email, name, source));
    }

    return Response.json({ ok: true, message: 'Sprawdź pocztę - pierwszy mail leci do Ciebie' });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Błąd' }, { status: 500 });
  }
};
