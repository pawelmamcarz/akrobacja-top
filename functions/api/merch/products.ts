import { type Env } from '../../../src/lib/types';

// GET /api/merch/products — list all active products
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const { results } = await ctx.env.DB.prepare(
    'SELECT id, name, slug, category, description, price, variants, image_url FROM products WHERE active = 1 ORDER BY sort_order'
  ).all();

  // Parse variants JSON
  const products = results.map(p => ({
    ...p,
    variants: p.variants ? JSON.parse(p.variants as string) : [],
  }));

  return Response.json({ products });
};
