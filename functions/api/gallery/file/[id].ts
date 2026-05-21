// GET /api/gallery/file/[id] — stream the R2 object for one approved submission.
// Only approved rows are served; pending/rejected return 404 to keep moderation private.

import { type Env } from '../../../../src/lib/types';

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const id = parseInt(String(ctx.params.id || ''), 10);
  if (!id) return new Response('Not found', { status: 404 });

  const row = await ctx.env.DB.prepare(
    `SELECT r2_key FROM gallery_submissions WHERE id = ? AND status = 'approved'`,
  ).bind(id).first<{ r2_key: string }>();
  if (!row) return new Response('Not found', { status: 404 });

  const obj = await ctx.env.VOUCHER_BUCKET.get(row.r2_key);
  if (!obj) return new Response('Not found', { status: 404 });

  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType || 'image/jpeg',
      'cache-control': 'public, max-age=31536000, immutable',
      'etag': obj.httpEtag,
    },
  });
};
