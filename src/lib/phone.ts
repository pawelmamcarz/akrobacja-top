// Normalize phone to +48XXXXXXXXX format for consistent storage
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('48') && digits.length === 11) return '+' + digits;
  if (digits.length === 9) return '+48' + digits;
  return '+' + digits;
}
