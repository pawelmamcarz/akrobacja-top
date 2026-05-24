import { type Env, type CalendarEvent } from '../../../../src/lib/types';
import { checkAdminAuthAsync } from '../../../../src/lib/admin-auth';

interface EventPatchBody {
  pilot_id?: string;
  aircraft_id?: string | null;
  type?: CalendarEvent['type'];
  title?: string | null;
  notes?: string | null;
  start_at?: string;
  end_at?: string;
  status?: CalendarEvent['status'];
}

const ALLOWED_TYPES = new Set<CalendarEvent['type']>(['flight', 'training', 'maintenance', 'show', 'other']);
const ALLOWED_STATUS = new Set<CalendarEvent['status']>(['confirmed', 'tentative', 'cancelled']);

export const onRequestPatch: PagesFunction<Env, 'id'> = async (ctx) => {
  if (!(await checkAdminAuthAsync(ctx.request, ctx.env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = ctx.params.id as string;
  const body = (await ctx.request.json()) as EventPatchBody;

  const fields: string[] = [];
  const binds: (string | number | null)[] = [];

  if (body.pilot_id !== undefined) { fields.push('pilot_id = ?'); binds.push(body.pilot_id); }
  if (body.aircraft_id !== undefined) { fields.push('aircraft_id = ?'); binds.push(body.aircraft_id || null); }
  if (body.type !== undefined) {
    if (!ALLOWED_TYPES.has(body.type)) return Response.json({ error: 'Nieprawidlowy typ' }, { status: 400 });
    fields.push('type = ?'); binds.push(body.type);
  }
  if (body.title !== undefined) { fields.push('title = ?'); binds.push(body.title || null); }
  if (body.notes !== undefined) { fields.push('notes = ?'); binds.push(body.notes || null); }
  if (body.start_at !== undefined) {
    const ms = Date.parse(body.start_at);
    if (isNaN(ms)) return Response.json({ error: 'Nieprawidlowy start_at' }, { status: 400 });
    fields.push('start_at = ?'); binds.push(new Date(ms).toISOString());
  }
  if (body.end_at !== undefined) {
    const ms = Date.parse(body.end_at);
    if (isNaN(ms)) return Response.json({ error: 'Nieprawidlowy end_at' }, { status: 400 });
    fields.push('end_at = ?'); binds.push(new Date(ms).toISOString());
  }
  if (body.status !== undefined) {
    if (!ALLOWED_STATUS.has(body.status)) return Response.json({ error: 'Nieprawidlowy status' }, { status: 400 });
    fields.push('status = ?'); binds.push(body.status);
  }

  if (fields.length === 0) {
    return Response.json({ error: 'Brak pol do aktualizacji' }, { status: 400 });
  }

  fields.push("updated_at = datetime('now')");
  binds.push(id);

  const res = await ctx.env.DB.prepare(
    `UPDATE calendar_events SET ${fields.join(', ')} WHERE id = ?`
  ).bind(...binds).run();

  if (res.meta.changes === 0) {
    return Response.json({ error: 'Event nie znaleziony' }, { status: 404 });
  }

  return Response.json({ ok: true });
};

export const onRequestDelete: PagesFunction<Env, 'id'> = async (ctx) => {
  if (!(await checkAdminAuthAsync(ctx.request, ctx.env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const id = ctx.params.id as string;
  const res = await ctx.env.DB.prepare(
    "UPDATE calendar_events SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?"
  ).bind(id).run();
  if (res.meta.changes === 0) {
    return Response.json({ error: 'Event nie znaleziony' }, { status: 404 });
  }
  return Response.json({ ok: true });
};
