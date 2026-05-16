import { type Env, type PackageId, PACKAGES, ADDONS } from '../../src/lib/types';
import { generateVoucherPdf } from '../../src/lib/pdf';
import { sendVoucherEmail, escapeHtml } from '../../src/lib/email';
import { createInvoice } from '../../src/lib/wfirma';
import { sendMetaPurchase } from '../../src/lib/meta-capi';
import { recordFailedDelivery } from '../../src/lib/audit';

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
      to: ['info@akrobacja.com'],
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

async function notifyOwnerOrder(env: Env, o: { voucherCode: string; packageId: PackageId; customerName: string; customerEmail: string; amount: number; addons: string[] }): Promise<void> {
  try {
    const pkg = PACKAGES[o.packageId];
    const amountPLN = (o.amount / 100).toLocaleString('pl-PL') + ' PLN';
    const addonsCell = o.addons.length === 0
      ? 'brak'
      : o.addons
          .map(id => ADDONS[id]?.invoiceName ?? id)
          .map(s => escapeHtml(s))
          .join('<br>');
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'akrobacja.com <system@akrobacja.com>',
        to: ['info@akrobacja.com'],
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
              <tr><td style="padding:8px 0;color:#6B7A90;vertical-align:top">Addony</td><td style="padding:8px 0;font-weight:600;text-align:right;vertical-align:top">${addonsCell}</td></tr>
            </table>
            <p style="margin-top:16px"><a href="https://akrobacja.com/admin" style="color:#0A2F7C;font-weight:600">Otwórz panel admina →</a></p>
          </div>`,
      }),
    });
  } catch (err) {
    // Non-critical — admin-notify nie blokuje sukcesu zamówienia, ale loguj do CF Logs
    // i audit-table żeby admin widział oprócz "pusta skrzynka" konkretną przyczynę.
    console.error('notifyOwnerOrder failed:', err);
    await recordFailedDelivery(env, {
      channel: 'owner_notify', refId: o.voucherCode, recipient: 'info@akrobacja.com', error: err,
    });
  }
}

// Stripe webhook signature verification (HMAC-SHA256).
// Reference: https://stripe.com/docs/webhooks#verify-manually
const SIGNATURE_TOLERANCE_SECONDS = 300; // 5-minute replay window, matches Stripe SDK default

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function verifyStripeSignature(payload: string, sig: string, secret: string): Promise<boolean> {
  const parts = sig.split(',').reduce((acc, part) => {
    const [key, val] = part.split('=');
    if (key === 't') acc.timestamp = val;
    if (key === 'v1') acc.signatures.push(val);
    return acc;
  }, { timestamp: '', signatures: [] as string[] });

  if (!parts.timestamp || parts.signatures.length === 0) return false;

  // Reject replayed payloads — Stripe SDK enforces the same 5-minute tolerance.
  const ts = Number(parts.timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > SIGNATURE_TOLERANCE_SECONDS) {
    return false;
  }

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

  return parts.signatures.some(s => timingSafeEqualHex(s, expected));
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

    // Refunds initiated from the Stripe Dashboard. Stripe doesn't guarantee event
    // ordering, so charge.refunded can arrive BEFORE checkout.session.completed.
    // We stamp refund_received_at unconditionally, and ALSO flip paid→refunded if
    // the order is already paid. The completed handler below checks
    // refund_received_at before issuing the voucher to cover the out-of-order case.
    if (event.type === 'charge.refunded' || event.type === 'charge.refund.updated') {
      const orderIdFromPI = metadata?.order_id;
      const merchOrderIdFromPI = metadata?.merch_order_id;
      if (orderIdFromPI) {
        await ctx.env.DB.prepare(
          `UPDATE orders SET refund_received_at = COALESCE(refund_received_at, datetime('now')),
                  status = CASE WHEN status = 'paid' THEN 'refunded' ELSE status END
             WHERE id = ?`
        ).bind(orderIdFromPI).run();
      }
      if (merchOrderIdFromPI) {
        await ctx.env.DB.prepare(
          `UPDATE merch_orders SET refund_received_at = COALESCE(refund_received_at, datetime('now')),
                  status = CASE WHEN status = 'paid' THEN 'refunded' ELSE status END
             WHERE id = ?`
        ).bind(merchOrderIdFromPI).run();
      }
      return Response.json({ ok: true, status_applied: 'refunded' });
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

    const order = await ctx.env.DB.prepare(`
      SELECT id, voucher_code, package_id, video_addon, customer_name, customer_email,
             customer_nip, amount, status, invoice_id, expires_at, recipient_name,
             dedication, send_at, email_sent_at, refund_received_at, discount_code,
             addons
        FROM orders WHERE id = ?
    `).bind(orderId).first<Record<string, unknown>>();

    if (!order) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }

    // Out-of-order safety: Stripe's charge.refunded may have arrived BEFORE this
    // checkout.session.completed event (rare but possible during replays). If so,
    // refund_received_at is already set — finalize to refunded without issuing PDF,
    // invoice or email.
    if (order.refund_received_at) {
      await ctx.env.DB.prepare(
        "UPDATE orders SET status = 'refunded', stripe_session_id = ? WHERE id = ? AND status = 'processing'"
      ).bind(session.id as string, orderId).run();
      console.warn(`[webhook] refunded-before-completed for ${voucherCode}; skipping voucher delivery`);
      return Response.json({ ok: true, refunded: true });
    }

    // Sanity: assert Stripe charged what we expected. amount_total is in the smallest
    // currency unit (grosze for PLN), same as our orders.amount. If they diverge,
    // someone or something is editing the price between checkout-create and webhook
    // — log it and refuse to issue the voucher.
    const stripeAmount = Number((session as { amount_total?: number }).amount_total);
    if (Number.isFinite(stripeAmount) && stripeAmount !== order.amount) {
      console.error(`[webhook] amount mismatch for ${voucherCode}: stripe=${stripeAmount} db=${order.amount}`);
      await ctx.env.DB.prepare(
        "UPDATE orders SET status = 'failed' WHERE id = ? AND status = 'processing'"
      ).bind(orderId).run();
      return Response.json({ error: 'Amount mismatch' }, { status: 400 });
    }

    const packageId = order.package_id as PackageId;
    const customerName = order.customer_name as string;
    const customerEmail = order.customer_email as string;
    const customerNip = order.customer_nip as string | undefined;
    const videoAddon = order.video_addon === 1;
    // orders.addons jest JSON tekstem zapisanym w checkout.ts. Stary order (sprzed migracji
    // 019) ma NULL — fallback: 'video' tylko jeśli video_addon == 1, dzięki czemu pojedyncza
    // pozycja "Video 360°" trafia do faktury tak jak wcześniej.
    let addons: string[];
    if (typeof order.addons === 'string' && order.addons.length > 0) {
      try {
        const parsed = JSON.parse(order.addons);
        addons = Array.isArray(parsed) ? parsed.filter((x: unknown): x is string => typeof x === 'string') : [];
      } catch {
        addons = [];
      }
    } else {
      addons = videoAddon ? ['video'] : [];
    }
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

      // Idempotency guards — on Stripe retry these may already be populated from a partial
      // previous run. Skip the side effect rather than double-issue an invoice or email.
      const existingInvoiceId = (order.invoice_id as string | null) ?? null;
      const existingEmailSentAt = (order.email_sent_at as string | null) ?? null;
      const isLive = ctx.env.STRIPE_SECRET_KEY?.includes('_live_');
      const shouldInvoice = !!isLive && !existingInvoiceId;
      const shouldEmail = !scheduleEmail && !existingEmailSentAt;

      // R2 put is idempotent (same key overwrites). Invoice and email are NOT — gate them on
      // the existing-state flags above. Promise.allSettled so a soft failure in one path does
      // not roll back the others (which would re-fire the side effect on Stripe retry).
      const [r2Res, invoiceRes, emailRes] = await Promise.allSettled([
        ctx.env.VOUCHER_BUCKET.put(`vouchers/${voucherCode}.pdf`, pdfBytes, {
          httpMetadata: { contentType: 'application/pdf' },
        }),
        shouldInvoice
          ? createInvoice(ctx.env, {
              customerName,
              customerEmail,
              customerNip,
              packageId,
              videoAddon,
              addons,
              voucherCode,
              amount: order.amount as number,
              discountCode: (order.discount_code as string | null) ?? null,
            })
          : Promise.resolve(undefined),
        shouldEmail
          ? sendVoucherEmail(ctx.env, {
              to: customerEmail,
              customerName,
              voucherCode,
              packageId,
              pdfBytes,
              siteUrl: ctx.env.SITE_URL || 'https://akrobacja.com',
            })
          : Promise.resolve(undefined),
      ]);

      // R2 put is the only fatal failure — we cannot serve the PDF without it.
      if (r2Res.status === 'rejected') {
        throw r2Res.reason instanceof Error ? r2Res.reason : new Error('R2 put failed');
      }

      // Persist successful invoice ID immediately so a retry sees it and skips createInvoice.
      let invoiceId: string | undefined = existingInvoiceId || undefined;
      if (invoiceRes.status === 'fulfilled' && invoiceRes.value) {
        invoiceId = invoiceRes.value;
        await ctx.env.DB.prepare(
          'UPDATE orders SET invoice_id = ? WHERE id = ? AND invoice_id IS NULL'
        ).bind(invoiceId, orderId).run();
      } else if (invoiceRes.status === 'rejected') {
        console.error(`createInvoice failed for ${voucherCode}:`, invoiceRes.reason);
        ctx.waitUntil(recordFailedDelivery(ctx.env, {
          channel: 'wfirma_invoice', refId: orderId, recipient: customerEmail, error: invoiceRes.reason,
        }));
      }

      // Persist email_sent_at immediately so a retry sees it and skips sendVoucherEmail.
      let emailDelivered = !!existingEmailSentAt;
      if (emailRes.status === 'fulfilled' && shouldEmail) {
        const guard = await ctx.env.DB.prepare(
          "UPDATE orders SET email_sent_at = datetime('now') WHERE id = ? AND email_sent_at IS NULL"
        ).bind(orderId).run();
        emailDelivered = guard.meta.changes > 0 || emailDelivered;
      } else if (emailRes.status === 'rejected') {
        console.error(`sendVoucherEmail failed for ${voucherCode}:`, emailRes.reason);
        ctx.waitUntil(recordFailedDelivery(ctx.env, {
          channel: 'voucher_email', refId: orderId, recipient: customerEmail, error: emailRes.reason,
        }));
      }

      // Finalize — guard on status='processing' so we never overwrite a manual cancel.
      // email_sent_at + invoice_id were already persisted above; this UPDATE only flips status.
      await ctx.env.DB.prepare(`
        UPDATE orders SET status = 'paid', paid_at = datetime('now'), stripe_session_id = ?
        WHERE id = ? AND status = 'processing'
      `).bind(session.id as string, orderId).run();

      ctx.waitUntil(notifyOwnerOrder(ctx.env, { voucherCode, packageId, customerName, customerEmail, amount: order.amount as number, addons }));

      // Meta CAPI Purchase pairs with client Pixel via event_id for dedup.
      ctx.waitUntil(
        sendMetaPurchase(ctx.env, {
          voucherCode,
          packageId,
          customerEmail,
          customerName,
          amountGrosze: order.amount as number,
          videoAddon,
        }).catch(async (err) => {
          console.error(`sendMetaPurchase failed for ${voucherCode}:`, err);
          await recordFailedDelivery(ctx.env, {
            channel: 'meta_capi', refId: orderId, recipient: customerEmail, error: err,
          });
        }),
      );

      return Response.json({ ok: true, invoice_id: invoiceId || null, email_delivered: emailDelivered });
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
