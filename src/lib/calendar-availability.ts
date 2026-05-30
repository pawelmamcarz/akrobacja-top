// Wspólne liczenie realnej dostępności samolotu na dany dzień.
// Jedno źródło prawdy dla /api/calendar/slots (kalendarz klienta) i
// /api/calendar/next-slots (propozycje terminów do vouchera).
//
// Slot 1-godzinny jest NIEDOSTĘPNY, gdy:
//  - jest już zarezerwowany (tabela slots, status != 'available'),
//  - dzień jest objęty availability_blocks,
//  - nachodzi na wpis calendar_events zajmujący samolot (lot, serwis mechanika,
//    trening, pokaz) - niezależnie od source (booking / manual / google).
//
// calendar_events trzyma czasy w ISO UTC ('...Z'); sloty liczone są w czasie
// warszawskim (wall-clock). Konwersja UTC->Warszawa przez Intl (pełne ICU w
// Workers), spójnie z warsawWallToUTC w functions/api/admin/calendar.ts.

import { type Env } from './types';
import { generateSlots } from './daylight';

// Typy calendar_events, które faktycznie zajmują samolot i blokują rezerwacje.
const BLOCKING_TYPES = ['flight', 'training', 'maintenance', 'show'];

export interface SlotAvailability {
  start: string;            // HH:MM
  end: string;              // HH:MM
  booked: boolean;          // niedostępny (rezerwacja lub event)
  blockedBy?: string;       // typ eventu, jeśli zablokowany przez calendar_events
}

export interface DayAvailability {
  blocked: boolean;         // cały dzień zablokowany (availability_blocks)
  reason?: string;
  slots: SlotAvailability[];
}

function hhmmToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// ISO UTC -> { date: 'YYYY-MM-DD', min } w czasie Europe/Warsaw.
function utcToWarsaw(iso: string): { date: string; min: number } {
  const dt = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(dt);
  const p: Record<string, string> = {};
  for (const part of parts) p[part.type] = part.value;
  const hour = parseInt(p.hour, 10) % 24; // en-CA bywa daje '24' dla północy
  return { date: `${p.year}-${p.month}-${p.day}`, min: hour * 60 + parseInt(p.minute, 10) };
}

interface BlockingInterval { startMin: number; endMin: number; type: string }

// Wpisy calendar_events nachodzące na dany dzień (czas warszawski), w minutach.
export async function getBlockingEventsForDate(env: Env, dateStr: string): Promise<BlockingInterval[]> {
  const placeholders = BLOCKING_TYPES.map(() => '?').join(',');
  // Wąskie okno po start_at (indeksowane): dzień ± 1, potem dokładny filtr w JS.
  const { results } = await env.DB.prepare(
    `SELECT start_at, end_at, type FROM calendar_events
     WHERE status != 'cancelled' AND type IN (${placeholders})
       AND date(start_at) BETWEEN date(?, '-1 day') AND date(?, '+1 day')`
  ).bind(...BLOCKING_TYPES, dateStr, dateStr).all<{ start_at: string; end_at: string; type: string }>();

  const intervals: BlockingInterval[] = [];
  for (const ev of results) {
    const s = utcToWarsaw(ev.start_at);
    const e = utcToWarsaw(ev.end_at);
    let startMin = s.date === dateStr ? s.min : (s.date < dateStr ? 0 : 24 * 60);
    let endMin = e.date === dateStr ? e.min : (e.date > dateStr ? 24 * 60 : 0);
    // Event w ogóle nie dotyka tego dnia.
    if (s.date > dateStr || e.date < dateStr) continue;
    if (endMin <= startMin) endMin = startMin + 60; // bezpiecznik na zdarzenia 0-min
    intervals.push({ startMin, endMin, type: ev.type });
  }
  return intervals;
}

// Pełna dostępność dnia: sloty + flagi booked/blockedBy. Bez pogody (warstwę
// pogodową dokłada /api/calendar/slots).
export async function getDayAvailability(env: Env, dateStr: string): Promise<DayAvailability> {
  const block = await env.DB.prepare(
    'SELECT reason FROM availability_blocks WHERE date_from <= ? AND date_to >= ?'
  ).bind(dateStr, dateStr).first<{ reason: string }>();
  if (block) return { blocked: true, reason: block.reason, slots: [] };

  const potential = generateSlots(dateStr);

  const { results: booked } = await env.DB.prepare(
    "SELECT start_time FROM slots WHERE date = ? AND status != 'available'"
  ).bind(dateStr).all<{ start_time: string }>();
  const bookedTimes = new Set(booked.map(b => b.start_time));

  const events = await getBlockingEventsForDate(env, dateStr);

  const slots: SlotAvailability[] = potential.map(slot => {
    const sMin = hhmmToMin(slot.start);
    const eMin = hhmmToMin(slot.end);
    const hit = events.find(ev => ev.startMin < eMin && ev.endMin > sMin);
    const isBooked = bookedTimes.has(slot.start) || !!hit;
    return { start: slot.start, end: slot.end, booked: isBooked, blockedBy: hit?.type };
  });

  return { blocked: false, slots };
}

// Najbliższe wolne terminy (do propozycji po zakupie vouchera). Skanuje dni od jutra.
// Bez pogody (propozycje sięgają dalej niż prognoza). Zwraca pierwsze `count` wolnych.
export async function getNextAvailableSlots(
  env: Env,
  count = 3,
  horizonDays = 60,
): Promise<Array<{ date: string; start: string; end: string }>> {
  const out: Array<{ date: string; start: string; end: string }> = [];
  const today = new Date();
  for (let i = 1; i <= horizonDays && out.length < count; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    const day = await getDayAvailability(env, dateStr);
    if (day.blocked) continue;
    for (const s of day.slots) {
      if (!s.booked) {
        out.push({ date: dateStr, start: s.start, end: s.end });
        if (out.length >= count) break;
      }
    }
  }
  return out;
}
