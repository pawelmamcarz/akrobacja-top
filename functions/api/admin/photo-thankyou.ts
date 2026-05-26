// POST /api/admin/photo-thankyou
// Body:
//   { action: 'preview', name: string }         -> wygeneruje sample tekst maila przez AI (bez wysylki)
//   { action: 'send_one', submission_id: number } -> generuje kod + tekst + wysyla pojedynczy mail
//   { action: 'send_bulk' }                     -> dla wszystkich zaakceptowanych zdjec gdzie photographer_email IS NOT NULL i nie ma jeszcze kodu z source='photo_thankyou'
//
// AI: Cloudflare Workers AI Llama 3 (env.AI) z polskim promptem.
// Fallback do BIELIK_URL gdy env.BIELIK_URL i env.BIELIK_TOKEN ustawione.

import { type Env } from '../../../src/lib/types';
import { checkAdminAuthAsync, getAdminUserAsync } from '../../../src/lib/admin-auth';
import { escapeHtml } from '../../../src/lib/email';

interface PhotoSubmissionRow {
  id: number;
  photographer_name: string;
  photographer_email: string;
  caption: string | null;
}

// Pretty event names z surowych tagow w DB
function prettyEventLabel(rawTags: string[], captions: string[]): string {
  const all = [...rawTags, ...captions].filter(Boolean).join(' ').toLowerCase();
  if (all.includes('jedlin') || all.includes('airsky')) return 'Airsky 2026 w Jedlińsku';
  if (all.includes('atam') || all.includes('piotrkow')) return 'ATAM 37 w Aeroklubie Ziemi Piotrkowskiej';
  if (rawTags[0]) return rawTags[0];
  if (captions[0]) return captions[0];
  return 'naszych pokazach';
}

async function getPhotoContext(env: Env, email: string): Promise<PhotoContext | undefined> {
  const { results } = await env.DB.prepare(
    `SELECT event_tag, caption FROM gallery_submissions
     WHERE status='approved' AND photographer_email = ?`
  ).bind(email).all<{ event_tag: string | null; caption: string | null }>();
  if (!results || results.length === 0) return undefined;
  const tags = [...new Set(results.map(r => r.event_tag).filter((x): x is string => !!x))];
  const captions = [...new Set(results.map(r => r.caption).filter((x): x is string => !!x))];
  return {
    event_label: prettyEventLabel(tags, captions),
    photo_count: results.length,
    captions,
  };
}

function randomCodeSuffix(): string {
  // 4 znaki [A-Z0-9] bez znakow myl0nych (0/O, 1/I)
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  let s = '';
  for (let i = 0; i < 4; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return s;
}

function generateCode(name: string): string {
  // PHOTO-{IMIE_2_LITERY_ASCII}{4_RANDOM} np. PHOTO-LUAB12.
  // Diakrytyki usuwane (klawiatury Stripe URL nie zawsze sobie radza z Ł/Ż).
  const ascii = (name || 'FOTO')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')      // strip combining marks (ó -> o, ż wymaga osobno)
    .replace(/ł/g, 'l').replace(/Ł/g, 'L') // ł nie ma combining mark
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase();
  const norm = ascii.slice(0, 2) || 'FT';
  return `PHOTO-${norm}${randomCodeSuffix()}`;
}

// Bielik 11B v2.3 GPU box przez Cloudflare Tunnel.
// Endpoint: https://llm.akrobacja.com/v1 (OpenAI-compatible, llama.cpp backend).
// Auth: Bearer LLAMA_API_KEY (wgraj przez wrangler pages secret put LLAMA_API_KEY).
// Concurrency: 1 slot (serializacja queue dla bulk requestow).
// CF Tunnel idle timeout 100s - dla generacji >100s uzyj stream:true (tu krotkie maile = OK bez stream).
const LLAMA_DEFAULT_ENDPOINT = 'https://llm.akrobacja.com';

interface BielikResponse {
  choices?: Array<{ message?: { content?: string }; text?: string }>;
  response?: string;
  message?: { content?: string };
}

async function callBielik(endpoint: string, prompt: string, apiKey?: string): Promise<string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const url = `${endpoint.replace(/\/$/, '')}/v1/chat/completions`;
  const r = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'bielik',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 700,
      temperature: 0.7,
      stream: false,
    }),
    signal: AbortSignal.timeout(90000),  // 90s - mail krotki, 1 slot moze byc w queue
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Bielik HTTP ${r.status}: ${txt.substring(0, 200)}`);
  let data: BielikResponse;
  try { data = JSON.parse(txt); } catch { throw new Error(`Bielik unparseable: ${txt.substring(0, 100)}`); }
  const text = data.choices?.[0]?.message?.content
    || data.choices?.[0]?.text
    || data.message?.content
    || data.response
    || '';
  if (!text) throw new Error(`Bielik empty response: ${txt.substring(0, 100)}`);
  return text.trim();
}

interface PhotoContext {
  event_label: string;       // np. "ATAM 37 w Aeroklubie Ziemi Piotrkowskiej" lub "Airsky 2026 w Jedlinsku"
  photo_count: number;       // ilosc zdjec tej osoby
  captions: string[];        // captions z submissions (do skomentowania)
}

async function generateMailText(env: Env, name: string, code: string, ctx?: PhotoContext): Promise<{ html: string; ai_used: string }> {
  const envExt = env as unknown as { LLAMA_ENDPOINT?: string; LLAMA_API_KEY?: string };
  const llamaEndpoint = envExt.LLAMA_ENDPOINT || LLAMA_DEFAULT_ENDPOINT;
  const llamaApiKey = envExt.LLAMA_API_KEY;

  const ctxBlock = ctx ? `
