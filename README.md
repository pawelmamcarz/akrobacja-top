# akrobacja.com

Strona sprzedaży voucherów na loty akrobacyjne Extra 300L SP-EKS z lotniska
Radom-Piastów (EPRP). Obok sklepu voucherowego: merch, kalendarz rezerwacji,
konto pilota z logowaniem SMS, panel admina, chat AI, pokazy i sponsoring.

Produkcyjny URL: <https://akrobacja.com>

## Stack

- **Hosting:** Cloudflare Pages (HTML) + Pages Functions (TypeScript)
- **Baza:** D1 (SQLite) — binding `DB`
- **Storage:** R2 (PDF-y voucherów) — binding `VOUCHER_BUCKET`
- **AI:** Workers AI (Llama 3.1 8B Instruct) — binding `AI`, dla chatu
- **Płatności:** Stripe Checkout (P24, BLIK, karta) + webhook
- **Faktury:** wFirma API v2
- **Email:** Resend (vouchery, powitania, abandoned cart, notyfikacje owner)
- **SMS:** SMSAPI.pl (OTP logowania pilotów, blast marketingowy)
- **Merch fulfilment:** Printful (częściowo — mapping pusty, patrz "Znane luki")
- **Analytics:** Cloudflare Web Analytics, GA4, Google Ads, Meta Pixel + CAPI

## Struktura katalogu

```
.
├── public/                 # statyczne HTML/JS/obrazki (deploy target)
│   ├── index.html          # landing page
│   ├── lot-akrobacyjny.html, voucher-prezent.html  # checkout voucherów
│   ├── sklep-merch.html    # merch
│   ├── kalendarz.html      # rezerwacja terminu
│   ├── konto.html          # portal pilota (SMS login)
│   ├── admin.html          # panel admina (Bearer token)
│   ├── sukces.html         # post-purchase (Google Ads / Meta Purchase)
│   ├── blog/               # SEO landingi (46 HTML-i)
│   ├── gallery/            # zdjęcia (JPG + WebP)
│   └── assets/             # consent-banner, ecommerce-events, site-enhancements
├── functions/              # Cloudflare Pages Functions
│   ├── _middleware.ts      # SEO, redirecty, analytics, security headers
│   └── api/
│       ├── checkout.ts, webhook.ts, chat.ts, subscribe.ts
│       ├── voucher/[code].ts       # pobranie PDF z R2
│       ├── calendar/               # slots, book
│       ├── auth/                   # send-code, verify, profile, my-bookings, insurance
│       ├── merch/                  # products, checkout
│       ├── admin/                  # 9 endpointów (Bearer = ADMIN_PASSWORD)
│       └── cron/                   # welcome-emails, abandoned-checkouts
├── src/lib/                # współdzielone moduły (pdf, email, wfirma, sms, ...)
├── migrations/             # 001-003.sql (uruchamiane przyrostowo)
├── schema.sql              # źródło prawdy dla świeżej bazy
├── wrangler.jsonc          # binding D1/R2/AI + pages_build_output_dir
└── .github/workflows/deploy.yml  # deploy z main → wrangler pages deploy
```

## Model danych (D1)

Voucher shop: `orders`, `welcome_emails_sent`
Merch: `products`, `merch_orders`
Mailing: `subscribers`
Pilot portal: `pilots`, `otp_codes`, `balance_log`, `insurance_pilots`
Kalendarz: `slots`, `bookings`, `availability_blocks`, `courses`
Samolot: `maintenance`, `documents`

Patrz `schema.sql` (świeża baza) i `migrations/*.sql` (produkcja rośnie
przyrostowo). Kolejne migracje nazywamy `NNN-opis.sql` — guard przez
`IF NOT EXISTS` żeby były idempotentne.

## Przepływ zakupu vouchera (happy path)

1. `POST /api/checkout` — tworzy rekord w `orders` (`status='pending'`), generuje
   unikalny `voucher_code` (`AKR-XXXX-XXXX`), tworzy Stripe Checkout Session.
