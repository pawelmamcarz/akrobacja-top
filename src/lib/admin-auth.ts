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

export type AdminUser = 'pawel' | 'magda';

// Wszyscy ci uzytkownicy maja te same pelne uprawnienia. Roznia ich tylko
// hasla (i identyfikator zapisywany w logach). Dodanie kolejnego: nowa zmienna
// srodowiskowa, jeden wpis tutaj, jeden w types.ts.
function userCandidates(env: Env): Array<{ user: AdminUser; expected: string }> {
  const all: Array<{ user: AdminUser; expected: string }> = [
    { user: 'pawel', expected: (env.ADMIN_PASSWORD || '').replace(/\s/g, '') },
    { user: 'magda', expected: (env.MAGDA_PASSWORD || '').replace(/\s/g, '') },
  ];
  return all.filter(c => c.expected.length > 0);
}

export function getAdminUser(request: Request, env: Env): AdminUser | null {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7);

  for (const { user, expected } of userCandidates(env)) {
    if (timingSafeEqual(token, expected)) return user;
  }
  return null;
}

export function checkAdminAuth(request: Request, env: Env): boolean {
  return getAdminUser(request, env) !== null;
}
