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

async function generateMailText(env: Env, name: string, code: string): Promise<string> {
  // Try BIELIK_URL first (jesli user ustawi swoj endpoint), fallback do Cloudflare Workers AI.
  const bielikUrl = (env as unknown as { BIELIK_URL?: string }).BIELIK_URL;
  const bielikToken = (env as unknown as { BIELIK_TOKEN?: string }).BIELIK_TOKEN;
  const prompt = `Napisz krótki, ciepły mail w jezyku polskim z PODZIĘKOWANIEM dla fotografa o imieniu "${name}", który wrzucił swoje zdjęcia z lotów akrobacyjnych Extra 300L SP-EKS do galerii akrobacja.com.

Wymagania:
- Maksymalnie 5-6 zdań
- Ton: ciepły, osobisty, niesztampowy
- BEZ emotek
- BEZ frazesów typu "Cieszę się że...", "W obliczu", "Warto pamiętać"
- BEZ em-dashy (—) - używaj zwyklych myslnikow (-)
- Konkretnie:
  1. Bezpośrednie podziękowanie za zdjęcia
  2. Info: zdjęcia są na akrobacja.com/galeria
  3. Propozycja: jeśli sam chciałbyś polecieć, mamy dla Ciebie 10% rabatu kodem ${code} (jednorazowy, tylko dla Ciebie, do końca lipca 2026)
  4. Link do oferty: akrobacja.com
  5. Pozdrowienia od Macieja Kulaszewskiego (pilot Extra 300L, Mistrz Świata 2022)

Format: tylko treść maila (HTML akapity <p>). Bez nagłówków <html>, <head>, <body>. Bez podpisu "Maciej" osobno - włącz go w treść.`;

  // 1. Sprobuj Bielik
  if (bielikUrl && bielikToken) {
    try {
      const r = await fetch(bielikUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${bielikToken}` },
        body: JSON.stringify({
          model: 'speakleash/Bielik-11B-v2.3-Instruct',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 600,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await r.json() as { choices?: Array<{ message?: { content?: string } }>, response?: string };
      const text = data.choices?.[0]?.message?.content || data.response || '';
      if (text) return text.trim();
    } catch (err) {
      console.error('Bielik error, fallback to CF AI:', err);
    }
  }

  // 2. Fallback: Cloudflare Workers AI Llama 3
  const aiRes = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 600,
    temperature: 0.7,
  }) as { response?: string };
  return (aiRes.response || '').trim() || `<p>Cześć ${name},</p><p>dziękujemy za zdjęcia w galerii akrobacja.com/galeria. Jeśli sam chciałbyś polecieć - kod <strong>${code}</strong> daje Ci 10% rabatu (jednorazowy, do końca lipca 2026). Sprawdź na akrobacja.com.</p><p>Pozdrawiam, Maciej Kulaszewski (pilot Extra 300L, Mistrz Świata 2022).</p>`;
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
    submission_id?: number;
    dry_run?: boolean;
  } | null;
  if (!body?.action) return Response.json({ error: 'Brak action' }, { status: 400 });

  if (body.action === 'preview') {
    const name = body.name || 'Łukasz';
    const code = generateCode(name);
    const html = await generateMailText(ctx.env, name, code);
    const env = ctx.env as unknown as { BIELIK_URL?: string; BIELIK_TOKEN?: string };
    return Response.json({
      name, code, html_preview: html,
      ai_used: env.BIELIK_URL && env.BIELIK_TOKEN ? 'bielik' : 'cloudflare-llama-3',
      bielik_configured: !!(env.BIELIK_URL && env.BIELIK_TOKEN),
    });
  }

  if (body.action === 'send_test') {
    if (!body.to) return Response.json({ error: 'to (email) wymagany' }, { status: 400 });
    const name = body.name || 'Łukasz';
    const code = generateCode(name);
    const html = await generateMailText(ctx.env, name, code);
    // NIE wpisujemy do personal_discount_codes (to test, nie produkcyjny send)
    await sendThankYouMail(ctx.env, body.to, name, code, html);
    return Response.json({ ok: true, sent_to: body.to, name, code, html, note: 'TEST mail - kod NIE jest aktywny w DB' });
  }

  if (body.action === 'send_one') {
    if (!body.submission_id) return Response.json({ error: 'submission_id wymagany' }, { status: 400 });
    const sub = await ctx.env.DB.prepare(
      `SELECT id, photographer_name, photographer_email, caption FROM gallery_submissions WHERE id = ?`
    ).bind(body.submission_id).first<PhotoSubmissionRow>();
    if (!sub) return Response.json({ error: 'Submission nie znaleziony' }, { status: 404 });
    if (!sub.photographer_email) return Response.json({ error: 'Brak emaila u fotografa' }, { status: 400 });

    const code = generateCode(sub.photographer_name);
    const html = await generateMailText(ctx.env, sub.photographer_name, code);
    if (body.dry_run) return Response.json({ dry_run: true, code, html });

    // Insert kod do DB
    await ctx.env.DB.prepare(
      `INSERT INTO personal_discount_codes (code, customer_email, pct, source, expires_at, created_by)
       VALUES (?, ?, 10, 'photo_thankyou', '2026-07-31', ?)`
    ).bind(code, sub.photographer_email, adminUser || 'admin').run();

    await sendThankYouMail(ctx.env, sub.photographer_email, sub.photographer_name, code, html);
    return Response.json({ ok: true, sent_to: sub.photographer_email, code });
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

    const sent: Array<{ email: string; name: string; code: string }> = [];
    const failed: Array<{ email: string; error: string }> = [];
    for (const r of results) {
      try {
        const code = generateCode(r.photographer_name);
        const html = await generateMailText(ctx.env, r.photographer_name, code);
        await ctx.env.DB.prepare(
          `INSERT INTO personal_discount_codes (code, customer_email, pct, source, expires_at, created_by)
           VALUES (?, ?, 10, 'photo_thankyou', '2026-07-31', ?)`
        ).bind(code, r.photographer_email, adminUser || 'admin').run();
        await sendThankYouMail(ctx.env, r.photographer_email, r.photographer_name, code, html);
        sent.push({ email: r.photographer_email, name: r.photographer_name, code });
      } catch (err) {
        failed.push({ email: r.photographer_email, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return Response.json({ sent_count: sent.length, failed_count: failed.length, sent, failed });
  }

  return Response.json({ error: 'Nieznana akcja' }, { status: 400 });
};
