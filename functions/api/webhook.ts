import { type Env, type PackageId, PACKAGES } from '../../src/lib/types';
import { generateVoucherPdf } from '../../src/lib/pdf';
import { sendVoucherEmail, escapeHtml } from '../../src/lib/email';
import { createInvoice } from '../../src/lib/wfirma';
import { sendMetaPurchase } from '../../src/lib/meta-capi';

async function notifyOwnerMerch(env: Env, o: {
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  shippingAddress: string;
  shippingCity: string;
  shippingZip: string;
  items: Array<{ name: string; variant?: string; quantity: number; price: number }>;
  totalAmount: number;
}): Promise<void> {
  const totalPLN = (o.totalAmount / 100).toFixed(2);
  const rows = o.items.map(i =>
    `<tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(i.name)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${escapeHtml(i.variant || '—')}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${i.quantity}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${(i.price / 100).toFixed(2)} PLN</td>
    </tr>`
  ).join('');

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from: 'akrobacja.com <system@akrobacja.com>',
      to: ['dto@akrobacja.com'],
      subject: `🛍️ Nowe zamówienie merch — ${o.customerName} — ${totalPLN} PLN`,
      html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
  <h2 style="color:#0A2F7C;margin:0 0 4px">Nowe zamówienie merch</h2>
  <p style="margin:0 0 20px;color:#6B7A90">Zamówienie #${o.orderId.slice(0,8)} · ${totalPLN} PLN zapłacone</p>

  <h3 style="margin:0 0 8px;color:#0A2F7C;font-size:14px;text-transform:uppercase;letter-spacing:1px">Produkty do zlecenia w Snapwear</h3>
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
    <thead>
      <tr style="background:#f5f7fa">
        <th style="padding:8px;text-align:left;font-size:12px;color:#6B7A90">Produkt</th>
        <th style="padding:8px;text-align:center;font-size:12px;color:#6B7A90">Rozmiar</th>
        <th style="padding:8px;text-align:center;font-size:12px;color:#6B7A90">Szt.</th>
        <th style="padding:8px;text-align:right;font-size:12px;color:#6B7A90">Cena</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <h3 style="margin:0 0 8px;color:#0A2F7C;font-size:14px;text-transform:uppercase;letter-spacing:1px">Adres dostawy</h3>
  <div style="background:#f5f7fa;padding:12px 16px;border-radius:6px;margin-bottom:20px;font-family:monospace;font-size:14px;line-height:1.8">
    ${escapeHtml(o.customerName)}<br>
    ${escapeHtml(o.shippingAddress)}<br>
    ${escapeHtml(o.shippingZip)} ${escapeHtml(o.shippingCity)}<br>
    ${o.customerPhone ? escapeHtml(o.customerPhone) + '<br>' : ''}
    ${escapeHtml(o.customerEmail)}
  </div>

  <p style="margin:0 0 20px">
    <a href="https://akrobacja.com/admin#merch" style="background:#0A2F7C;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
      Otwórz panel admina →
    </a>
    &nbsp;&nbsp;
    <a href="https://solutions.snapwear.pro" style="background:#7B2FBE;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
      Otwórz Snapwear →
    </a>
  </p>
</div>`,
    }),
  });
}

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
              <tr><td style="padding:8px 0;color:#6B7A90;border-bottom:1px solid #eee">Pakiet</td><td style="padding:8px 0;font-weight:600;border-bottom:1px solid #eee;text-align:right">${escapeHtml(pkg.name)}</td></tr>
              <tr><td style="padding:8px 0;color:#6B7A90;border-bottom:1px solid #eee">Kwota</td><td style="padding:8px 0;font-weight:600;color:#27ae60;border-bottom:1px solid #eee;text-align:right">${amountPLN}</td></tr>
              <tr><td style="padding:8px 0;color:#6B7A90;border-bottom:1px solid #eee">Klient</td><td style="padding:8px 0;font-weight:600;border-bottom:1px solid #eee;text-align:right">${escapeHtml(o.customerName)}</td></tr>
              <tr><td style="padding:8px 0;color:#6B7A90;border-bottom:1px solid #eee">Email</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right"><a href="mailto:${encodeURIComponent(o.customerEmail)}">${escapeHtml(o.customerEmail)}</a></td></tr>
              <tr><td style="padding:8px 0;color:#6B7A90;border-bottom:1px solid #eee">Voucher</td><td style="padding:8px 0;font-weight:600;font-family:monospace;border-bottom:1px solid #eee;text-align:right">${escapeHtml(o.voucherCode)}</td></tr>
              <tr><td style="padding:8px 0;color:#6B7A90">Video 360°</td><td style="padding:8px 0;font-weight:600;text-align:right">${o.videoAddon ? 'Tak (+299 PLN)' : 'Nie'}</td></tr>
            </table>
            <p style="margin-top:16px"><a href="https://akrobacja.com/admin" style="color:#0A2F7C;font-weight:600">Otwórz panel admina →</a></p>
          </div>`,
      }),
    });
  } catch (err) {
    // Non-critical — admin-notify nie blokuje sukcesu zamówienia, ale loguj do CF Logs.
    console.error('notifyOwnerOrder failed:', err);
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
  try {
    const sig = ctx.request.headers.get('stripe-signature');
    if (!sig) return Response.json({ error: 'Missing signature' }, { status: 400 });

    const rawBody = await ctx.request.text();

    const webhookSecret = ctx.env.STRIPE_WEBHOOK_SECRET?.replace(/\s/g, '') || '';
    if (!webhookSecret) {
      // Fail loud — without a secret any payload would pass verification.
      return Response.json({ error: 'Webhook not configured' }, { status: 500 });
    }

    const valid = await verifyStripeSignature(rawBody, sig, webhookSecret);
    if (!valid) return Response.json({ error: 'Invalid signature' }, { status: 400 });

    const event = JSON.parse(rawBody) as { type: string; data: { object: Record<string, unknown> } };
    const session = event.data.object;
    const metadata = session.metadata as Record<string, string> | undefined;

    // Terminal non-success eventy — flip ordera, żeby nie zostawał zombie 'pending'
    // w abandoned-cart cronie. Tylko dla naszych orderów (matchujemy po metadata).
    if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
      const newStatus = event.type === 'checkout.session.expired' ? 'expired' : 'failed';
      if (metadata?.order_id) {
        await ctx.env.DB.prepare(
          "UPDATE orders SET status = ? WHERE id = ? AND status = 'pending'"
        ).bind(newStatus, metadata.order_id).run();
      }
      if (metadata?.merch_order_id) {
        await ctx.env.DB.prepare(
          "UPDATE merch_orders SET status = ? WHERE id = ? AND status = 'pending'"
        ).bind(newStatus, metadata.merch_order_id).run();
      }
      return Response.json({ ok: true, status_applied: newStatus });
    }

    if (event.type !== 'checkout.session.completed') {
      return Response.json({ ok: true, skipped: event.type });
    }

    // Handle merch orders — atomic update prevents double-processing on webhook retry.
    if (metadata?.merch_order_id) {
      const merchOrderId = metadata.merch_order_id;
      const res = await ctx.env.DB.prepare(
        "UPDATE merch_orders SET status = 'paid', paid_at = datetime('now'), stripe_session_id = ? WHERE id = ? AND status = 'pending'"
      ).bind(session.id as string, merchOrderId).run();
      if (res.meta.changes === 0) {
        return Response.json({ ok: true, duplicate: true });
      }

      // Notify admin to manually place order in Snapwear panel.
      ctx.waitUntil((async () => {
        try {
          const mo = await ctx.env.DB.prepare(
            'SELECT customer_name, customer_email, customer_phone, shipping_address, shipping_city, shipping_zip, items, total_amount FROM merch_orders WHERE id = ?'
          ).bind(merchOrderId).first<{
            customer_name: string; customer_email: string; customer_phone: string | null;
            shipping_address: string; shipping_city: string; shipping_zip: string;
            items: string; total_amount: number;
          }>();
          if (!mo) return;
          const parsedItems = JSON.parse(mo.items) as Array<{
            name: string; variant?: string; quantity: number; price: number;
          }>;
          await notifyOwnerMerch(ctx.env, {
            orderId: merchOrderId,
            customerName: mo.customer_name,
            customerEmail: mo.customer_email,
            customerPhone: mo.customer_phone,
            shippingAddress: mo.shipping_address,
            shippingCity: mo.shipping_city,
            shippingZip: mo.shipping_zip,
            items: parsedItems,
            totalAmount: mo.total_amount,
          });
        } catch (err) {
          console.error('notifyOwnerMerch failed:', err);
        }
      })());

      return Response.json({ ok: true });
    }

    const orderId = metadata?.order_id;
    const voucherCode = metadata?.voucher_code;
    if (!orderId || !voucherCode) {
      return Response.json({ error: 'Missing metadata' }, { status: 400 });
    }

    // Atomic claim: flip status pending→processing in one step. If no rows change,
    // another webhook (or retry) is already handling this order — ack and stop.
    const claim = await ctx.env.DB.prepare(
      "UPDATE orders SET status = 'processing' WHERE id = ? AND status = 'pending'"
    ).bind(orderId).run();

    if (claim.meta.changes === 0) {
      return Response.json({ ok: true, duplicate: true });
    }

    const order = await ctx.env.DB.prepare(
      'SELECT * FROM orders WHERE id = ?'
    ).bind(orderId).first<Record<string, unknown>>();

    if (!order) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }

    const packageId = order.package_id as PackageId;
    const customerName = order.customer_name as string;
    const customerEmail = order.customer_email as string;
    const customerNip = order.customer_nip as string | undefined;
    const videoAddon = order.video_addon === 1;
    const expiresAt = order.expires_at as string;
    const recipientName = (order.recipient_name as string | null) ?? null;
    const dedication = (order.dedication as string | null) ?? null;
    const sendAt = (order.send_at as string | null) ?? null;
    // Voucher zaplanowany na przyszłość — generuj PDF + wrzuć do R2, ale email
    // wysyła cron scheduled-vouchers gdy nadejdzie send_at. Owner notify i Meta CAPI
    // lecą normalnie (właściciel chce wiedzieć od razu, Pixel deduplikuje purchase).
    const scheduleEmail = sendAt !== null && Date.parse(sendAt) > Date.now();

    // Test product — skip PDF/invoice/email; mark paid + fire Meta CAPI and return.
    if (packageId === 'test_naklejka') {
      await ctx.env.DB.prepare(`
        UPDATE orders SET status = 'paid', paid_at = datetime('now'), stripe_session_id = ?
        WHERE id = ?
      `).bind(session.id as string, orderId).run();

      ctx.waitUntil(
        sendMetaPurchase(ctx.env, {
          voucherCode,
          packageId,
          customerEmail,
          customerName,
          amountGrosze: order.amount as number,
          videoAddon: false,
        }).catch(err => console.error(`sendMetaPurchase (test) failed for ${voucherCode}:`, err)),
      );

      return Response.json({ ok: true, test: true });
    }

    try {
      // PDF blocks everything else — R2, email, and the final invoice_id are derived from it.
      const pdfBytes = await generateVoucherPdf({
        voucherCode,
        packageId,
        customerName,
        videoAddon,
        expiresAt,
        recipientName,
        dedication,
      });

      // R2 upload, wFirma invoice, and customer email are independent — run in parallel.
      // Each settles individually: R2 failure is fatal (no PDF to serve), invoice/email are
      // non-critical (admin can reissue).
      // Jeśli email zaplanowany (send_at w przyszłości) — pomijamy sendVoucherEmail tutaj,
      // cron scheduled-vouchers wyśle PDF z R2 gdy nadejdzie data.
      const isLive = ctx.env.STRIPE_SECRET_KEY?.includes('_live_');
      const [, invoiceResult] = await Promise.all([
        ctx.env.VOUCHER_BUCKET.put(`vouchers/${voucherCode}.pdf`, pdfBytes, {
          httpMetadata: { contentType: 'application/pdf' },
        }),
        isLive
          ? createInvoice(ctx.env, {
              customerName,
              customerEmail,
              customerNip,
              packageId,
              videoAddon,
              voucherCode,
              amount: order.amount as number,
              discountCode: (order.discount_code as string | null) ?? null,
            }).catch(err => { console.error(`createInvoice failed for ${voucherCode}:`, err); return undefined; })
          : Promise.resolve(undefined),
        scheduleEmail
          ? Promise.resolve(undefined)
          : sendVoucherEmail(ctx.env, {
              to: customerEmail,
              customerName,
              voucherCode,
              packageId,
              pdfBytes,
              siteUrl: ctx.env.SITE_URL || 'https://akrobacja.com',
            }).catch(err => { console.error(`sendVoucherEmail failed for ${voucherCode}:`, err); return undefined; }),
      ]);
      const invoiceId = invoiceResult;

      // Finalize — guard on status='processing' so we never overwrite a manual cancel.
      // email_sent_at ustawiamy tylko jeśli faktycznie wysłaliśmy maila tu (nie scheduled).
      await ctx.env.DB.prepare(`
        UPDATE orders SET status = 'paid', paid_at = datetime('now'), invoice_id = ?, stripe_session_id = ?,
          email_sent_at = CASE WHEN ? = 1 THEN email_sent_at ELSE datetime('now') END
        WHERE id = ? AND status = 'processing'
      `).bind(invoiceId || null, session.id as string, scheduleEmail ? 1 : 0, orderId).run();

      ctx.waitUntil(notifyOwnerOrder(ctx.env, { voucherCode, packageId, customerName, customerEmail, amount: order.amount as number, videoAddon }));

      // Meta CAPI Purchase pairs with client Pixel via event_id for dedup.
      ctx.waitUntil(
        sendMetaPurchase(ctx.env, {
          voucherCode,
          packageId,
          customerEmail,
          customerName,
          amountGrosze: order.amount as number,
          videoAddon,
        }).catch(err => console.error(`sendMetaPurchase failed for ${voucherCode}:`, err)),
      );

      return Response.json({ ok: true });
    } catch (innerErr) {
      // Revert claim so Stripe retry can pick it up. PDF/invoice/email fail soft above,
      // so we only land here on R2 put or PDF generation errors.
      await ctx.env.DB.prepare(
        "UPDATE orders SET status = 'pending' WHERE id = ? AND status = 'processing'"
      ).bind(orderId).run();
      throw innerErr;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
};
