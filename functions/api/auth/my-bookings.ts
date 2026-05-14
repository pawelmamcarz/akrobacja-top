import { type Env } from '../../../src/lib/types';
import { getPilotFromToken } from '../../../src/lib/pilot-auth';

// GET /api/auth/my-bookings — get pilot's bookings, courses, vouchers.
// Matching is by phone (SMS-verified via OTP) — email is user-settable without verification
// and was previously the IDOR sink: a pilot could change their email to a victim's address
// in /api/auth/profile and then read the victim's bookings/vouchers here.
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const pilot = await getPilotFromToken(ctx.request, ctx.env.DB);
  if (!pilot) return Response.json({ error: 'Nie zalogowany' }, { status: 401 });

  // Bookings — phone only.
  const { results: bookings } = await ctx.env.DB.prepare(`
    SELECT b.*, s.date, s.start_time, s.end_time
    FROM bookings b
    JOIN slots s ON s.booking_id = b.id
    WHERE b.customer_phone = ?
    ORDER BY s.date DESC, s.start_time DESC
    LIMIT 50
  `).bind(pilot.phone).all();

  // Courses — phone only.
  const { results: courses } = await ctx.env.DB.prepare(
    'SELECT * FROM courses WHERE customer_phone = ? ORDER BY created_at DESC'
  ).bind(pilot.phone).all();

  // Vouchers — orders has no customer_phone column, so we surface only vouchers the pilot
  // has used in a booking with this phone. Self-bought vouchers without a booking are not
  // listed here; that is a deliberate trade-off to close the email-based IDOR.
  const res = await ctx.env.DB.prepare(`
    SELECT DISTINCT o.voucher_code, o.package_id, o.status, o.redeemed_at, o.expires_at
    FROM orders o
    JOIN bookings b ON b.voucher_code = o.voucher_code
    WHERE b.customer_phone = ? AND o.status = 'paid'
    ORDER BY o.created_at DESC
  `).bind(pilot.phone).all();
  const vouchers = res.results as Record<string, unknown>[];

  return Response.json({ bookings, courses, vouchers });
};
