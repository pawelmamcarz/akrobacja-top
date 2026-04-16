import { type Env } from './types';

// Constant-time string comparison to prevent timing attacks on admin tokens.
// Workers Web Crypto lacks crypto.subtle.timingSafeEqual, so implement manually
// on raw bytes. Pads to equal length first to avoid length leak.
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

export function checkAdminAuth(request: Request, env: Env): boolean {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return false;
  const token = auth.slice(7);
  const expected = (env.ADMIN_PASSWORD || '').replace(/\s/g, '');
  if (!expected) return false;
  return timingSafeEqual(token, expected);
}
