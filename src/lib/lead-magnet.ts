// Lead magnet "5-dniowy kurs mailowy: Przygotowanie do pierwszego lotu akrobacyjnego".
// Krok 0 (welcome) wysylany natychmiast z /api/lead-magnet. Kroki 2/4/7/14 — z crona
// lead-magnet-emails.ts. Linki w mailach kierują do istniejących blog postów,
// zeby zbudowac email engagement + retargeting traffic na site.

import { type Env, GOOGLE_REVIEW_URL } from './types';
import { escapeHtml } from './email';

export const LEAD_MAGNET_STEPS = [0, 2, 4, 7, 14] as const;
export type LeadMagnetStep = typeof LEAD_MAGNET_STEPS[number];

interface StepContent {
  subject: string;
  preheader: string;
  bodyHtml: (name: string | null) => string;
}

const SITE = 'https://akrobacja.com';
const FROM = 'akrobacja.com <kurs@akrobacja.com>';
const REPLY_TO = 'info@akrobacja.com';

// Wrapper: spojny layout dla wszystkich 5 maili.
function wrap(preheader: string, contentHtml: string): string {
  return `<!DOCTYPE html>
<html lang="pl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f5f7fa;color:#1A2438">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;font-size:1px">${escapeHtml(preheader)}</span>
  <div style="max-width:600px;margin:0 auto;background:#fff">
    <div style="background:#0A2F7C;padding:32px 24px;text-align:center">
      <a href="${SITE}" style="text-decoration:none">
        <h1 style="color:#fff;margin:0;font-size:24px;letter-spacing:-0.5px">akrobacja.com</h1>
        <p style="color:rgba(255,255,255,0.6);margin:4px 0 0;font-size:12px;letter-spacing:1px">EXTRA 300L · SP-EKS · RADOM</p>
      </a>
    </div>
    <div style="padding:32px 24px;line-height:1.6;font-size:15px">
      ${contentHtml}
    </div>
    <div style="background:#f5f7fa;padding:24px;text-align:center;font-size:12px;color:#6B7A90;line-height:1.5">
      <p style="margin:0 0 8px">Paweł Mamcarz · Mistrz Polski w akrobacji samolotowej</p>
      <p style="margin:0"><a href="${SITE}/unsubscribe" style="color:#6B7A90">Wypisz mnie z kursu</a> · <a href="${SITE}" style="color:#6B7A90">akrobacja.com</a></p>
    </div>
  </div>
</body>
</html>`;
}

