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

export type AdminRole = 'full' | 'limited';

function bearerToken(request: Request): string | null {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

// 'full' = owner (ADMIN_PASSWORD), unrestricted.
// 'limited' = secondary (MAGDA_PASSWORD), allowed only safe (GET/HEAD) methods.
export function getAdminRole(request: Request, env: Env): AdminRole | null {
  const token = bearerToken(request);
  if (!token) return null;

  const fullExpected = (env.ADMIN_PASSWORD || '').replace(/\s/g, '');
  if (fullExpected && timingSafeEqual(token, fullExpected)) return 'full';

  const limitedExpected = (env.MAGDA_PASSWORD || '').replace(/\s/g, '');
  if (limitedExpected && timingSafeEqual(token, limitedExpected)) return 'limited';

  return null;
}

// Default admin gate. Accepts both roles; the limited role is restricted to
// safe (GET/HEAD) methods at the auth boundary, so every write endpoint that
// uses this helper is automatically locked for limited tokens.
export function checkAdminAuth(request: Request, env: Env): boolean {
  const role = getAdminRole(request, env);
  if (role === 'full') return true;
  if (role === 'limited') {
    const m = request.method.toUpperCase();
    return m === 'GET' || m === 'HEAD';
  }
  return false;
}

// Strict gate for endpoints that should never be reachable by the limited
// role even on safe methods (e.g., endpoints surfacing financial PII).
export function requireFullAdmin(request: Request, env: Env): boolean {
  return getAdminRole(request, env) === 'full';
}
