import { type Env } from '../../../src/lib/types';

function checkAuth(request: Request, env: Env): boolean {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  return auth.slice(7) === (env.ADMIN_PASSWORD || '').replace(/\s/g, '');
}

// POST /api/admin/redeem { voucher_code }
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!checkAuth(ctx.request, ctx.env)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await ctx.request.json()) as { voucher_code: string };
  if (!body.voucher_code) {
    return Response.json({ error: 'Brak kodu vouchera' }, { status: 400 });
  }

  const order = await ctx.env.DB.prepare(
    'SELECT id, status, redeemed_at FROM orders WHERE voucher_code = ?'
  ).bind(body.voucher_code).first<{ id: string; status: string; redeemed_at: string | null }>();

  if (!order) return Response.json({ error: 'Voucher nie znaleziony' }, { status: 404 });
  if (order.status !== 'paid') return Response.json({ error: 'Voucher nie jest opłacony' }, { status: 400 });
  if (order.redeemed_at) return Response.json({ error: `Voucher już wykorzystany: ${order.redeemed_at}` }, { status: 400 });

  await ctx.env.DB.prepare(
    'UPDATE orders SET redeemed_at = datetime(\'now\') WHERE id = ?'
  ).bind(order.id).run();

  return Response.json({ ok: true, message: 'Voucher oznaczony jako wykorzystany' });
};
