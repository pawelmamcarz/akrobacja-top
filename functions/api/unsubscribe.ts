import { type Env } from '../../src/lib/types';
import { normalizePhone } from '../../src/lib/phone';
import { isValidEmail } from '../../src/lib/validate';
import { rateLimit, clientIp } from '../../src/lib/rate-limit';

// POST /api/unsubscribe { phone?, email? }
// One-click opt-out endpoint for the List-Unsubscribe header (RFC 8058) and the
// /unsubscribe page form. Idempotent: a non-existent subscriber returns 200 with
// "already off the list" so an attacker can't enumerate which phones / emails
// are subscribed.
//
// GET is supported with query params so plain HTTP links from email/SMS work
// without JS. List-Unsubscribe-Post=One-Click prefers POST; both shapes here.
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const body = await ctx.request.json().catch(() => ({})) as { phone?: string; email?: string };
  return handle(ctx, body);
};

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);
  return handle(ctx, {
    phone: url.searchParams.get('phone') || undefined,
    email: url.searchParams.get('email') || undefined,
  });
};

async function handle(
  ctx: Parameters<PagesFunction<Env>>[0],
  body: { phone?: string; email?: string },
): Promise<Response> {
  const ip = clientIp(ctx.request);
  const rl = await rateLimit(ctx.env, `unsub:${ip}`, 10, 60);
  if (!rl.ok) {
    return Response.json({ error: 'Zbyt wiele zapytań, spróbuj za chwilę' }, { status: 429 });
  }

  const phoneRaw = (body.phone || '').trim();
  const emailRaw = (body.email || '').trim().toLowerCase();

  if (!phoneRaw && !emailRaw) {
    return Response.json({ error: 'Podaj telefon lub email' }, { status: 400 });
  }

  let normalizedPhone: string | null = null;
  if (phoneRaw) {
    try {
      normalizedPhone = normalizePhone(phoneRaw);
    } catch {
      return Response.json({ error: 'Nieprawidłowy numer telefonu' }, { status: 400 });
    }
  }

  if (emailRaw && !isValidEmail(emailRaw)) {
    return Response.json({ error: 'Nieprawidłowy adres email' }, { status: 400 });
  }

  // Match by either column. UPDATE returns row count via .meta.changes; we
  // intentionally don't differentiate "found" vs "not found" in the response
  // - would leak subscriber status to anyone with a hit list.
  const where: string[] = [];
  const binds: string[] = [];
  if (normalizedPhone) { where.push('phone = ?'); binds.push(normalizedPhone); }
  if (emailRaw) { where.push('LOWER(email) = ?'); binds.push(emailRaw); }

  await ctx.env.DB.prepare(
    `UPDATE subscribers SET active = 0 WHERE active = 1 AND (${where.join(' OR ')})`
  ).bind(...binds).run();

  return Response.json({
    ok: true,
    message: 'Wypisaliśmy Cię z listy. Nie dostaniesz od nas więcej SMS-ów ani emaili. Możesz wrócić w każdej chwili - wystarczy zapisać się ponownie.',
  });
}
