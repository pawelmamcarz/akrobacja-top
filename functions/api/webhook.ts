import { type Env } from '../../src/lib/types';
import { fulfillVoucherOrder, fulfillMerchOrder } from '../../src/lib/order-fulfillment';

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

  // Reject replayed payloads - Stripe SDK enforces the same 5-minute tolerance.
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
      // Fail loud - without a secret any payload would pass verification.
      return Response.json({ error: 'Webhook not configured' }, { status: 500 });
    }

    const valid = await verifyStripeSignature(rawBody, sig, webhookSecret);
    if (!valid) return Response.json({ error: 'Invalid signature' }, { status: 400 });

    const event = JSON.parse(rawBody) as { type: string; data: { object: Record<string, unknown> } };
    const session = event.data.object;
    const metadata = session.metadata as Record<string, string> | undefined;

    // Terminal non-success eventy - flip ordera, żeby nie zostawał zombie 'pending'
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

    const waitUntil = (p: Promise<unknown>) => ctx.waitUntil(p);

    // Handle merch orders - shared finalization (atomic claim prevents double-processing).
    if (metadata?.merch_order_id) {
      const r = await fulfillMerchOrder(ctx.env, {
        merchOrderId: metadata.merch_order_id,
        gateway: 'stripe',
        gatewayRef: session.id as string,
        waitUntil,
      });
      return Response.json(r.duplicate ? { ok: true, duplicate: true } : { ok: true });
    }

    const orderId = metadata?.order_id;
    const voucherCode = metadata?.voucher_code;
    if (!orderId || !voucherCode) {
      return Response.json({ error: 'Missing metadata' }, { status: 400 });
    }

    const stripeAmount = Number((session as { amount_total?: number }).amount_total);
    const r = await fulfillVoucherOrder(ctx.env, {
      orderId,
      gateway: 'stripe',
      gatewayRef: session.id as string,
      expectedAmount: stripeAmount,
      waitUntil,
    });

    if (r.duplicate) return Response.json({ ok: true, duplicate: true });
    if (r.notFound) return Response.json({ error: 'Order not found' }, { status: 404 });
    if (r.refunded) return Response.json({ ok: true, refunded: true });
    if (r.amountMismatch) return Response.json({ error: 'Amount mismatch' }, { status: 400 });
    if (r.test) return Response.json({ ok: true, test: true });
    return Response.json({ ok: true, invoice_id: r.invoiceId ?? null, email_delivered: r.emailDelivered });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
};
