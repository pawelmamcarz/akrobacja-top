import { type Env } from '../../../src/lib/types';

// Welcome email sequence configuration
const WELCOME_STEPS = [
  { step: 1, delayDays: 0, subject: 'Witaj w akrobacja.com' },
  { step: 2, delayDays: 2, subject: 'Jak wygląda lot akrobacyjny?' },
  { step: 3, delayDays: 5, subject: 'Twój kod rabatowy -100 PLN' },
] as const;

const FROM_EMAIL = 'akrobacja.com <dto@akrobacja.com>';

// Branded HTML wrapper
function wrapHtml(body: string): string {
  return `<!DOCTYPE html>
<html lang="pl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Montserrat',Arial,sans-serif;background:#f5f7fa">
  <div style="max-width:600px;margin:0 auto;background:#ffffff">
    <div style="background:#0A2F7C;padding:40px;text-align:center">
      <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:700;letter-spacing:0.02em">akrobacja.com</h1>
      <p style="color:rgba(255,255,255,0.6);margin:8px 0 0;font-size:13px">Extra 300L &middot; SP-EKS</p>
    </div>
    <div style="padding:40px">
      ${body}
    </div>
    <div style="background:#0A2F7C;padding:24px;text-align:center">
      <p style="color:rgba(255,255,255,0.5);font-size:11px;margin:0;line-height:1.6">
        akrobacja.com &middot; Lotnisko Radom-Piast&oacute;w (EPRP) &middot; +48 535 535 221<br>
        <a href="https://akrobacja.com" style="color:rgba(255,255,255,0.5);text-decoration:underline">akrobacja.com</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

function ctaButton(text: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;background:#E11E26;color:#ffffff;text-decoration:none;padding:14px 32px;font-weight:700;font-size:14px;border-radius:4px;margin:8px 0">${text}</a>`;
}

// Step 1: Welcome email (Day 0)
function buildWelcomeEmail(name: string | null): string {
  const greeting = name ? `Cześć ${name}!` : 'Cześć!';
  return wrapHtml(`
    <h2 style="color:#0A2F7C;margin:0 0 8px;font-size:22px">${greeting}</h2>
    <p style="color:#333;line-height:1.7;margin:0 0 20px;font-size:15px">
      Witamy w akrobacja.com! Cieszymy się, że dołączasz do grona miłośników latania.
    </p>
    <p style="color:#333;line-height:1.7;margin:0 0 20px;font-size:15px">
      Oto co Cię czeka w najbliższych dniach:
    </p>
    <ul style="color:#333;line-height:2;font-size:15px;padding-left:20px;margin:0 0 24px">
      <li>Dowiesz się, jak wygląda lot akrobacyjny krok po kroku</li>
      <li>Poznasz naszego pilota i samolot Extra 300L</li>
      <li>Otrzymasz specjalny kod rabatowy na pierwszy lot</li>
    </ul>
    <p style="color:#333;line-height:1.7;margin:0 0 24px;font-size:15px">
      Tymczasem zerknij na naszą stronę, znajdziesz tam wszystkie pakiety lotów i odpowiedzi na najczęstsze pytania.
    </p>
    <p style="text-align:center;margin:0 0 24px">
      ${ctaButton('Zobacz pakiety lotów', 'https://akrobacja.com/#pakiety')}
    </p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
    <p style="color:#6B7A90;font-size:13px;line-height:1.6;margin:0">
      Masz pytania? Pisz na <a href="mailto:dto@akrobacja.com" style="color:#0A2F7C">dto@akrobacja.com</a>
      lub dzwoń: <a href="tel:+48535535221" style="color:#0A2F7C">+48 535 535 221</a>
    </p>
  `);
}

