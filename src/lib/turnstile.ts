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
  // Fail-open ONLY when neither key nor secret is configured (i.e. true dev / preview env).
  // If the site key is set but the secret is missing/empty (e.g. wrangler pages secret put
  // was completed with an empty value), this is a prod misconfig and we must fail closed —
  // otherwise bot protection silently disappears with no signal.
  if (!secret) {
    if (env.TURNSTILE_SITE_KEY) return false;
    return true;
  }
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
