import { type Env } from './types';
import { normalizePhone } from './phone';

// SMSAPI.pl - send OTP via SMS
export async function sendSms(env: Env, phone: string, message: string): Promise<void> {
  const sender = 'akrobacja';
  const token = (env.SMSAPI_TOKEN || '').replace(/\s/g, '');
  const to = normalizePhone(phone);

  const params = new URLSearchParams({
    to,
    message,
    from: sender,
    format: 'json',
  });

  const res = await fetch('https://api.smsapi.pl/sms.do', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
    signal: AbortSignal.timeout(10000),
  });

  const text = await res.text();

  // SMSAPI returns 200 even on errors - sprawdź body
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    console.error('SMSAPI non-JSON response', { status: res.status, body: text.substring(0, 200) });
    throw new Error('SMSAPI request failed');
  }

  if (data.error) {
    // Log full details (token length, recipient) but never expose them to the caller.
    console.error('SMSAPI app-level error', { error: data.error, message: data.message, tokenLen: token.length, to });
    throw new Error('SMSAPI request failed');
  }
}

export function generateOtp(): string {
  const bytes = crypto.getRandomValues(new Uint32Array(1));
  return String(bytes[0] % 900000 + 100000); // 6 digits
}
