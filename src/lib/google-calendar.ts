// Zapis do Google Calendar API (kierunek strona -> Google) przez konto serwisowe.
// Komplementarny do odczytu (cron sync-google-calendar zaciąga publiczny iCal).
//
// Auth: service account (JWT RS256 -> access token), bez bibliotek - crypto.subtle
// w Workers. Wymaga sekretów:
//   GOOGLE_SA_CLIENT_EMAIL  - e-mail konta serwisowego
//   GOOGLE_SA_PRIVATE_KEY   - klucz prywatny PEM (z pliku JSON; \n mogą być literalne)
//   GOOGLE_CALENDAR_ID      - id kalendarza "Loty akrobacja.com" (var)
// Konto serwisowe musi mieć udostępniony kalendarz z prawem "Wprowadzanie zmian".
//
// Wszystkie funkcje są best-effort: brak konfiguracji / błąd API zwraca null i NIE
// wywala flow biznesowego (rezerwacji/eventu).

import { type Env } from './types';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/calendar';

function b64urlFromString(s: string): string {
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlFromBytes(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem
    .replace(/\\n/g, '\n')                  // sekret z literalnymi \n
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const bin = atob(body);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

export function isGoogleWriteConfigured(env: Env): boolean {
  return !!(env.GOOGLE_SA_CLIENT_EMAIL && env.GOOGLE_SA_PRIVATE_KEY && env.GOOGLE_CALENDAR_ID);
}

async function getAccessToken(env: Env): Promise<string | null> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const header = b64urlFromString(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claim = b64urlFromString(JSON.stringify({
      iss: env.GOOGLE_SA_CLIENT_EMAIL,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }));
    const unsigned = `${header}.${claim}`;
    const key = await crypto.subtle.importKey(
      'pkcs8',
      pemToPkcs8(env.GOOGLE_SA_PRIVATE_KEY as string),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
    const jwt = `${unsigned}.${b64urlFromBytes(sig)}`;

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    });
    if (!res.ok) return null;
    const j = await res.json<{ access_token?: string }>();
    return j.access_token ?? null;
  } catch {
    return null;
  }
}

function calApi(calendarId: string, path = ''): string {
  return `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events${path}`;
}

export interface GoogleEventInput {
  summary: string;
  description?: string;
  startUtc: string;   // ISO UTC
  endUtc: string;     // ISO UTC
}

// Tworzy event w Google. Zwraca { id, iCalUID } albo null (best-effort).
export async function createGoogleEvent(env: Env, ev: GoogleEventInput): Promise<{ id: string; iCalUID: string } | null> {
  if (!isGoogleWriteConfigured(env)) return null;
  const token = await getAccessToken(env);
  if (!token) return null;
  try {
    const res = await fetch(calApi(env.GOOGLE_CALENDAR_ID as string), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: ev.summary,
        description: ev.description,
        start: { dateTime: ev.startUtc, timeZone: 'Europe/Warsaw' },
        end: { dateTime: ev.endUtc, timeZone: 'Europe/Warsaw' },
      }),
    });
    if (!res.ok) return null;
    const j = await res.json<{ id?: string; iCalUID?: string }>();
    if (!j.id || !j.iCalUID) return null;
    return { id: j.id, iCalUID: j.iCalUID };
  } catch {
    return null;
  }
}

export async function patchGoogleEvent(env: Env, googleEventId: string, ev: Partial<GoogleEventInput>): Promise<boolean> {
  if (!isGoogleWriteConfigured(env)) return false;
  const token = await getAccessToken(env);
  if (!token) return false;
  try {
    const body: Record<string, unknown> = {};
    if (ev.summary !== undefined) body.summary = ev.summary;
    if (ev.description !== undefined) body.description = ev.description;
    if (ev.startUtc) body.start = { dateTime: ev.startUtc, timeZone: 'Europe/Warsaw' };
    if (ev.endUtc) body.end = { dateTime: ev.endUtc, timeZone: 'Europe/Warsaw' };
    const res = await fetch(calApi(env.GOOGLE_CALENDAR_ID as string, `/${encodeURIComponent(googleEventId)}`), {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteGoogleEvent(env: Env, googleEventId: string): Promise<boolean> {
  if (!isGoogleWriteConfigured(env)) return false;
  const token = await getAccessToken(env);
  if (!token) return false;
  try {
    const res = await fetch(calApi(env.GOOGLE_CALENDAR_ID as string, `/${encodeURIComponent(googleEventId)}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok || res.status === 410; // 410 = już usunięty
  } catch {
    return false;
  }
}
