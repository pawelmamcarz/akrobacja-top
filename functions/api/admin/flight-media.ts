// /api/admin/flight-media
// GET    ?voucher_code=AKR-... — list media files (and shares) for a voucher
// POST   multipart, fields { voucher_code, files[] } — upload one or more
// DELETE { id } — remove a single media file (R2 object + DB row)
//
// Files stored in VOUCHER_BUCKET under prefix flight/{voucher_code}/{uuid}.{ext}.
// Per-file limit 100 MB (Workers/Pages Functions body limit on paid plans).
// Larger raw videos: pre-transcode locally (DaVinci/FFmpeg) and upload the web copy.

import { type Env } from '../../../src/lib/types';
import { checkAdminAuthAsync, getAdminUserAsync } from '../../../src/lib/admin-auth';

const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_FILES_PER_REQUEST = 12;
const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'video/mp4', 'video/quicktime', 'video/webm',
]);

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

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    'image/heic': 'heic', 'image/heif': 'heif',
    'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
  };
  return map[mime] || 'bin';
}

function kindFromMime(mime: string): 'photo' | 'video' {
  return mime.startsWith('video/') ? 'video' : 'photo';
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (!(await checkAdminAuthAsync(ctx.request, ctx.env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = new URL(ctx.request.url);
  const voucher_code = url.searchParams.get('voucher_code')?.trim();
  if (!voucher_code) return Response.json({ error: 'voucher_code required' }, { status: 400 });

  const media = await ctx.env.DB.prepare(
    `SELECT id, r2_key, kind, filename, size, content_type, width, height, duration_sec, uploaded_at, uploaded_by
     FROM flight_media WHERE voucher_code = ? ORDER BY uploaded_at DESC`,
  ).bind(voucher_code).all();

  const shares = await ctx.env.DB.prepare(
    `SELECT token, created_at, expires_at, created_by, notify_sent_at, view_count, last_viewed_at
     FROM flight_shares WHERE voucher_code = ? ORDER BY created_at DESC`,
  ).bind(voucher_code).all();

  return Response.json({
    voucher_code,
    media: media.results || [],
    shares: shares.results || [],
  });
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getAdminUserAsync(ctx.request, ctx.env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let form: FormData;
  try {
    form = await ctx.request.formData();
  } catch {
    return Response.json({ error: 'Bad multipart' }, { status: 400 });
  }
  const voucher_code = (form.get('voucher_code') as unknown as string | null)?.trim();
  if (!voucher_code || !/^AKR-[A-Z0-9-]+$/i.test(voucher_code)) {
    return Response.json({ error: 'voucher_code invalid' }, { status: 400 });
  }

  const exists = await ctx.env.DB.prepare(
    `SELECT id FROM orders WHERE voucher_code = ?`,
  ).bind(voucher_code).first<{ id: string }>();
  if (!exists) return Response.json({ error: 'Voucher nie istnieje' }, { status: 404 });

  const files = (form.getAll('files') as unknown[]).filter(isFile).filter((f) => f.size > 0);
  if (files.length === 0) return Response.json({ error: 'Brak plików' }, { status: 400 });
  if (files.length > MAX_FILES_PER_REQUEST) {
    return Response.json({ error: `Max ${MAX_FILES_PER_REQUEST} plików / request` }, { status: 400 });
  }
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) {
      return Response.json({ error: `Plik ${f.name} >100MB, przetnij/skompresuj lokalnie` }, { status: 400 });
    }
    if (!ALLOWED_MIME.has(f.type)) {
      return Response.json({ error: `Typ ${f.type} nieobsługiwany (${f.name})` }, { status: 400 });
    }
  }

  const widths = (form.getAll('widths') as unknown[]).map((v) => typeof v === 'string' ? parseInt(v, 10) : 0);
  const heights = (form.getAll('heights') as unknown[]).map((v) => typeof v === 'string' ? parseInt(v, 10) : 0);
  const durations = (form.getAll('durations') as unknown[]).map((v) => typeof v === 'string' ? parseFloat(v) : 0);

  const now = Math.floor(Date.now() / 1000);
  const insertedIds: number[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const key = `flight/${voucher_code}/${uuid()}.${extFromMime(file.type)}`;
    try {
      await ctx.env.VOUCHER_BUCKET.put(key, file.stream(), {
        httpMetadata: { contentType: file.type },
      });
    } catch (err) {
      console.error('R2 upload failed:', err);
      return Response.json({ error: `R2 fail dla ${file.name}` }, { status: 500 });
    }
    const w = widths[i] && widths[i] > 0 ? widths[i] : null;
    const h = heights[i] && heights[i] > 0 ? heights[i] : null;
    const d = durations[i] && durations[i] > 0 ? durations[i] : null;
    const res = await ctx.env.DB.prepare(
      `INSERT INTO flight_media (voucher_code, r2_key, kind, filename, size, content_type, width, height, duration_sec, uploaded_at, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(voucher_code, key, kindFromMime(file.type), file.name.slice(0, 200), file.size, file.type, w, h, d, now, user).run();
    if (res.meta.last_row_id) insertedIds.push(Number(res.meta.last_row_id));
  }

  return Response.json({ ok: true, count: insertedIds.length, ids: insertedIds });
};

export const onRequestDelete: PagesFunction<Env> = async (ctx) => {
  if (!(await checkAdminAuthAsync(ctx.request, ctx.env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await ctx.request.json().catch(() => null) as { id?: number } | null;
  if (!body?.id) return Response.json({ error: 'id required' }, { status: 400 });
  const row = await ctx.env.DB.prepare(
    `SELECT r2_key FROM flight_media WHERE id = ?`,
  ).bind(body.id).first<{ r2_key: string }>();
  if (!row) return Response.json({ error: 'Not found' }, { status: 404 });
  await ctx.env.VOUCHER_BUCKET.delete(row.r2_key).catch(() => {});
  await ctx.env.DB.prepare(`DELETE FROM flight_media WHERE id = ?`).bind(body.id).run();
  return Response.json({ ok: true });
};
