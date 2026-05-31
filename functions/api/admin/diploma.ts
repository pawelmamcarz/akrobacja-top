import { type Env } from '../../../src/lib/types';
import { checkAdminAuthAsync } from '../../../src/lib/admin-auth';
import { fulfillDiploma } from '../../../src/lib/diploma-fulfillment';

// POST /api/admin/diploma { voucher_code }
// Recznie generuje/regeneruje i wysyla dyplom uczestnika (force=true).
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!(await checkAdminAuthAsync(ctx.request, ctx.env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await ctx.request.json()) as { voucher_code?: string };
  if (!body.voucher_code) {
    return Response.json({ error: 'Brak kodu vouchera' }, { status: 400 });
  }

  const r = await fulfillDiploma(ctx.env, body.voucher_code, { force: true });
  if (!r.ok) {
    return Response.json({ error: r.error || 'Nie udalo sie wygenerowac dyplomu' }, { status: 400 });
  }
  return Response.json({ ok: true, message: 'Dyplom wygenerowany i wyslany' });
};
