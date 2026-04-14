import { type Env, type PackageId, PACKAGES } from '../../src/lib/types';
import { generateVoucherPdf } from '../../src/lib/pdf';
import { sendVoucherEmail } from '../../src/lib/email';
import { createInvoice } from '../../src/lib/wfirma';
import { sendMetaPurchase } from '../../src/lib/meta-capi';

// Notify owner about new paid order via Resend
async function notifyOwnerOrder(env: Env, o: { voucherCode: string; packageId: PackageId; customerName: string; customerEmail: string; amount: number; videoAddon: boolean }): Promise<void> {
  try {
    const pkg = PACKAGES[o.packageId];
    const amountPLN = (o.amount / 100).toLocaleString('pl-PL') + ' PLN';
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'akrobacja.com <system@akrobacja.com>',
        to: ['dto@akrobacja.com'],
        subject: `💰 Nowe zamówienie: ${pkg.name} — ${amountPLN}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto">
            <h2 style="color:#0A2F7C;margin:0 0 16px">Nowe zamówienie opłacone!</h2>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:8px 0;color:#6B7A90;border-bottom:1px solid #eee">Pakiet</td><td style="padding:8px 0;font-weight:600;border-bottom:1px solid #eee;text-align:right">${pkg.name}</td></tr>
              <tr><td style="padding:8px 0;color:#6B7A90;border-bottom:1px solid #eee">Kwota</td><td style="padding:8px 0;font-weight:600;color:#27ae60;border-bottom:1px solid #eee;text-align:right">${amountPLN}</td></tr>
              <tr><td style="padding:8px 0;color:#6B7A90;border-bottom:1px solid #eee">Klient</td><td style="padding:8px 0;font-weight:600;border-bottom:1px solid #eee;text-align:right">${o.customerName}</td></tr>
              <tr><td style="padding:8px 0;color:#6B7A90;border-bottom:1px solid #eee">Email</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right"><a href="mailto:${o.customerEmail}">${o.customerEmail}</a></td></tr>
              <tr><td style="padding:8px 0;color:#6B7A90;border-bottom:1px solid #eee">Voucher</td><td style="padding:8px 0;font-weight:600;font-family:monospace;border-bottom:1px solid #eee;text-align:right">${o.voucherCode}</td></tr>
              <tr><td style="padding:8px 0;color:#6B7A90">Video 360°</td><td style="padding:8px 0;font-weight:600;text-align:right">${o.videoAddon ? 'Tak (+299 PLN)' : 'Nie'}</td></tr>
            </table>
            <p style="margin-top:16px"><a href="https://akrobacja.com/admin" style="color:#0A2F7C;font-weight:600">Otwórz panel admina →</a></p>
          </div>`,
      }),
    });
  } catch {
    // Non-critical
  }
}

