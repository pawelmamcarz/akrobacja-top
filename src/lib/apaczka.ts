// Apaczka.pl Web API v2 - tworzenie przesyłki (order_send) + pobranie etykiety (waybill).
// Broker kurierski: jedno konto Pawła, wiele usług (kurier pod adres, paczkomat InPost).
//
// Auth (wg oficjalnej dokumentacji v2): każde żądanie to POST application/x-www-form-urlencoded
// z polami app_id, request (JSON danych), expires (unix, max 30 min), signature.
//   signature = hex( HMAC-SHA256( "{app_id}:{route}:{request}:{expires}", app_secret ) )
// Server liczy podpis z otrzymanych pól, więc kluczowe jest, by podpisać DOKŁADNIE ten sam
// string (route + request + expires), który wysyłamy.
//
// Funkcje rzucają błędy z czytelnym komunikatem — etykietę generuje dostawca przyciskiem,
// błąd ma być widoczny w panelu, nie cichy.

import { type Env } from './types';

const APACZKA_API_BASE = 'https://www.apaczka.pl/api/v2/';

async function hmacSha256Hex(message: string, key: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  const bytes = new Uint8Array(sig);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
  return hex;
}

interface ApaczkaResponse {
  status: number;
  message?: string;
  response?: Record<string, unknown>;
}

