import { type Env, PACKAGES, type PackageId } from '../../../src/lib/types';
import { escapeHtml } from '../../../src/lib/email';
import { generateSlots } from '../../../src/lib/daylight';

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

    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date) || !/^\d{2}:\d{2}$/.test(body.start_time)) {
      return Response.json({ error: 'Nieprawidłowy format daty lub godziny' }, { status: 400 });
    }

    // start_time musi być jednym ze slotów wygenerowanych dla danej daty (slot grid = 1h od sunrise+30 do sunset-30).
    const validSlot = generateSlots(body.date).some(s => s.start === body.start_time);
    if (!validSlot) {
      return Response.json({ error: 'Nieprawidłowa godzina — godzina poza oknem dziennym' }, { status: 400 });
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

    // Check for blocks
    const block = await ctx.env.DB.prepare(
      'SELECT reason FROM availability_blocks WHERE date_from <= ? AND date_to >= ?'
    ).bind(body.date, body.date).first();

    if (block) {
      return Response.json({ error: 'Ten dzień jest zablokowany' }, { status: 400 });
    }

    // Atomowa rezerwacja slotu — partial UNIQUE(date, start_time) WHERE status != 'available'
    // gwarantuje, że dwa równoległe POST-y nie przejdą oba. Zwracamy 409 dla przegranego.
    const bookingId = crypto.randomUUID();
    const slotId = crypto.randomUUID();
    const endTime = addHour(body.start_time);

    const slotInsert = await ctx.env.DB.prepare(`
      INSERT OR IGNORE INTO slots (id, date, start_time, end_time, type, booking_id, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `).bind(slotId, body.date, body.start_time, endTime, body.type, bookingId).run();

    if (slotInsert.meta.changes === 0) {
      return Response.json({ error: 'Ten termin jest już zajęty' }, { status: 409 });
    }

    try {
      await ctx.env.DB.prepare(`
        INSERT INTO bookings (id, slot_id, type, customer_name, customer_email, customer_phone, voucher_code, package_id, course_id, notes, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `).bind(
        bookingId, slotId, body.type,
        body.customer_name, body.customer_email, body.customer_phone || null,
        body.voucher_code || null, body.package_id || null, body.course_id || null,
        body.notes || null,
      ).run();
    } catch (err) {
      // Booking INSERT padł — zwolnij slot, żeby inny klient mógł go zająć.
      await ctx.env.DB.prepare('DELETE FROM slots WHERE id = ?').bind(slotId).run();
      throw err;
    }

    ctx.waitUntil(sendBookingEmails(ctx.env, {
      bookingId,
      date: body.date,
      startTime: body.start_time,
      type: body.type,
      customerName: body.customer_name,
      customerEmail: body.customer_email,
      voucherCode: body.voucher_code,
    }));

    return Response.json({
      ok: true,
      booking_id: bookingId,
      message: 'Rezerwacja złożona — oczekuje na zatwierdzenie. Dostaniesz potwierdzenie na email.',
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 });
  }
};

