import { type Env } from './types';

// Cloudflare Turnstile siteverify. Returns true when the token is valid for our
// secret, false otherwise. Fails open ONLY when TURNSTILE_SECRET is not configured
// (i.e. in dev) so the rest of the request flow still works; in prod the secret
// must be set or every request will be rejected.
let _missingSecretWarned = false;

export async function verifyTurnstile(
  env: Env,
  token: string | null | undefined,
  remoteIp: string | null,
): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET;
  if (!secret) {
    // Fail-open with a console.warn so the misconfig is visible in CF Logs. We deliberately
    // do NOT fail-closed when site key is set but secret is empty — KV rate-limit is still
    // active on every endpoint, and locking out legit users (today's prod state, where the
    // secret was uploaded as an empty string) is worse than letting bots through 5/min/IP.
    if (env.TURNSTILE_SITE_KEY && !_missingSecretWarned) {
      _missingSecretWarned = true;
      console.warn('[turnstile] TURNSTILE_SITE_KEY is set but TURNSTILE_SECRET is empty — bot protection effectively OFF. Set the secret in Cloudflare Pages.');
    }
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
