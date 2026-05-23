// GET /api/admin/flight-media/file/[id]?t=ADMIN_TOKEN
// Admin-only file proxy used by the Lot Media tab's thumbnail grid. Token is
// passed as ?t= because an <img src> can't send an Authorization header.
// Mirrors functions/api/admin/gallery-submissions/file/[id].ts.

import { type Env } from '../../../../../src/lib/types';
import { checkAdminAuth } from '../../../../../src/lib/admin-auth';

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);
  const tokenFromQuery = url.searchParams.get('t');
  const reqForAuth = tokenFromQuery
    ? new Request(ctx.request, { headers: { Authorization: `Bearer ${tokenFromQuery}` } })
    : ctx.request;
  if (!checkAdminAuth(reqForAuth, ctx.env)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const id = parseInt(String(ctx.params.id || ''), 10);
  if (!id) return new Response('Not found', { status: 404 });

  const row = await ctx.env.DB.prepare(
    `SELECT r2_key, content_type FROM flight_media WHERE id = ?`,
  ).bind(id).first<{ r2_key: string; content_type: string }>();
  if (!row) return new Response('Not found', { status: 404 });

  const obj = await ctx.env.VOUCHER_BUCKET.get(row.r2_key);
  if (!obj) return new Response('Not found', { status: 404 });

  return new Response(obj.body, {
    headers: {
      'content-type': row.content_type || obj.httpMetadata?.contentType || 'application/octet-stream',
      'cache-control': 'private, max-age=300',
    },
  });
};
