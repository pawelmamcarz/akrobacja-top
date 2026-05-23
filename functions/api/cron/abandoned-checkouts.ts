// Abandoned checkout recovery, wysyła mail z kodem rabatowym do osób,
// które rozpoczęły checkout >1h temu, <48h temu, nie zapłaciły i nie dostały jeszcze maila.
//
// Cron: wywoływać co 1-2 godziny (zewnętrzny scheduler, GH Actions, cron-job.org).
// Minimalne okno 1h od startu checkoutu daje użytkownikowi realistyczny czas
// na dokończenie sam (ktoś mógł pójść po kartę). Max 48h bo dalej to zimny lead.

import { type Env, PACKAGES, type PackageId } from '../../../src/lib/types';
import { recordFailedDelivery } from '../../../src/lib/audit';
import { buildRecoveryEmail, sendRecoveryEmail } from '../../../src/lib/abandoned-recovery';

interface AbandonedRow {
  id: string;
  customer_name: string;
  customer_email: string;
  package_id: string;
  amount: number;
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const expected = ctx.env.CRON_SECRET;
  if (!expected) {
    return Response.json({ error: 'Cron not configured' }, { status: 500 });
  }
  const auth = ctx.request.headers.get('Authorization') || '';
  if (auth !== `Bearer ${expected}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: Array<{ order: string; email: string; status: string }> = [];

  try {
    // Candidates: pending, >1h old, <48h old, no email sent yet
    const rows = await ctx.env.DB.prepare(`
      SELECT id, customer_name, customer_email, package_id, amount
      FROM orders
      WHERE status = 'pending'
        AND abandon_email_sent_at IS NULL
        AND created_at <= datetime('now', '-1 hour')
        AND created_at >= datetime('now', '-48 hours')
        AND customer_email IS NOT NULL
        AND customer_email != ''
      LIMIT 50
    `).all<AbandonedRow>();

    if (!rows.results || rows.results.length === 0) {
      return Response.json({ ok: true, processed: 0, timestamp: new Date().toISOString() });
    }

    for (const row of rows.results) {
      const pkg = PACKAGES[row.package_id as PackageId];
      if (!pkg) {
        results.push({ order: row.id, email: row.customer_email, status: `skipped: unknown package ${row.package_id}` });
        continue;
      }

      // Claim the row BEFORE sending the email — two overlapping cron runs would otherwise
      // both pass the abandon_email_sent_at IS NULL filter above and double-send.
      const claim = await ctx.env.DB.prepare(
        `UPDATE orders SET abandon_email_sent_at = datetime('now')
         WHERE id = ? AND abandon_email_sent_at IS NULL`
      ).bind(row.id).run();
      if (claim.meta.changes === 0) {
        results.push({ order: row.id, email: row.customer_email, status: 'skipped: already_claimed' });
        continue;
      }

      try {
        const html = buildRecoveryEmail({
          customerName: row.customer_name,
          packageId: row.package_id as PackageId,
          amountGrosze: row.amount,
        });
        await sendRecoveryEmail(
          ctx.env,
          row.customer_email,
          `${row.customer_name?.split(/\s+/)[0] || 'Cześć'}, dokończ zakup ze zniżką 5% (48h)`,
          html,
        );
        results.push({ order: row.id, email: row.customer_email, status: 'sent' });
      } catch (err) {
        const e = err as Error & { permanent?: boolean };
        // For transient (non-permanent) failures we release the claim so the next run can retry.
        if (!e.permanent) {
          await ctx.env.DB.prepare(
            `UPDATE orders SET abandon_email_sent_at = NULL WHERE id = ?`
          ).bind(row.id).run();
        }
        results.push({
          order: row.id,
          email: row.customer_email,
          status: `${e.permanent ? 'permanent_fail' : 'error'}: ${e.message || 'unknown'}`,
        });
        await recordFailedDelivery(ctx.env, {
          channel: 'abandoned_email', refId: row.id, recipient: row.customer_email, error: err,
        });
      }
    }

    return Response.json({
      ok: true,
      processed: results.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error', results },
      { status: 500 },
    );
  }
};

export const onRequestPost = onRequestGet;
