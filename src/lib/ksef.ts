// KSeF API helper - MVP (do uzupelnienia o pelne sync invoices).
//
// KSeF 2.0 production: https://api.ksef.mf.gov.pl/v2 (v2.5.0 sprawdzone 2026-05-26).
// Stary host ksef.mf.gov.pl/api zostal wylaczony ("Koniec dzialania AP 1.0").
//
// Flow autoryzacji KSeF 2.0:
//   1. POST /v2/auth/challenge  (bez auth) -> { challenge, timestamp, timestampMs }
//   2. RSA-OAEP encrypt (KSEF_TOKEN + timestampMs) z KSeF public key
//   3. POST /v2/auth/token-signature z { contextIdentifier, encryptedToken } -> { sessionToken, ... }
//   4. Header SessionToken: w kolejnych requestach (24h TTL)
//
// Query faktur 2.0:
//   POST /v2/invoices/query lub /v2/invoices/sync z paginacja
//
// Aktualnie zaimplementowane: getAuthorisationChallenge() (action 1).
// TODO: RSA encryption + initSession + queryInvoices + FA(2) XML parsing.

import { type Env } from './types';

const KSEF_BASE_URL = 'https://api.ksef.mf.gov.pl/v2';

export interface AuthChallenge {
  challenge: string;
  timestamp: string;
  timestampMs: number;
}

export async function getAuthorisationChallenge(_env: Env): Promise<AuthChallenge> {
  // POST /v2/auth/challenge - public endpoint, bez NIP w body.
  // NIP idzie w kolejnym kroku przy InitToken.
  const url = `${KSEF_BASE_URL}/auth/challenge`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(20000),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`KSeF challenge HTTP ${res.status}: ${text.substring(0, 300)}`);
  }
  let parsed: { challenge?: string; timestamp?: string; timestampMs?: number } = {};
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`KSeF challenge: unparseable response: ${text.substring(0, 200)}`);
  }
  if (!parsed.challenge || !parsed.timestamp || parsed.timestampMs == null) {
    throw new Error(`KSeF challenge: missing fields: ${JSON.stringify(parsed)}`);
  }
  return { challenge: parsed.challenge, timestamp: parsed.timestamp, timestampMs: parsed.timestampMs };
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

// Test wielu URL-i (1.0, 2.0, rozne domeny) zeby zobaczyc ktory dziala.
// api.ksef.mf.gov.pl zwroci 405 na POST do /v2/sessions/AuthorisationChallenge - czyli
// endpoint zyje ale inna metoda lub inny path.
export async function ksefProbeEndpoints(env: Env): Promise<Array<{ url: string; method: string; status: number; sample: string }>> {
  const nip = (env.KSEF_NIP || '').replace(/\s/g, '');
  const HOST = 'https://api.ksef.mf.gov.pl';
  // Roznych wariantow - kombinacje method + path
  const probes: Array<{ url: string; method: string; body?: unknown }> = [
    { url: `${HOST}/v2/sessions/AuthorisationChallenge`, method: 'GET' },
    { url: `${HOST}/v2/sessions/online/init`, method: 'POST', body: { contextIdentifier: { type: 'onip', identifier: nip } } },
    { url: `${HOST}/v2/sessions/online/initialization`, method: 'POST', body: { contextIdentifier: { type: 'onip', identifier: nip } } },
    { url: `${HOST}/v2/sessions/init`, method: 'POST', body: { contextIdentifier: { type: 'onip', identifier: nip } } },
    { url: `${HOST}/v2/auth/challenge`, method: 'POST', body: { contextIdentifier: { type: 'onip', identifier: nip } } },
    { url: `${HOST}/v2/health`, method: 'GET' },
    { url: `${HOST}/v2/info`, method: 'GET' },
    { url: `${HOST}/`, method: 'GET' },
    { url: `${HOST}/v2/`, method: 'GET' },
    { url: `${HOST}/v2/swagger`, method: 'GET' },
    { url: `${HOST}/v2/openapi`, method: 'GET' },
  ];
  const results: Array<{ url: string; method: string; status: number; sample: string }> = [];
  for (const p of probes) {
    try {
      const opts: RequestInit = {
        method: p.method,
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000),
      };
      if (p.body !== undefined) opts.body = JSON.stringify(p.body);
      const r = await fetch(p.url, opts);
      const text = await r.text();
      results.push({ url: p.url, method: p.method, status: r.status, sample: text.substring(0, 250) });
    } catch (err) {
      results.push({ url: p.url, method: p.method, status: 0, sample: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}
