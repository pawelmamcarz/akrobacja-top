// Wspólna finalizacja zamówień - używana przez OBA webhooki płatności:
// Stripe (functions/api/webhook.ts) i PayNow (functions/api/webhook/paynow.ts).
// Logika musi być identyczna niezależnie od bramki, więc trzymamy ją w jednym
// miejscu zamiast duplikować w dwóch route'ach (kod krytyczny dla pieniędzy).

import { type Env, type PackageId, PACKAGES, ADDONS } from './types';
import { generateVoucherPdf } from './pdf';
import { sendVoucherEmail, escapeHtml } from './email';
import { createInvoice } from './wfirma';
import { sendMetaPurchase } from './meta-capi';
import { recordFailedDelivery } from './audit';

type Gateway = 'stripe' | 'paynow';
type WaitUntil = (p: Promise<unknown>) => void;

export async function notifyOwnerMerch(env: Env, o: {
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
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${escapeHtml(i.variant || '-')}</td>
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
      tags: [{ name: 'type', value: 'owner-merch-notify' }],
      subject: `🛍️ Nowe zamówienie merch - ${o.customerName} - ${totalPLN} PLN`,
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
        tags: [{ name: 'type', value: 'owner-voucher-notify' }],
        subject: `💰 Nowe zamówienie: ${pkg.name} - ${amountPLN}`,
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
    // Non-critical - admin-notify nie blokuje sukcesu zamówienia, ale loguj do CF Logs
    // i audit-table żeby admin widział oprócz "pusta skrzynka" konkretną przyczynę.
    console.error('notifyOwnerOrder failed:', err);
    await recordFailedDelivery(env, {
      channel: 'owner_notify', refId: o.voucherCode, recipient: 'info@akrobacja.com', error: err,
    });
  }
}

export interface VoucherFulfillResult {
  duplicate?: boolean;
  notFound?: boolean;
  refunded?: boolean;
  amountMismatch?: boolean;
  test?: boolean;
  ok?: boolean;
  invoiceId?: string | null;
  emailDelivered?: boolean;
}

