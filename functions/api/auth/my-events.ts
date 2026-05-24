import { type Env } from '../../../src/lib/types';
import { getPilotFromToken } from '../../../src/lib/pilot-auth';

// GET /api/auth/my-events?from=&to=
// Zwraca nadchodzace eventy zalogowanego pilota (max 50).
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const pilot = await getPilotFromToken(ctx.request, ctx.env.DB);
  if (!pilot) return Response.json({ error: 'Nie zalogowany' }, { status: 401 });

  const url = new URL(ctx.request.url);
  const fromParam = url.searchParams.get('from');
  const toParam = url.searchParams.get('to');

  const fromIso = fromParam
    ? new Date(fromParam).toISOString()
    : new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const toIso = toParam
    ? new Date(toParam).toISOString()
    : new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString();

  const { results } = await ctx.env.DB.prepare(
    `SELECT e.id, e.type, e.title, e.notes, e.start_at, e.end_at, e.status, a.tail AS aircraft_tail
     FROM calendar_events e
     LEFT JOIN aircrafts a ON a.id = e.aircraft_id
     WHERE e.pilot_id = ?
       AND e.status != 'cancelled'
       AND e.end_at >= ?
       AND e.start_at <= ?
     ORDER BY e.start_at
     LIMIT 50`
  ).bind(pilot.id, fromIso, toIso).all();

  return Response.json({ events: results });
};
