// GET /api/admin/aircraft/file/[id]?kind=doc|logbook[&t=<token>]
// Serwuje załącznik dokumentu (np. MS od CAMO) albo zdjęcie wpisu dziennika z R2.
// Otwierane przez <img>/<a> w panelu (bez nagłówka Authorization), więc token
// akceptujemy też z ?t=. Dostęp: każda zalogowana rola admina (w tym mechanik) -
// middleware przepuszcza /api/admin/aircraft/* dla mechanika.

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
  const kind = url.searchParams.get('kind') === 'logbook' ? 'logbook' : 'doc';

  let r2Key: string | null = null;
  if (kind === 'logbook') {
    const row = await ctx.env.DB.prepare('SELECT photo_r2_key AS k FROM flight_logbook WHERE id = ?').bind(id).first<{ k: string | null }>();
    r2Key = row?.k ?? null;
  } else {
    const row = await ctx.env.DB.prepare('SELECT r2_key AS k FROM documents WHERE id = ?').bind(id).first<{ k: string | null }>();
    r2Key = row?.k ?? null;
  }
  if (!r2Key) return new Response('Not found', { status: 404 });

  const obj = await ctx.env.VOUCHER_BUCKET.get(r2Key);
  if (!obj) return new Response('Not found', { status: 404 });

  return new Response(obj.body, {
    headers: {
      'content-type': obj.httpMetadata?.contentType || 'application/octet-stream',
      'cache-control': 'private, max-age=300',
    },
  });
};
