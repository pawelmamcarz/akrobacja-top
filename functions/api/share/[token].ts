// GET /api/share/[token]
// Public metadata for the /lot/[token] passenger page. Returns the list of media
// files for the voucher_code that the token resolves to, plus expiry info.
// Rate-limited so the token space can't be cheaply enumerated.
// Bumps view_count + last_viewed_at on each successful fetch (admin sees engagement).

import { type Env, PACKAGES, type PackageId } from '../../../src/lib/types';
import { rateLimit, clientIp } from '../../../src/lib/rate-limit';

interface ShareRow {
  voucher_code: string;
  expires_at: number;
}
interface OrderRow {
  customer_name: string;
  package_id: string;
  paid_at: string | null;
}
interface MediaRow {
  id: number;
  kind: string;
  filename: string;
  size: number;
  content_type: string;
  width: number | null;
  height: number | null;
  duration_sec: number | null;
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const ip = clientIp(ctx.request);
  const rl = await rateLimit(ctx.env, `share:${ip}`, 60, 60);
  if (!rl.ok) return Response.json({ error: 'rate-limited' }, { status: 429 });

  const token = String(ctx.params.token || '').trim();
  if (!token || !/^[a-f0-9]{32,}$/.test(token)) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }

  const share = await ctx.env.DB.prepare(
    `SELECT voucher_code, expires_at FROM flight_shares WHERE token = ?`,
  ).bind(token).first<ShareRow>();
  if (!share) return Response.json({ error: 'not_found' }, { status: 404 });

  const now = Math.floor(Date.now() / 1000);
  if (share.expires_at < now) {
    return Response.json({ error: 'expired', expires_at: share.expires_at }, { status: 410 });
  }

  const order = await ctx.env.DB.prepare(
    `SELECT customer_name, package_id, paid_at FROM orders WHERE voucher_code = ?`,
  ).bind(share.voucher_code).first<OrderRow>();

  const media = await ctx.env.DB.prepare(
    `SELECT id, kind, filename, size, content_type, width, height, duration_sec
     FROM flight_media WHERE voucher_code = ? ORDER BY kind ASC, id ASC`,
  ).bind(share.voucher_code).all<MediaRow>();

  ctx.waitUntil(ctx.env.DB.prepare(
    `UPDATE flight_shares SET view_count = view_count + 1, last_viewed_at = ? WHERE token = ?`,
  ).bind(now, token).run());

  const pkg = order?.package_id ? PACKAGES[order.package_id as PackageId] : null;

  return Response.json({
    expires_at: share.expires_at,
    customer_name: order?.customer_name || null,
    package_name: pkg?.name || null,
    flight_date: order?.paid_at || null,
    media: media.results || [],
  });
};
