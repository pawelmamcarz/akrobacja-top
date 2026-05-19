import { type Env } from '../../../src/lib/types';
import { sendLeadMagnetEmail, type LeadMagnetStep } from '../../../src/lib/lead-magnet';
import { recordFailedDelivery } from '../../../src/lib/audit';

// Cron-driven steps. Krok 0 wysyla endpoint /api/lead-magnet od razu — tutaj tylko nurture.
// delayDays = ile dni od email_leads.created_at zanim wysylac.
const NURTURE_STEPS: Array<{ step: LeadMagnetStep; delayDays: number }> = [
  { step: 2, delayDays: 2 },
  { step: 4, delayDays: 4 },
  { step: 7, delayDays: 7 },
  { step: 14, delayDays: 14 },
];

// Maximum age: nie ganiamy z mailami za leadami starszymi niz 30 dni
// (cron zaczynajacy chodzic po backfill historii spali budzet Resend).
const MAX_AGE_DAYS = 30;

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const expected = ctx.env.CRON_SECRET;
  if (!expected) {
    return Response.json({ error: 'Cron not configured' }, { status: 500 });
  }
  const auth = ctx.request.headers.get('Authorization') || '';
  if (auth !== `Bearer ${expected}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: Array<{ lead_id: string; email: string; step: number; status: string }> = [];

  try {
    for (const { step, delayDays } of NURTURE_STEPS) {
      const rows = await ctx.env.DB.prepare(`
        SELECT l.id, l.email, l.name
          FROM email_leads l
         WHERE l.active = 1
           AND l.created_at <= datetime('now', ?)
           AND l.created_at >= datetime('now', ?)
           AND NOT EXISTS (
             SELECT 1 FROM lead_emails_sent w
              WHERE w.lead_id = l.id AND w.step = ?
           )
      `).bind(`-${delayDays} days`, `-${MAX_AGE_DAYS} days`, step).all<{
        id: string; email: string; name: string | null;
      }>();

      if (!rows.results?.length) continue;

      for (const lead of rows.results) {
        try {
          await sendLeadMagnetEmail(ctx.env, { to: lead.email, name: lead.name, step });
          await ctx.env.DB.prepare(
            'INSERT OR IGNORE INTO lead_emails_sent (id, lead_id, step) VALUES (?, ?, ?)'
          ).bind(crypto.randomUUID(), lead.id, step).run();
          results.push({ lead_id: lead.id, email: lead.email, step, status: 'sent' });
        } catch (err) {
          results.push({
            lead_id: lead.id, email: lead.email, step,
            status: `error: ${err instanceof Error ? err.message : 'unknown'}`,
          });
          await recordFailedDelivery(ctx.env, {
            channel: 'lead_magnet_email', refId: lead.id, recipient: lead.email, error: err,
          });
        }
      }
    }

    return Response.json({ ok: true, processed: results.length, results, timestamp: new Date().toISOString() });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error', results },
      { status: 500 },
    );
  }
};

export const onRequestPost = onRequestGet;