const STEPS: Record<LeadMagnetStep, StepContent> = {
  0: {
    subject: 'Witaj w kursie. Co dostaniesz w 5 dni',
    preheader: '5 maili przez 14 dni. Realna wiedza o lotach akrobacyjnych.',
    bodyHtml: (name) => `
      <p>Cześć${name ? ' ' + escapeHtml(name) : ''},</p>
      <p>Dzięki, że zapisałeś się na kurs. Jestem Paweł Mamcarz, Mistrz Polski w akrobacji samolotowej i przez ostatnie 8 lat woziłem nad Radomiem ponad 600 osób: od dziennikarzy TVN przez influencerów po kandydatów na astronautów.</p>
      <p>W ciągu najbliższych 14 dni dostaniesz ode mnie 4 maile z konkretami:</p>
      <ul style="padding-left:20px;margin:16px 0">
        <li><strong>Za 2 dni</strong> — jak naprawdę wygląda przeciążenie +6G. Fizyka i odczucia, bez ściemy.</li>
        <li><strong>Za 4 dni</strong> — 10 rzeczy, które warto zrobić przed pierwszym lotem akrobacyjnym.</li>
        <li><strong>Za 7 dni</strong> — dlaczego latam Extrą 300L (a nie Zlinem czy Pittsem) + spersonalizowany kod rabatowy.</li>
        <li><strong>Za 14 dni</strong> — ostatnie przypomnienie o kodzie + odpowiedzi na pytania.</li>
      </ul>
      <p>Na start polecam mój najczęściej czytany artykuł: <a href="${SITE}/blog/co-czujesz-podczas-lotu-akrobacyjnego" style="color:#0A2F7C;font-weight:600">Co czujesz podczas lotu akrobacyjnego?</a></p>
      <p style="margin-top:24px">Do zobaczenia za 2 dni,<br><strong>Paweł</strong></p>`,
  },
  2: {
    subject: 'Jak naprawdę wygląda +6G',
    preheader: 'Co dzieje się z ciałem, kiedy waga rośnie 6 razy.',
    bodyHtml: (name) => `
      <p>Cześć${name ? ' ' + escapeHtml(name) : ''},</p>
      <p>Każdy słyszał określenie "+6G" w kontekście pilotów myśliwskich albo F1. Mało kto wie, co to faktycznie znaczy w samolocie akrobacyjnym.</p>
      <p>Krótko: <strong>Twoja waga rośnie 6-krotnie</strong>. Jeśli ważysz 80 kg, podczas pętli czujesz się jak 480 kg. Głowa, ręce, każdy kosmyk włosów. Krew odpływa z głowy w stronę nóg, dlatego zaciskasz mięśnie brzucha i wykonujesz tzw. "anti-G straining manoeuvre" — ja Cię tego nauczę przed lotem.</p>
      <p>To nie jest niebezpieczne. Extra 300L jest certyfikowana do +10G/-10G (bierzemy maksymalnie +6/-4). Pasażer ma kompletny system bezpieczeństwa: 5-punktowe pasy, spadochron, pełne briefing przed lotem.</p>
      <p>Pełen artykuł z konkretnymi opisami od osób, które ze mną latały: <a href="${SITE}/blog/co-czujesz-podczas-lotu-akrobacyjnego" style="color:#0A2F7C;font-weight:600">Co czujesz podczas lotu akrobacyjnego?</a></p>
      <p>Jeśli zastanawiasz się, czy to bezpieczne — mam też osobny tekst: <a href="${SITE}/blog/czy-lot-akrobacyjny-jest-bezpieczny" style="color:#0A2F7C">Czy lot akrobacyjny jest bezpieczny?</a></p>
      <p style="margin-top:24px">Za 2 dni: jak się przygotować praktycznie.<br><strong>Paweł</strong></p>`,
  },
  4: {
    subject: '10 rzeczy do zrobienia przed pierwszym lotem',
    preheader: 'Praktyczna lista: co zjeść, co założyć, kiedy przyjechać.',
    bodyHtml: (name) => `
      <p>Cześć${name ? ' ' + escapeHtml(name) : ''},</p>
      <p>Najczęstsze pytanie przed pierwszym lotem: <em>"Co mam zrobić, żeby było mi dobrze?"</em>. Krótka lista:</p>
      <ol style="padding-left:20px;margin:16px 0;line-height:1.8">
        <li><strong>Lekkie śniadanie 2-3h wcześniej.</strong> Pusty żołądek = zawroty głowy. Pełny = ryzyko nudności.</li>
        <li><strong>Bez alkoholu poprzedniego dnia.</strong> Wpływa na błędnik 24h+.</li>
        <li><strong>Ubranie wygodne, nie ciasne.</strong> Pasy ściskają mocno, koszula z kołnierzykiem przeszkadza.</li>
        <li><strong>Buty zamknięte.</strong> Klapki czy japonki = nie wejdziesz do samolotu.</li>
        <li><strong>Przyjedź 30 min wcześniej.</strong> Briefing przed lotem trwa 20-40 min — to nie formalność, to bezpieczeństwo.</li>
        <li><strong>Włosy związane.</strong> W kokpicie wiruje powietrze, długie włosy uderzają w twarz.</li>
        <li><strong>Klucze, telefon, monety — wyłóż.</strong> Wszystko luźne lata po kokpicie przy ujemnym G.</li>
        <li><strong>Okulary z paskiem albo zostaw.</strong> Bez paska polecą.</li>
        <li><strong>Daj znać o lekach.</strong> Jeżeli bierzesz coś na ciśnienie albo serce — powiedz mi przed briefingem.</li>
        <li><strong>Nie wstydź się powiedzieć "wystarczy".</strong> Po pierwszej beczce mogę odpuścić, lot będzie nadal warto wspomnieniem.</li>
      </ol>
      <p>Pełen tekst z bardziej szczegółowym opisem każdego punktu: <a href="${SITE}/blog/10-rzeczy-przed-lotem-akrobacyjnym" style="color:#0A2F7C;font-weight:600">10 rzeczy do zrobienia przed pierwszym lotem</a>.</p>
      <p style="margin-top:24px">Za 3 dni: dlaczego Extra 300L + Twój kod rabatowy.<br><strong>Paweł</strong></p>`,
  },
  7: {
    subject: 'Dlaczego Extra 300L (+ kod -5%)',
    preheader: '299900 PLN samolot kontra konkurencja. Plus podarunek dla Ciebie.',
    bodyHtml: (name) => `
      <p>Cześć${name ? ' ' + escapeHtml(name) : ''},</p>
      <p>Kiedy 8 lat temu kupowałem akrobacyjny samolot, miałem trzy realne opcje: <strong>Extra 300L</strong>, <strong>Zlin 50LS</strong>, <strong>Pitts S-2C</strong>. Wybrałem Extrę i nigdy nie żałowałem. Krótko dlaczego:</p>
      <ul style="padding-left:20px;margin:16px 0;line-height:1.7">
        <li><strong>Extra 300L</strong> — kompozytowa konstrukcja Walter Extra (Niemcy), certyfikowana do ±10G, silnik Lycoming 300 KM, 2 miejsca tandem. Najbardziej "easygoing" dla pasażera spośród maszyn klasy "unlimited".</li>
        <li><strong>Zlin 50LS</strong> — twardszy, mniej toleruje błędy w pilotażu, dla pasażera dużo mniej komfortowy.</li>
        <li><strong>Pitts S-2C</strong> — dwupłat, brutalny, dla zawodników. Pasażer nie zobaczy nic poza kabiną.</li>
      </ul>
      <p>Pełne porównanie z konkretnymi liczbami: <a href="${SITE}/blog/extra-300l-vs-zlin-vs-pitts" style="color:#0A2F7C;font-weight:600">Extra 300L vs Zlin vs Pitts</a>.</p>
      <p style="margin:32px 0;padding:24px;background:#f5f7fa;border-radius:8px;text-align:center">
        <strong style="color:#0A2F7C;font-size:18px;display:block;margin-bottom:8px">Twój kod: KURS5OFF</strong>
        <span style="color:#6B7A90;font-size:14px;display:block;margin-bottom:16px">5% rabatu na dowolny voucher · ważny 14 dni</span>
        <a href="${SITE}/lot-akrobacyjny?discount=KURS5OFF" style="display:inline-block;background:#0A2F7C;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600">Zobacz vouchery →</a>
      </p>
      <p>Jeśli masz pytania, po prostu odpisz na tego maila — czytam każdą wiadomość osobiście.</p>
      <p style="margin-top:24px"><strong>Paweł</strong></p>`,
  },
  14: {
    subject: 'Twój kod kończy się jutro',
    preheader: 'KURS5OFF dzisiaj ostatni dzień. Plus opinie ludzi, którzy ze mną latali.',
    bodyHtml: (name) => `
      <p>Cześć${name ? ' ' + escapeHtml(name) : ''},</p>
      <p>Krótka wiadomość: kod <strong>KURS5OFF</strong> kończy się dzisiaj. Jeśli zastanawiasz się nad voucherem dla siebie albo prezentem dla bliskiej osoby, to dziś jest ostatni dzień, żeby z niego skorzystać.</p>
      <p>Zamiast pisać kolejny argument, podsyłam Ci 3 opinie od osób, które ostatnio ze mną latały:</p>
      <blockquote style="margin:16px 0;padding:16px 20px;background:#f5f7fa;border-left:3px solid #0A2F7C;font-style:italic;color:#1A2438">
        "Najlepszy prezent jaki dostałem w życiu. Briefing był super profesjonalny, Paweł tłumaczy wszystko spokojnie. W powietrzu — nie do opisania. Beczki, pętle, lot odwrócony. Wracam na Adrenalinę."<br>
        <span style="font-style:normal;color:#6B7A90;font-size:13px">— Marcin K., voucher Pierwszy Lot</span>
      </blockquote>
      <blockquote style="margin:16px 0;padding:16px 20px;background:#f5f7fa;border-left:3px solid #0A2F7C;font-style:italic;color:#1A2438">
        "Kupiłam mężowi na 40. urodziny. Sama wybrałam Adrenalinę, bo chciałam, żeby zapamiętał ten prezent na lata. Wrócił z lotu jak dziecko z parku rozrywki. Polecam każdej żonie szukającej pomysłu."<br>
        <span style="font-style:normal;color:#6B7A90;font-size:13px">— Joanna M., voucher Adrenalina</span>
      </blockquote>
      <blockquote style="margin:16px 0;padding:16px 20px;background:#f5f7fa;border-left:3px solid #0A2F7C;font-style:italic;color:#1A2438">
        "Latam PPL, chciałem zobaczyć jak wygląda lot za sterami Extry. Masterclass to nie 'atrakcja' — to realny trening akrobacji z najlepszym instruktorem w PL. Wracam co rok."<br>
        <span style="font-style:normal;color:#6B7A90;font-size:13px">— Tomek W., voucher Masterclass (3 razy)</span>
      </blockquote>
      <p style="margin:32px 0;text-align:center">
        <a href="${SITE}/lot-akrobacyjny?discount=KURS5OFF" style="display:inline-block;background:#0A2F7C;color:#fff;padding:14px 28px;border-radius:6px;text-decoration:none;font-weight:600">Wykorzystaj KURS5OFF →</a>
      </p>
      <p>Jeśli nie kupisz dzisiaj — nic się nie stanie. Zostawiam Cię w spokoju, ale gdybyś za miesiąc albo rok zmienił zdanie, jestem na <a href="${SITE}" style="color:#0A2F7C">akrobacja.com</a>. Możesz też zostawić mi opinię tutaj: <a href="${GOOGLE_REVIEW_URL}" style="color:#0A2F7C">Google Reviews</a>.</p>
      <p style="margin-top:24px">Powodzenia,<br><strong>Paweł</strong></p>`,
  },
};

export async function sendLeadMagnetEmail(
  env: Env,
  params: { to: string; name: string | null; step: LeadMagnetStep },
): Promise<void> {
  const content = STEPS[params.step];
  if (!content) throw new Error(`Unknown lead magnet step: ${params.step}`);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM,
      to: [params.to],
      reply_to: REPLY_TO,
      subject: content.subject,
      tags: [
        { name: 'type', value: 'lead_magnet' },
        { name: 'step', value: String(params.step) },
      ],
      headers: {
        'List-Unsubscribe': '<mailto:info@akrobacja.com?subject=unsubscribe>, <https://akrobacja.com/unsubscribe>',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      html: wrap(content.preheader, content.bodyHtml(params.name)),
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend error ${res.status}: ${text}`);
  }
}
