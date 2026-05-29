// PayNow (paynow.pl / mBank) REST API v1 - tworzenie płatności + weryfikacja webhooka.
//
// Podpis ŻĄDANIA (wg oficjalnego pay-now/paynow-php-sdk, generateV3):
//   base64(HMAC-SHA256(JSON.stringify({headers:{Api-Key,Idempotency-Key}, parameters:{}, body:<bodyString>}), Signature-Key))
//   JSON_UNESCAPED_SLASHES - JS JSON.stringify domyślnie nie escapuje '/', więc zgodne.
// Podpis WEBHOOKA (notyfikacja): base64(HMAC-SHA256(<rawBody>, Signature-Key)).

import { type Env } from './types';

const PAYNOW_API_BASE = 'https://api.paynow.pl';

async function hmacSha256Base64(message: string, key: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  const bytes = new Uint8Array(sig);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface PaynowPaymentResult {
  redirectUrl: string;
  paymentId: string;
  status: string;
}

// Tworzy płatność PayNow. amount w groszach (int). externalId = nasz identyfikator
// (z prefiksem v_/m_), unikalny, używany też jako Idempotency-Key (retry dedupe).
export async function createPaynowPayment(env: Env, p: {
  amount: number;
  externalId: string;
  description: string;
  email: string;
  continueUrl: string;
}): Promise<PaynowPaymentResult> {
  const apiKey = (env.PAYNOW_API_KEY || '').replace(/\s/g, '');
  const signatureKey = (env.PAYNOW_SIGNATURE_KEY || '').replace(/\s/g, '');
  if (!apiKey || !signatureKey) throw new Error('PayNow not configured');

  const idempotencyKey = p.externalId.slice(0, 45);
  const body = {
    amount: p.amount,
    currency: 'PLN',
    externalId: p.externalId,
    description: p.description.slice(0, 255),
    buyer: { email: p.email.slice(0, 50) },
    continueUrl: p.continueUrl.slice(0, 1000),
  };
  const bodyString = JSON.stringify(body);

  const signaturePayload = JSON.stringify({
    headers: { 'Api-Key': apiKey, 'Idempotency-Key': idempotencyKey },
    parameters: {},
    body: bodyString,
  });
  const signature = await hmacSha256Base64(signaturePayload, signatureKey);

  const res = await fetch(`${PAYNOW_API_BASE}/v1/payments`, {
    method: 'POST',
    headers: {
      'Api-Key': apiKey,
      'Signature': signature,
      'Idempotency-Key': idempotencyKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: bodyString,
  });

  const text = await res.text();
  if (!res.ok) {
    // Loguj status + body (bez sekretów) do diagnozy, ale nie wyciekaj klientowi.
    console.error('[paynow] create payment failed', { status: res.status, body: text.slice(0, 300) });
    throw new Error('PayNow payment creation failed');
  }

  const data = JSON.parse(text) as { redirectUrl?: string; paymentId?: string; status?: string };
  if (!data.redirectUrl || !data.paymentId) {
    throw new Error('PayNow returned no redirectUrl');
  }
  return { redirectUrl: data.redirectUrl, paymentId: data.paymentId, status: data.status || 'NEW' };
}

// Weryfikuje podpis notyfikacji webhooka (constant-time). rawBody musi być
// dokładnym tekstem requestu (przed JSON.parse).
export async function verifyPaynowSignature(rawBody: string, signatureHeader: string, signatureKey: string): Promise<boolean> {
  const key = (signatureKey || '').replace(/\s/g, '');
  if (!key || !signatureHeader) return false;
  const expected = await hmacSha256Base64(rawBody, key);
  return timingSafeEqual(signatureHeader.trim(), expected);
}
