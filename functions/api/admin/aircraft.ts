import { type Env } from '../../../src/lib/types';
import { checkAdminAuthAsync, getAdminIdentityAsync } from '../../../src/lib/admin-auth';

const DEFAULT_AIRCRAFT = 'speks-001';

// Konkretny typ body - zamiast Record<string, unknown> sprawdzamy typeof przed
// bindem do D1, żeby nie przekazać np. obiektu/array tam gdzie ma być liczba.
interface AircraftBody {
  action?: string;
  // maintenance
  type?: string;
  description?: string;
  due_date?: string;
  due_hours?: number;
  current_hours?: number;
  notes?: string;
  // wspólne
  id?: string;
  aircraft_id?: string;
  // document
  name?: string;
  doc_type?: string;
  valid_from?: string;
  valid_to?: string;
  // insurance
  pilot_id?: string;
  // logbook (dziennik) - edytowalne pola przy recenzji
  flight_date?: string;
  flights_count?: number;
  flight_minutes?: number;
  landings?: number;
  hours_after?: number;
  fuel_l?: number;
  remarks?: string;
}

// Estymacja: ile dni do osiągnięcia due_hours, na podstawie obecnego nalotu
// (aircrafts.current_hours) i średniego tempa nalotu z ostatnich zatwierdzonych
// wpisów dziennika. Zwraca null gdy brak danych do projekcji.
function estimateMaintenance(
  m: { due_hours: number | null; status: string },
  currentHours: number | null,
  hoursPerDay: number | null,
): { est_days: number | null; est_date: string | null } {
  if (m.status === 'completed' || m.due_hours == null || currentHours == null || !hoursPerDay || hoursPerDay <= 0) {
    return { est_days: null, est_date: null };
  }
  const remaining = m.due_hours - currentHours;
  const days = Math.round(remaining / hoursPerDay);
  const d = new Date(Date.now() + days * 86400000);
  return { est_days: days, est_date: d.toISOString().slice(0, 10) };
}