KONTEKST (uzyj konkretnie w tekscie, nie ogolnie):
- Event: ${ctx.event_label}
- Liczba zdjec tej osoby: ${ctx.photo_count}
${ctx.captions.length ? `- Opisy zdjec: ${ctx.captions.join(' | ')}` : ''}
` : '';

  const prompt = `Napisz krótki mail po polsku do fotografa "${name}" - jego zdjęcia z lotów akrobacyjnych Extra 300L SP-EKS sa juz w galerii akrobacja.com/galeria.

${ctxBlock}

ZASADY:
- DOKLADNIE 3-4 zdania, NIE WIECEJ
- LUZNY ton, jak do znajomego - bez "Drogi", "och", "ach", "niesamowite", "doskonale", "uchwycilo ducha", "inspirujace", "wspaniale", "promowanie pasji"
- ZERO emotek
- ZERO em-dashy (—), tylko zwykle myslniki (-)
- Wspomnij konkretny event po nazwie (nie ogolnie "pokazy")
- Konkretnie podziekuj za te X zdjec, nie ogolnie "wkład"

STRUKTURA (3-4 zdania w 1 lub 2 akapitach <p>):
1. Krotkie podziekowanie z konkretami (imie + event + liczba zdjec)
2. Info ze sa na akrobacja.com/galeria
3. Propozycja lotu z kodem ${code} (-10%, jednorazowy, do 31.07.2026)

Zakoncz osobnym <p> z DOKLADNIE: "Pozdrawiamy, załoga akrobacja.com - Paweł Mamcarz i Maciej Kulaszewski"

Format: TYLKO tagi <p>. Bez <html>, <head>, <body>.`;

  // 1. Sprobuj Bielik (llm.akrobacja.com, PL-native)
  try {
    const text = await callBielik(llamaEndpoint, prompt, llamaApiKey);
    if (text) return { html: text, ai_used: `bielik (${llamaEndpoint})` };
  } catch (err) {
    console.error('Bielik error, fallback to CF AI:', err);
  }

  // 2. Fallback: Cloudflare Workers AI Llama 3
  const aiRes = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 700,
    temperature: 0.7,
  }) as { response?: string };
  const text = (aiRes.response || '').trim();
  if (text) return { html: text, ai_used: 'cloudflare-llama-3 (bielik unavailable)' };

  return {
    html: `<p>Cześć ${name},</p><p>dziękujemy za zdjęcia w galerii akrobacja.com/galeria. Jeśli sam chciałbyś polecieć - kod <strong>${code}</strong> daje Ci 10% rabatu (jednorazowy, do końca lipca 2026). Sprawdź na akrobacja.com.</p><p>Pozdrawiamy, załoga akrobacja.com - Paweł Mamcarz i Maciej Kulaszewski.</p>`,
    ai_used: 'fallback (no AI)',
  };
}

async function sendThankYouMail(env: Env, to: string, name: string, code: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'akrobacja.com <maciej@akrobacja.com>',
      to: [to],
      reply_to: 'maciej@akrobacja.com',
      subject: `${name}, dziękujemy za Twoje zdjęcia z Extra 300L`,
      tags: [{ name: 'type', value: 'photo_thankyou' }],
      html: `
