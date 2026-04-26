import { type Env } from '../../../src/lib/types';
import { getPilotFromToken } from '../../../src/lib/pilot-auth';

// GET /api/auth/profile — get current pilot profile
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const pilot = await getPilotFromToken(ctx.request, ctx.env.DB);
  if (!pilot) return Response.json({ error: 'Nie zalogowany' }, { status: 401 });
  return Response.json({ pilot });
};

// POST /api/auth/profile — update profile
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const pilot = await getPilotFromToken(ctx.request, ctx.env.DB);
  if (!pilot) return Response.json({ error: 'Nie zalogowany' }, { status: 401 });

  const body = (await ctx.request.json()) as {
    name?: string;
    email?: string;
    license_type?: string;
    license_number?: string;
  };

  await ctx.env.DB.prepare(
    'UPDATE pilots SET name = COALESCE(?, name), email = COALESCE(?, email), license_type = COALESCE(?, license_type), license_number = COALESCE(?, license_number) WHERE id = ?'
  ).bind(
    body.name || null, body.email || null,
    body.license_type || null, body.license_number || null,
    pilot.id,
  ).run();

  return Response.json({ ok: true });
};
