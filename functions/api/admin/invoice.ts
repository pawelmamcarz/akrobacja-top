import { type Env, type PackageId } from '../../../src/lib/types';
import { createInvoice } from '../../../src/lib/wfirma';
import { checkAdminAuth } from '../../../src/lib/admin-auth';

// POST /api/admin/invoice { voucher_code }
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!checkAdminAuth(ctx.request, ctx.env)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await ctx.request.json()) as { voucher_code: string };
  if (!body.voucher_code) {
    return Response.json({ error: 'Brak kodu vouchera' }, { status: 400 });
  }

  const order = await ctx.env.DB.prepare(
    'SELECT * FROM orders WHERE voucher_code = ?'
  ).bind(body.voucher_code).first<Record<string, unknown>>();

  if (!order) return Response.json({ error: 'Voucher nie znaleziony' }, { status: 404 });
  if (order.status !== 'paid') return Response.json({ error: 'Voucher nie jest opłacony' }, { status: 400 });
  if (order.invoice_id) return Response.json({ error: `Faktura już istnieje: ${order.invoice_id}` }, { status: 400 });

  try {
    const invoiceId = await createInvoice(ctx.env, {
      customerName: order.customer_name as string,
      customerEmail: order.customer_email as string,
      customerNip: order.customer_nip as string | undefined,
      packageId: order.package_id as PackageId,
      videoAddon: order.video_addon === 1,
      voucherCode: body.voucher_code,
      amount: order.amount as number,
      discountCode: (order.discount_code as string | null) ?? null,
    });

    await ctx.env.DB.prepare(
      'UPDATE orders SET invoice_id = ? WHERE id = ?'
    ).bind(invoiceId, order.id).run();

    return Response.json({ ok: true, invoice_id: invoiceId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: msg }, { status: 500 });
  }
};
