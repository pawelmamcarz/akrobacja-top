// RFC-5322 lite — local@domain.tld z TLD >= 2 znaki. Wystarczające dla checkoutu;
// pełną zgodność i tak weryfikuje Stripe/Resend przy pierwszym wysyłce.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export function isValidEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return EMAIL_RE.test(email.trim());
}

// Walidacja zaplanowanej daty wysyłki vouchera (feature: prezent na konkretną datę).
// Akceptujemy ISO 8601 ("2026-05-15" lub pełny datetime). Data musi być w przyszłości
// (>= now, z tolerancją 60s na clock skew klienta) i nie dalej niż maxDaysAhead dni.
// Zwracamy wynormalizowaną wartość ISO datetime albo null jeśli niepoprawna.
export function isValidSendAt(s: string | null | undefined, maxDaysAhead = 365): string | null {
  if (!s) return null;
  const trimmed = s.trim();
  if (!trimmed) return null;

  // Akceptujemy "YYYY-MM-DD" (date pickerowy domyślny) i pełny ISO datetime.
  // "YYYY-MM-DD" interpretujemy jako 09:00 UTC dnia danego (poranna wysyłka).
  let iso: string;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    iso = `${trimmed}T09:00:00.000Z`;
  } else {
    iso = trimmed;
  }

  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return null;

  const now = Date.now();
  if (ts < now - 60_000) return null;                                 // przeszłość
  if (ts > now + maxDaysAhead * 24 * 60 * 60 * 1000) return null;     // za daleko

  return new Date(ts).toISOString();
}
