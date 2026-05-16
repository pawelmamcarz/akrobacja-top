// POST /api/wa-click - tracking klikniec w WhatsApp CTA z frontendu.
//
// Wywolywany przez navigator.sendBeacon z onclick na <a href="wa.me/..."> linkach
// na stronach FCL.800 / dotacje / pozyczka 0%. Fire-and-forget - nie blokuje
// otwarcia WhatsAppa.
//
// Body: { page: string, location: string, prefilledText?: string }
// page: pathname (np. '/dotacje-szkolenie-lotnicze')
// location: nazwa CTA (np. 'hero-cta', '10-krokow-cta', 'footer')
// prefilledText: wartosc z parametru ?text= w wa.me URL (jasne intencje klienta)
//
// Bez autoryzacji (publiczny). Rate-limit przeciw spam: 60 klikniec / IP / godzine.

import { type Env } from '../../src/lib/types';
import { rateLimit, clientIp } from '../../src/lib/rate-limit';

interface WaClickBody {
  page: string;
  location?: string;
  prefilledText?: string;
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  try {
    const ip = clientIp(ctx.request);
    const userAgent = (ctx.request.headers.get('user-agent') || '').slice(0, 500);
    const referer = (ctx.request.headers.get('referer') || '').slice(0, 500);

    const rl = await rateLimit(ctx.env, `wa-click:${ip}`, 60, 3600);
    if (!rl.ok) {
      return Response.json({ error: 'rate_limited' }, { status: 429 });
    }

    let body: WaClickBody;
    try {
      body = await ctx.request.json();
    } catch {
      return Response.json({ error: 'invalid_body' }, { status: 400 });
    }

    if (!body.page || typeof body.page !== 'string') {
      return Response.json({ error: 'missing_page' }, { status: 400 });
    }

    const page = body.page.slice(0, 200);
    const location = typeof body.location === 'string' ? body.location.slice(0, 80) : null;
    const prefilledText = typeof body.prefilledText === 'string' ? body.prefilledText.slice(0, 500) : null;

    await ctx.env.DB.prepare(`
      INSERT INTO wa_clicks (id, page, location, prefilled_text, ip, user_agent, referer)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(crypto.randomUUID(), page, location, prefilledText, ip, userAgent, referer).run();

    return Response.json({ ok: true });
  } catch (err) {
    console.error('[wa-click] failed:', err);
    return Response.json({ error: 'server_error' }, { status: 500 });
  }
};
