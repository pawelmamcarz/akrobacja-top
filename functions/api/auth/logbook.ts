// Portal pilota - dziennik techniczny.
// POST /api/auth/logbook  - instruktor wgrywa zdjęcie strony dziennika; Workers AI
//   wizja wyciąga pola; tworzymy wpis flight_logbook status='pending_review'
//   (zatwierdza technik w panelu admina przed zaliczeniem do nalotu).
// GET  /api/auth/logbook  - ostatnie wpisy (do podglądu statusu w PWA).

import { type Env } from '../../../src/lib/types';
import { getPilotFromToken } from '../../../src/lib/pilot-auth';
import { rateLimit, clientIp } from '../../../src/lib/rate-limit';
import { extractLogbook } from '../../../src/lib/vision';

const DEFAULT_AIRCRAFT = 'speks-001';
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB - zdjęcia są resize'owane po stronie klienta

// `File` global nie jest pewnie otypowany w tym tsconfig - duck-typing jak w
// functions/api/photographer/upload.ts.
interface UploadedFile { name: string; size: number; type: string; arrayBuffer(): Promise<ArrayBuffer>; }
function isFile(v: unknown): v is UploadedFile {
  return typeof v === 'object' && v !== null
    && typeof (v as { size?: unknown }).size === 'number'
    && typeof (v as { type?: unknown }).type === 'string'
    && typeof (v as { arrayBuffer?: unknown }).arrayBuffer === 'function';
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const pilot = await getPilotFromToken(ctx.request, ctx.env.DB);
  if (!pilot) return Response.json({ error: 'Nie zalogowany' }, { status: 401 });
  if (!pilot.is_instructor) return Response.json({ error: 'Tylko dla instruktorów' }, { status: 403 });

  const { results } = await ctx.env.DB.prepare(
    `SELECT id, aircraft_id, flight_date, flights_count, flight_minutes, landings,
            hours_after, fuel_l, remarks, status, created_at
       FROM flight_logbook
      WHERE aircraft_id = ?
      ORDER BY created_at DESC LIMIT 30`
  ).bind(DEFAULT_AIRCRAFT).all();
  return Response.json({ entries: results || [] });
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const pilot = await getPilotFromToken(ctx.request, ctx.env.DB);
  if (!pilot) return Response.json({ error: 'Nie zalogowany' }, { status: 401 });
  if (!pilot.is_instructor) return Response.json({ error: 'Tylko dla instruktorów' }, { status: 403 });

  const ip = clientIp(ctx.request);
  const rl = await rateLimit(ctx.env, `logbook-upload:${ip}`, 20, 3600);
  if (!rl.ok) return Response.json({ error: 'Zbyt wiele uploadów. Spróbuj później.' }, { status: 429 });

  let form: FormData;
  try {
    form = await ctx.request.formData();
  } catch {
    return Response.json({ error: 'Nieprawidłowe dane formularza' }, { status: 400 });
  }
  const file = form.get('photo');
  if (!isFile(file)) return Response.json({ error: 'Brak zdjęcia' }, { status: 400 });
  if (file.size === 0 || file.size > MAX_BYTES) {
    return Response.json({ error: 'Zdjęcie za duże lub puste (max 8 MB)' }, { status: 400 });
  }
  const aircraftId = (form.get('aircraft_id') as string) || DEFAULT_AIRCRAFT;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = file.type.includes('png') ? 'png' : 'jpg';
  const r2Key = `logbook/${aircraftId}/${crypto.randomUUID()}.${ext}`;

  await ctx.env.VOUCHER_BUCKET.put(r2Key, bytes, {
    httpMetadata: { contentType: file.type || 'image/jpeg' },
  });

  // Analiza wizyjna - best-effort. Nawet gdy zawiedzie, zapisujemy wpis z pustymi
  // polami, żeby technik mógł uzupełnić ręcznie ze zdjęcia.
  const { fields, raw } = await extractLogbook(ctx.env, bytes);

  const id = crypto.randomUUID();
  await ctx.env.DB.prepare(
    `INSERT INTO flight_logbook
       (id, aircraft_id, pilot_id, photo_r2_key, flight_date, flights_count, flight_minutes,
        landings, hours_after, fuel_l, remarks, extracted_json, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review')`
  ).bind(
    id, aircraftId, pilot.id, r2Key,
    fields.flight_date, fields.flights_count, fields.flight_minutes,
    fields.landings, fields.hours_after, fields.fuel_l, fields.remarks,
    JSON.stringify(raw ? { raw } : {}),
  ).run();

  return Response.json({ ok: true, id, status: 'pending_review', fields });
};
