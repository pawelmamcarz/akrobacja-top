import { type Env } from '../../../src/lib/types';
import { checkAdminAuth } from '../../../src/lib/admin-auth';

// GET /api/admin/merch — list merch orders
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (!checkAdminAuth(ctx.request, ctx.env)) {
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
  if (!checkAdminAuth(ctx.request, ctx.env)) {
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

    case 'create_product': {
      if (!body.name || typeof body.price !== 'number') {
        return Response.json({ error: 'Podaj nazwę i cenę (w groszach)' }, { status: 400 });
      }
      const id = (body.id as string) || crypto.randomUUID();
      const slug = (body.slug as string) || String(body.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const variants = body.variants ? String(body.variants) : '[]';
      try { JSON.parse(variants); } catch { return Response.json({ error: 'variants musi być JSON tablicą' }, { status: 400 }); }
      await ctx.env.DB.prepare(
        `INSERT INTO products (id, name, slug, category, description, price, image_url, variants, active, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
      ).bind(
        id,
        body.name,
        slug,
        body.category || null,
        body.description || null,
        body.price,
        body.image_url || null,
        variants,
        (body.sort_order as number) ?? 100,
      ).run();
      return Response.json({ ok: true, id, slug });
    }

    case 'toggle_product_active': {
      if (!body.id) return Response.json({ error: 'Podaj id produktu' }, { status: 400 });
      await ctx.env.DB.prepare(
        'UPDATE products SET active = CASE active WHEN 1 THEN 0 ELSE 1 END WHERE id = ?'
      ).bind(body.id).run();
      return Response.json({ ok: true });
    }

    case 'delete_product': {
      if (!body.id) return Response.json({ error: 'Podaj id produktu' }, { status: 400 });
      await ctx.env.DB.prepare('DELETE FROM products WHERE id = ?').bind(body.id).run();
      return Response.json({ ok: true });
    }

    default:
      return Response.json({ error: 'Nieznana akcja' }, { status: 400 });
  }
};
