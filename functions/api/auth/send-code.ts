import { type Env } from '../../../src/lib/types';
import { sendSms, generateOtp } from '../../../src/lib/sms';
import { normalizePhone } from '../../../src/lib/phone';
import { rateLimit, clientIp } from '../../../src/lib/rate-limit';
import { verifyTurnstile } from '../../../src/lib/turnstile';

// POST /api/auth/send-code { phone, turnstileToken }
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const ip = clientIp(ctx.request);
    const rl = await rateLimit(ctx.env, `send-code:${ip}`, 3, 60);
    if (!rl.ok) {
      return Response.json({ error: 'Zbyt wiele zapytań, spróbuj za chwilę' }, { status: 429 });
    }

    const { phone, turnstileToken } = (await ctx.request.json()) as {
      phone: string;
      turnstileToken?: string;
    };

    if (!(await verifyTurnstile(ctx.env, turnstileToken, ip))) {
      return Response.json({ error: 'Weryfikacja captcha nieudana' }, { status: 400 });
    }

    if (!phone) {
      return Response.json({ error: 'Podaj numer telefonu' }, { status: 400 });
    }

    let normalized: string;
    try {
      normalized = normalizePhone(phone);
    } catch {
      return Response.json({ error: 'Podaj prawidłowy numer telefonu' }, { status: 400 });
    }

    // Rate limit — max 3 codes per phone per hour
    const recent = await ctx.env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM otp_codes WHERE phone = ? AND created_at > datetime('now', '-1 hour')"
    ).bind(normalized).first<{ cnt: number }>();

    if (recent && recent.cnt >= 3) {
      return Response.json({ error: 'Zbyt wiele prób. Spróbuj za godzinę.' }, { status: 429 });
    }

    // Invalidate prior unused codes for this phone before issuing a new one.
    // Previously up to 3 codes could be valid simultaneously, so an OTP brute-force
    // attempt against the latest code could also accidentally match one of the older
    // active codes — effectively tripling the attacker's success probability.
    await ctx.env.DB.prepare(
      'UPDATE otp_codes SET used = 1 WHERE phone = ? AND used = 0'
    ).bind(normalized).run();

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    await ctx.env.DB.prepare(
      'INSERT INTO otp_codes (id, phone, code, expires_at) VALUES (?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), normalized, code, expiresAt).run();

    await sendSms(ctx.env, normalized, `Twój kod akrobacja.com: ${code}. Ważny 5 minut.`);

    return Response.json({ ok: true, message: 'Kod wysłany' });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Błąd' }, { status: 500 });
  }
};
