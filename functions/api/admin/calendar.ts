import { type Env } from '../../../src/lib/types';
import { checkAdminAuth } from '../../../src/lib/admin-auth';

// GET /api/admin/calendar?from=2026-04-01&to=2026-04-30
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (!checkAdminAuth(ctx.request, ctx.env)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(ctx.request.url);
  const from = url.searchParams.get('from') || new Date().toISOString().split('T')[0];
  const to = url.searchParams.get('to') || from;

  const { results: slots } = await ctx.env.DB.prepare(`
    SELECT s.*, b.customer_name, b.customer_email, b.customer_phone, b.type as booking_type,
           b.voucher_code, b.package_id, b.course_id, b.notes, b.status as booking_status
    FROM slots s
    LEFT JOIN bookings b ON s.booking_id = b.id
    WHERE s.date >= ? AND s.date <= ?
    ORDER BY s.date, s.start_time
  `).bind(from, to).all();

  const { results: blocks } = await ctx.env.DB.prepare(
    'SELECT * FROM availability_blocks WHERE date_from <= ? AND date_to >= ? ORDER BY date_from'
  ).bind(to, from).all();

  const { results: pendingBookings } = await ctx.env.DB.prepare(`
    SELECT b.*, s.date, s.start_time, s.end_time
    FROM bookings b
    JOIN slots s ON s.booking_id = b.id
    WHERE b.status = 'pending'
    ORDER BY s.date, s.start_time
  `).all();

  return Response.json({ slots, blocks, pendingBookings });
};

// POST /api/admin/calendar — manage bookings and blocks
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!checkAdminAuth(ctx.request, ctx.env)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await ctx.request.json()) as {
    action: string;
    booking_id?: string;
    date_from?: string;
    date_to?: string;
    reason?: string;
    block_id?: string;
  };

  switch (body.action) {
    case 'approve': {
      if (!body.booking_id) return Response.json({ error: 'Brak booking_id' }, { status: 400 });
      await ctx.env.DB.prepare(
        "UPDATE bookings SET status = 'approved', approved_at = datetime('now') WHERE id = ?"
      ).bind(body.booking_id).run();
      await ctx.env.DB.prepare(
        "UPDATE slots SET status = 'booked' WHERE booking_id = ?"
      ).bind(body.booking_id).run();
      return Response.json({ ok: true, message: 'Rezerwacja zatwierdzona' });
    }

    case 'reject': {
      if (!body.booking_id) return Response.json({ error: 'Brak booking_id' }, { status: 400 });
      await ctx.env.DB.prepare(
        "UPDATE bookings SET status = 'rejected', cancelled_at = datetime('now') WHERE id = ?"
      ).bind(body.booking_id).run();
      await ctx.env.DB.prepare(
        "UPDATE slots SET status = 'available', booking_id = NULL WHERE booking_id = ?"
      ).bind(body.booking_id).run();
      return Response.json({ ok: true, message: 'Rezerwacja odrzucona' });
    }

    case 'block': {
      if (!body.date_from || !body.date_to || !body.reason) {
        return Response.json({ error: 'Podaj date_from, date_to i reason' }, { status: 400 });
      }
      const blockId = crypto.randomUUID();
      await ctx.env.DB.prepare(
        'INSERT INTO availability_blocks (id, date_from, date_to, reason) VALUES (?, ?, ?, ?)'
      ).bind(blockId, body.date_from, body.date_to, body.reason).run();
      return Response.json({ ok: true, block_id: blockId, message: 'Blokada dodana' });
    }

    case 'unblock': {
      if (!body.block_id) return Response.json({ error: 'Brak block_id' }, { status: 400 });
      await ctx.env.DB.prepare('DELETE FROM availability_blocks WHERE id = ?').bind(body.block_id).run();
      return Response.json({ ok: true, message: 'Blokada usunięta' });
    }

    default:
      return Response.json({ error: 'Nieznana akcja' }, { status: 400 });
  }
};