<!DOCTYPE html>
<html lang="pl"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f7fa">
  <div style="max-width:560px;margin:0 auto;background:#fff">
    <div style="background:#0A2F7C;padding:32px;text-align:center">
      <h1 style="color:#fff;margin:0;font-size:24px">akrobacja.com</h1>
      <p style="color:rgba(255,255,255,0.7);margin:6px 0 0;font-size:12px">Extra 300L · SP-EKS · Radom-Piastów</p>
    </div>
    <div style="padding:32px 28px;color:#0A2F7C;font-size:14px;line-height:1.7">
      ${html}
      <div style="margin-top:24px;padding:14px 18px;background:#fff5e6;border-left:4px solid #f59e0b;border-radius:4px">
        <strong>Twój osobisty kod:</strong> <code style="font-size:16px;color:#0A2F7C;font-weight:700">${escapeHtml(code)}</code><br>
        <small style="color:#666">-10% na dowolny pakiet · jednorazowy · ważny do 31.07.2026</small>
      </div>
      <p style="margin-top:24px"><a href="https://akrobacja.com" style="display:inline-block;background:#E11E26;color:#fff;text-decoration:none;padding:12px 24px;font-weight:700;font-size:14px;border-radius:4px">Wybierz pakiet lotu</a></p>
    </div>
    <div style="background:#0A2F7C;padding:18px;text-align:center">
      <p style="color:rgba(255,255,255,0.5);font-size:11px;margin:0">akrobacja.com · Lotnisko Radom-Piastów (EPRP) · +48 739 158 131</p>
    </div>
  </div>
