import { type Env } from '../../../src/lib/types';
import { getPilotFromToken } from '../../../src/lib/pilot-auth';
import { isValidEmail } from '../../../src/lib/validate';

// GET /api/auth/profile - get current pilot profile
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const pilot = await getPilotFromToken(ctx.request, ctx.env.DB);
  if (!pilot) return Response.json({ error: 'Nie zalogowany' }, { status: 401 });
  const siteUrl = (ctx.env.SITE_URL || 'https://akrobacja.com').replace(/\/$/, '');
  const calendar_ics_url = pilot.calendar_token
    ? `${siteUrl}/api/calendar/feed.ics?token=${pilot.calendar_token}`
    : null;
  return Response.json({ pilot, calendar_ics_url });
};

// POST /api/auth/profile - update profile
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const pilot = await getPilotFromToken(ctx.request, ctx.env.DB);
  if (!pilot) return Response.json({ error: 'Nie zalogowany' }, { status: 401 });

  const body = (await ctx.request.json()) as {
    name?: string;
    email?: string;
    license_type?: string;
    license_number?: string;
  };

  // Email is user-set without verification - validate format and prevent collisions so a
  // pilot can't claim someone else's email. my-bookings.ts now matches by phone instead of
  // email to close the IDOR fully; this only blocks the obvious abuse of overwriting.
  let normalizedEmail: string | undefined;
  if (body.email !== undefined && body.email !== null && body.email !== '') {
    normalizedEmail = String(body.email).trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      return Response.json({ error: 'Nieprawidłowy adres email' }, { status: 400 });
    }
    // LOWER(email) on both sides so "Foo@bar.com" and "foo@bar.com" collide.
    const collision = await ctx.env.DB.prepare(
      'SELECT 1 FROM pilots WHERE LOWER(email) = ? AND id != ?'
    ).bind(normalizedEmail, pilot.id).first();
    if (collision) {
      return Response.json({ error: 'Ten email jest już w użyciu' }, { status: 409 });
    }
  }

  await ctx.env.DB.prepare(
    'UPDATE pilots SET name = COALESCE(?, name), email = COALESCE(?, email), license_type = COALESCE(?, license_type), license_number = COALESCE(?, license_number) WHERE id = ?'
  ).bind(
    body.name || null, normalizedEmail || null,
    body.license_type || null, body.license_number || null,
    pilot.id,
  ).run();

  return Response.json({ ok: true });
};
