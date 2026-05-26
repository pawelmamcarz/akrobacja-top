// KSeF API helper - MVP (do uzupelnienia o pelne sync invoices).
//
// Flow autoryzacji KSeF online sesji z API tokenem:
//   1. GET /online/Session/AuthorisationChallenge?... -> { challenge, timestamp }
//   2. RSA-OAEP encrypt (KSeF_TOKEN + challenge_timestamp) using KSeF public key
//   3. POST /online/Session/InitToken with encrypted blob -> { sessionToken }
//   4. Use sessionToken jako naglowek SessionToken: w kolejnych requestach (24h TTL)
//
// Query faktur:
//   POST /online/Query/Invoice/Sync (synchroniczne, paginacja)
//   Body: { queryCriteria: { subjectType: 'subject2' (purchase), date_range, page_size, page_offset } }
//
// Aktualnie zaimplementowane: getChallenge() - test ze NIP + auth.
// TODO: RSA encryption + initSession + queryInvoices + FA(2) XML parsing.

import { type Env } from './types';

const KSEF_BASE_URL = 'https://ksef.mf.gov.pl/api';

export interface AuthChallenge {
  challenge: string;
  timestamp: string;
}

export async function getAuthorisationChallenge(env: Env): Promise<AuthChallenge> {
  const nip = (env.KSEF_NIP || '').replace(/\s/g, '');
  if (!nip) throw new Error('KSEF_NIP not configured');
  if (!/^[0-9]{10}$/.test(nip)) throw new Error('KSEF_NIP must be 10 digits');

  const url = `${KSEF_BASE_URL}/online/Session/AuthorisationChallenge`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      contextIdentifier: {
        type: 'onip',
        identifier: nip,
      },
    }),
    signal: AbortSignal.timeout(20000),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`KSeF challenge HTTP ${res.status}: ${text.substring(0, 300)}`);
  }
  let parsed: { challenge?: string; timestamp?: string } = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`KSeF challenge: unparseable response: ${text.substring(0, 200)}`);
  }
  if (!parsed.challenge || !parsed.timestamp) {
    throw new Error(`KSeF challenge: missing fields: ${JSON.stringify(parsed)}`);
  }
  return { challenge: parsed.challenge, timestamp: parsed.timestamp };
}

// TODO: pelna implementacja:
// - rsaEncryptToken(token, challenge, ksefPublicKey): Promise<string> -> base64
// - initSession(env, challenge, encryptedToken): Promise<{ sessionToken, expirationTime }>
// - queryInvoicesPurchase(sessionToken, from, to, page): Promise<Invoice[]>
// - parseFA2Xml(xml): Invoice
// - terminateSession(sessionToken)
//
// KSeF public key (production): pobrac z https://ksef.mf.gov.pl/Files/KSeFPublicKey.txt
// (format: PEM lub DER base64). Cache w D1 lub hardcode w kodzie.

export interface KsefSelfTestResult {
  ok: boolean;
  step?: string;
  challenge?: AuthChallenge;
  error?: string;
}

export async function ksefSelfTest(env: Env): Promise<KsefSelfTestResult> {
  if (!env.KSEF_TOKEN) {
    return { ok: false, error: 'KSEF_TOKEN not configured w CF Pages secrets' };
  }
  if (!env.KSEF_NIP) {
    return { ok: false, error: 'KSEF_NIP not configured w CF Pages secrets' };
  }
  try {
    const challenge = await getAuthorisationChallenge(env);
    return {
      ok: true,
      step: 'challenge_only',
      challenge,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
