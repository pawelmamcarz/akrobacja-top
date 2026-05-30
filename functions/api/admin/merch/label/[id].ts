// GET /api/admin/merch/label/[id][?t=<token>]
// Serwuje PDF etykiety kuriera (apaczka) z R2. Otwierane przez <a> w panelu (druk),
// więc token akceptujemy też z ?t=. Dostęp: zalogowany admin lub dostawca (supplier) -
// middleware przepuszcza /api/admin/merch/* dla obu ról.

import { type Env } from '../../../../../src/lib/types';
import { checkAdminAuthAsync } from '../../../../../src/lib/admin-auth';

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);
  const tokenFromQuery = url.searchParams.get('t');
  const reqForAuth = tokenFromQuery
    ? new Request(ctx.request, { headers: { Authorization: `Bearer ${tokenFromQuery}` } })
    : ctx.request;
  if (!(await checkAdminAuthAsync(reqForAuth, ctx.env))) {
    return new Response('Unauthorized', { status: 401 });
  }

  const id = String(ctx.params.id || '');
  if (!id) return new Response('Not found', { status: 404 });

  const row = await ctx.env.DB.prepare(
    'SELECT apaczka_label_r2_key AS k FROM merch_orders WHERE id = ?'
  ).bind(id).first<{ k: string | null }>();
  const r2Key = row?.k ?? null;
  if (!r2Key) return new Response('Not found', { status: 404 });

  const obj = await ctx.env.VOUCHER_BUCKET.get(r2Key);
  if (!obj) return new Response('Not found', { status: 404 });

  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType || 'application/pdf',
      'content-disposition': `inline; filename="etykieta-${id.slice(0, 8)}.pdf"`,
      'cache-control': 'private, max-age=300',
    },
  });
};
