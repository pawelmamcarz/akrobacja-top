import { type Env } from '../../../src/lib/types';
import { checkAdminAuth } from '../../../src/lib/admin-auth';

// POST /api/admin/redeem { voucher_code }
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!checkAdminAuth(ctx.request, ctx.env)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await ctx.request.json()) as { voucher_code: string };
  if (!body.voucher_code) {
    return Response.json({ error: 'Brak kodu vouchera' }, { status: 400 });
  }

  // Atomic claim: only succeed if paid and not yet redeemed — prevents race.
  const res = await ctx.env.DB.prepare(
    "UPDATE orders SET redeemed_at = datetime('now') WHERE voucher_code = ? AND status = 'paid' AND redeemed_at IS NULL"
  ).bind(body.voucher_code).run();

  if (res.meta.changes === 1) {
    return Response.json({ ok: true, message: 'Voucher oznaczony jako wykorzystany' });
  }

  // Diagnose why we couldn't claim
  const order = await ctx.env.DB.prepare(
    'SELECT status, redeemed_at FROM orders WHERE voucher_code = ?'
  ).bind(body.voucher_code).first<{ status: string; redeemed_at: string | null }>();

  if (!order) return Response.json({ error: 'Voucher nie znaleziony' }, { status: 404 });
  if (order.status !== 'paid') return Response.json({ error: 'Voucher nie jest opłacony' }, { status: 400 });
  if (order.redeemed_at) return Response.json({ error: `Voucher już wykorzystany: ${order.redeemed_at}` }, { status: 400 });
  return Response.json({ error: 'Nie udało się oznaczyć vouchera' }, { status: 500 });
};
