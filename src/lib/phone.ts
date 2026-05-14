// Normalize phone to E.164 (+48XXXXXXXXX for Polish numbers, generic +<digits> for others).
// Strict: throws on inputs that don't match a known format so rate-limit buckets cannot
// be bypassed by passing the same number in multiple representations (0048…, 48…, …,
// "+48 501 234 567", etc. — all collapse to the same canonical value).
export function normalizePhone(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  // +48XXXXXXXXX — Polish E.164 already
  if (/^48\d{9}$/.test(digits)) return '+' + digits;
  // 10-digit with Polish trunk prefix 0 (common manual entry: 0501234567)
  if (/^0\d{9}$/.test(digits)) return '+48' + digits.slice(1);
  // Bare 9-digit Polish local number — assume PL prefix
  if (/^\d{9}$/.test(digits)) return '+48' + digits;
  // Some international formats use 00 + country code as the prefix (e.g. 0048…, 0049…)
  if (/^00\d{8,14}$/.test(digits)) return '+' + digits.slice(2);
  throw new Error('Invalid phone number format');
}
