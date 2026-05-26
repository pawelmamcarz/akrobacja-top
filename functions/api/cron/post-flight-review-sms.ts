// Post-flight review-request SMS.
//
// Once a day this cron finds bookings that flew within the last 7 days, haven't
// been pinged yet, and have a phone number on file. Sends a short ASCII SMS with
// a link to /opinia (which 301-redirects to the akrobacja.com Google Business
// Profile write-review page).
//
// Idempotency: review_request_sent_at is stamped on the row only AFTER SMSAPI
// confirms delivery. If SMSAPI fails, the row remains eligible for the next run.
//
// Rate limits: max 50 SMS per cron run to avoid blowing the SMSAPI burst budget.
// Tuned so the daily run handles all backlog within a day or two even after a
// gap in cron availability.
//
// Cron schedule: daily at 10:07 UTC (12:07 Warsaw summer / 11:07 winter). Avoids
// hitting customers too early - most flights end mid-afternoon, so day-after
// SMS feels like a polite reminder.

import { type Env } from '../../../src/lib/types';
import { sendSms } from '../../../src/lib/sms';
import { recordFailedDelivery } from '../../../src/lib/audit';

interface ReviewSmsCandidate {
  id: string;
  customer_name: string;
  customer_phone: string;
  slot_date: string;
  voucher_code: string | null;
}

// Strip Polish diacritics so a single SMS stays at the 160-character GSM-7 limit
// (with diacritics, SMSAPI segments at 70 chars and charges per segment).
function asciize(text: string): string {
  const map: Record<string, string> = {
    'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
    'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N', 'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z',
  };
  return text.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, ch => map[ch] || ch);
}

function firstName(full: string): string {
  return asciize((full || '').trim().split(/\s+/)[0] || 'Pilot');
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => runCron(ctx);
export const onRequestPost: PagesFunction<Env> = async (ctx) => runCron(ctx);

async function runCron(ctx: Parameters<PagesFunction<Env>>[0]): Promise<Response> {
  const expected = ctx.env.CRON_SECRET;
  if (!expected) {
    return Response.json({ error: 'Cron not configured' }, { status: 500 });
  }
  const auth = ctx.request.headers.get('Authorization') || '';
  if (auth !== `Bearer ${expected}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: Array<{ booking: string; phone: string; status: string }> = [];
  let sent = 0;
  let failed = 0;

  try {
    // Candidates: approved booking, slot date in [today-7, yesterday], phone on
    // file, not yet asked. JOIN slots to pull the actual flight date.
    const { results: rows } = await ctx.env.DB.prepare(`
      SELECT b.id, b.customer_name, b.customer_phone, b.voucher_code, s.date AS slot_date
        FROM bookings b
        JOIN slots s ON s.booking_id = b.id
       WHERE b.status = 'approved'
         AND b.customer_phone IS NOT NULL AND b.customer_phone != ''
         AND b.review_request_sent_at IS NULL
         AND date(s.date) >= date('now', '-7 days')
         AND date(s.date) <= date('now', '-1 day')
       ORDER BY s.date ASC
       LIMIT 50
    `).all<ReviewSmsCandidate>();

    if (!rows || rows.length === 0) {
      return Response.json({ ok: true, sent: 0, failed: 0, timestamp: new Date().toISOString() });
    }

    for (const row of rows) {
      // Claim before send - UPDATE returns changes=1 only on first run to dodge a
      // race where two cron invocations could overlap. If claim fails, skip.
      const claim = await ctx.env.DB.prepare(
        `UPDATE bookings SET review_request_sent_at = datetime('now')
          WHERE id = ? AND review_request_sent_at IS NULL`
      ).bind(row.id).run();
      if (claim.meta.changes === 0) {
        results.push({ booking: row.id, phone: row.customer_phone, status: 'skipped: already_claimed' });
        continue;
      }

      const message =
        `Czesc ${firstName(row.customer_name)}! ` +
        `Dzieki za lot z nami. 30 sek opinii na Google znaczy dla nas wiele: ` +
        `https://akrobacja.com/opinia ` +
        `- Maciej & Pawel`;

      try {
        await sendSms(ctx.env, row.customer_phone, message);
        sent++;
        results.push({ booking: row.id, phone: row.customer_phone, status: 'sent' });
      } catch (err) {
        // Release the claim so the next run can retry, unless the failure looks
        // structural (invalid phone format etc.) - heuristic on error text.
        const msg = err instanceof Error ? err.message : 'unknown';
        const permanent = /format|invalid|blacklist/i.test(msg);
        if (!permanent) {
          await ctx.env.DB.prepare(
            `UPDATE bookings SET review_request_sent_at = NULL WHERE id = ?`
          ).bind(row.id).run();
        }
        failed++;
        results.push({
          booking: row.id,
          phone: row.customer_phone,
          status: `${permanent ? 'permanent_fail' : 'error'}: ${msg}`,
        });
        await recordFailedDelivery(ctx.env, {
          channel: 'sms', refId: row.id, recipient: row.customer_phone, error: err,
        });
      }
    }

    return Response.json({
      ok: true,
      sent,
      failed,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error', sent, failed, results },
      { status: 500 },
    );
  }
}