2. Klient płaci. Stripe → `POST /api/webhook` (event `checkout.session.completed`).
3. Webhook atomowo flipuje `pending` → `processing`, potem równolegle:
   - generuje PDF voucher (pdf-lib) i wrzuca do R2 (`vouchers/{code}.pdf`),
   - wystawia fakturę wFirma (tylko na `STRIPE_SECRET_KEY` zawierającym `_live_`),
   - wysyła mail do klienta (Resend) z załączonym PDF-em.
4. Status → `paid`, `waitUntil` odpala Meta CAPI `Purchase` + mail do ownera.
5. Klient ląduje na `/sukces?code=...&amount=...&pkg=...` → GA4/Ads/Pixel strzelają
   konwersję z `sessionStorage.akro_checkout_info` (Enhanced Conversions).

Produkt testowy `test_naklejka` (100 gr) pomija PDF/email/fakturę — służy tylko
weryfikacji pikseli konwersji.

## Przepływ rezerwacji kalendarza

1. `GET /api/calendar/slots?date=YYYY-MM-DD` — zwraca:
   - sunrise/sunset (EPRP, lat=51.3892, lon=21.2133) — sloty 1h od +30 min po
     świcie do -30 min przed zachodem, max 8/dzień,
   - pogoda z Open-Meteo (do 7 dni do przodu), flyable jeśli
     widzialność ≥ 5 km, podstawa chmur ≥ 1500 m, wiatr < 40 km/h, brak opadów,
   - istniejące rezerwacje i bloki (`availability_blocks`).
2. `POST /api/calendar/book` — typ `voucher` (wymaga kodu) | `course` |
   `proficiency` | `training`. Tworzy booking `status='pending'` + slot
   `status='pending'`.
3. Admin w `/admin` widzi `pendingBookings` i zatwierdza (`approve`) lub
   odrzuca (`reject`).

## Przepływ pilot portal (SMS OTP)

1. `POST /api/auth/send-code` — rate limit 3/h/telefon, zapis `otp_codes`,
   SMS wysłany przez SMSAPI.
2. `POST /api/auth/verify` — sprawdza kod (5 min TTL), tworzy lub aktualizuje
   `pilots`, generuje `session_token` (zapisywany w localStorage u klienta).
3. `GET /api/auth/profile` / `/my-bookings` / `/insurance` — Bearer token =
   `session_token`. `/insurance POST` zgłasza pilota do polisy (admin musi
   zatwierdzić w `/admin` → zakładka Samolot → Piloci w polisie).

## Welcome email sequence (cron)

`GET /api/cron/welcome-emails` przetwarza `subscribers` z emailem (ostatnie 7
dni). Kroki: day 0 (powitanie), day 2 (edukacyjny), day 5 (rabat -100 PLN
`PIERWSZY100`). Idempotencja przez `welcome_emails_sent` (UNIQUE
`subscriber_id, step`).

## Abandoned cart recovery (cron)

`GET /api/cron/abandoned-checkouts` wysyła kod WRACAM5 (-5%) do zamówień
`pending` starszych niż 1h, młodszych niż 48h, bez wysłanego maila. Flagę
`abandon_email_sent_at` ustawia jako "sent" nawet przy permanent-fail (422 —
zły email), żeby nie retry'ować.

## Lokalny dev

```bash
npm install
cp .dev.vars.example .dev.vars   # uzupełnij sekrety
npm run dev                      # wrangler pages dev public --port 8788
```

Tworzenie świeżej bazy lokalnie:

```bash
npx wrangler d1 execute akrobacja-db --local --file=schema.sql
```

Migracja produkcyjnej bazy (po `git pull` z nowym plikiem w `migrations/`):

```bash
npx wrangler d1 execute akrobacja-db --file=migrations/NNN-<nazwa>.sql
```

## Deploy

Push na `main` → GitHub Actions (`.github/workflows/deploy.yml`) →
`wrangler pages deploy public --project-name=akrobacja-top`. Workflow kopiuje
`index.html` i `sukces.html` z roota do `public/` przed deployem (legacy —
warto docelowo trzymać tylko w `public/`).