// Niskopoziomowe wywołanie API. route = identyfikator trasy z końcowym '/'
// (np. 'order_send/', 'waybill/123/'); URL = base + route; podpis liczony z tego samego route.
async function call(env: Env, route: string, data: unknown): Promise<Record<string, unknown>> {
  const appId = (env.APACZKA_APP_ID || '').replace(/\s/g, '');
  const appSecret = (env.APACZKA_API_KEY || '').replace(/\s/g, '');
  if (!appId || !appSecret) throw new Error('Apaczka nie skonfigurowana (brak APACZKA_APP_ID / APACZKA_API_KEY)');

  const request = JSON.stringify(data ?? {});
  const expires = Math.floor(Date.now() / 1000) + 1800; // +30 min (maks. dopuszczalne)
  const stringToSign = `${appId}:${route}:${request}:${expires}`;
  const signature = await hmacSha256Hex(stringToSign, appSecret);

  const form = new URLSearchParams();
  form.append('app_id', appId);
  form.append('request', request);
  form.append('expires', String(expires));
  form.append('signature', signature);

  const res = await fetch(`${APACZKA_API_BASE}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
    signal: AbortSignal.timeout(20000),
  });

  const text = await res.text();
  let parsed: ApaczkaResponse;
  try {
    parsed = JSON.parse(text) as ApaczkaResponse;
  } catch {
    console.error('[apaczka] non-JSON response', { route, status: res.status, body: text.slice(0, 300) });
    throw new Error(`Apaczka: nieprawidłowa odpowiedź (HTTP ${res.status})`);
  }
  if (parsed.status !== 200) {
    console.error('[apaczka] api error', { route, status: parsed.status, message: parsed.message });
    throw new Error(`Apaczka: ${parsed.message || `błąd ${parsed.status}`}`);
  }
  return parsed.response ?? {};
}

export interface ApaczkaReceiver {
  name: string;
  line1: string;       // ulica i numer (przy paczkomacie nieobowiązkowe)
  postalCode: string;
  city: string;
  phone: string;
  email: string;
}

export interface CreateApaczkaOrderInput {
  receiver: ApaczkaReceiver;
  deliveryMethod: 'courier' | 'inpost_locker';
  inpostPointCode?: string | null;   // ID punktu apaczka, gdy paczkomat
  weightG: number;                   // waga paczki w gramach
}

export interface ApaczkaOrderResult {
  apaczkaOrderId: string;
  waybillNumber: string | null;      // numer listu przewozowego (tracking)
}

function senderAddress(env: Env): Record<string, unknown> {
  return {
    country_code: 'PL',
    name: env.APACZKA_SENDER_NAME || '',
    line1: env.APACZKA_SENDER_LINE1 || '',
    line2: '',
    postal_code: env.APACZKA_SENDER_POSTAL || '',
    city: env.APACZKA_SENDER_CITY || '',
    contact_person: env.APACZKA_SENDER_CONTACT || env.APACZKA_SENDER_NAME || '',
    email: env.APACZKA_SENDER_EMAIL || '',
    phone: env.APACZKA_SENDER_PHONE || '',
    foreign_address_id: '',
  };
}

// Tworzy przesyłkę w apaczka (order_send). Zwraca id zamówienia apaczka + numer listu.
export async function createApaczkaOrder(env: Env, input: CreateApaczkaOrderInput): Promise<ApaczkaOrderResult> {
  const isLocker = input.deliveryMethod === 'inpost_locker';
  const serviceId = isLocker
    ? (env.APACZKA_SERVICE_ID_INPOST || '').replace(/\s/g, '')
    : (env.APACZKA_SERVICE_ID_COURIER || '').replace(/\s/g, '');
  if (!serviceId) {
    throw new Error(`Apaczka: brak service_id dla ${isLocker ? 'paczkomatu' : 'kuriera'} (ustaw APACZKA_SERVICE_ID_*)`);
  }
  if (isLocker && !input.inpostPointCode) {
    throw new Error('Apaczka: brak kodu paczkomatu dla przesyłki do paczkomatu');
  }

  const weightKg = Math.max(0.1, (input.weightG || 1000) / 1000);
  const receiver: Record<string, unknown> = {
    country_code: 'PL',
    name: input.receiver.name,
    line1: input.receiver.line1 || '',
    line2: '',
    postal_code: input.receiver.postalCode || '',
    city: input.receiver.city || '',
    contact_person: input.receiver.name,
    email: input.receiver.email || '',
    phone: (input.receiver.phone || '').replace(/[^0-9]/g, ''),
    // Punkt odbioru (paczkomat) wskazujemy przez foreign_address_id z /points/.
    foreign_address_id: isLocker ? String(input.inpostPointCode) : '',
  };

  const order = {
    service_id: Number(serviceId),
    address: { sender: senderAddress(env), receiver },
    shipment: [
      {
        dimension1: 20,
        dimension2: 15,
        dimension3: 10,
        weight: weightKg,
        shipment_type_code: 'PACZKA',
        is_nstd: 0,
      },
    ],
    pickup: { type: 'SELF' },
    comment: '',
    content: 'Merch akrobacja.com',
  };

  const response = await call(env, 'order_send/', { order });
  // Kształt: response.order = { id, waybill_number, ... }. Pola potwierdzić na żywym kluczu.
  const orderObj = (response.order ?? response) as Record<string, unknown>;
  const apaczkaOrderId = String(orderObj.id ?? orderObj.order_id ?? '');
  if (!apaczkaOrderId) {
    console.error('[apaczka] order_send без id', { response });
    throw new Error('Apaczka: nie zwróciła id przesyłki');
  }
  const waybillNumber = (orderObj.waybill_number ?? orderObj.tracking_number ?? null) as string | null;
  return { apaczkaOrderId, waybillNumber: waybillNumber ? String(waybillNumber) : null };
}

// Pobiera etykietę (list przewozowy) jako PDF. Apaczka zwraca base64 w response.waybill.
export async function getApaczkaWaybill(env: Env, apaczkaOrderId: string): Promise<ArrayBuffer> {
  const response = await call(env, `waybill/${encodeURIComponent(apaczkaOrderId)}/`, {});
  const b64 = (response.waybill ?? response.label ?? '') as string;
  if (!b64) throw new Error('Apaczka: brak etykiety w odpowiedzi');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

// Lista punktów odbioru (paczkomaty) dla wyboru w checkout, gdy nie używamy widżetu mapy.
// type: 'inpost' | 'ups' | 'poczta' itd. Best-effort — zwraca surową listę z apaczka.
export async function listApaczkaPoints(env: Env, type = 'inpost', data: Record<string, unknown> = {}): Promise<unknown[]> {
  const response = await call(env, `points/${encodeURIComponent(type)}/`, data);
  const points = (response.points ?? response.list ?? []) as unknown[];
  return Array.isArray(points) ? points : [];
}

export interface ApaczkaService {
  id: string;
  name: string;
  deliveryType: string;  // wskazówka, która usługa to kurier vs paczkomat
}

// Lista dostępnych usług (service_structure) — żeby odczytać numeryczne service_id
// do konfiguracji APACZKA_SERVICE_ID_COURIER / _INPOST. Narzędzie odkrywcze (panel).
export async function listApaczkaServices(env: Env): Promise<ApaczkaService[]> {
  const response = await call(env, 'service_structure/', {});
  const raw = (response.services ?? response.list ?? []) as Array<Record<string, unknown>>;
  return (Array.isArray(raw) ? raw : [])
    .map(s => ({
      id: String(s.service_id ?? s.id ?? ''),
      name: String(s.name ?? s.service_name ?? s.supplier ?? ''),
      deliveryType: String(s.delivery_type ?? s.type ?? s.door ?? ''),
    }))
    .filter(s => s.id);
}
