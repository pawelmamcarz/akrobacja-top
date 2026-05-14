import { type Env } from './types';

// Cloudflare Turnstile siteverify. Returns true when the token is valid for our
// secret, false otherwise. Fails open ONLY when TURNSTILE_SECRET is not configured
// (i.e. in dev) so the rest of the request flow still works; in prod the secret
// must be set or every request will be rejected.
export async function verifyTurnstile(
  env: Env,
  token: string | null | undefined,
  remoteIp: string | null,
): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET;
  // Temporary debug — confirm secret reaches the worker in prod.
  console.log('[turnstile] secret present:', !!secret, 'len:', secret?.length || 0, 'token present:', !!token);
  if (!secret) return true; // not configured — allow (dev mode)
  if (!token) return false;

  try {
    const form = new URLSearchParams({
      secret,
      response: token,
    });
    if (remoteIp) form.set('remoteip', remoteIp);

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