</body></html>`,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Resend ${res.status}: ${txt.substring(0, 200)}`);
  }
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!(await checkAdminAuthAsync(ctx.request, ctx.env))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const adminUser = await getAdminUserAsync(ctx.request, ctx.env);
  const body = (await ctx.request.json().catch(() => null)) as {
    action?: 'preview' | 'send_one' | 'send_bulk' | 'send_test';
    name?: string;
    to?: string;
    preview_email?: string;       // override default kontekstu w preview (np. 'blaszczak.lukas@gmail.com' dla Lukasza)
    submission_id?: number;
    dry_run?: boolean;
  } | null;
  if (!body?.action) return Response.json({ error: 'Brak action' }, { status: 400 });

  if (body.action === 'preview') {
    const name = body.name || 'Łukasz';
    const code = generateCode(name);

    // Debug: probe Bielik bezposrednio gdy ?debug=1, zwroc error pelny.
    const url = new URL(ctx.request.url);
    if (url.searchParams.get('debug') === '1') {
      const envExt = ctx.env as unknown as { LLAMA_ENDPOINT?: string; LLAMA_API_KEY?: string };
      const endpoint = envExt.LLAMA_ENDPOINT || LLAMA_DEFAULT_ENDPOINT;
      try {
        const text = await callBielik(endpoint, 'Test polskiego: napisz krotkie "OK" jesli rozumiesz.', envExt.LLAMA_API_KEY);
        return Response.json({ bielik_ok: true, endpoint, has_api_key: !!envExt.LLAMA_API_KEY, response: text });
      } catch (err) {
        return Response.json({ bielik_ok: false, endpoint, has_api_key: !!envExt.LLAMA_API_KEY, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
      }
    }

    // Kontekst z fotografow ATAM37 (default Karolina jako test - ma 4 zdjec)
    const ctxPreview = await getPhotoContext(ctx.env, body.preview_email || 'karolinadrygas@gmail.com');
    const r = await generateMailText(ctx.env, name, code, ctxPreview);
    return Response.json({ name, code, context: ctxPreview, html_preview: r.html, ai_used: r.ai_used });
  }

  if (body.action === 'send_test') {
    if (!body.to) return Response.json({ error: 'to (email) wymagany' }, { status: 400 });
    const name = body.name || 'Łukasz';
    const code = generateCode(name);
    // Dla send_test wez kontekst Lukasza (Jedlinsk) jesli imie 'Łukasz', else Karolina (ATAM)
    const ctxEmail = name.toLowerCase().includes('łukasz') || name.toLowerCase().includes('lukasz')
      ? 'blaszczak.lukas@gmail.com' : 'karolinadrygas@gmail.com';
    const photoCtx = await getPhotoContext(ctx.env, ctxEmail);
    const r = await generateMailText(ctx.env, name, code, photoCtx);
    // NIE wpisujemy do personal_discount_codes (to test, nie produkcyjny send)
    await sendThankYouMail(ctx.env, body.to, name, code, r.html);
    return Response.json({ ok: true, sent_to: body.to, name, code, ai_used: r.ai_used, context: photoCtx, html: r.html, note: 'TEST mail - kod NIE jest aktywny w DB' });
  }

  if (body.action === 'send_one') {
    if (!body.submission_id) return Response.json({ error: 'submission_id wymagany' }, { status: 400 });
    const sub = await ctx.env.DB.prepare(
      `SELECT id, photographer_name, photographer_email, caption FROM gallery_submissions WHERE id = ?`
    ).bind(body.submission_id).first<PhotoSubmissionRow>();
    if (!sub) return Response.json({ error: 'Submission nie znaleziony' }, { status: 404 });
    if (!sub.photographer_email) return Response.json({ error: 'Brak emaila u fotografa' }, { status: 400 });

    const code = generateCode(sub.photographer_name);
    const photoCtx = await getPhotoContext(ctx.env, sub.photographer_email);
    const r = await generateMailText(ctx.env, sub.photographer_name, code, photoCtx);
    if (body.dry_run) return Response.json({ dry_run: true, code, html: r.html, ai_used: r.ai_used });

    // Insert kod do DB
    await ctx.env.DB.prepare(
      `INSERT INTO personal_discount_codes (code, customer_email, pct, source, expires_at, created_by)
       VALUES (?, ?, 10, 'photo_thankyou', '2026-07-31', ?)`
    ).bind(code, sub.photographer_email, adminUser || 'admin').run();

    await sendThankYouMail(ctx.env, sub.photographer_email, sub.photographer_name, code, r.html);
    return Response.json({ ok: true, sent_to: sub.photographer_email, code, ai_used: r.ai_used });
  }

  if (body.action === 'send_bulk') {
    // Wszyscy zaakceptowani, z mailem, ktorzy NIE maja jeszcze kodu z source='photo_thankyou'.
    const { results } = await ctx.env.DB.prepare(`
      SELECT DISTINCT gs.photographer_name, gs.photographer_email
      FROM gallery_submissions gs
      LEFT JOIN personal_discount_codes pdc ON pdc.customer_email = gs.photographer_email AND pdc.source = 'photo_thankyou'
      WHERE gs.status = 'approved'
        AND gs.photographer_email IS NOT NULL
        AND gs.photographer_email != ''
        AND pdc.code IS NULL
    `).all<{ photographer_name: string; photographer_email: string }>();

    const sent: Array<{ email: string; name: string; code: string; ai_used: string }> = [];
    const failed: Array<{ email: string; error: string }> = [];
    for (const row of results) {
      try {
        const code = generateCode(row.photographer_name);
        const photoCtx = await getPhotoContext(ctx.env, row.photographer_email);
        const r = await generateMailText(ctx.env, row.photographer_name, code, photoCtx);
        await ctx.env.DB.prepare(
          `INSERT INTO personal_discount_codes (code, customer_email, pct, source, expires_at, created_by)
           VALUES (?, ?, 10, 'photo_thankyou', '2026-07-31', ?)`
        ).bind(code, row.photographer_email, adminUser || 'admin').run();
        await sendThankYouMail(ctx.env, row.photographer_email, row.photographer_name, code, r.html);
        sent.push({ email: row.photographer_email, name: row.photographer_name, code, ai_used: r.ai_used });
      } catch (err) {
        failed.push({ email: row.photographer_email, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return Response.json({ sent_count: sent.length, failed_count: failed.length, sent, failed });
  }

  return Response.json({ error: 'Nieznana akcja' }, { status: 400 });
};
