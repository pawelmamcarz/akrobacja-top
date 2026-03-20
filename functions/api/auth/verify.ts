import { type Env } from '../../../src/lib/types';
import { normalizePhone } from '../../../src/lib/phone';

// POST /api/auth/verify { phone, code }
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const { phone, code } = (await ctx.request.json()) as { phone: string; code: string };
    if (!phone || !code) {
      return Response.json({ error: 'Podaj numer i kod' }, { status: 400 });
    }

    const normalized = normalizePhone(phone);

    // Find valid OTP
    const otp = await ctx.env.DB.prepare(
      "SELECT id FROM otp_codes WHERE phone = ? AND code = ? AND used = 0 AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1"
    ).bind(normalized, code).first<{ id: string }>();

    if (!otp) {
      return Response.json({ error: 'Nieprawidłowy lub wygasły kod' }, { status: 400 });
    }

    // Mark OTP as used
    await ctx.env.DB.prepare('UPDATE otp_codes SET used = 1 WHERE id = ?').bind(otp.id).run();

    // Create or get pilot
    let pilot = await ctx.env.DB.prepare(
      'SELECT id, name, email, license_type, license_number, verified FROM pilots WHERE phone = ?'
    ).bind(normalized).first<{ id: string; name: string | null; email: string | null; license_type: string | null; license_number: string | null; verified: number }>();

    const sessionToken = crypto.randomUUID() + '-' + crypto.randomUUID();

    if (!pilot) {
      const pilotId = crypto.randomUUID();
      await ctx.env.DB.prepare(
        "INSERT INTO pilots (id, phone, verified, session_token, last_login) VALUES (?, ?, 1, ?, datetime('now'))"
      ).bind(pilotId, normalized, sessionToken).run();

      return Response.json({
        ok: true,
        token: sessionToken,
        pilot: { id: pilotId, phone: normalized, new_account: true },
      });
    }

    // Existing pilot — update session
    await ctx.env.DB.prepare(
      "UPDATE pilots SET verified = 1, session_token = ?, last_login = datetime('now') WHERE phone = ?"
    ).bind(sessionToken, normalized).run();

    return Response.json({
      ok: true,
      token: sessionToken,
      pilot: {
        id: pilot.id,
        name: pilot.name,
        email: pilot.email,
        phone: normalized,
        license_type: pilot.license_type,
        license_number: pilot.license_number,
        new_account: !pilot.name,
      },
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Błąd' }, { status: 500 });
  }
};
