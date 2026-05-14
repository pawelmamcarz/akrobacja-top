import { type Env } from './types';

// Fixed-window rate limit backed by Workers KV. Eventually-consistent (~60s)
// but cheap and adequate for blocking unsophisticated abuse on public endpoints.
// On KV outage we fail open — better to serve traffic than block legit users.
export async function rateLimit(
  env: Env,
  key: string,
  max: number,
  windowSec: number,
): Promise<{ ok: boolean; remaining: number }> {
  try {
    const raw = await env.RATE_LIMIT_KV.get(key);
    const cur = raw ? parseInt(raw, 10) : 0;
    if (cur >= max) {
      return { ok: false, remaining: 0 };
    }
    await env.RATE_LIMIT_KV.put(key, String(cur + 1), { expirationTtl: windowSec });
    return { ok: true, remaining: max - cur - 1 };
  } catch {
    return { ok: true, remaining: max };
  }
}

export function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') || 'unknown';
}
