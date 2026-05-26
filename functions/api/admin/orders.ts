import { type Env, PACKAGES, type PackageId } from '../../../src/lib/types';
import { checkAdminAuthAsync, getAdminUserAsync } from '../../../src/lib/admin-auth';
import { generateVoucherCode } from '../../../src/lib/voucher-code';
import { generateVoucherPdf } from '../../../src/lib/pdf';
import { sendVoucherEmail } from '../../../src/lib/email';
import { isValidEmail } from '../../../src/lib/validate';
import { recordFailedDelivery } from '../../../src/lib/audit';

// GET /api/admin/orders - list all orders
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (!(await checkAdminAuthAsync(ctx.request, ctx.env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { results } = await ctx.env.DB.prepare(`
    SELECT id, voucher_code, package_id, video_addon, customer_name, customer_email,
           customer_nip, amount, status, invoice_id, created_at, paid_at, expires_at,
           redeemed_at, payment_method, abandon_email_sent_at
    FROM orders
    ORDER BY created_at DESC
    LIMIT 100
  `).all();

  return Response.json({ orders: results });
};

// POST /api/admin/orders - manually create a paid voucher (cash / bank transfer / free).
// Skips Stripe (no Stripe session) and wFirma (no sales invoice). Generates PDF,
// uploads to R2, optionally emails the customer with the voucher attached.
//
// Body: { package_id, customer_name, customer_email?, customer_phone?, amount?,
//         payment_method: 'cash'|'transfer'|'free', video_addon?, send_email?,
//         recipient_name?, dedication? }
type PaymentMethod = 'cash' | 'transfer' | 'free';
const VALID_PAYMENT_METHODS = new Set<PaymentMethod>(['cash', 'transfer', 'free']);

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getAdminUserAsync(ctx.request, ctx.env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await ctx.request.json().catch(() => null) as {
    package_id?: string;
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string;
    amount?: number;
    payment_method?: string;
    video_addon?: boolean;
    send_email?: boolean;
    recipient_name?: string;
    dedication?: string;
  } | null;
  if (!body) return Response.json({ error: 'Bad body' }, { status: 400 });

  const packageId = body.package_id as PackageId;
  if (!packageId || !PACKAGES[packageId]) {
    return Response.json({ error: 'package_id niepoprawne' }, { status: 400 });
  }
  const customerName = (body.customer_name || '').trim();
  if (!customerName) return Response.json({ error: 'customer_name wymagane' }, { status: 400 });
  if (customerName.length > 120) return Response.json({ error: 'customer_name za długie' }, { status: 400 });

  const paymentMethod = body.payment_method as PaymentMethod;
  if (!VALID_PAYMENT_METHODS.has(paymentMethod)) {
    return Response.json({ error: 'payment_method wymagane: cash | transfer | free' }, { status: 400 });
  }

  const customerEmail = (body.customer_email || '').trim();
  if (customerEmail && !isValidEmail(customerEmail)) {
    return Response.json({ error: 'Nieprawidłowy email' }, { status: 400 });
  }

  // Free vouchers always 0; otherwise default to package price, allow override (rabat/dopłata).
  const defaultAmount = PACKAGES[packageId].price;
  let amount: number;
  if (paymentMethod === 'free') {
    amount = 0;
  } else if (typeof body.amount === 'number' && Number.isFinite(body.amount) && body.amount >= 0) {
    amount = Math.round(body.amount);
  } else {
    amount = defaultAmount;
  }

  const videoAddon = body.video_addon === true;
  const sendEmail = body.send_email !== false && !!customerEmail;
  const recipientName = (body.recipient_name || '').trim().slice(0, 120) || null;
  const dedication = (body.dedication || '').trim().slice(0, 280) || null;

  // Generate voucher code, retry on collision (unique constraint on voucher_code).
  let voucherCode = '';
  for (let i = 0; i < 5; i++) {
    voucherCode = generateVoucherCode();
    const dup = await ctx.env.DB.prepare(
      'SELECT 1 FROM orders WHERE voucher_code = ?',
    ).bind(voucherCode).first();
    if (!dup) break;
    voucherCode = '';
  }
  if (!voucherCode) return Response.json({ error: 'Voucher code clash, spróbuj ponownie' }, { status: 500 });

  const orderId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const addonsJson = videoAddon ? JSON.stringify(['video']) : null;

  // Insert as 'paid' immediately - no Stripe handshake needed.
  // orders.customer_email is NOT NULL - fall back to empty string when admin
  // intentionally creates a voucher without one (cash sale, no contact data).
  // orders has no customer_phone column; phone is captured at Stripe checkout
  // only, so we drop it here.
  await ctx.env.DB.prepare(`
    INSERT INTO orders (id, voucher_code, package_id, video_addon, customer_name, customer_email,
                        amount, status, payment_method, created_at, paid_at,
                        expires_at, recipient_name, dedication, addons)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'paid', ?, datetime('now'), datetime('now'), ?, ?, ?, ?)
  `).bind(
    orderId, voucherCode, packageId, videoAddon ? 1 : 0,
    customerName, customerEmail || '',
    amount, paymentMethod, expiresAt, recipientName, dedication, addonsJson,
  ).run();

  // Generate PDF + upload to R2 (same path as Stripe webhook: vouchers/{code}.pdf).
  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await generateVoucherPdf({
      voucherCode, packageId, customerName, videoAddon,
      expiresAt, recipientName, dedication,
    });
  } catch (err) {
    return Response.json({ error: 'PDF generation failed: ' + (err instanceof Error ? err.message : 'unknown') }, { status: 500 });
  }

  try {
    await ctx.env.VOUCHER_BUCKET.put(`vouchers/${voucherCode}.pdf`, pdfBytes, {
      httpMetadata: { contentType: 'application/pdf' },
    });
  } catch (err) {
    return Response.json({ error: 'R2 upload failed: ' + (err instanceof Error ? err.message : 'unknown') }, { status: 500 });
  }

  let emailSent = false;
  if (sendEmail) {
    try {
      await sendVoucherEmail(ctx.env, {
        to: customerEmail,
        customerName,
        voucherCode,
        packageId,
        pdfBytes,
        siteUrl: ctx.env.SITE_URL || 'https://akrobacja.com',
      });
      await ctx.env.DB.prepare(
        `UPDATE orders SET email_sent_at = datetime('now') WHERE id = ?`,
      ).bind(orderId).run();
      emailSent = true;
    } catch (err) {
      ctx.waitUntil(recordFailedDelivery(ctx.env, {
        channel: 'voucher_email', refId: orderId, recipient: customerEmail, error: err,
      }));
    }
  }

  return Response.json({
    ok: true,
    voucher_code: voucherCode,
    order_id: orderId,
    pdf_url: `/api/voucher/${voucherCode}`,
    email_sent: emailSent,
    created_by: user,
  });
};

