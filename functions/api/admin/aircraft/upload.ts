// POST /api/admin/aircraft/upload  (multipart)
// Wgranie pliku MS (maintenance status od CAMO) lub skanu dokumentu. Plik ląduje
// w R2, metadane w tabeli documents (source='camo' dla MS). Dostęp: admin + mechanik
// (middleware przepuszcza /api/admin/aircraft/* dla mechanika).
//
// Pola formularza: photo (File, wymagane), name, doc_type (domyślnie 'ms'),
// valid_from, valid_to, notes, aircraft_id, source ('camo'|'manual').

import { type Env } from '../../../../src/lib/types';
import { checkAdminAuthAsync } from '../../../../src/lib/admin-auth';

const DEFAULT_AIRCRAFT = 'speks-001';
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB - PDF MS bywa wielostronicowy

interface UploadedFile { name: string; size: number; type: string; arrayBuffer(): Promise<ArrayBuffer>; }
function isFile(v: unknown): v is UploadedFile {
  return typeof v === 'object' && v !== null
    && typeof (v as { size?: unknown }).size === 'number'
    && typeof (v as { type?: unknown }).type === 'string'
    && typeof (v as { arrayBuffer?: unknown }).arrayBuffer === 'function';
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!(await checkAdminAuthAsync(ctx.request, ctx.env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await ctx.request.formData();
  } catch {
    return Response.json({ error: 'Nieprawidłowe dane formularza' }, { status: 400 });
  }

  const file = form.get('photo');
  if (!isFile(file)) return Response.json({ error: 'Brak pliku' }, { status: 400 });
  if (file.size === 0 || file.size > MAX_BYTES) {
    return Response.json({ error: 'Plik za duży lub pusty (max 15 MB)' }, { status: 400 });
  }

  const docType = (form.get('doc_type') as string) || 'ms';
  const source = (form.get('source') as string) === 'manual' ? 'manual' : 'camo';
  const aircraftId = (form.get('aircraft_id') as string) || DEFAULT_AIRCRAFT;
  const name = (form.get('name') as string)?.trim() || file.name || 'Dokument';

  const ext = (file.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const r2Key = `documents/${aircraftId}/${crypto.randomUUID()}.${ext}`;
  await ctx.env.VOUCHER_BUCKET.put(r2Key, new Uint8Array(await file.arrayBuffer()), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
  });

  const id = crypto.randomUUID();
  await ctx.env.DB.prepare(
    'INSERT INTO documents (id, name, type, valid_from, valid_to, notes, aircraft_id, r2_key, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    id, name.slice(0, 200), docType,
    (form.get('valid_from') as string) || null,
    (form.get('valid_to') as string) || null,
    (form.get('notes') as string) || null,
    aircraftId, r2Key, source,
  ).run();

  return Response.json({ ok: true, id, r2_key: r2Key });
};
