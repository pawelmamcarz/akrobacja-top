// POST /api/admin/auth/logout - invalidates the bearer session token.
// No-op for legacy ADMIN_PASSWORD/MAGDA_PASSWORD bearer (those don't have
// session rows). Always returns ok so UI can clear localStorage uniformly.

import { type Env } from '../../../../src/lib/types';

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const auth = ctx.request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token && /^[a-f0-9]{32,128}$/.test(token)) {
    await ctx.env.DB.prepare(`DELETE FROM admin_sessions WHERE token = ?`).bind(token).run();
  }
  return Response.json({ ok: true });
};
