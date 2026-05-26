// GET /api/admin/ksef-test
// Sprawdza czy KSeF API odpowiada na challenge dla naszego NIP-u.
// To pierwszy krok integracji - jak dziala, to dalej RSA + session + query invoices.

import { type Env } from '../../../src/lib/types';
import { checkAdminAuthAsync } from '../../../src/lib/admin-auth';
import { ksefSelfTest } from '../../../src/lib/ksef';

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (!(await checkAdminAuthAsync(ctx.request, ctx.env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const result = await ksefSelfTest(ctx.env);
  return Response.json(result, { status: result.ok ? 200 : 500 });
};