// Finalizacja voucher ordera po potwierdzeniu płatności. Idempotentna:
// atomowy claim pending→processing, a wszystkie efekty uboczne są bramkowane
// na istniejący stan (invoice_id / email_sent_at), więc retry/duplikat z bramki
// nie wystawia drugiej faktury ani drugiego maila.
export async function fulfillVoucherOrder(env: Env, opts: {
  orderId: string;
  gateway: Gateway;
  gatewayRef: string | null;          // stripe session id LUB paynow payment id
  expectedAmount?: number | null;     // sanity-check kwoty (Stripe amount_total); PayNow pomija
  waitUntil: WaitUntil;
}): Promise<VoucherFulfillResult> {
  const { orderId, gateway, gatewayRef, expectedAmount, waitUntil } = opts;
  const stripeRef = gateway === 'stripe' ? gatewayRef : null;
  const paynowRef = gateway === 'paynow' ? gatewayRef : null;

  // Atomic claim: pending→processing. Brak zmian = inny webhook/retry już to obsługuje.
  const claim = await env.DB.prepare(
    "UPDATE orders SET status = 'processing' WHERE id = ? AND status = 'pending'"
  ).bind(orderId).run();
  if (claim.meta.changes === 0) return { duplicate: true };

  const order = await env.DB.prepare(`
    SELECT id, voucher_code, package_id, video_addon, customer_name, customer_email,
           customer_nip, amount, status, invoice_id, expires_at, recipient_name,
           dedication, send_at, email_sent_at, refund_received_at, discount_code,
           addons
      FROM orders WHERE id = ?
  `).bind(orderId).first<Record<string, unknown>>();

  if (!order) return { notFound: true };

  const voucherCode = order.voucher_code as string;

  // Out-of-order: refund mógł przyjść przed potwierdzeniem płatności. Jeśli tak -
  // finalizuj jako refunded bez PDF/faktury/maila.
  if (order.refund_received_at) {
    await env.DB.prepare(
      `UPDATE orders SET status = 'refunded', payment_gateway = ?,
              stripe_session_id = COALESCE(?, stripe_session_id),
              paynow_payment_id = COALESCE(?, paynow_payment_id)
         WHERE id = ? AND status = 'processing'`
    ).bind(gateway, stripeRef, paynowRef, orderId).run();
    console.warn(`[fulfill] refunded-before-completed for ${voucherCode}; skipping voucher delivery`);
    return { refunded: true };
  }

  // Sanity: kwota faktycznie pobrana == nasza orders.amount (grosze). Tylko gdy bramka
  // ją dostarcza (Stripe). Rozjazd = ktoś edytował cenę między checkout a webhookiem.
  if (expectedAmount != null && Number.isFinite(expectedAmount) && expectedAmount !== order.amount) {
    console.error(`[fulfill] amount mismatch for ${voucherCode}: gateway=${expectedAmount} db=${order.amount}`);
    await env.DB.prepare(
      "UPDATE orders SET status = 'failed' WHERE id = ? AND status = 'processing'"
    ).bind(orderId).run();
    return { amountMismatch: true };
  }

  const packageId = order.package_id as PackageId;
  const customerName = order.customer_name as string;
  const customerEmail = order.customer_email as string;
  const customerNip = order.customer_nip as string | undefined;
  const videoAddon = order.video_addon === 1;
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
  const scheduleEmail = sendAt !== null && Date.parse(sendAt) > Date.now();

  // Test product - skip PDF/invoice/email; mark paid + fire Meta CAPI and return.
  if (packageId === 'test_naklejka') {
    await env.DB.prepare(
      `UPDATE orders SET status = 'paid', paid_at = datetime('now'), payment_gateway = ?,
              stripe_session_id = COALESCE(?, stripe_session_id),
              paynow_payment_id = COALESCE(?, paynow_payment_id)
         WHERE id = ?`
    ).bind(gateway, stripeRef, paynowRef, orderId).run();

    waitUntil(
      sendMetaPurchase(env, {
        voucherCode, packageId, customerEmail, customerName,
        amountGrosze: order.amount as number, videoAddon: false,
      }).catch(err => console.error(`sendMetaPurchase (test) failed for ${voucherCode}:`, err)),
    );
    return { test: true };
  }

  try {
    const pdfBytes = await generateVoucherPdf({
      voucherCode, packageId, customerName, videoAddon, expiresAt, recipientName, dedication,
    });

    const existingInvoiceId = (order.invoice_id as string | null) ?? null;
    const existingEmailSentAt = (order.email_sent_at as string | null) ?? null;
    const isLive = env.STRIPE_SECRET_KEY?.includes('_live_');
    const shouldInvoice = !!isLive && !existingInvoiceId;
    const shouldEmail = !scheduleEmail && !existingEmailSentAt;

    const [r2Res, invoiceRes, emailRes] = await Promise.allSettled([
      env.VOUCHER_BUCKET.put(`vouchers/${voucherCode}.pdf`, pdfBytes, {
        httpMetadata: { contentType: 'application/pdf' },
      }),
      shouldInvoice
        ? createInvoice(env, {
            customerName, customerEmail, customerNip, packageId, videoAddon, addons, voucherCode,
            amount: order.amount as number,
            discountCode: (order.discount_code as string | null) ?? null,
          })
        : Promise.resolve(undefined),
      shouldEmail
        ? sendVoucherEmail(env, {
            to: customerEmail, customerName, voucherCode, packageId, pdfBytes,
            siteUrl: env.SITE_URL || 'https://akrobacja.com',
          })
        : Promise.resolve(undefined),
    ]);

    if (r2Res.status === 'rejected') {
      throw r2Res.reason instanceof Error ? r2Res.reason : new Error('R2 put failed');
    }

    let invoiceId: string | undefined = existingInvoiceId || undefined;
    if (invoiceRes.status === 'fulfilled' && invoiceRes.value) {
      invoiceId = invoiceRes.value;
      await env.DB.prepare(
        'UPDATE orders SET invoice_id = ? WHERE id = ? AND invoice_id IS NULL'
      ).bind(invoiceId, orderId).run();
    } else if (invoiceRes.status === 'rejected') {
      console.error(`createInvoice failed for ${voucherCode}:`, invoiceRes.reason);
      waitUntil(recordFailedDelivery(env, {
        channel: 'wfirma_invoice', refId: orderId, recipient: customerEmail, error: invoiceRes.reason,
      }));
    }

    let emailDelivered = !!existingEmailSentAt;
    if (emailRes.status === 'fulfilled' && shouldEmail) {
      const guard = await env.DB.prepare(
        "UPDATE orders SET email_sent_at = datetime('now') WHERE id = ? AND email_sent_at IS NULL"
      ).bind(orderId).run();
      emailDelivered = guard.meta.changes > 0 || emailDelivered;
    } else if (emailRes.status === 'rejected') {
      console.error(`sendVoucherEmail failed for ${voucherCode}:`, emailRes.reason);
      waitUntil(recordFailedDelivery(env, {
        channel: 'voucher_email', refId: orderId, recipient: customerEmail, error: emailRes.reason,
      }));
    }

    // Finalize - guard na status='processing' żeby nie nadpisać ręcznego cancela.
    await env.DB.prepare(
      `UPDATE orders SET status = 'paid', paid_at = datetime('now'), payment_gateway = ?,
              stripe_session_id = COALESCE(?, stripe_session_id),
              paynow_payment_id = COALESCE(?, paynow_payment_id)
         WHERE id = ? AND status = 'processing'`
    ).bind(gateway, stripeRef, paynowRef, orderId).run();

    // Osobisty kod jednorazowy - oznacz jako użyty (no-op dla statycznych DISCOUNTS).
    const usedDiscountCode = (order.discount_code as string | null) ?? null;
    if (usedDiscountCode) {
      await env.DB.prepare(
        "UPDATE personal_discount_codes SET used_at = datetime('now'), used_order_id = ? WHERE code = ? AND used_at IS NULL"
      ).bind(orderId, usedDiscountCode).run();
    }

    waitUntil(notifyOwnerOrder(env, { voucherCode, packageId, customerName, customerEmail, amount: order.amount as number, addons }));

    waitUntil(
      sendMetaPurchase(env, {
        voucherCode, packageId, customerEmail, customerName,
        amountGrosze: order.amount as number, videoAddon,
      }).catch(async (err) => {
        console.error(`sendMetaPurchase failed for ${voucherCode}:`, err);
        await recordFailedDelivery(env, {
          channel: 'meta_capi', refId: orderId, recipient: customerEmail, error: err,
        });
      }),
    );

    return { ok: true, invoiceId: invoiceId || null, emailDelivered };
  } catch (innerErr) {
    // Revert claim żeby retry mógł podjąć ordera ponownie. PDF/invoice/email failują
    // soft powyżej, więc tu lądujemy tylko na błędzie R2 put / generacji PDF.
    await env.DB.prepare(
      "UPDATE orders SET status = 'pending' WHERE id = ? AND status = 'processing'"
    ).bind(orderId).run();
    throw innerErr;
  }
}

