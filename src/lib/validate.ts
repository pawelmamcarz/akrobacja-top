// RFC-5322 lite — local@domain.tld z TLD >= 2 znaki. Wystarczające dla checkoutu;
// pełną zgodność i tak weryfikuje Stripe/Resend przy pierwszym wysyłce.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

export function isValidEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return EMAIL_RE.test(email.trim());
}
