import { type Env } from '../../../src/lib/types';
import { getPilotFromToken } from '../../../src/lib/pilot-auth';

// GET /api/auth/my-bookings — get pilot's bookings and courses
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const pilot = await getPilotFromToken(ctx.request, ctx.env.DB);
  if (!pilot) return Response.json({ error: 'Nie zalogowany' }, { status: 401 });

  // Bookings by email or phone
  const { results: bookings } = await ctx.env.DB.prepare(`
    SELECT b.*, s.date, s.start_time, s.end_time
    FROM bookings b
    JOIN slots s ON s.booking_id = b.id
    WHERE b.customer_email = ? OR b.customer_phone = ?
    ORDER BY s.date DESC, s.start_time DESC
    LIMIT 50
  `).bind(pilot.email || '', pilot.phone).all();

  // Courses by email or phone
  const { results: courses } = await ctx.env.DB.prepare(
    'SELECT * FROM courses WHERE customer_email = ? OR customer_phone = ? ORDER BY created_at DESC'
  ).bind(pilot.email || '', pilot.phone).all();

  // Vouchers — tylko po email; pomiń query gdy email pusty (inaczej match
  // wszystkich orderów z pustym emailem to byłby data leak).
  let vouchers: Record<string, unknown>[] = [];
  if (pilot.email) {
    const res = await ctx.env.DB.prepare(
      "SELECT voucher_code, package_id, status, redeemed_at, expires_at FROM orders WHERE customer_email = ? AND status = 'paid' ORDER BY created_at DESC"
    ).bind(pilot.email).all();
    vouchers = res.results as Record<string, unknown>[];
  }

  return Response.json({ bookings, courses, vouchers });
};