// Finalizacja merch ordera: status=paid (atomowo) + powiadomienie do admina.
export async function fulfillMerchOrder(env: Env, opts: {
  merchOrderId: string;
  gateway: Gateway;
  gatewayRef: string | null;
  waitUntil: WaitUntil;
}): Promise<{ duplicate?: boolean; ok?: boolean }> {
  const { merchOrderId, gateway, gatewayRef, waitUntil } = opts;
  const stripeRef = gateway === 'stripe' ? gatewayRef : null;
  const paynowRef = gateway === 'paynow' ? gatewayRef : null;

  const res = await env.DB.prepare(
    `UPDATE merch_orders SET status = 'paid', paid_at = datetime('now'), payment_gateway = ?,
            stripe_session_id = COALESCE(?, stripe_session_id),
            paynow_payment_id = COALESCE(?, paynow_payment_id)
       WHERE id = ? AND status = 'pending'`
  ).bind(gateway, stripeRef, paynowRef, merchOrderId).run();
  if (res.meta.changes === 0) return { duplicate: true };

  waitUntil((async () => {
    try {
      const mo = await env.DB.prepare(
        'SELECT customer_name, customer_email, customer_phone, shipping_address, shipping_city, shipping_zip, items, total_amount FROM merch_orders WHERE id = ?'
      ).bind(merchOrderId).first<{
        customer_name: string; customer_email: string; customer_phone: string | null;
        shipping_address: string; shipping_city: string; shipping_zip: string;
        items: string; total_amount: number;
      }>();
      if (!mo) return;
      const parsedItems = JSON.parse(mo.items) as Array<{ name: string; variant?: string; quantity: number; price: number }>;
      await notifyOwnerMerch(env, {
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

  return { ok: true };
}
