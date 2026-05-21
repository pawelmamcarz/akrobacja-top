// GET /api/admin/gallery-submissions/file/[id]
// Admin-only file proxy — serves submissions regardless of status so the moderation
// UI can preview pending/rejected entries. Public /api/gallery/file/[id] only serves
// 'approved' rows.

import { type Env } from '../../../../../src/lib/types';
import { checkAdminAuth } from '../../../../../src/lib/admin-auth';

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  // Admin endpoint is opened by an <img src> in the admin UI which can't send
  // an Authorization header. Accept the token via ?t= query param as well.
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
    `SELECT r2_key FROM gallery_submissions WHERE id = ?`,
  ).bind(id).first<{ r2_key: string }>();
  if (!row) return new Response('Not found', { status: 404 });

  const obj = await ctx.env.VOUCHER_BUCKET.get(row.r2_key);
  if (!obj) return new Response('Not found', { status: 404 });

  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType || 'image/jpeg',
      'cache-control': 'private, max-age=300',
    },
  });
};