// Step 2: Educational email (Day 2)
function buildEducationalEmail(name: string | null): string {
  const greeting = name ? `Cześć ${name}!` : 'Cześć!';
  return wrapHtml(`
    <h2 style="color:#0A2F7C;margin:0 0 8px;font-size:22px">${greeting}</h2>
    <h3 style="color:#0A2F7C;margin:0 0 20px;font-size:18px;font-weight:600">Jak wygląda lot akrobacyjny?</h3>
    <p style="color:#333;line-height:1.7;margin:0 0 20px;font-size:15px">
      Wielu naszych gości zastanawia się, czego się spodziewać. Oto krótki przewodnik:
    </p>

    <div style="background:#f0f3f7;padding:20px;margin-bottom:20px;border-left:4px solid #0A2F7C">
      <p style="color:#0A2F7C;font-weight:700;margin:0 0 8px;font-size:14px">1. BRIEFING PRZED LOTEM</p>
      <p style="color:#333;font-size:14px;line-height:1.6;margin:0">
        Pilot omawia z Tobą przebieg lotu, figury akrobacyjne i sygnały komunikacji. Dostajesz spadochron i instrukcję bezpieczeństwa.
      </p>
    </div>

    <div style="background:#f0f3f7;padding:20px;margin-bottom:20px;border-left:4px solid #E11E26">
      <p style="color:#E11E26;font-weight:700;margin:0 0 8px;font-size:14px">2. LOT AKROBACYJNY</p>
      <p style="color:#333;font-size:14px;line-height:1.6;margin:0">
        Startujesz z lotniska Radom-Piastów w samolocie Extra 300L. Pętle, beczki, loty odwrócone, wszystko pod okiem Mistrza Polski w akrobacji.
      </p>
    </div>

    <div style="background:#f0f3f7;padding:20px;margin-bottom:20px;border-left:4px solid #0A2F7C">
      <p style="color:#0A2F7C;font-weight:700;margin:0 0 8px;font-size:14px">3. DEBRIEFING</p>
      <p style="color:#333;font-size:14px;line-height:1.6;margin:0">
        Po lądowaniu omawiasz lot z pilotem. Dostajesz certyfikat i (opcjonalnie) nagranie wideo 360° z kokpitu.
      </p>
    </div>

    <p style="color:#333;line-height:1.7;margin:0 0 24px;font-size:15px">
      Chcesz dowiedzieć się więcej? Odwiedź naszą stronę i poznaj pilota, samolot i lotnisko.
    </p>
    <p style="text-align:center;margin:0 0 24px">
      ${ctaButton('Poznaj szczegóły', 'https://akrobacja.com/#maszyna')}
    </p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
    <p style="color:#6B7A90;font-size:13px;line-height:1.6;margin:0">
      Pytania? <a href="mailto:dto@akrobacja.com" style="color:#0A2F7C">dto@akrobacja.com</a>
      &middot; <a href="tel:+48535535221" style="color:#0A2F7C">+48 535 535 221</a>
    </p>
  `);
}

// Step 3: Discount code email (Day 5)
function buildDiscountEmail(name: string | null): string {
  const greeting = name ? `${name}, mamy coś dla Ciebie!` : 'Mamy coś specjalnego dla Ciebie!';
  return wrapHtml(`
    <h2 style="color:#0A2F7C;margin:0 0 16px;font-size:22px">${greeting}</h2>
    <p style="color:#333;line-height:1.7;margin:0 0 24px;font-size:15px">
      Jako podziękowanie za dołączenie do naszej społeczności, mamy dla Ciebie specjalny kod rabatowy:
    </p>

    <div style="background:#0A2F7C;padding:32px;text-align:center;margin-bottom:24px">
      <p style="color:rgba(255,255,255,0.7);font-size:12px;text-transform:uppercase;letter-spacing:0.15em;margin:0 0 8px">Twój kod rabatowy</p>
      <p style="color:#ffffff;font-size:36px;font-weight:800;margin:0 0 8px;letter-spacing:0.08em">PIERWSZY100</p>
      <p style="color:#ffffff;font-size:20px;font-weight:700;margin:0 0 12px">-100 PLN</p>
      <p style="color:rgba(255,255,255,0.7);font-size:13px;margin:0">na dowolny pakiet lotu akrobacyjnego</p>
    </div>

    <div style="background:#FFF3F3;border:1px solid #E11E26;padding:16px;text-align:center;margin-bottom:24px;border-radius:4px">
      <p style="color:#E11E26;font-weight:700;font-size:14px;margin:0">
        ⏰ Kod ważny tylko 48 godzin!
      </p>
    </div>

    <p style="color:#333;line-height:1.7;margin:0 0 24px;font-size:15px">
      Podaj kod <strong>PIERWSZY100</strong> podczas rezerwacji lub wpisz go na stronie zamówienia.
      Rabat działa na wszystkie pakiety, od Pierwszego Lotu po Masterclass.
    </p>
    <p style="text-align:center;margin:0 0 24px">
      ${ctaButton('Zarezerwuj lot ze zniżką', 'https://akrobacja.com/lot-akrobacyjny')}
    </p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
    <p style="color:#6B7A90;font-size:13px;line-height:1.6;margin:0">
      Pytania o rezerwację? <a href="mailto:dto@akrobacja.com" style="color:#0A2F7C">dto@akrobacja.com</a>
      &middot; <a href="tel:+48535535221" style="color:#0A2F7C">+48 535 535 221</a>
    </p>
  `);
}

