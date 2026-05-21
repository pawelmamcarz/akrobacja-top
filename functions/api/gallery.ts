// GET /api/gallery — public list of approved photographer submissions
// for /galeria. Returns lightweight JSON; the actual image content streams from
// /api/gallery/file/{id} (which proxies the R2 object).

import { type Env } from '../../src/lib/types';
import { rateLimit, clientIp } from '../../src/lib/rate-limit';

interface Row {
  id: number;
  width: number;
  height: number;
  photographer_name: string;
  photographer_instagram: string | null;
  caption: string | null;
  approved_at: number | null;
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const rl = await rateLimit(ctx.env, `gallery:${clientIp(ctx.request)}`, 60, 60);
  if (!rl.ok) {
    return Response.json({ error: 'Zbyt wiele zapytań' }, { status: 429 });
  }

  const rows = await ctx.env.DB.prepare(
    `SELECT id, width, height, photographer_name, photographer_instagram, caption, approved_at
     FROM gallery_submissions
     WHERE status = 'approved'
     ORDER BY approved_at DESC, id DESC
     LIMIT 60`,
  ).all<Row>();

  return new Response(JSON.stringify({ photos: rows.results || [] }), {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=60, stale-while-revalidate=300',
    },
  });
};
