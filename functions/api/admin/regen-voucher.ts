import { type Env, type PackageId, PACKAGES } from '../../../src/lib/types';
import { checkAdminAuthAsync } from '../../../src/lib/admin-auth';
import { generateVoucherPdf } from '../../../src/lib/pdf';

// POST /api/admin/regen-voucher  { voucher_code }
// Regenerates the voucher PDF from current orders row state and overwrites the
// R2 object at vouchers/{code}.pdf. Use after manual edits to package_id /
// amount / dedication / recipient_name etc. when the customer needs an updated PDF.
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!(await checkAdminAuthAsync(ctx.request, ctx.env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await ctx.request.json().catch(() => null) as { voucher_code?: string } | null;
  const voucherCode = (body?.voucher_code || '').trim().toUpperCase();
  if (!voucherCode) return Response.json({ error: 'voucher_code wymagany' }, { status: 400 });

  const order = await ctx.env.DB.prepare(
    `SELECT voucher_code, package_id, video_addon, customer_name, expires_at,
            recipient_name, dedication
       FROM orders WHERE voucher_code = ?`,
  ).bind(voucherCode).first<{
    voucher_code: string;
    package_id: string;
    video_addon: number;
    customer_name: string;
    expires_at: string;
    recipient_name: string | null;
    dedication: string | null;
  }>();
  if (!order) return Response.json({ error: 'Nie znaleziono zamówienia' }, { status: 404 });

  if (!PACKAGES[order.package_id as PackageId]) {
    return Response.json({ error: `Niepoprawny package_id: ${order.package_id}` }, { status: 400 });
  }

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await generateVoucherPdf({
      voucherCode: order.voucher_code,
      packageId: order.package_id as PackageId,
      customerName: order.customer_name,
      videoAddon: order.video_addon === 1,
      expiresAt: order.expires_at,
      recipientName: order.recipient_name,
      dedication: order.dedication,
    });
  } catch (err) {
    return Response.json({ error: 'PDF generation failed: ' + (err instanceof Error ? err.message : 'unknown') }, { status: 500 });
  }

  try {
    await ctx.env.VOUCHER_BUCKET.put(`vouchers/${order.voucher_code}.pdf`, pdfBytes, {
      httpMetadata: { contentType: 'application/pdf' },
    });
  } catch (err) {
    return Response.json({ error: 'R2 upload failed: ' + (err instanceof Error ? err.message : 'unknown') }, { status: 500 });
  }

  return Response.json({
    ok: true,
    voucher_code: order.voucher_code,
    package_id: order.package_id,
    bytes: pdfBytes.byteLength,
    download_url: `${ctx.env.SITE_URL || 'https://akrobacja.com'}/api/voucher/${order.voucher_code}`,
  });
};
