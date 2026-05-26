import { type Env, type CalendarEvent } from '../../../src/lib/types';
import { buildICS, type IcsEventInput } from '../../../src/lib/ics';

// GET /api/calendar/feed.ics?token=XYZ
// Zwraca text/calendar z eventami pilota powiazanego z tokenem.
// Zakres: ostatnie 30 dni + nadchodzace 365 dni, max 500 wierszy.

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);
  const token = url.searchParams.get('token');

  if (!token || !/^[a-f0-9]{32,128}$/.test(token)) {
    return new Response('Invalid token', { status: 401 });
  }

  const pilot = await ctx.env.DB.prepare(
    'SELECT id, name, email FROM pilots WHERE calendar_token = ? LIMIT 1'
  ).bind(token).first<{ id: string; name: string | null; email: string | null }>();
  if (!pilot) {
    return new Response('Token not found', { status: 404 });
  }

  const now = Date.now();
  const fromIso = new Date(now - 30 * 24 * 3600 * 1000).toISOString();
  const toIso = new Date(now + 365 * 24 * 3600 * 1000).toISOString();

  const { results } = await ctx.env.DB.prepare(
    `SELECT e.id, e.type, e.title, e.notes, e.start_at, e.end_at, e.status, a.tail AS aircraft_tail
     FROM calendar_events e
     LEFT JOIN aircrafts a ON a.id = e.aircraft_id
     WHERE e.pilot_id = ?
       AND e.end_at >= ?
       AND e.start_at <= ?
     ORDER BY e.start_at
     LIMIT 500`
  ).bind(pilot.id, fromIso, toIso).all<{
    id: string;
    type: CalendarEvent['type'];
    title: string | null;
    notes: string | null;
    start_at: string;
    end_at: string;
    status: CalendarEvent['status'];
    aircraft_tail: string | null;
  }>();

  const events: IcsEventInput[] = results.map((r) => ({
    id: r.id,
    start_at: r.start_at,
    end_at: r.end_at,
    type: r.type,
    title: r.title,
    notes: r.notes,
    status: r.status,
    pilot_name: pilot.name,
    aircraft_tail: r.aircraft_tail,
  }));

  const calName = `akrobacja.com - ${pilot.name || 'Pilot'}`;
  const ics = buildICS(events, { calName, method: 'PUBLISH' });

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="akrobacja-${pilot.id}.ics"`,
      // Cache 5 min - GCal/Apple Calendar i tak refreshuja co kilka godzin,
      // ale przy reczym refresh w panelu chcemy szybkie odswiezenie.
      'Cache-Control': 'private, max-age=300',
    },
  });
};
