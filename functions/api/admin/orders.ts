import { type Env } from '../../../src/lib/types';
import { checkAdminAuth } from '../../../src/lib/admin-auth';

// GET /api/admin/orders — list all orders
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (!checkAdminAuth(ctx.request, ctx.env)) {
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
