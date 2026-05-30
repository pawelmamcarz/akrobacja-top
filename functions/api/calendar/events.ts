import { type Env, type CalendarEvent } from '../../../src/lib/types';
import { checkAdminAuthAsync, getAdminUserAsync } from '../../../src/lib/admin-auth';
import { buildSingleEventICS, type IcsEventInput } from '../../../src/lib/ics';
import { sendEventEmailWithICS, escapeHtml } from '../../../src/lib/email';
import { createGoogleEvent } from '../../../src/lib/google-calendar';

interface EventCreateBody {
  pilot_id: string;
  aircraft_id?: string | null;
  type: CalendarEvent['type'];
  title?: string;
  notes?: string;
  start_at: string;                 // ISO UTC
  end_at: string;
  status?: CalendarEvent['status'];
  notify?: boolean;                 // domyslnie true: wyslij ICS mail do pilota + info@
}

const ALLOWED_TYPES = new Set<CalendarEvent['type']>(['flight', 'training', 'maintenance', 'show', 'other']);
const ALLOWED_STATUS = new Set<CalendarEvent['status']>(['confirmed', 'tentative', 'cancelled']);

// GET /api/calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD&pilot_id=&aircraft_id=&type=&available_only=1
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (!(await checkAdminAuthAsync(ctx.request, ctx.env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(ctx.request.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const pilotId = url.searchParams.get('pilot_id');
  const aircraftId = url.searchParams.get('aircraft_id');
  const type = url.searchParams.get('type');
  const availableOnly = url.searchParams.get('available_only') === '1';

  if (availableOnly) {
    if (!from || !to) {
      return Response.json({ error: 'available_only wymaga from i to' }, { status: 400 });
    }
    const rangeStart = `${from}T00:00:00Z`;
    const rangeEnd = `${to}T23:59:59Z`;
    const { results } = await ctx.env.DB.prepare(
      `SELECT a.id, a.tail, a.type
       FROM aircrafts a
       WHERE a.active = 1
         AND NOT EXISTS (
           SELECT 1 FROM calendar_events e
           WHERE e.aircraft_id = a.id
             AND e.status != 'cancelled'
             AND e.start_at < ?
             AND e.end_at > ?
         )`
    ).bind(rangeEnd, rangeStart).all();
    return Response.json({ available: results });
  }

  const where: string[] = [];
  const binds: (string | number)[] = [];
  if (from) { where.push('end_at >= ?'); binds.push(`${from}T00:00:00Z`); }
  if (to)   { where.push('start_at <= ?'); binds.push(`${to}T23:59:59Z`); }
  if (pilotId) { where.push('pilot_id = ?'); binds.push(pilotId); }
  if (aircraftId) { where.push('aircraft_id = ?'); binds.push(aircraftId); }
  if (type && ALLOWED_TYPES.has(type as CalendarEvent['type'])) {
    where.push('type = ?'); binds.push(type);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const { results } = await ctx.env.DB.prepare(
    `SELECT e.*, p.name AS pilot_name, p.email AS pilot_email, a.tail AS aircraft_tail
     FROM calendar_events e
     LEFT JOIN pilots p ON p.id = e.pilot_id
     LEFT JOIN aircrafts a ON a.id = e.aircraft_id
     ${whereSql}
     ORDER BY start_at
     LIMIT 500`
  ).bind(...binds).all();

  return Response.json({ events: results });
};

// POST /api/calendar/events - admin tworzy nowy wielogodzinny event
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const adminUser = await getAdminUserAsync(ctx.request, ctx.env);
  if (!adminUser) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await ctx.request.json()) as EventCreateBody;

  if (!body.pilot_id || !body.type || !body.start_at || !body.end_at) {
    return Response.json({ error: 'Brakuje pol: pilot_id, type, start_at, end_at' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(body.type)) {
    return Response.json({ error: 'Nieprawidlowy typ eventu' }, { status: 400 });
  }
  const status: CalendarEvent['status'] = body.status && ALLOWED_STATUS.has(body.status) ? body.status : 'confirmed';

  const startMs = Date.parse(body.start_at);
  const endMs = Date.parse(body.end_at);
  if (isNaN(startMs) || isNaN(endMs) || startMs >= endMs) {
    return Response.json({ error: 'start_at musi byc przed end_at i obie ISO' }, { status: 400 });
  }

  const pilot = await ctx.env.DB.prepare(
    'SELECT id, name, email FROM pilots WHERE id = ?'
  ).bind(body.pilot_id).first<{ id: string; name: string | null; email: string | null }>();
  if (!pilot) return Response.json({ error: 'Pilot nie znaleziony' }, { status: 404 });

  let aircraftTail: string | null = null;
  if (body.aircraft_id) {
    const air = await ctx.env.DB.prepare(
      'SELECT tail FROM aircrafts WHERE id = ?'
    ).bind(body.aircraft_id).first<{ tail: string }>();
    if (!air) return Response.json({ error: 'Samolot nie znaleziony' }, { status: 404 });
    aircraftTail = air.tail;
  }

  const startIso = new Date(startMs).toISOString();
  const endIso = new Date(endMs).toISOString();

  // Zapis do Google (best-effort). Gdy się uda, lokalne id = gcal:<iCalUID>, żeby
  // późniejszy odczyt ICS trafił w ten sam wiersz (ON CONFLICT) - bez duplikatu/pętli.
  const g = await createGoogleEvent(ctx.env, {
    summary: body.title || body.type,
    description: body.notes || undefined,
    startUtc: startIso,
    endUtc: endIso,
  });
  const id = g ? `gcal:${g.iCalUID}` : crypto.randomUUID();

  await ctx.env.DB.prepare(
    `INSERT INTO calendar_events (id, pilot_id, aircraft_id, type, title, notes, start_at, end_at, status, source, created_by, google_event_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?)
     ON CONFLICT(id) DO UPDATE SET title=excluded.title, notes=excluded.notes, type=excluded.type,
       start_at=excluded.start_at, end_at=excluded.end_at, status=excluded.status,
       google_event_id=excluded.google_event_id, updated_at=datetime('now')`
  ).bind(
    id,
    body.pilot_id,
    body.aircraft_id || null,
    body.type,
    body.title || null,
    body.notes || null,
    startIso,
    endIso,
    status,
    adminUser,
    g?.id ?? null,
  ).run();

  if (body.notify !== false && pilot.email) {
    const icsEvent: IcsEventInput = {
      id,
      start_at: new Date(startMs).toISOString(),
      end_at: new Date(endMs).toISOString(),
      type: body.type,
      title: body.title,
      notes: body.notes,
      status,
      pilot_name: pilot.name,
      aircraft_tail: aircraftTail,
    };
    const ics = buildSingleEventICS(
      icsEvent,
      `akrobacja.com - ${pilot.name || pilot.email}`,
      'maciej@akrobacja.com',
      pilot.email,
    );
    const startWarsaw = formatWarsaw(new Date(startMs));
    const endWarsaw = formatWarsaw(new Date(endMs));
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px">
        <h2 style="color:#0A2F7C;margin:0 0 12px">Nowy event w kalendarzu</h2>
        <p>${escapeHtml(pilot.name || 'Pilot')},</p>
        <p>${escapeHtml(adminUser)} dodał Ci nowy event w kalendarzu akrobacja.com:</p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px">
          <tr><td style="padding:8px 0;color:#6B7A90">Typ</td><td style="padding:8px 0;font-weight:600;text-align:right">${escapeHtml(body.type)}</td></tr>
          ${body.title ? `<tr><td style="padding:8px 0;color:#6B7A90">Tytul</td><td style="padding:8px 0;font-weight:600;text-align:right">${escapeHtml(body.title)}</td></tr>` : ''}
          ${aircraftTail ? `<tr><td style="padding:8px 0;color:#6B7A90">Samolot</td><td style="padding:8px 0;font-weight:600;text-align:right">${escapeHtml(aircraftTail)}</td></tr>` : ''}
          <tr><td style="padding:8px 0;color:#6B7A90">Start</td><td style="padding:8px 0;font-weight:600;text-align:right">${escapeHtml(startWarsaw)}</td></tr>
          <tr><td style="padding:8px 0;color:#6B7A90">Koniec</td><td style="padding:8px 0;font-weight:600;text-align:right">${escapeHtml(endWarsaw)}</td></tr>
          ${body.notes ? `<tr><td style="padding:8px 0;color:#6B7A90">Notatki</td><td style="padding:8px 0;text-align:right">${escapeHtml(body.notes)}</td></tr>` : ''}
        </table>
        <p style="color:#6B7A90;font-size:13px;margin-top:16px">
          Załącznik <code>event.ics</code> dodaje wpis do Twojego kalendarza (Gmail: przycisk „Dodaj do kalendarza”).
        </p>
      </div>`;
    ctx.waitUntil(
      sendEventEmailWithICS(ctx.env, {
        to: [pilot.email],
        bcc: ['info@akrobacja.com'],
        subject: `Nowy event: ${body.title || body.type} - ${startWarsaw}`,
        html,
        icsContent: ics,
        filename: `event-${id}.ics`,
        tagType: 'calendar_event_create',
      }).catch((err) => console.error('sendEventEmailWithICS failed', err))
    );
  }

  return Response.json({ ok: true, id });
};

function formatWarsaw(d: Date): string {
  return new Intl.DateTimeFormat('pl-PL', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(d);
}
