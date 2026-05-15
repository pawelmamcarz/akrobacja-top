import { type Env } from '../../../src/lib/types';
import { rateLimit, clientIp } from '../../../src/lib/rate-limit';

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const code = ctx.params.code as string;

  // Validate code format BEFORE rate-limit so malformed URLs don't consume the budget
  // of a legit customer downloading their own voucher.
  if (!/^AKR-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
    return new Response('Nieprawidłowy kod vouchera', { status: 400 });
  }

  // Per-IP throttle: a legit customer downloads their own PDF maybe 2-3 times;
  // enumeration attempts will burn through the cap and get 429 within seconds.
  // 36^8 codes makes brute force infeasible by combinatorics anyway, but this caps
  // R2 GET + D1 read cost from any single host.
  const ip = clientIp(ctx.request);
  const rl = await rateLimit(ctx.env, `voucher-dl:${ip}`, 20, 60);
  if (!rl.ok) {
    return new Response('Zbyt wiele zapytań, spróbuj za chwilę', { status: 429 });
  }

  // Check if order exists and is paid
  const order = await ctx.env.DB.prepare(
    'SELECT status FROM orders WHERE voucher_code = ?'
  ).bind(code).first<{ status: string }>();

  if (!order || order.status !== 'paid') {
    return new Response('Voucher nie znaleziony', { status: 404 });
  }

  // Fetch PDF from R2
  const obj = await ctx.env.VOUCHER_BUCKET.get(`vouchers/${code}.pdf`);
  if (!obj) {
    return new Response('PDF nie znaleziony', { status: 404 });
  }

  return new Response(obj.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="voucher-${code}.pdf"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
};
