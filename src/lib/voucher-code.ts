// Generates a unique voucher code like AKR-X3K9-M7PL
export function generateVoucherCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
  const segment = (len: number) =>
    Array.from(crypto.getRandomValues(new Uint8Array(len)))
      .map(b => chars[b % chars.length])
      .join('');
  return `AKR-${segment(4)}-${segment(4)}`;
}
