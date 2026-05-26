import { type Env } from '../../../src/lib/types';
import { hashToken } from '../../../src/lib/pilot-auth';

// POST /api/auth/logout
// Header: Authorization: Bearer <token>
//
// Inwaliduje session_token + session_token_hash + session_expires_at po stronie
// serwera, nawet jeśli klient wyczyści localStorage. Loguje do auth_events 'logout'.
// Idempotentne - gdy token nieznany, zwraca { ok: true } bez błędu.
export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const auth = ctx.request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return Response.json({ error: 'Brak tokena' }, { status: 401 });
  }
  const token = auth.slice(7);
  if (!token) {
    return Response.json({ error: 'Brak tokena' }, { status: 401 });
  }

  const tokenHash = await hashToken(token);

  // Try hash first (current sessions), fall back to plaintext (legacy pre-015 sessions).
  const pilot = await ctx.env.DB.prepare(
    'SELECT id, phone FROM pilots WHERE session_token_hash = ? OR session_token = ?'
  ).bind(tokenHash, token).first<{ id: string; phone: string }>();

  await ctx.env.DB.prepare(
    `UPDATE pilots SET session_token = NULL, session_token_hash = NULL, session_expires_at = NULL
       WHERE session_token_hash = ? OR session_token = ?`
  ).bind(tokenHash, token).run();

  if (pilot) {
    const ip = ctx.request.headers.get('CF-Connecting-IP') || null;
    const userAgent = ctx.request.headers.get('User-Agent') || null;
    await ctx.env.DB.prepare(
      'INSERT INTO auth_events (id, phone, pilot_id, event_type, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), pilot.phone, pilot.id, 'logout', ip, userAgent).run();
  }

  return Response.json({ ok: true });
};
