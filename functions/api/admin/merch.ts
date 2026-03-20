import { type Env } from '../../../src/lib/types';

function checkAuth(request: Request, env: Env): boolean {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  return auth.slice(7) === (env.ADMIN_PASSWORD || '').replace(/\s/g, '');
}

// GET /api/admin/merch — list merch orders
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (!checkAuth(ctx.request, ctx.env)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { results: orders } = await ctx.env.DB.prepare(
    'SELECT * FROM merch_orders ORDER BY created_at DESC LIMIT 100'
  ).all();

  const { results: products } = await ctx.env.DB.prepare(
    'SELECT * FROM products ORDER BY sort_order'
  ).all();

  return Response.json({ orders, products });
};

// POST /api/admin/merch — manage merch orders
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!checkAuth(ctx.request, ctx.env)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await ctx.request.json()) as Record<string, unknown>;

  switch (body.action) {
    case 'mark_paid': {
      await ctx.env.DB.prepare(
        "UPDATE merch_orders SET status = 'paid', paid_at = datetime('now') WHERE id = ?"
      ).bind(body.id).run();
      return Response.json({ ok: true });
    }
    case 'mark_shipped': {
      await ctx.env.DB.prepare(
        "UPDATE merch_orders SET status = 'shipped', shipped_at = datetime('now'), tracking_number = ? WHERE id = ?"
      ).bind(body.tracking || null, body.id).run();
      return Response.json({ ok: true });
    }
    case 'mark_completed': {
      await ctx.env.DB.prepare(
        "UPDATE merch_orders SET status = 'completed' WHERE id = ?"
      ).bind(body.id).run();
      return Response.json({ ok: true });
    }
    case 'cancel': {
      await ctx.env.DB.prepare(
        "UPDATE merch_orders SET status = 'cancelled' WHERE id = ?"
      ).bind(body.id).run();
      return Response.json({ ok: true });
    }
    default:
      return Response.json({ error: 'Nieznana akcja' }, { status: 400 });
  }
};
