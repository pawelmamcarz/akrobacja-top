// POST /api/photographer/upload
// Public endpoint — photographers submit photos for /galeria. Files are pre-resized
// client-side (canvas) to a 2048px long-edge JPEG/WebP under 2 MB; server validates,
// stores in R2 under submissions/{uuid}.jpg and inserts a gallery_submissions row with
// status='pending'. Admin approves from the "Zdjecia" tab; only approved rows surface
// on /galeria via /api/gallery.

import { type Env } from '../../../src/lib/types';
import { rateLimit, clientIp } from '../../../src/lib/rate-limit';
import { verifyTurnstile } from '../../../src/lib/turnstile';
import { isValidEmail } from '../../../src/lib/validate';

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_FILES_PER_SUBMISSION = 8;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/webp']);

function safeStr(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const trimmed = v.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

interface UploadedFile {
  name: string;
  size: number;
  type: string;
  stream(): ReadableStream;
}
function isFile(v: unknown): v is UploadedFile {
  return typeof v === 'object' && v !== null
    && typeof (v as { size?: unknown }).size === 'number'
    && typeof (v as { type?: unknown }).type === 'string'
    && typeof (v as { stream?: unknown }).stream === 'function';
}

function uuid(): string {
  return (crypto as { randomUUID?: () => string }).randomUUID?.()
    ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const ip = clientIp(ctx.request);

  const rl = await rateLimit(ctx.env, `photo-upload:${ip}`, 4, 3600);
  if (!rl.ok) {
    return Response.json({ error: 'Zbyt wiele zgloszen. Spróbuj za godzinę.' }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await ctx.request.formData();
  } catch {
    return Response.json({ error: 'Nieprawidłowy format formularza' }, { status: 400 });
  }

  const photographer_name = safeStr(form.get('photographer_name'), 80);
  if (!photographer_name) {
    return Response.json({ error: 'Podaj imię i nazwisko' }, { status: 400 });
  }
  const photographer_city = safeStr(form.get('photographer_city'), 60);
  const photographer_instagram = safeStr(form.get('photographer_instagram'), 60);
  const photographer_email = safeStr(form.get('photographer_email'), 120);
  const caption = safeStr(form.get('caption'), 200);
  const event_tag = safeStr(form.get('event_tag'), 40);
  const turnstileToken = safeStr(form.get('turnstileToken'), 4096);

  if (photographer_email && !isValidEmail(photographer_email)) {
    return Response.json({ error: 'Nieprawidłowy adres email' }, { status: 400 });
  }

  if (!(await verifyTurnstile(ctx.env, turnstileToken, ip))) {
    return Response.json({ error: 'Weryfikacja captcha nieudana' }, { status: 400 });
  }

  const files = (form.getAll('files') as unknown[]).filter(isFile).filter((f) => f.size > 0);
  if (files.length === 0) {
    return Response.json({ error: 'Dodaj co najmniej jedno zdjęcie' }, { status: 400 });
  }
  if (files.length > MAX_FILES_PER_SUBMISSION) {
    return Response.json({ error: `Maks. ${MAX_FILES_PER_SUBMISSION} plików na zgłoszenie` }, { status: 400 });
  }
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) {
      return Response.json({ error: `Plik ${f.name} jest zbyt duży (max 2 MB po kompresji)` }, { status: 400 });
    }
    if (!ALLOWED_MIME.has(f.type)) {
      return Response.json({ error: `Plik ${f.name}: dozwolone tylko JPG i WebP` }, { status: 400 });
    }
  }

  const widths = form.getAll('widths').map((v) => typeof v === 'string' ? parseInt(v, 10) : 0);
  const heights = form.getAll('heights').map((v) => typeof v === 'string' ? parseInt(v, 10) : 0);

  const ua = ctx.request.headers.get('user-agent')?.slice(0, 240) || '';
  const submittedAt = Math.floor(Date.now() / 1000);
  const insertedIds: number[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = file.type === 'image/webp' ? 'webp' : 'jpg';
    const key = `submissions/${uuid()}.${ext}`;
    const w = widths[i] && widths[i] > 0 ? widths[i] : 0;
    const h = heights[i] && heights[i] > 0 ? heights[i] : 0;

    try {
      await ctx.env.VOUCHER_BUCKET.put(key, file.stream(), {
        httpMetadata: { contentType: file.type },
      });
    } catch (err) {
      console.error('R2 upload failed:', err);
      return Response.json({ error: 'Nie udało się zapisać pliku, spróbuj ponownie' }, { status: 500 });
    }

    const res = await ctx.env.DB.prepare(
      `INSERT INTO gallery_submissions
        (r2_key, width, height, photographer_name, photographer_city, photographer_instagram,
         photographer_email, caption, event_tag, status, submitted_at, submitter_ip, submitter_ua)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
    )
      .bind(key, w, h, photographer_name, photographer_city, photographer_instagram,
        photographer_email, caption, event_tag, submittedAt, ip, ua)
      .run();
    if (res.meta.last_row_id) insertedIds.push(Number(res.meta.last_row_id));
  }

  ctx.waitUntil(notifyAdmin(ctx.env, photographer_name, files.length, photographer_city, photographer_instagram).catch(() => {}));

  return Response.json({ ok: true, count: insertedIds.length, ids: insertedIds });
};

async function notifyAdmin(
  env: Env,
  name: string,
  count: number,
  city: string | null,
  ig: string | null,
): Promise<void> {
  if (!env.RESEND_API_KEY) return;
  const body = `Nowe zgloszenie zdjec do galerii:\n\n` +
    `Fotograf: ${name}\n` +
    (city ? `Miasto: ${city}\n` : '') +
    (ig ? `Instagram: ${ig}\n` : '') +
    `Liczba zdjec: ${count}\n\n` +
    `Moderacja: https://akrobacja.com/admin#zdjecia`;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'akrobacja.com <system@akrobacja.com>',
      to: ['info@akrobacja.com'],
      tags: [{ name: 'type', value: 'photo-submission' }],
      subject: `Zdjecia do galerii: ${name} (${count})`,
      text: body,
    }),
  });
}