// GET /api/admin/aircraft - get maintenance, documents, insurance pilots
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (!(await checkAdminAuthAsync(ctx.request, ctx.env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { results: maintenanceRows } = await ctx.env.DB.prepare(
    'SELECT * FROM maintenance ORDER BY CASE status WHEN \'overdue\' THEN 0 WHEN \'upcoming\' THEN 1 WHEN \'completed\' THEN 2 END, due_date ASC'
  ).all<{ due_hours: number | null; status: string }>();

  const { results: documents } = await ctx.env.DB.prepare(
    'SELECT * FROM documents ORDER BY valid_to ASC'
  ).all();

  const { results: insurancePilots } = await ctx.env.DB.prepare(`
    SELECT ip.*, p.name as pilot_name, p.phone as pilot_phone, p.email as pilot_email, p.license_type, p.license_number
    FROM insurance_pilots ip
    JOIN pilots p ON p.id = ip.pilot_id
    WHERE ip.removed_at IS NULL
    ORDER BY ip.requested_at DESC
  `).all();

  // Samolot + nalot (na razie pojedynczy SP-EKS).
  const aircraft = await ctx.env.DB.prepare(
    'SELECT id, tail, type, current_hours, hours_updated_at FROM aircrafts WHERE id = ?'
  ).bind(DEFAULT_AIRCRAFT).first<{ current_hours: number | null; hours_updated_at: string | null }>();
  const currentHours = aircraft?.current_hours ?? null;

  // Dziennik pokładowy: oczekujące recenzji + ostatnie zatwierdzone.
  const { results: logbook } = await ctx.env.DB.prepare(
    `SELECT id, aircraft_id, pilot_id, photo_r2_key, flight_date, flights_count, flight_minutes,
            landings, hours_after, fuel_l, remarks, status, confirmed_by, confirmed_at, created_at
       FROM flight_logbook
      ORDER BY CASE status WHEN 'pending_review' THEN 0 ELSE 1 END, created_at DESC
      LIMIT 60`
  ).all();

  // Tempo nalotu: (max-min hours_after) / rozpiętość dni z zatwierdzonych wpisów (ostatnie 90 dni).
  const rate = await ctx.env.DB.prepare(
    `SELECT MIN(hours_after) AS min_h, MAX(hours_after) AS max_h,
            MIN(flight_date) AS min_d, MAX(flight_date) AS max_d
       FROM flight_logbook
      WHERE status = 'confirmed' AND hours_after IS NOT NULL AND flight_date IS NOT NULL
        AND flight_date >= date('now', '-90 days')`
  ).first<{ min_h: number | null; max_h: number | null; min_d: string | null; max_d: string | null }>();
  let hoursPerDay: number | null = null;
  if (rate && rate.min_h != null && rate.max_h != null && rate.min_d && rate.max_d && rate.max_d > rate.min_d) {
    const days = (Date.parse(rate.max_d) - Date.parse(rate.min_d)) / 86400000;
    if (days > 0) hoursPerDay = (rate.max_h - rate.min_h) / days;
  }

  const maintenance = (maintenanceRows || []).map(m => ({
    ...m,
    ...estimateMaintenance(m, currentHours, hoursPerDay),
  }));

  return Response.json({
    maintenance, documents, insurancePilots, logbook,
    aircraft: { current_hours: currentHours, hours_updated_at: aircraft?.hours_updated_at ?? null, hours_per_day: hoursPerDay },
  });
};

// POST /api/admin/aircraft - manage maintenance, documents, insurance
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const identity = await getAdminIdentityAsync(ctx.request, ctx.env);
  if (!identity) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await ctx.request.json()) as AircraftBody;

  switch (body.action) {
    // ── MAINTENANCE ──
    case 'add_maintenance': {
      if (typeof body.type !== 'string' || !body.type) {
        return Response.json({ error: 'Pole "type" wymagane' }, { status: 400 });
      }
      if (body.due_hours !== undefined && body.due_hours !== null && typeof body.due_hours !== 'number') {
        return Response.json({ error: 'Pole "due_hours" musi być liczbą' }, { status: 400 });
      }
      if (body.current_hours !== undefined && body.current_hours !== null && typeof body.current_hours !== 'number') {
        return Response.json({ error: 'Pole "current_hours" musi być liczbą' }, { status: 400 });
      }
      const id = crypto.randomUUID();
      await ctx.env.DB.prepare(
        'INSERT INTO maintenance (id, type, description, due_date, due_hours, current_hours, notes, aircraft_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        id,
        body.type,
        body.description || null,
        body.due_date || null,
        body.due_hours ?? null,
        body.current_hours ?? null,
        body.notes || null,
        body.aircraft_id || DEFAULT_AIRCRAFT,
      ).run();
      return Response.json({ ok: true, id });
    }

    case 'complete_maintenance': {
      if (typeof body.id !== 'string' || !body.id) {
        return Response.json({ error: 'Pole "id" wymagane' }, { status: 400 });
      }
      await ctx.env.DB.prepare(
        "UPDATE maintenance SET status = 'completed', completed_at = datetime('now'), notes = COALESCE(?, notes) WHERE id = ?"
      ).bind(body.notes || null, body.id).run();
      return Response.json({ ok: true });
    }

    case 'delete_maintenance': {
      if (typeof body.id !== 'string' || !body.id) {
        return Response.json({ error: 'Pole "id" wymagane' }, { status: 400 });
      }
      await ctx.env.DB.prepare('DELETE FROM maintenance WHERE id = ?').bind(body.id).run();
      return Response.json({ ok: true });
    }

    case 'update_hours': {
      if (typeof body.id !== 'string' || !body.id) {
        return Response.json({ error: 'Pole "id" wymagane' }, { status: 400 });
      }
      if (typeof body.current_hours !== 'number') {
        return Response.json({ error: 'Pole "current_hours" musi być liczbą' }, { status: 400 });
      }
      await ctx.env.DB.prepare(
        'UPDATE maintenance SET current_hours = ? WHERE id = ?'
      ).bind(body.current_hours, body.id).run();
      return Response.json({ ok: true });
    }

    // ── DOCUMENTS ──
    case 'add_document': {
      if (typeof body.name !== 'string' || !body.name) {
        return Response.json({ error: 'Pole "name" wymagane' }, { status: 400 });
      }
      if (typeof body.doc_type !== 'string' || !body.doc_type) {
        return Response.json({ error: 'Pole "doc_type" wymagane' }, { status: 400 });
      }
      const id = crypto.randomUUID();
      await ctx.env.DB.prepare(
        "INSERT INTO documents (id, name, type, valid_from, valid_to, notes, aircraft_id, source) VALUES (?, ?, ?, ?, ?, ?, ?, 'manual')"
      ).bind(id, body.name, body.doc_type, body.valid_from || null, body.valid_to || null, body.notes || null, body.aircraft_id || DEFAULT_AIRCRAFT).run();
      return Response.json({ ok: true, id });
    }

    case 'delete_document': {
      if (typeof body.id !== 'string' || !body.id) {
        return Response.json({ error: 'Pole "id" wymagane' }, { status: 400 });
      }
      // Usuń też plik z R2 jeśli dokument miał załącznik (np. MS).
      const doc = await ctx.env.DB.prepare('SELECT r2_key FROM documents WHERE id = ?').bind(body.id).first<{ r2_key: string | null }>();
      if (doc?.r2_key) await ctx.env.VOUCHER_BUCKET.delete(doc.r2_key).catch(() => {});
      await ctx.env.DB.prepare('DELETE FROM documents WHERE id = ?').bind(body.id).run();
      return Response.json({ ok: true });
    }

    // ── DZIENNIK POKŁADOWY (logbook) ──
    case 'edit_logbook': {
      if (typeof body.id !== 'string' || !body.id) {
        return Response.json({ error: 'Pole "id" wymagane' }, { status: 400 });
      }
      await ctx.env.DB.prepare(
        `UPDATE flight_logbook SET
            flight_date = ?, flights_count = ?, flight_minutes = ?, landings = ?,
            hours_after = ?, fuel_l = ?, remarks = ?
          WHERE id = ? AND status = 'pending_review'`
      ).bind(
        body.flight_date || null,
        body.flights_count ?? null,
        body.flight_minutes ?? null,
        body.landings ?? null,
        body.hours_after ?? null,
        body.fuel_l ?? null,
        body.remarks || null,
        body.id,
      ).run();
      return Response.json({ ok: true });
    }

    case 'confirm_logbook': {
      if (typeof body.id !== 'string' || !body.id) {
        return Response.json({ error: 'Pole "id" wymagane' }, { status: 400 });
      }
      const entry = await ctx.env.DB.prepare(
        "SELECT aircraft_id, hours_after FROM flight_logbook WHERE id = ? AND status = 'pending_review'"
      ).bind(body.id).first<{ aircraft_id: string; hours_after: number | null }>();
      if (!entry) return Response.json({ error: 'Wpis nie istnieje lub już rozpatrzony' }, { status: 404 });

      await ctx.env.DB.prepare(
        "UPDATE flight_logbook SET status = 'confirmed', confirmed_by = ?, confirmed_at = datetime('now') WHERE id = ?"
      ).bind(identity.user, body.id).run();

      // Aktualizuj nalot samolotu (monotonicznie - nalot tylko rośnie).
      if (entry.hours_after != null) {
        await ctx.env.DB.prepare(
          `UPDATE aircrafts SET current_hours = ?, hours_updated_at = datetime('now')
            WHERE id = ? AND (current_hours IS NULL OR current_hours < ?)`
        ).bind(entry.hours_after, entry.aircraft_id, entry.hours_after).run();
      }
      return Response.json({ ok: true });
    }

    case 'reject_logbook': {
      if (typeof body.id !== 'string' || !body.id) {
        return Response.json({ error: 'Pole "id" wymagane' }, { status: 400 });
      }
      await ctx.env.DB.prepare(
        "UPDATE flight_logbook SET status = 'rejected', confirmed_by = ?, confirmed_at = datetime('now') WHERE id = ? AND status = 'pending_review'"
      ).bind(identity.user, body.id).run();
      return Response.json({ ok: true });
    }

    // ── INSURANCE PILOTS ──
    case 'add_insurance_pilot': {
      if (typeof body.pilot_id !== 'string' || !body.pilot_id) {
        return Response.json({ error: 'Podaj pilot_id' }, { status: 400 });
      }
      const pilot = await ctx.env.DB.prepare('SELECT id FROM pilots WHERE id = ?').bind(body.pilot_id).first();
      if (!pilot) return Response.json({ error: 'Pilot nie znaleziony' }, { status: 404 });
      const active = await ctx.env.DB.prepare(
        "SELECT id FROM insurance_pilots WHERE pilot_id = ? AND removed_at IS NULL AND status != 'rejected'"
      ).bind(body.pilot_id).first();
      if (active) return Response.json({ error: 'Pilot już w polisie' }, { status: 409 });
      const id = crypto.randomUUID();
      await ctx.env.DB.prepare(
        `INSERT INTO insurance_pilots (id, pilot_id, status, approved_at) VALUES (?, ?, 'approved', datetime('now'))`
      ).bind(id, body.pilot_id).run();
      await ctx.env.DB.prepare(
        "UPDATE pilots SET insurance_status = 'approved' WHERE id = ?"
      ).bind(body.pilot_id).run();
      return Response.json({ ok: true, id });
    }

    case 'approve_insurance': {
      if (typeof body.id !== 'string' || !body.id) {
        return Response.json({ error: 'Pole "id" wymagane' }, { status: 400 });
      }
      await ctx.env.DB.prepare(
        "UPDATE insurance_pilots SET status = 'approved', approved_at = datetime('now') WHERE id = ?"
      ).bind(body.id).run();
      // Update pilot status
      const ip = await ctx.env.DB.prepare('SELECT pilot_id FROM insurance_pilots WHERE id = ?').bind(body.id).first<{ pilot_id: string }>();
      if (ip) await ctx.env.DB.prepare("UPDATE pilots SET insurance_status = 'approved' WHERE id = ?").bind(ip.pilot_id).run();
      return Response.json({ ok: true });
    }

    case 'reject_insurance': {
      if (typeof body.id !== 'string' || !body.id) {
        return Response.json({ error: 'Pole "id" wymagane' }, { status: 400 });
      }
      await ctx.env.DB.prepare(
        "UPDATE insurance_pilots SET status = 'rejected' WHERE id = ?"
      ).bind(body.id).run();
      const ip2 = await ctx.env.DB.prepare('SELECT pilot_id FROM insurance_pilots WHERE id = ?').bind(body.id).first<{ pilot_id: string }>();
      if (ip2) await ctx.env.DB.prepare("UPDATE pilots SET insurance_status = 'none' WHERE id = ?").bind(ip2.pilot_id).run();
      return Response.json({ ok: true });
    }

    case 'remove_insurance': {
      if (typeof body.id !== 'string' || !body.id) {
        return Response.json({ error: 'Pole "id" wymagane' }, { status: 400 });
      }
      await ctx.env.DB.prepare(
        "UPDATE insurance_pilots SET status = 'removed', removed_at = datetime('now') WHERE id = ?"
      ).bind(body.id).run();
      const ip3 = await ctx.env.DB.prepare('SELECT pilot_id FROM insurance_pilots WHERE id = ?').bind(body.id).first<{ pilot_id: string }>();
      if (ip3) await ctx.env.DB.prepare("UPDATE pilots SET insurance_status = 'none' WHERE id = ?").bind(ip3.pilot_id).run();
      return Response.json({ ok: true });
    }

    default:
      return Response.json({ error: 'Nieznana akcja' }, { status: 400 });
  }
};
