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

/**
 * Wyciąga Bearer token z requesta i znajduje pilota.
 * Zwraca null jeśli brak tokena, token nie pasuje lub session_expires_at minęło.
 *
 * Uwaga: kolumny zwracane przez SELECT są ujednolicone — używaj jako wspólny
 * helper dla wszystkich auth/* endpointów.
 */
export async function getPilotFromToken(
  request: Request,
  db: D1Database
): Promise<PilotSession | null> {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  if (!token) return null;

  return db.prepare(
    `SELECT id, phone, name, email, license_type, license_number,
            balance_minutes, insurance_status, verified,
            session_expires_at, last_login, created_at
       FROM pilots
      WHERE session_token = ?
        AND (session_expires_at IS NULL OR session_expires_at > datetime('now'))`
  ).bind(token).first<PilotSession>();
}
