// Analiza zdjęcia papierowego dziennika technicznego przez Cloudflare Workers AI
// (model wizyjny). Wyciąga pola wpisu do JSON. Wynik ZAWSZE wymaga recenzji
// człowieka przed zapisem do dziennika - model bywa niedokładny na piśmie odręcznym.

import { type Env } from './types';

const VISION_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';

export interface LogbookFields {
  flight_date: string | null;   // YYYY-MM-DD
  flights_count: number | null;
  flight_minutes: number | null;
  landings: number | null;
  hours_after: number | null;   // nalot narastająco (h)
  fuel_l: number | null;
  remarks: string | null;
}

export interface LogbookExtraction {
  fields: LogbookFields;
  raw: string;
}

const EMPTY: LogbookFields = {
  flight_date: null, flights_count: null, flight_minutes: null,
  landings: null, hours_after: null, fuel_l: null, remarks: null,
};

const PROMPT = [
  'Przeanalizuj zdjęcie strony dziennika technicznego samolotu (po polsku, często pismo odręczne).',
  'Zwróć WYŁĄCZNIE obiekt JSON z polami (użyj null gdy nie odczytasz danego pola):',
  '{"flight_date":"YYYY-MM-DD","flights_count":<int>,"flight_minutes":<int laczny czas lotu w minutach>,',
  '"landings":<int>,"hours_after":<float nalot narastajaco w godzinach po locie>,"fuel_l":<float litry paliwa>,',
  '"remarks":"<uwagi/usterki lub null>"}',
  'Nie dodawaj komentarzy ani tekstu poza JSON.',
].join(' ');

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(',', '.').replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
function int(v: unknown): number | null {
  const n = num(v);
  return n === null ? null : Math.round(n);
}
function str(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s.length ? s.slice(0, 1000) : null;
}

export async function extractLogbook(env: Env, imageBytes: Uint8Array): Promise<LogbookExtraction> {
  let raw = '';
  try {
    // Workers AI model wizyjny: image jako tablica bajtów (0-255).
    const ai = (env as unknown as { AI: { run: (m: string, i: Record<string, unknown>) => Promise<unknown> } }).AI;
    const out = await ai.run(VISION_MODEL, {
      image: Array.from(imageBytes),
      prompt: PROMPT,
      max_tokens: 512,
    });
    raw = typeof out === 'string'
      ? out
      : ((out as { response?: string; description?: string })?.response
        ?? (out as { description?: string })?.description
        ?? JSON.stringify(out));
  } catch (err) {
    console.error('[vision] extractLogbook AI call failed:', err);
    return { fields: { ...EMPTY }, raw: '' };
  }

  // Wyłuskaj pierwszy obiekt JSON z odpowiedzi (model lubi dokleić tekst).
  let parsed: Record<string, unknown> = {};
  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try { parsed = JSON.parse(match[0]) as Record<string, unknown>; } catch { /* zostaje EMPTY */ }
  }

  const fields: LogbookFields = {
    flight_date: str(parsed.flight_date),
    flights_count: int(parsed.flights_count),
    flight_minutes: int(parsed.flight_minutes),
    landings: int(parsed.landings),
    hours_after: num(parsed.hours_after),
    fuel_l: num(parsed.fuel_l),
    remarks: str(parsed.remarks),
  };
  return { fields, raw: raw.slice(0, 4000) };
}
