// POST /api/webhook/resend - odbiera Resend webhook events i loguje do D1.
//
// Resend wysyla webhook na kazde zdarzenie maila (email.sent, email.delivered,
// email.opened, email.clicked, email.bounced, email.complained,
// email.delivery_delayed, email.failed). Konfiguracja: Resend dashboard -> Webhooks
// -> Add Endpoint -> URL https://akrobacja.com/api/webhook/resend, secret zaczyna
// sie od 'whsec_' (Svix-compatible).
//
// Weryfikacja podpisu: Svix HMAC SHA256 (3 headery Svix-Id, Svix-Timestamp,
// Svix-Signature). Bez tego wpuscilibyśmy spoofing.

import { type Env } from '../../../src/lib/types';

interface ResendWebhookPayload {
  type: string;
  created_at: string;
  data: {
    email_id?: string;
    from?: string;
    to?: string[];
    subject?: string;
    tags?: Array<{ name: string; value: string }>;
    created_at?: string;
  };
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function verifySvixSignature(
  secret: string,
  svixId: string,
  svixTimestamp: string,
  body: string,
  signatureHeader: string,
): Promise<boolean> {
  if (!secret.startsWith('whsec_')) return false;
  const secretBytes = base64ToBytes(secret.slice('whsec_'.length));
  const signedContent = `${svixId}.${svixTimestamp}.${body}`;
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedContent)),
  );
  const expected = bytesToBase64(sig);
  // Header format: 'v1,base64sig v1,base64sig2' (multi-signature for rotation)
  const sigs = signatureHeader
    .split(' ')
    .map((s) => s.trim())
    .filter((s) => s.startsWith('v1,'))
    .map((s) => s.slice(3));
  return sigs.some((s) => s === expected);
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const secret = (ctx.env as any).RESEND_WEBHOOK_SECRET;
    if (!secret) {
      console.error('[resend-webhook] RESEND_WEBHOOK_SECRET not configured');
      return new Response('not_configured', { status: 500 });
    }

    const svixId = ctx.request.headers.get('svix-id') || '';
    const svixTimestamp = ctx.request.headers.get('svix-timestamp') || '';
    const svixSignature = ctx.request.headers.get('svix-signature') || '';
    if (!svixId || !svixTimestamp || !svixSignature) {
      return new Response('missing_svix_headers', { status: 400 });
    }

    const body = await ctx.request.text();
    const valid = await verifySvixSignature(secret, svixId, svixTimestamp, body, svixSignature);
    if (!valid) {
      console.warn('[resend-webhook] invalid signature');
      return new Response('invalid_signature', { status: 401 });
    }

    let payload: ResendWebhookPayload;
    try {
      payload = JSON.parse(body);
    } catch {
      return new Response('invalid_json', { status: 400 });
    }

    const type = (payload.type || 'unknown').slice(0, 80);
    const data = payload.data || ({} as ResendWebhookPayload['data']);
    const resendId = data.email_id || null;
    const sender = (data.from || '').slice(0, 200);
    const recipient = Array.isArray(data.to) && data.to[0] ? data.to[0].slice(0, 200) : null;
    const subject = (data.subject || '').slice(0, 300);
    const tags = data.tags || [];
    const tagType = tags.find((t) => t.name === 'type')?.value?.slice(0, 80) || null;
    const tagExtra = tags
      .filter((t) => t.name !== 'type')
      .map((t) => `${t.name}=${t.value}`)
      .join(',')
      .slice(0, 200) || null;

    await ctx.env.DB.prepare(
      `INSERT INTO email_events (id, resend_id, type, sender, recipient, subject, tag_type, tag_extra, raw_payload)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        crypto.randomUUID(),
        resendId,
        type,
        sender,
        recipient,
        subject,
        tagType,
        tagExtra,
        body.slice(0, 8000),
      )
      .run();

    return Response.json({ ok: true });
  } catch (err) {
    console.error('[resend-webhook] failed:', err);
    return new Response('server_error', { status: 500 });
  }
};
