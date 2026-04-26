import { type Env } from '../../../src/lib/types';
import { normalizePhone } from '../../../src/lib/phone';

const MAX_FAILURES = 10;       // w oknie
const WINDOW_MINUTES = 10;     // minut
const SESSION_TTL_DAYS = 30;   // jak długo żyje token sesji

// POST /api/auth/verify { phone, code }
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const { phone, code } = (await ctx.request.json()) as { phone: string; code: string };
    if (!phone || !code) {
      return Response.json({ error: 'Podaj numer i kod' }, { status: 400 });
    }

    const normalized = normalizePhone(phone);
    const ip = ctx.request.headers.get('CF-Connecting-IP') || null;
    const userAgent = ctx.request.headers.get('User-Agent') || null;

    // Rate limit brute-force: licz nieudane próby per phone LUB per IP w oknie WINDOW_MINUTES.
    const windowClause = `datetime('now', '-${WINDOW_MINUTES} minutes')`;
    const failCount = await ctx.env.DB.prepare(
      `SELECT COUNT(*) AS cnt FROM otp_attempts
       WHERE success = 0 AND created_at > ${windowClause}
         AND (phone = ? OR (ip IS NOT NULL AND ip = ?))`
    ).bind(normalized, ip).first<{ cnt: number }>();

    if (failCount && failCount.cnt >= MAX_FAILURES) {
      return Response.json({ error: 'Zbyt wiele nieudanych prób. Spróbuj za kilka minut.' }, { status: 429 });
    }

    const otp = await ctx.env.DB.prepare(
      "SELECT id FROM otp_codes WHERE phone = ? AND code = ? AND used = 0 AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1"
    ).bind(normalized, code).first<{ id: string }>();

    if (!otp) {
      await ctx.env.DB.prepare(
        'INSERT INTO otp_attempts (id, phone, ip, success) VALUES (?, ?, ?, 0)'
      ).bind(crypto.randomUUID(), normalized, ip).run();
      return Response.json({ error: 'Nieprawidłowy lub wygasły kod' }, { status: 400 });
    }

    await ctx.env.DB.prepare('UPDATE otp_codes SET used = 1 WHERE id = ?').bind(otp.id).run();

    // Sukces — zaloguj i wyczyść nieudane próby dla tego numeru, żeby reset limitu po legalnym logowaniu.
    await ctx.env.DB.prepare(
      'INSERT INTO otp_attempts (id, phone, ip, success) VALUES (?, ?, ?, 1)'
    ).bind(crypto.randomUUID(), normalized, ip).run();
    await ctx.env.DB.prepare(
      'DELETE FROM otp_attempts WHERE phone = ? AND success = 0'
    ).bind(normalized).run();

    // Get existing pilot (jeśli jest) — potrzebne też do detekcji nowego IP
    const existingPilot = await ctx.env.DB.prepare(
      'SELECT id, name, email, license_type, license_number, verified, session_token FROM pilots WHERE phone = ?'
    ).bind(normalized).first<{
      id: string;
      name: string | null;
      email: string | null;
      license_type: string | null;
      license_number: string | null;
      verified: number;
      session_token: string | null;
    }>();

    // Detekcja "login z nowego IP": jeśli istnieje pilot z aktywnym tokenem,
    // sprawdź ostatni login_event i porównaj IP. Jeśli różne — log event.
    if (existingPilot && existingPilot.session_token && ip) {
      const lastLogin = await ctx.env.DB.prepare(
        `SELECT ip FROM auth_events
          WHERE phone = ? AND event_type IN ('login', 'login_new_ip')
          ORDER BY created_at DESC LIMIT 1`
      ).bind(normalized).first<{ ip: string | null }>();

      if (lastLogin && lastLogin.ip && lastLogin.ip !== ip) {
        await ctx.env.DB.prepare(
          'INSERT INTO auth_events (id, phone, pilot_id, event_type, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(crypto.randomUUID(), normalized, existingPilot.id, 'login_new_ip', ip, userAgent).run();
      }
    }

    const sessionToken = crypto.randomUUID() + '-' + crypto.randomUUID();
    const sessionExpiresClause = `datetime('now', '+${SESSION_TTL_DAYS} days')`;

    if (!existingPilot) {
      const pilotId = crypto.randomUUID();
      await ctx.env.DB.prepare(
        `INSERT INTO pilots (id, phone, verified, session_token, session_expires_at, last_login)
         VALUES (?, ?, 1, ?, ${sessionExpiresClause}, datetime('now'))`
      ).bind(pilotId, normalized, sessionToken).run();

      await ctx.env.DB.prepare(
        'INSERT INTO auth_events (id, phone, pilot_id, event_type, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(crypto.randomUUID(), normalized, pilotId, 'login', ip, userAgent).run();

      return Response.json({
        ok: true,
        token: sessionToken,
        pilot: { id: pilotId, phone: normalized, new_account: true },
      });
    }

    // Existing pilot — update session + TTL
    await ctx.env.DB.prepare(
      `UPDATE pilots SET verified = 1, session_token = ?, session_expires_at = ${sessionExpiresClause},
              last_login = datetime('now')
        WHERE phone = ?`
    ).bind(sessionToken, normalized).run();

    await ctx.env.DB.prepare(
      'INSERT INTO auth_events (id, phone, pilot_id, event_type, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), normalized, existingPilot.id, 'login', ip, userAgent).run();

    return Response.json({
      ok: true,
      token: sessionToken,
      pilot: {
        id: existingPilot.id,
        name: existingPilot.name,
        email: existingPilot.email,
        phone: normalized,
        license_type: existingPilot.license_type,
        license_number: existingPilot.license_number,
        new_account: !existingPilot.name,
      },
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Błąd' }, { status: 500 });
  }
};