async function sendBookingEmails(env: Env, o: {
  bookingId: string;
  date: string;
  startTime: string;
  type: string;
  customerName: string;
  customerEmail: string;
  voucherCode?: string;
}): Promise<void> {
  const typeLabels: Record<string, string> = {
    voucher: 'Lot akrobacyjny (voucher)',
    proficiency: 'Lot sprawdzający',
    training: 'Lot szkolny',
    course: 'Kurs akrobacji',
  };
  const label = typeLabels[o.type] || o.type;
  const adminUrl = 'https://akrobacja.com/admin';

  const customerHtml = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#0A2F7C;padding:32px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:24px">akrobacja.com</h1>
      </div>
      <div style="padding:32px">
        <h2 style="color:#0A2F7C;margin:0 0 16px">Rezerwacja złożona!</h2>
        <p style="color:#333;line-height:1.6;margin:0 0 24px">
          Cześć ${escapeHtml(o.customerName)}! Twoja rezerwacja oczekuje na zatwierdzenie przez pilota.
          Dostaniesz potwierdzenie emailem gdy zostanie zatwierdzona.
        </p>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px 0;color:#6B7A90;border-bottom:1px solid #eee">Typ</td><td style="padding:8px 0;font-weight:600;border-bottom:1px solid #eee;text-align:right">${escapeHtml(label)}</td></tr>
          <tr><td style="padding:8px 0;color:#6B7A90;border-bottom:1px solid #eee">Data</td><td style="padding:8px 0;font-weight:600;border-bottom:1px solid #eee;text-align:right">${escapeHtml(o.date)}</td></tr>
          <tr><td style="padding:8px 0;color:#6B7A90;border-bottom:1px solid #eee">Godzina</td><td style="padding:8px 0;font-weight:600;border-bottom:1px solid #eee;text-align:right">${escapeHtml(o.startTime)}</td></tr>
          ${o.voucherCode ? `<tr><td style="padding:8px 0;color:#6B7A90">Voucher</td><td style="padding:8px 0;font-weight:600;font-family:monospace;text-align:right">${escapeHtml(o.voucherCode)}</td></tr>` : ''}
        </table>
        <p style="color:#6B7A90;font-size:13px;margin-top:24px">
          Pytania? Zadzwoń: <a href="tel:+48535535221" style="color:#0A2F7C">+48 535 535 221</a>
          lub napisz: <a href="mailto:dto@akrobacja.com" style="color:#0A2F7C">dto@akrobacja.com</a>
        </p>
      </div>
    </div>`;

  const adminHtml = `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto">
      <h2 style="color:#0A2F7C;margin:0 0 16px">Nowa rezerwacja do zatwierdzenia</h2>
      <table style="width:100%;border-collapse:collapse">
        <tr><td style="padding:8px 0;color:#6B7A90;border-bottom:1px solid #eee">Typ</td><td style="padding:8px 0;font-weight:600;border-bottom:1px solid #eee;text-align:right">${escapeHtml(label)}</td></tr>
        <tr><td style="padding:8px 0;color:#6B7A90;border-bottom:1px solid #eee">Data</td><td style="padding:8px 0;font-weight:600;border-bottom:1px solid #eee;text-align:right">${escapeHtml(o.date)}</td></tr>
        <tr><td style="padding:8px 0;color:#6B7A90;border-bottom:1px solid #eee">Godzina</td><td style="padding:8px 0;font-weight:600;border-bottom:1px solid #eee;text-align:right">${escapeHtml(o.startTime)}</td></tr>
        <tr><td style="padding:8px 0;color:#6B7A90;border-bottom:1px solid #eee">Klient</td><td style="padding:8px 0;font-weight:600;border-bottom:1px solid #eee;text-align:right">${escapeHtml(o.customerName)}</td></tr>
        <tr><td style="padding:8px 0;color:#6B7A90;border-bottom:1px solid #eee">Email</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right"><a href="mailto:${encodeURIComponent(o.customerEmail)}">${escapeHtml(o.customerEmail)}</a></td></tr>
        ${o.voucherCode ? `<tr><td style="padding:8px 0;color:#6B7A90">Voucher</td><td style="padding:8px 0;font-weight:600;font-family:monospace;text-align:right">${escapeHtml(o.voucherCode)}</td></tr>` : ''}
      </table>
      <p style="margin-top:16px"><a href="${adminUrl}" style="color:#0A2F7C;font-weight:600">Zatwierdź w panelu admina →</a></p>
    </div>`;

  const sendEmail = async (to: string, subject: string, html: string) => {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.RESEND_API_KEY}` },
      body: JSON.stringify({ from: 'akrobacja.com <dto@akrobacja.com>', to: [to], subject, html }),
    });
  };

  await Promise.allSettled([
    sendEmail(o.customerEmail, `Rezerwacja złożona — ${o.date} ${o.startTime}`, customerHtml),
    sendEmail('dto@akrobacja.com', `✈️ Nowa rezerwacja: ${label} — ${o.date} ${o.startTime}`, adminHtml),
  ]);
}

function addHour(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
