// GET /api/share/[token]/file/[id]
// Streams a flight_media R2 object to the passenger. Validates that the token
// resolves to the same voucher_code as the media row and that the share has
// not expired. Supports HTTP Range requests so HTML5 <video> seeking works.

import { type Env } from '../../../../../src/lib/types';
import { rateLimit, clientIp } from '../../../../../src/lib/rate-limit';

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const ip = clientIp(ctx.request);
  const rl = await rateLimit(ctx.env, `share-file:${ip}`, 120, 60);
  if (!rl.ok) return new Response('rate-limited', { status: 429 });

  const token = String(ctx.params.token || '').trim();
  const mediaId = parseInt(String(ctx.params.id || ''), 10);
  if (!token || !mediaId) return new Response('not_found', { status: 404 });

  const share = await ctx.env.DB.prepare(
    `SELECT voucher_code, expires_at FROM flight_shares WHERE token = ?`,
  ).bind(token).first<{ voucher_code: string; expires_at: number }>();
  if (!share) return new Response('not_found', { status: 404 });
  if (share.expires_at < Math.floor(Date.now() / 1000)) {
    return new Response('expired', { status: 410 });
  }

  const media = await ctx.env.DB.prepare(
    `SELECT r2_key, content_type, filename FROM flight_media WHERE id = ? AND voucher_code = ?`,
  ).bind(mediaId, share.voucher_code).first<{ r2_key: string; content_type: string; filename: string }>();
  if (!media) return new Response('not_found', { status: 404 });

  const range = ctx.request.headers.get('range');
  const r2Options: R2GetOptions = {};
  if (range) {
    const m = /bytes=(\d+)-(\d*)/.exec(range);
    if (m) {
      const offset = parseInt(m[1], 10);
      const end = m[2] ? parseInt(m[2], 10) : undefined;
      r2Options.range = end !== undefined
        ? { offset, length: end - offset + 1 }
        : { offset };
    }
  }

  const obj = await ctx.env.VOUCHER_BUCKET.get(media.r2_key, r2Options);
  if (!obj) return new Response('not_found', { status: 404 });

  const headers = new Headers({
    'content-type': media.content_type,
    'accept-ranges': 'bytes',
    'cache-control': 'private, max-age=3600',
    'etag': obj.httpEtag,
  });
  const dl = new URL(ctx.request.url).searchParams.get('dl');
  if (dl === '1') {
    headers.set('content-disposition', `attachment; filename="${encodeURIComponent(media.filename)}"`);
  }
  if (obj.range) {
    const start = (obj.range as { offset: number }).offset;
    const length = (obj.range as { length?: number }).length ?? (obj.size - start);
    const end = start + length - 1;
    headers.set('content-range', `bytes ${start}-${end}/${obj.size}`);
    headers.set('content-length', String(length));
    return new Response(obj.body, { status: 206, headers });
  }
  headers.set('content-length', String(obj.size));
  return new Response(obj.body, { status: 200, headers });
};
