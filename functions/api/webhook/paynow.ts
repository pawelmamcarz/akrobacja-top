// POST /api/webhook/paynow - notyfikacje PayNow o zmianie statusu płatności.
//
// PayNow wysyła POST na ten URL (skonfigurowany w panelu PayNow) z body
// {paymentId, externalId, status, modifiedAt} i nagłówkiem Signature.
// externalId ma prefiks: v_<orderId> (voucher) albo m_<orderId> (merch).
// Statusy: NEW/PENDING (w toku), CONFIRMED (sukces), REJECTED/ERROR/EXPIRED/
// ABANDONED (porażka). Weryfikacja podpisu obowiązkowa - bez niej spoofing.

import { type Env } from '../../../src/lib/types';
import { verifyPaynowSignature } from '../../../src/lib/paynow';
import { fulfillVoucherOrder, fulfillMerchOrder } from '../../../src/lib/order-fulfillment';

interface PaynowNotification {
  paymentId?: string;
  externalId?: string;
  status?: string;
}

const FAILURE_STATUSES = new Set(['REJECTED', 'ERROR', 'EXPIRED', 'ABANDONED']);

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const signatureKey = ctx.env.PAYNOW_SIGNATURE_KEY;
    if (!signatureKey) {
      console.error('[paynow-webhook] PAYNOW_SIGNATURE_KEY not configured');
      return new Response('not_configured', { status: 500 });
    }

    const rawBody = await ctx.request.text();
    const signature = ctx.request.headers.get('Signature') || '';
    const valid = await verifyPaynowSignature(rawBody, signature, signatureKey);
    if (!valid) {
      console.warn('[paynow-webhook] invalid signature');
      return new Response('invalid_signature', { status: 401 });
    }

    let payload: PaynowNotification;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response('invalid_json', { status: 400 });
    }

    const externalId = payload.externalId || '';
    const status = payload.status || '';
    const paymentId = payload.paymentId || null;

    // Zdejmij prefiks v_/m_ -> typ + orderId.
    const isVoucher = externalId.startsWith('v_');
    const isMerch = externalId.startsWith('m_');
    if (!isVoucher && !isMerch) {
      // Nieznany externalId - ack 200, żeby PayNow nie retryował w nieskończoność.
      console.warn('[paynow-webhook] unknown externalId prefix:', externalId.slice(0, 40));
      return Response.json({ ok: true, ignored: true });
    }
    const orderId = externalId.slice(2);

    const waitUntil = (p: Promise<unknown>) => ctx.waitUntil(p);

    if (status === 'CONFIRMED') {
      if (isVoucher) {
        const r = await fulfillVoucherOrder(ctx.env, {
          orderId,
          gateway: 'paynow',
          gatewayRef: paymentId,
          waitUntil,
        });
        return Response.json({ ok: true, ...r });
      }
      const r = await fulfillMerchOrder(ctx.env, {
        merchOrderId: orderId,
        gateway: 'paynow',
        gatewayRef: paymentId,
        waitUntil,
      });
      return Response.json({ ok: true, ...r });
    }

    if (FAILURE_STATUSES.has(status)) {
      const table = isVoucher ? 'orders' : 'merch_orders';
      // Guard na pending/processing - nie nadpisuj paid/refunded.
      await ctx.env.DB.prepare(
        `UPDATE ${table} SET status = 'failed' WHERE id = ? AND status IN ('pending','processing')`
      ).bind(orderId).run();
      return Response.json({ ok: true, status_applied: 'failed' });
    }

    // NEW / PENDING - jeszcze w toku, nic nie robimy.
    return Response.json({ ok: true, status_noted: status });
  } catch (err) {
    console.error('[paynow-webhook] failed:', err);
    return new Response('server_error', { status: 500 });
  }
};
