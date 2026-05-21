// GET /api/admin/me - zwraca role aktualnie zalogowanego admina
// na podstawie tokena z headera Authorization: Bearer ...
// Wynik: { role: 'full' | 'limited' } albo 401.

import { type Env } from '../../../src/lib/types';
import { getAdminRole } from '../../../src/lib/admin-auth';

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const role = getAdminRole(ctx.request, ctx.env);
  if (!role) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  return Response.json({ role });
};