// Build email HTML for a given step
function buildEmailHtml(step: number, name: string | null): string {
  switch (step) {
    case 1: return buildWelcomeEmail(name);
    case 2: return buildEducationalEmail(name);
    case 3: return buildDiscountEmail(name);
    default: throw new Error(`Unknown step: ${step}`);
  }
}

// Send email via Resend API
async function sendEmail(env: Env, to: string, subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend error ${res.status}: ${text}`);
  }
}

// Ensure the welcome_emails_sent tracking table exists
async function ensureTable(db: D1Database): Promise<void> {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS welcome_emails_sent (
      id TEXT PRIMARY KEY,
      subscriber_id TEXT NOT NULL,
      step INTEGER NOT NULL,
      sent_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(subscriber_id, step)
    )
  `).run();

  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_welcome_emails_subscriber
    ON welcome_emails_sent(subscriber_id)
  `).run();
}

// Main handler, GET /api/cron/welcome-emails
// Designed to be called by an external cron (e.g. Cloudflare Cron Trigger, or a simple HTTP cron)
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (ctx.env.CRON_SECRET) {
    const auth = ctx.request.headers.get('Authorization') || '';
    if (auth !== `Bearer ${ctx.env.CRON_SECRET}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const results: Array<{ subscriber_id: string; email: string; step: number; status: string }> = [];

  try {
    await ensureTable(ctx.env.DB);

    // Query active subscribers who signed up in the last 7 days and have an email
    // We join against welcome_emails_sent to find which steps are still pending
    for (const stepConfig of WELCOME_STEPS) {
      const { step, delayDays, subject } = stepConfig;

      // Find subscribers who:
      // 1. Are active
      // 2. Have an email address
      // 3. Signed up at least `delayDays` ago but within the last 7 days
      // 4. Have NOT already received this step
      const query = `
        SELECT s.id, s.email, s.name
        FROM subscribers s
        WHERE s.active = 1
          AND s.email IS NOT NULL
          AND s.email != ''
          AND s.created_at <= datetime('now', '-${delayDays} days')
          AND s.created_at >= datetime('now', '-7 days')
          AND NOT EXISTS (
            SELECT 1 FROM welcome_emails_sent w
            WHERE w.subscriber_id = s.id AND w.step = ?
          )
      `;

      const rows = await ctx.env.DB.prepare(query).bind(step).all<{
        id: string;
        email: string;
        name: string | null;
      }>();

      if (!rows.results || rows.results.length === 0) continue;

      for (const subscriber of rows.results) {
        try {
          const html = buildEmailHtml(step, subscriber.name);
          await sendEmail(ctx.env, subscriber.email, subject, html);

          // Record the sent email (idempotent via UNIQUE constraint)
          await ctx.env.DB.prepare(
            'INSERT OR IGNORE INTO welcome_emails_sent (id, subscriber_id, step) VALUES (?, ?, ?)'
          ).bind(crypto.randomUUID(), subscriber.id, step).run();

          results.push({
            subscriber_id: subscriber.id,
            email: subscriber.email,
            step,
            status: 'sent',
          });
        } catch (err) {
          results.push({
            subscriber_id: subscriber.id,
            email: subscriber.email,
            step,
            status: `error: ${err instanceof Error ? err.message : 'unknown'}`,
          });
        }
      }
    }

    return Response.json({
      ok: true,
      processed: results.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Unknown error', results },
      { status: 500 },
    );
  }
};

// Also support POST for flexibility (e.g. Cloudflare Cron Triggers)
export const onRequestPost = onRequestGet;
