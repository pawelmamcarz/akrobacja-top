// Meta Conversions API (server-side) — sends Purchase event with hashed user data.
// Pairs with client-side Pixel via shared event_id (dedup).
// https://developers.facebook.com/docs/marketing-api/conversions-api

import type { Env, PackageId } from './types';
import { PACKAGES } from './types';

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/[^\p{L}\s-]/gu, '');
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  return { first: parts[0] || '', last: parts.slice(1).join(' ') || '' };
}

export interface PurchaseEvent {
  voucherCode: string;
  packageId: PackageId;
  customerEmail: string;
  customerName: string;
  amountGrosze: number;      // from orders table, in grosze (1 PLN = 100)
  videoAddon: boolean;
  eventSourceUrl?: string;   // typically /sukces URL
}

export async function sendMetaPurchase(env: Env, ev: PurchaseEvent): Promise<void> {
  const pixelId = env.META_PIXEL_ID;
  const token = env.META_CAPI_TOKEN;
  if (!pixelId || !token) return;

  const pkg = PACKAGES[ev.packageId];
  const { first, last } = splitName(ev.customerName);

  const [em, fn, ln, country] = await Promise.all([
    sha256Hex(normalizeEmail(ev.customerEmail)),
    first ? sha256Hex(normalizeName(first)) : Promise.resolve(''),
    last ? sha256Hex(normalizeName(last)) : Promise.resolve(''),
    sha256Hex('pl'),
  ]);

  const valuePLN = ev.amountGrosze / 100;
  const eventId = `purchase_${ev.voucherCode}`; // matches client-side eventID for dedup

  const payload: Record<string, unknown> = {
    data: [
      {
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: 'website',
        event_source_url: ev.eventSourceUrl || `https://akrobacja.com/sukces?code=${ev.voucherCode}`,
        user_data: {
          em: [em],
          fn: fn ? [fn] : undefined,
          ln: ln ? [ln] : undefined,
          country: [country],
        },
        custom_data: {
          currency: 'PLN',
          value: valuePLN,
          content_ids: [`AKRO-V-${ev.packageId.toUpperCase().replace('_', '-')}`],
          content_type: 'product',
          content_name: `Voucher — ${pkg.name}`,
          content_category: 'Voucher',
          num_items: ev.videoAddon ? 2 : 1,
          order_id: ev.voucherCode,
        },
      },
    ],
  };

  // Test events mode — only visible in Meta Events Manager → Test Events tab
  if (env.META_TEST_EVENT_CODE) {
    payload.test_event_code = env.META_TEST_EVENT_CODE;
  }

  const url = `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${encodeURIComponent(token)}`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
