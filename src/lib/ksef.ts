// KSeF API helper - MVP (do uzupelnienia o pelne sync invoices).
//
// UWAGA: AP 1.0 / API 1.0 KSeF zostalo WYLACZONE (zwraca HTML "Koniec dzialania AP 1.0").
// Aktualnie obowiazuje KSeF 2.0 z nowymi endpointami. Endpointy ksef 2.0:
//   - https://ksef.mf.gov.pl/api/v2/sessions/online/initialization
//   - https://ksef.mf.gov.pl/api/v2/sessions/online/init
// Trzeba sprawdzic aktualna dokumentacje MF: https://www.gov.pl/web/kas/api-i-aktualne-wersje-srodowisk-ksef
//
// Token API wygenerowany w starym KSeF moze nie pasowac do v2 - moze byc wymagana
// migracja konta + ponowne wygenerowanie tokena.
//
// Aktualnie zaimplementowane: getAuthorisationChallenge() - probuje 1.0 i 2.0 endpointow.
// TODO: RSA encryption + initSession + queryInvoices + FA(2) XML parsing.

import { type Env } from './types';

const KSEF_BASE_URL = 'https://ksef.mf.gov.pl/api';
const KSEF_V2_BASE_URL = 'https://ksef.mf.gov.pl/api/v2';

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

// Test wielu URL-i (1.0, 2.0) zeby zobaczyc ktory dziala.
export async function ksefProbeEndpoints(env: Env): Promise<Array<{ url: string; status: number; sample: string }>> {
  const nip = (env.KSEF_NIP || '').replace(/\s/g, '');
  const urls = [
    'https://ksef.mf.gov.pl/api/online/Session/AuthorisationChallenge',
    'https://ksef.mf.gov.pl/api/v2/sessions/online/initialization',
    'https://ksef.mf.gov.pl/api/v2/online/Session/AuthorisationChallenge',
    'https://ksef.mf.gov.pl/api/v2/auth/challenge',
    'https://ksef.mf.gov.pl/api/v2/AuthorisationChallenge',
  ];
  const results: Array<{ url: string; status: number; sample: string }> = [];
  for (const url of urls) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ contextIdentifier: { type: 'onip', identifier: nip } }),
        signal: AbortSignal.timeout(10000),
      });
      const text = await r.text();
      results.push({ url, status: r.status, sample: text.substring(0, 200) });
    } catch (err) {
      results.push({ url, status: 0, sample: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}