// Stripe webhook signature verification (HMAC-SHA256)
async function verifyStripeSignature(payload: string, sig: string, secret: string): Promise<boolean> {
  const parts = sig.split(',').reduce((acc, part) => {
    const [key, val] = part.split('=');
    if (key === 't') acc.timestamp = val;
    if (key === 'v1') acc.signatures.push(val);
    return acc;
  }, { timestamp: '', signatures: [] as string[] });

  if (!parts.timestamp || parts.signatures.length === 0) return false;

  const signedPayload = `${parts.timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret.replace(/\s/g, '')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signatureBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const expected = Array.from(new Uint8Array(signatureBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return parts.signatures.some(s => s === expected);
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const steps: string[] = [];
  try {
    steps.push('start');

    const sig = ctx.request.headers.get('stripe-signature');
    if (!sig) return Response.json({ error: 'Missing signature', steps }, { status: 400 });
    steps.push('has_sig');

    const rawBody = await ctx.request.text();
    steps.push(`body_len:${rawBody.length}`);

    const webhookSecret = ctx.env.STRIPE_WEBHOOK_SECRET?.replace(/\s/g, '') || '';
    steps.push(`secret_len:${webhookSecret.length}`);

    const valid = await verifyStripeSignature(rawBody, sig, webhookSecret);
    steps.push(`sig_valid:${valid}`);

    if (!valid) return Response.json({ error: 'Invalid signature', steps }, { status: 400 });

    const event = JSON.parse(rawBody) as { type: string; data: { object: Record<string, unknown> } };
    steps.push(`event:${event.type}`);

    if (event.type !== 'checkout.session.completed') {
      return Response.json({ ok: true, skipped: event.type, steps });
    }

    const session = event.data.object;
    const metadata = session.metadata as Record<string, string> | undefined;

    // Handle merch orders
    if (metadata?.merch_order_id) {
      const merchOrderId = metadata.merch_order_id;
      steps.push(`merch_order:${merchOrderId}`);
      await ctx.env.DB.prepare(
        "UPDATE merch_orders SET status = 'paid', paid_at = datetime('now'), stripe_session_id = ? WHERE id = ?"
      ).bind(session.id as string, merchOrderId).run();
      steps.push('merch_paid');
      // TODO: auto-create Printful order here when product mapping is configured
      return Response.json({ ok: true, steps });
    }

    const orderId = metadata?.order_id;
    const voucherCode = metadata?.voucher_code;
    if (!orderId || !voucherCode) {
      return Response.json({ error: 'Missing metadata', steps }, { status: 400 });
    }
    steps.push(`order:${orderId}`);

    // Fetch order
    const order = await ctx.env.DB.prepare(
      'SELECT * FROM orders WHERE id = ? AND status = ?'
    ).bind(orderId, 'pending').first<Record<string, unknown>>();

    if (!order) {
      return Response.json({ error: 'Order not found or already processed', steps }, { status: 404 });
    }
    steps.push('order_found');

    const packageId = order.package_id as PackageId;
    const customerName = order.customer_name as string;
    const customerEmail = order.customer_email as string;
    const customerNip = order.customer_nip as string | undefined;
    const videoAddon = order.video_addon === 1;
    const expiresAt = order.expires_at as string;

    // 1. Generate voucher PDF
    const pdfBytes = await generateVoucherPdf({
      voucherCode,
      packageId,
      customerName,
      videoAddon,
      expiresAt,
    });
    steps.push(`pdf:${pdfBytes.length}bytes`);

    // 2. Store PDF in R2
    await ctx.env.VOUCHER_BUCKET.put(`vouchers/${voucherCode}.pdf`, pdfBytes, {
      httpMetadata: { contentType: 'application/pdf' },
    });
    steps.push('r2_stored');

    // 3. Create invoice in wFirma (skip in Stripe test mode)
    let invoiceId: string | undefined;
    const isLive = ctx.env.STRIPE_SECRET_KEY?.includes('_live_');
    if (isLive) {
      try {
        invoiceId = await createInvoice(ctx.env, {
          customerName,
          customerEmail,
          customerNip,
          packageId,
          videoAddon,
          voucherCode,
        });
        steps.push(`invoice:${invoiceId}`);
      } catch (err) {
        steps.push(`invoice_err:${err instanceof Error ? err.message : 'unknown'}`);
      }
    } else {
      steps.push('invoice_skipped_test');
    }

    // 4. Send email with PDF
    try {
      await sendVoucherEmail(ctx.env, {
        to: customerEmail,
        customerName,
        voucherCode,
        packageId,
        pdfBytes,
        siteUrl: ctx.env.SITE_URL || 'https://akrobacja.com',
      });
      steps.push('email_sent');
    } catch (err) {
      steps.push(`email_err:${err instanceof Error ? err.message : 'unknown'}`);
    }

    // 5. Update order status
    await ctx.env.DB.prepare(`
      UPDATE orders SET status = 'paid', paid_at = datetime('now'), invoice_id = ?, stripe_session_id = ?
      WHERE id = ?
    `).bind(invoiceId || null, session.id as string, orderId).run();
    steps.push('order_updated');

    // 6. Notify owner about new order
    ctx.waitUntil(notifyOwnerOrder(ctx.env, { voucherCode, packageId, customerName, customerEmail, amount: order.amount as number, videoAddon }));
    steps.push('owner_notified');

    // 7. Meta CAPI — server-side Purchase event (paired with client Pixel via event_id)
    ctx.waitUntil(
      sendMetaPurchase(ctx.env, {
        voucherCode,
        packageId,
        customerEmail,
        customerName,
        amountGrosze: order.amount as number,
        videoAddon,
      }).catch(() => { /* non-critical */ }),
    );
    steps.push('meta_capi_queued');

    return Response.json({ ok: true, steps });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message, steps }, { status: 500 });
  }
};
