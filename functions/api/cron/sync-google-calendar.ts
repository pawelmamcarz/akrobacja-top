// Cron: sync publicznego kalendarza Google (iCal) -> calendar_events (source='google').
// Wywoływany przez zewnętrzny scheduler co ~15 min z Authorization: Bearer ${CRON_SECRET}.
//
// Efekt: lot/serwis dodany w Google pojawia się na stronie i blokuje sloty klienta
// (przez src/lib/calendar-availability.ts). Usunięcie eventu w Google -> status
// 'cancelled' przy najbliższym syncu (slot znów wolny). Idempotentne.
//
// Setup: ustawić wspólny kalendarz Google jako publiczny, skopiować "Secret address
// in iCal format" i zapisać jako secret GOOGLE_CALENDAR_ICS_URL.

import { type Env } from '../../../src/lib/types';
import { parseIcs } from '../../../src/lib/ics-parse';

const DEFAULT_PILOT = 'pilot-maciej';
const DEFAULT_AIRCRAFT = 'speks-001';

// Typ calendar_events z tytułu eventu Google (PL/EN). Domyślnie 'flight'.
function eventType(summary: string): string {
  const s = summary.toLowerCase();
  if (/serwis|maintenance|przegl|naprawa|konserwacj|adsb|usterk/.test(s)) return 'maintenance';
  if (/trening|szkolen|nauka|lekcj/.test(s)) return 'training';
  if (/pokaz|airshow|\bshow\b|event/.test(s)) return 'show';
  return 'flight';
}

function icsStatusToDb(status: string): string {
  if (status === 'CANCELLED') return 'cancelled';
  if (status === 'TENTATIVE') return 'tentative';
  return 'confirmed';
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const expected = ctx.env.CRON_SECRET;
  if (!expected) {
    return Response.json({ error: 'Cron not configured' }, { status: 500 });
  }
  const auth = ctx.request.headers.get('Authorization') || '';
  if (auth !== `Bearer ${expected}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const icsUrl = ctx.env.GOOGLE_CALENDAR_ICS_URL;
  if (!icsUrl) {
    return Response.json({ ok: true, skipped: 'GOOGLE_CALENDAR_ICS_URL not set' });
  }

  let text: string;
  try {
    const res = await fetch(icsUrl, { headers: { 'User-Agent': 'akrobacja.com-calendar-sync' } });
    if (!res.ok) throw new Error(`ICS fetch ${res.status}`);
    text = await res.text();
  } catch (err) {
    return Response.json({ error: 'ICS fetch failed', detail: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }

  let events;
  try {
    events = parseIcs(text);
  } catch (err) {
    return Response.json({ error: 'ICS parse failed', detail: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }

  // Synchronizujemy okno: od 7 dni wstecz do +365 dni (pomijamy stare archiwum).
  const now = Date.now();
  const windowStart = now - 7 * 86400_000;
  const windowEnd = now + 365 * 86400_000;

  let synced = 0;
  const seenIds: string[] = [];
  for (const ev of events) {
    try {
      const endMs = new Date(ev.endUtc).getTime();
      const startMs = new Date(ev.startUtc).getTime();
      if (isNaN(startMs) || isNaN(endMs)) continue;
      if (endMs < windowStart || startMs > windowEnd) continue;

      const id = `gcal:${ev.uid}`;
      seenIds.push(id);
      const type = eventType(ev.summary);
      const status = icsStatusToDb(ev.status);

      // Dla wierszy app-origin (source='booking'/'manual' - powstały z zapisu strona->Google)
      // NIE nadpisujemy tytułu/typu generykiem z publicznego kalendarza (chronimy lokalne dane
      // klienta). Czasy i status aktualizujemy zawsze (reschedule/odwołanie w Google działa).
      await ctx.env.DB.prepare(
        `INSERT INTO calendar_events (id, pilot_id, aircraft_id, type, title, start_at, end_at, status, source, created_by, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'google', 'google-sync', datetime('now'))
         ON CONFLICT(id) DO UPDATE SET
           type = CASE WHEN calendar_events.source = 'google' THEN excluded.type ELSE calendar_events.type END,
           title = CASE WHEN calendar_events.source = 'google' THEN excluded.title ELSE calendar_events.title END,
           start_at = excluded.start_at, end_at = excluded.end_at, status = excluded.status,
           updated_at = datetime('now')`
      ).bind(id, DEFAULT_PILOT, DEFAULT_AIRCRAFT, type, ev.summary || 'Lot', ev.startUtc, ev.endUtc, status).run();
      synced++;
    } catch {
      // Pojedynczy zły event nie wywala całego syncu.
      continue;
    }
  }

  // Reconcile: eventy z source='google', których już nie ma w ICS -> cancelled.
  let cancelled = 0;
  try {
    const { results } = await ctx.env.DB.prepare(
      "SELECT id FROM calendar_events WHERE source = 'google' AND status != 'cancelled'"
    ).all<{ id: string }>();
    const seen = new Set(seenIds);
    for (const row of results) {
      if (!seen.has(row.id)) {
        await ctx.env.DB.prepare(
          "UPDATE calendar_events SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?"
        ).bind(row.id).run();
        cancelled++;
      }
    }
  } catch { /* best-effort */ }

  return Response.json({ ok: true, parsed: events.length, synced, cancelled });
};

export const onRequestPost = onRequestGet;