Sekrety w Cloudflare: `npx wrangler pages secret put NAZWA --project-name=akrobacja-top`.
Lista wymaganych — patrz `.dev.vars.example`.

## Endpointy API

### Publiczne
- `POST /api/checkout` — voucher Stripe session
- `POST /api/merch/checkout` — merch Stripe session
- `GET /api/merch/products` — lista produktów merch
- `POST /api/webhook` — Stripe webhook (HMAC-SHA256 weryfikacja)
- `POST /api/subscribe` — zapis do newslettera
- `GET /api/voucher/{code}` — pobranie PDF z R2 (tylko paid)
- `GET /api/calendar/slots?date=...`
- `POST /api/calendar/book`
- `POST /api/chat` — Workers AI Llama 3.1

### Pilot (Bearer `session_token`)
- `POST /api/auth/send-code`, `POST /api/auth/verify`
- `GET|POST /api/auth/profile`
- `GET /api/auth/my-bookings`
- `GET|POST /api/auth/insurance`

### Admin (Bearer `ADMIN_PASSWORD`)
- `GET /api/admin/orders`
- `POST /api/admin/redeem` — odbicie vouchera
- `POST /api/admin/invoice` — retry wFirma
- `GET|POST /api/admin/calendar` — slots, approve/reject, block/unblock
- `GET|POST /api/admin/courses`
- `GET|POST /api/admin/pilots` — saldo + log
- `GET|POST /api/admin/aircraft` — maintenance, documents, insurance pilots
- `GET|POST /api/admin/merch`
- `GET|POST /api/admin/subscribers` — blast SMS, remove

### Cron (publiczne — **trzeba dodać CRON_SECRET**)
- `GET|POST /api/cron/welcome-emails`
- `GET|POST /api/cron/abandoned-checkouts`

## Znane luki (backlog)

Zidentyfikowane podczas audytu kompleksowości (kwiecień 2026). Priorytety:

### P0 — blokery
- Brak seedu `products` — `/sklep-merch` wyświetla pustą listę po świeżym
  wdrożeniu. Dodać rekordy przez admina albo `wrangler d1 execute`.

### P1 — domknąć journey
- `calendar/book` nie wysyła maila do klienta ani admina. Admin dowiaduje się
  tylko przez aktywny polling panelu.
- Webhook obsługuje tylko `checkout.session.completed` — sesje `expired` /
  `payment_failed` zostają w `pending` na zawsze.
- Printful: `PRINTFUL_PRODUCTS = {}` → `createPrintfulOrder` rzuca wyjątek.
  Merch orders trzeba wysyłać ręcznie.
- Brak rate-limitu na `/api/chat` (drogi Workers AI) i `/api/subscribe`.
- Crony `welcome-emails` i `abandoned-checkouts` są **publiczne**. Chronić
  `Authorization: Bearer ${CRON_SECRET}`.

### P2 — jakość
- Admin token = hasło w localStorage, bez TTL, bez 2FA. Rozważyć JWT
  `/api/admin/login`.
- Brak formularzy lead dla B2B (`/pokazy`, `/sponsoring`, `/camp`) — tylko
  `mailto:` i `wa.me`, zero tracking konwersji.
- Chat widget bez ochrony przed prompt injection.
- `/api/calendar/book` nie weryfikuje że `start_time` mieści się w
  `generateSlots(date)` — można ręcznym POST rezerwować o 03:00.
- `/sukces` bez `?code=` pokazuje `---` i broken download link.

### P3 — DX
- `GEMINI_API_KEY` w `Env` ale nieużywane.
- Brak skryptów `db:migrate` / `db:seed` w `package.json`.
- `/api/admin/subscribers send_blast` bez UI w admin.html.

## Kontakt

- Paweł Mamcarz (owner): dto@akrobacja.com, +48 535 535 221
- Pilot Maciej Kulaszewski: <https://www.facebook.com/bullet.aerobatics/>
