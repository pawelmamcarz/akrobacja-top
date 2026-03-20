import { type Env } from './types';

// SMSAPI.pl — send OTP via SMS
export async function sendSms(env: Env, phone: string, message: string): Promise<void> {
  const sender = 'akrobacja';
  const token = (env.SMSAPI_TOKEN || '').replace(/\s/g, '');

  const params = new URLSearchParams({
    to: normalizePhone(phone),
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
  });

  const text = await res.text();

  // SMSAPI returns 200 even on errors, check response body
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`SMSAPI error: ${text}`);
  }

  if (data.error) {
    throw new Error(`SMSAPI error: ${data.message || data.error} [token:${token.length}ch, to:${normalizePhone(phone)}]`);
  }
}

export function generateOtp(): string {
  const bytes = crypto.getRandomValues(new Uint32Array(1));
  return String(bytes[0] % 900000 + 100000); // 6 digits
}

function normalizePhone(phone: string): string {
  let p = phone.replace(/[\s\-\(\)\+]/g, '');
  if (p.startsWith('48') && p.length === 11) return p;
  if (p.length === 9) return '48' + p;
  return p;
}
