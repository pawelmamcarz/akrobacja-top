// POST /api/admin/flight-media/presign
// Body: { voucher_code, files: [{ name, size, type }] }
// Returns: { uploads: [{ r2_key, upload_url, expires_at }] }
//
// Bypasses the Pages Functions 500 MB body limit by giving the browser a
// short-lived (30 min) S3-compatible presigned PUT URL straight against R2.
// Browser uploads file via XHR/fetch with progress events, then calls
// /confirm to register metadata in D1.
//
// Requires R2_* env vars (see types.ts). Falls back to 503 with setup hint
// when secrets are missing so admin sees the gap instead of a silent 500.

import { AwsClient } from 'aws4fetch';
import { type Env } from '../../../../src/lib/types';
import { checkAdminAuthAsync } from '../../../../src/lib/admin-auth';

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'video/mp4', 'video/quicktime', 'video/webm',
]);
const MAX_FILE_BYTES = 5 * 1024 * 1024 * 1024; // R2 single-PUT cap
const MAX_FILES_PER_PRESIGN = 50;
const URL_TTL_SECONDS = 1800;

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    'image/heic': 'heic', 'image/heif': 'heif',
    'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
  };
  return map[mime] || 'bin';
}
function uuid(): string {
  return (crypto as { randomUUID?: () => string }).randomUUID?.()
    ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface FileSpec { name?: string; size?: number; type?: string }

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!(await checkAdminAuthAsync(ctx.request, ctx.env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const accountId = ctx.env.R2_ACCOUNT_ID;
  const accessKey = ctx.env.R2_ACCESS_KEY_ID;
  const secretKey = ctx.env.R2_SECRET_ACCESS_KEY;
  const bucket = ctx.env.R2_BUCKET || 'akrobacja-vouchers';
  if (!accountId || !accessKey || !secretKey) {
    return Response.json({
      error: 'R2 S3 credentials nie ustawione',
      hint: 'wrangler pages secret put R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY',
    }, { status: 503 });
  }

  const body = await ctx.request.json().catch(() => null) as { voucher_code?: string; files?: FileSpec[] } | null;
  const voucherCode = (body?.voucher_code || '').trim();
  if (!voucherCode || !/^AKR-[A-Z0-9-]+$/i.test(voucherCode)) {
    return Response.json({ error: 'voucher_code invalid' }, { status: 400 });
  }
  const files = body?.files;
  if (!Array.isArray(files) || files.length === 0) {
    return Response.json({ error: 'files[] wymagane' }, { status: 400 });
  }
  if (files.length > MAX_FILES_PER_PRESIGN) {
    return Response.json({ error: `Max ${MAX_FILES_PER_PRESIGN} plików / presign batch` }, { status: 400 });
  }
  for (const f of files) {
    if (typeof f.type !== 'string' || !ALLOWED_MIME.has(f.type)) {
      return Response.json({ error: `Typ ${f.type} nieobsługiwany (${f.name})` }, { status: 400 });
    }
    if (typeof f.size !== 'number' || f.size <= 0 || f.size > MAX_FILE_BYTES) {
      return Response.json({ error: `Plik ${f.name}: rozmiar poza zakresem (max 5 GB)` }, { status: 400 });
    }
  }

  const exists = await ctx.env.DB.prepare(`SELECT id FROM orders WHERE voucher_code = ?`)
    .bind(voucherCode).first();
  if (!exists) return Response.json({ error: 'Voucher nie istnieje' }, { status: 404 });

  const aws = new AwsClient({
    accessKeyId: accessKey,
    secretAccessKey: secretKey,
    region: 'auto',
    service: 's3',
  });

  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  const expiresAt = Math.floor(Date.now() / 1000) + URL_TTL_SECONDS;
  const uploads: Array<{ r2_key: string; upload_url: string; expires_at: number; content_type: string }> = [];

  for (const f of files) {
    const key = `flight/${voucherCode}/${uuid()}.${extFromMime(f.type as string)}`;
    const signedUrl = `${endpoint}/${bucket}/${key}?X-Amz-Expires=${URL_TTL_SECONDS}`;
    const signedReq = await aws.sign(new Request(signedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': f.type as string },
    }), { aws: { signQuery: true } });
    uploads.push({ r2_key: key, upload_url: signedReq.url, expires_at: expiresAt, content_type: f.type as string });
  }

  return Response.json({ uploads, expires_at: expiresAt });
};
