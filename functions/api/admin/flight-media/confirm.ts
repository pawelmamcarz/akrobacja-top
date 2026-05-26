// POST /api/admin/flight-media/confirm
// Body: { voucher_code, files: [{ r2_key, original_name, size, content_type,
//                                  width?, height?, duration_sec? }] }
// Returns: { ok, count, ids: [...] }
//
// Called by the browser AFTER it finished uploading files directly to R2 via
// the presigned URLs from /presign. We verify each r2_key is in the
// flight/{voucher_code}/ namespace (so the client can't claim a key under
// another voucher) and that the object actually exists in R2, then insert
// the metadata row that the gallery UI reads from.

import { type Env } from '../../../../src/lib/types';
import { getAdminUserAsync } from '../../../../src/lib/admin-auth';

interface ConfirmFile {
  r2_key?: string;
  original_name?: string;
  size?: number;
  content_type?: string;
  width?: number;
  height?: number;
  duration_sec?: number;
}

function kindFromMime(mime: string): 'photo' | 'video' {
  return mime.startsWith('video/') ? 'video' : 'photo';
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const user = await getAdminUserAsync(ctx.request, ctx.env);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await ctx.request.json().catch(() => null) as { voucher_code?: string; files?: ConfirmFile[] } | null;
  const voucherCode = (body?.voucher_code || '').trim();
  if (!voucherCode || !/^AKR-[A-Z0-9-]+$/i.test(voucherCode)) {
    return Response.json({ error: 'voucher_code invalid' }, { status: 400 });
  }
  const files = body?.files;
  if (!Array.isArray(files) || files.length === 0) {
    return Response.json({ error: 'files[] wymagane' }, { status: 400 });
  }

  const keyPrefix = `flight/${voucherCode}/`;
  const now = Math.floor(Date.now() / 1000);
  const insertedIds: number[] = [];

  for (const f of files) {
    const r2Key = String(f.r2_key || '');
    if (!r2Key.startsWith(keyPrefix)) {
      return Response.json({ error: `r2_key ${r2Key} nie pasuje do voucher ${voucherCode}` }, { status: 400 });
    }
    // Verify object actually exists in R2 - prevents fake confirms from
    // adding ghost rows that 404 when admin previews them later.
    const head = await ctx.env.VOUCHER_BUCKET.head(r2Key);
    if (!head) {
      return Response.json({ error: `Plik nie istnieje w R2: ${r2Key}` }, { status: 400 });
    }

    const size = Number(f.size) || head.size || 0;
    const contentType = String(f.content_type || head.httpMetadata?.contentType || 'application/octet-stream');
    const originalName = String(f.original_name || '').slice(0, 200) || r2Key.split('/').pop() || 'upload';
    const width = Number.isFinite(Number(f.width)) && Number(f.width) > 0 ? Number(f.width) : null;
    const height = Number.isFinite(Number(f.height)) && Number(f.height) > 0 ? Number(f.height) : null;
    const duration = Number.isFinite(Number(f.duration_sec)) && Number(f.duration_sec) > 0 ? Number(f.duration_sec) : null;

    const res = await ctx.env.DB.prepare(`
      INSERT INTO flight_media (voucher_code, r2_key, kind, filename, size, content_type, width, height, duration_sec, uploaded_at, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      voucherCode, r2Key, kindFromMime(contentType), originalName, size, contentType,
      width, height, duration, now, user,
    ).run();
    if (res.meta.last_row_id) insertedIds.push(Number(res.meta.last_row_id));
  }

  return Response.json({ ok: true, count: insertedIds.length, ids: insertedIds });
};
