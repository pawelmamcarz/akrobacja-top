import { type Env } from '../../../src/lib/types';

function checkAuth(request: Request, env: Env): boolean {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  return auth.slice(7) === (env.ADMIN_PASSWORD || '').replace(/\s/g, '');
}

// GET /api/admin/orders — list all orders
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (!checkAuth(ctx.request, ctx.env)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { results } = await ctx.env.DB.prepare(`
    SELECT id, voucher_code, package_id, video_addon, customer_name, customer_email,
           customer_nip, amount, status, invoice_id, created_at, paid_at, expires_at, redeemed_at
    FROM orders
    ORDER BY created_at DESC
    LIMIT 100
  `).all();

  return Response.json({ orders: results });
};
