// POST /api/admin/recover { voucher_code }
// Manual recovery email send — same template as cron/abandoned-checkouts but admin-triggered.
// Bypasses the 1-48h window and the abandon_email_sent_at debounce so admin can re-send
// at will (e.g. customer asked twice, or first cron attempt bounced). Order must still be
// status='pending' and have a customer_email.

import { type Env, type PackageId } from '../../../src/lib/types';
import { checkAdminAuth } from '../../../src/lib/admin-auth';
import { buildRecoveryEmail, sendRecoveryEmail } from '../../../src/lib/abandoned-recovery';
import { recordFailedDelivery } from '../../../src/lib/audit';

interface OrderRow {
  id: string;
  voucher_code: string;
  customer_name: string;
  customer_email: string;
  package_id: string;
  amount: number;
  status: string;
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!checkAdminAuth(ctx.request, ctx.env)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await ctx.request.json().catch(() => null) as { voucher_code?: string } | null;
  const code = body?.voucher_code?.trim();
  if (!code) return Response.json({ error: 'Brak voucher_code' }, { status: 400 });

  const row = await ctx.env.DB.prepare(
    `SELECT id, voucher_code, customer_name, customer_email, package_id, amount, status
     FROM orders WHERE voucher_code = ?`,
  ).bind(code).first<OrderRow>();
  if (!row) return Response.json({ error: 'Zamowienie nie znalezione' }, { status: 404 });
  if (row.status !== 'pending') {
    return Response.json({ error: `Recovery dostepny tylko dla pending (obecny status: ${row.status})` }, { status: 400 });
  }
  if (!row.customer_email) {
    return Response.json({ error: 'Brak adresu email klienta' }, { status: 400 });
  }

  try {
    const html = buildRecoveryEmail({
      customerName: row.customer_name,
      packageId: row.package_id as PackageId,
      amountGrosze: row.amount,
    });
    const firstName = row.customer_name?.split(/\s+/)[0] || 'Cześć';
    await sendRecoveryEmail(
      ctx.env,
      row.customer_email,
      `${firstName}, dokończ zakup ze zniżką 5% (48h)`,
      html,
    );
    await ctx.env.DB.prepare(
      `UPDATE orders SET abandon_email_sent_at = datetime('now') WHERE id = ?`,
    ).bind(row.id).run();
    return Response.json({ ok: true, sent_to: row.customer_email });
  } catch (err) {
    await recordFailedDelivery(ctx.env, {
      channel: 'abandoned_email', refId: row.id, recipient: row.customer_email, error: err,
    });
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: msg }, { status: 500 });
  }
};
