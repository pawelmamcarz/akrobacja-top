import { type Env, PACKAGES, type PackageId } from '../../../src/lib/types';

interface BookingRequest {
  date: string;
  start_time: string;
  type: 'voucher' | 'proficiency' | 'training' | 'course';
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  voucher_code?: string;
  package_id?: PackageId;
  course_id?: string;
  notes?: string;
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const body = (await ctx.request.json()) as BookingRequest;

    // Validate
    if (!body.date || !body.start_time || !body.type || !body.customer_name || !body.customer_email) {
      return Response.json({ error: 'Brakuje wymaganych pól' }, { status: 400 });
    }

    // For voucher bookings, verify the voucher
    if (body.type === 'voucher') {
      if (!body.voucher_code) {
        return Response.json({ error: 'Podaj kod vouchera' }, { status: 400 });
      }
      const order = await ctx.env.DB.prepare(
        "SELECT id, status, redeemed_at, package_id FROM orders WHERE voucher_code = ?"
      ).bind(body.voucher_code).first<{ id: string; status: string; redeemed_at: string | null; package_id: string }>();

      if (!order) return Response.json({ error: 'Voucher nie znaleziony' }, { status: 404 });
      if (order.status !== 'paid') return Response.json({ error: 'Voucher nie jest opłacony' }, { status: 400 });
      if (order.redeemed_at) return Response.json({ error: 'Voucher już wykorzystany' }, { status: 400 });

      body.package_id = order.package_id as PackageId;
    }

    // For course bookings, verify the course
    if (body.type === 'course') {
      if (!body.course_id) {
        return Response.json({ error: 'Podaj ID kursu' }, { status: 400 });
      }
      const course = await ctx.env.DB.prepare(
        "SELECT id, status, completed_flights, total_flights FROM courses WHERE id = ?"
      ).bind(body.course_id).first<{ id: string; status: string; completed_flights: number; total_flights: number }>();

      if (!course) return Response.json({ error: 'Kurs nie znaleziony' }, { status: 404 });
      if (course.status !== 'active') return Response.json({ error: 'Kurs nie jest aktywny' }, { status: 400 });
      if (course.completed_flights >= course.total_flights) return Response.json({ error: 'Kurs ukończony' }, { status: 400 });
    }

    // Check if slot is available
    const existingSlot = await ctx.env.DB.prepare(
      "SELECT id FROM slots WHERE date = ? AND start_time = ? AND status != 'available'"
    ).bind(body.date, body.start_time).first();

    if (existingSlot) {
      return Response.json({ error: 'Ten termin jest już zajęty' }, { status: 409 });
    }

    // Check for blocks
    const block = await ctx.env.DB.prepare(
      'SELECT reason FROM availability_blocks WHERE date_from <= ? AND date_to >= ?'
    ).bind(body.date, body.date).first();

    if (block) {
      return Response.json({ error: 'Ten dzień jest zablokowany' }, { status: 400 });
    }

    // Create booking
    const bookingId = crypto.randomUUID();
    const slotId = crypto.randomUUID();

    await ctx.env.DB.prepare(`
      INSERT INTO bookings (id, slot_id, type, customer_name, customer_email, customer_phone, voucher_code, package_id, course_id, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).bind(
      bookingId, slotId, body.type,
      body.customer_name, body.customer_email, body.customer_phone || null,
      body.voucher_code || null, body.package_id || null, body.course_id || null,
      body.notes || null,
    ).run();

    // Reserve the slot
    const endTime = addHour(body.start_time);
    await ctx.env.DB.prepare(`
      INSERT INTO slots (id, date, start_time, end_time, type, booking_id, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `).bind(slotId, body.date, body.start_time, endTime, body.type, bookingId).run();

    return Response.json({
      ok: true,
      booking_id: bookingId,
      message: 'Rezerwacja złożona — oczekuje na zatwierdzenie. Dostaniesz potwierdzenie na email.',
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
};

function addHour(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
