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

export type AdminUser = string; // 'pawel' | 'magda' (legacy) | email (DB user)

// Legacy env-based user (Pawel) — kept dla cron endpoints i back-compat.
// Magda + Maciej + ewentualni nowi userzy ida przez admin_users (PBKDF2).
function legacyUserCandidates(env: Env): Array<{ user: AdminUser; expected: string }> {
  const all: Array<{ user: AdminUser; expected: string }> = [
    { user: 'pawel', expected: (env.ADMIN_PASSWORD || '').replace(/\s/g, '') },
  ];
  return all.filter(c => c.expected.length > 0);
}

function bearerToken(request: Request): string | null {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

// SYNC, legacy-only. Existing crons + endpoints that already use this stay
// untouched — they accept ADMIN_PASSWORD / MAGDA_PASSWORD Bearer tokens as
// they did before. New endpoints should use getAdminUserAsync() so DB sessions
// (email-login) also resolve.
export function getAdminUser(request: Request, env: Env): AdminUser | null {
  const token = bearerToken(request);
  if (!token) return null;
  for (const { user, expected } of legacyUserCandidates(env)) {
    if (timingSafeEqual(token, expected)) return user;
  }
  return null;
}

export function checkAdminAuth(request: Request, env: Env): boolean {
  return getAdminUser(request, env) !== null;
}

// ──────────────────────────────────────────────────────────────────
// New email+password flow

// PBKDF2-SHA256, 100k iterations, 32-byte output. Salt is 16 random bytes,
// both stored base64-encoded so they survive D1 TEXT columns.
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEY_BYTES = 32;
const SALT_BYTES = 16;

function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
  return s;
}
async function pbkdf2(password: string, salt: Uint8Array): Promise<string> {
  const keyMat = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMat,
    PBKDF2_KEY_BYTES * 8,
  );
  return bytesToB64(new Uint8Array(bits));
}

export async function hashPassword(plain: string): Promise<{ hash: string; salt: string }> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await pbkdf2(plain, saltBytes);
  return { hash, salt: bytesToB64(saltBytes) };
}

export async function verifyPassword(plain: string, saltB64: string, hashB64: string): Promise<boolean> {
  const actual = await pbkdf2(plain, b64ToBytes(saltB64));
  return timingSafeEqual(actual, hashB64);
}

// Cryptographically random token for session cookies / password-reset links.
// 32 random bytes → 64 hex chars. Reset tokens use the same shape.
export function randomToken(): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
}

export interface AdminUserRow {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  password_salt: string;
  role: string;
  last_login_at: number | null;
}

// ASYNC. Checks legacy Bearer first (cheap, no DB hit), then falls back to a
// DB session lookup. Returns the resolved user identifier (legacy 'pawel'/'magda'
// or email for DB users) or null when no auth resolves.
export async function getAdminUserAsync(request: Request, env: Env): Promise<AdminUser | null> {
  // Legacy first — preserves all existing cron + admin behaviour without a DB hit.
  const legacy = getAdminUser(request, env);
  if (legacy) return legacy;

  const token = bearerToken(request);
  if (!token) return null;
  // Session tokens are 64 hex chars; skip DB lookup for obviously-not-our-shape input.
  if (!/^[a-f0-9]{32,128}$/.test(token)) return null;

  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(
    `SELECT u.email
     FROM admin_sessions s
     JOIN admin_users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > ?`,
  ).bind(token, now).first<{ email: string }>();
  if (!row) return null;

  // Best-effort last_used_at bump; fail silent so a transient DB write error
  // never blocks an otherwise-valid request.
  await env.DB.prepare(`UPDATE admin_sessions SET last_used_at = ? WHERE token = ?`)
    .bind(now, token).run().catch(() => {});

  return row.email;
}

export async function checkAdminAuthAsync(request: Request, env: Env): Promise<boolean> {
  return (await getAdminUserAsync(request, env)) !== null;
}
