import { type Env } from '../../../src/lib/types';
import { sendSms, generateOtp } from '../../../src/lib/sms';
import { normalizePhone } from '../../../src/lib/phone';

// POST /api/auth/send-code { phone }
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const { phone } = (await ctx.request.json()) as { phone: string };
    if (!phone || phone.replace(/\D/g, '').length < 9) {
      return Response.json({ error: 'Podaj prawidłowy numer telefonu' }, { status: 400 });
    }

    const normalized = normalizePhone(phone);

    // Rate limit — max 3 codes per phone per hour
    const recent = await ctx.env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM otp_codes WHERE phone = ? AND created_at > datetime('now', '-1 hour')"
    ).bind(normalized).first<{ cnt: number }>();

    if (recent && recent.cnt >= 3) {
      return Response.json({ error: 'Zbyt wiele prób. Spróbuj za godzinę.' }, { status: 429 });
    }

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    await ctx.env.DB.prepare(
      'INSERT INTO otp_codes (id, phone, code, expires_at) VALUES (?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), normalized, code, expiresAt).run();

    await sendSms(ctx.env, normalized, `Twoj kod akrobacja.com: ${code}. Wazny 5 minut.`);

    return Response.json({ ok: true, message: 'Kod wysłany' });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Błąd' }, { status: 500 });
  }
};
