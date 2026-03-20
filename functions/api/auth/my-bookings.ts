import { type Env } from '../../../src/lib/types';

async function getPilot(request: Request, db: D1Database) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return db.prepare(
    'SELECT id, phone, email FROM pilots WHERE session_token = ?'
  ).bind(auth.slice(7)).first<{ id: string; phone: string; email: string | null }>();
}

// GET /api/auth/my-bookings — get pilot's bookings and courses
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const pilot = await getPilot(ctx.request, ctx.env.DB);
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

  // Courses by email
  const { results: courses } = await ctx.env.DB.prepare(
    'SELECT * FROM courses WHERE customer_email = ? OR customer_phone = ? ORDER BY created_at DESC'
  ).bind(pilot.email || '', pilot.phone).all();

  // Vouchers by email
  const { results: vouchers } = await ctx.env.DB.prepare(
    "SELECT voucher_code, package_id, status, redeemed_at, expires_at FROM orders WHERE customer_email = ? AND status = 'paid' ORDER BY created_at DESC"
  ).bind(pilot.email || '').all();

  return Response.json({ bookings, courses, vouchers });
};
