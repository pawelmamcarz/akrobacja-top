import { type Env } from '../../../src/lib/types';

async function getPilot(request: Request, db: D1Database) {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return db.prepare(
    'SELECT id, phone, name, email, insurance_status FROM pilots WHERE session_token = ?'
  ).bind(auth.slice(7)).first<{ id: string; phone: string; name: string | null; email: string | null; insurance_status: string }>();
}

// GET /api/auth/insurance — get insurance status
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const pilot = await getPilot(ctx.request, ctx.env.DB);
  if (!pilot) return Response.json({ error: 'Nie zalogowany' }, { status: 401 });
  return Response.json({ insurance_status: pilot.insurance_status });
};

// POST /api/auth/insurance — request insurance inclusion
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const pilot = await getPilot(ctx.request, ctx.env.DB);
  if (!pilot) return Response.json({ error: 'Nie zalogowany' }, { status: 401 });

  if (!pilot.name || !pilot.email) {
    return Response.json({ error: 'Uzupelnij profil (imie i email) przed wnioskowaniem' }, { status: 400 });
  }

  if (pilot.insurance_status === 'approved') {
    return Response.json({ error: 'Jestes juz wpisany do polisy' }, { status: 400 });
  }

  if (pilot.insurance_status === 'pending') {
    return Response.json({ error: 'Wniosek juz zlozony — oczekuje na zatwierdzenie' }, { status: 400 });
  }

  // Check for existing pending request
  const existing = await ctx.env.DB.prepare(
    "SELECT id FROM insurance_pilots WHERE pilot_id = ? AND status = 'pending'"
  ).bind(pilot.id).first();

  if (existing) {
    return Response.json({ error: 'Masz juz oczekujacy wniosek' }, { status: 400 });
  }

  const id = crypto.randomUUID();
  await ctx.env.DB.prepare(
    'INSERT INTO insurance_pilots (id, pilot_id) VALUES (?, ?)'
  ).bind(id, pilot.id).run();

  await ctx.env.DB.prepare(
    "UPDATE pilots SET insurance_status = 'pending' WHERE id = ?"
  ).bind(pilot.id).run();

  return Response.json({ ok: true, message: 'Wniosek zlozony — oczekuje na zatwierdzenie' });
};
