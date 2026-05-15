// Helper do odczytu pilota z tokena Bearer w nagłówku Authorization.
// Sprawdza TTL (session_expires_at) — wygasły token zwraca null.

export interface PilotSession {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  license_type: string | null;
  license_number: string | null;
  balance_minutes: number;
  insurance_status: string;
  verified: number;
  session_expires_at: string | null;
  last_login: string | null;
  created_at: string;
}

// SHA-256(token) → lowercase hex. Used both at session issue time (verify.ts)
// and on every Bearer auth lookup to avoid keeping plaintext tokens in D1.
export async function hashToken(token: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Wyciąga Bearer token z requesta i znajduje pilota.
 * Zwraca null jeśli brak tokena, token nie pasuje lub session_expires_at minęło.
 *
 * Strategia po migracji 015: porównaj SHA-256(token) z session_token_hash. Jeśli
 * miss, fall back na plaintext session_token (legacy sesje sprzed migracji). Po
 * udanym legacy-match migrujemy ten wiersz na hash w tle (waitUntil-free; nie
 * blokujemy odpowiedzi). Po wygaśnięciu wszystkich legacy sesji można drop kolumny
 * session_token w osobnej migracji.
 */
export async function getPilotFromToken(
  request: Request,
  db: D1Database
): Promise<PilotSession | null> {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  if (!token) return null;

  const tokenHash = await hashToken(token);

  // Primary: hash match.
  const SELECT_COLS = `SELECT id, phone, name, email, license_type, license_number,
                              balance_minutes, insurance_status, verified,
                              session_expires_at, last_login, created_at`;
  const TTL = `(session_expires_at IS NULL OR session_expires_at > datetime('now'))`;

  const hashHit = await db.prepare(
    `${SELECT_COLS} FROM pilots WHERE session_token_hash = ? AND ${TTL}`
  ).bind(tokenHash).first<PilotSession>();
  if (hashHit) return hashHit;

  // Legacy fallback: plaintext match (sesje sprzed migracji 015).
  const legacyHit = await db.prepare(
    `${SELECT_COLS} FROM pilots WHERE session_token = ? AND ${TTL}`
  ).bind(token).first<PilotSession & { id: string }>();
  if (!legacyHit) return null;

  // Migrate this row to hash storage so the next request uses the fast path
  // and the plaintext column is no longer needed for this session.
  await db.prepare(
    'UPDATE pilots SET session_token_hash = ?, session_token = NULL WHERE id = ?'
  ).bind(tokenHash, legacyHit.id).run();

  return legacyHit;
}
