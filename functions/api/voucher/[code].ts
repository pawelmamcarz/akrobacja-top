import { type Env } from '../../../src/lib/types';

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const code = ctx.params.code as string;

  // Validate code format
  if (!/^AKR-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
    return new Response('Nieprawidłowy kod vouchera', { status: 400 });
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
