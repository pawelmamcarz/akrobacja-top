# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

akrobacja.com - voucher shop for Extra 300L SP-EKS aerobatic flights from Radom-Piastów (EPRP). Also hosts merch, booking calendar, pilot portal (SMS OTP login), admin panel, AI chat, and SEO blog.

Production URL: https://akrobacja.com

Stack: **Cloudflare Pages** (static HTML in `public/`) + **Pages Functions** (TypeScript in `functions/api/`), **D1** (binding `DB`), **R2** (binding `VOUCHER_BUCKET`), **Workers AI** (binding `AI`), Stripe Checkout + PayNow (payment gateways), wFirma (invoices), Resend (email), SMSAPI (SMS), Printful (merch - partly stubbed).

> **Payments note (2026-05):** PayNow is wired up (`src/lib/paynow.ts`, `functions/api/webhook/paynow.ts`) but currently **disabled — checkout is forced to Stripe** because the PayNow keys 401. See the `paynow-disabled-forced-stripe` memory before re-enabling.

Full repo layout, data model, and endpoint list live in `README.md` - read that first when looking up specifics. Migration policy is documented in `migrations/README.md`. **Caveat**: `README.md` § "Endpointy API" and § "Znane luki (backlog)" have drifted — many P0/P1 items there are already fixed (see "Known gaps" at the bottom of this file) and admin/cron endpoint lists are incomplete. Trust the file tree under `functions/api/` over the README's enumeration.

## Common commands

```bash
npm install
cp .dev.vars.example .dev.vars                    # fill in secrets
npm run dev                                        # wrangler pages dev public --port 8788
npm run types                                      # regenerate worker-configuration.d.ts
npm run db:typecheck                               # tsc --noEmit - actual type check across functions/ + src/
npm run deploy                                     # node scripts/deploy.mjs (rsync + wrangler pages deploy)

# D1 schema - see "Schema policy" below
npm run db:bootstrap:local                                                     # fresh local DB from schema.sql
npm run db:bootstrap:remote                                                    # ⚠ wipes/recreates prod DB - disaster recovery only
npx wrangler d1 execute akrobacja-db --remote --file=migrations/NNN-<name>.sql # prod drift patch (normal path)

# Push secrets to Cloudflare (one at a time)
npx wrangler pages secret put NAME --project-name=akrobacja-top
```

There is no test suite, no linter, no formatter wired up. **`npm run db:typecheck` (TS strict mode, covers `functions/` + `src/`) is the only safety net** - run it before every commit that touches `.ts`. `npm run types` only regenerates the wrangler-derived `worker-configuration.d.ts` and doesn't validate anything.

Auto-deploy: pushes to `main` trigger `.github/workflows/deploy.yml` → `wrangler pages deploy public --project-name=akrobacja-top --branch=main`. Other branches do NOT auto-deploy (locked, since D1/R2/AI bindings are shared with prod and preview deploys would corrupt live data). Use `npm run dev` for local staging. **A commit on `main` goes live within ~1 min of push** - only push when you want it deployed.

## Architecture

### Pages vs Functions split
- `public/` is the deploy target - every `.html` is served as-is by Cloudflare Pages. JS lives inline or in `public/assets/`.
- `functions/_middleware.ts` runs on every request: SEO canonical/robots injection via `HTMLRewriter`, legacy WordPress URL redirects, security headers, and analytics tag injection. Hit it before debugging "why isn't my page rendering."
- `functions/api/**` are the API routes (file-based routing - `functions/api/foo.ts` → `/api/foo`, `functions/api/foo/bar.ts` → `/api/foo/bar`). Three distinct webhooks share the prefix: `functions/api/webhook.ts` is the **Stripe** webhook at `/api/webhook` (signature via `STRIPE_WEBHOOK_SECRET`); `functions/api/webhook/paynow.ts` is the **PayNow** notification webhook at `/api/webhook/paynow` (HMAC-SHA256 via PayNow `Signature-Key`); `functions/api/webhook/resend.ts` is the **Resend** delivery-events webhook at `/api/webhook/resend` (signature via `RESEND_WEBHOOK_SECRET`). Don't conflate them.
- Cron endpoints live under `functions/api/cron/` and are HTTP-triggered on a schedule by **GitHub Actions** (`.github/workflows/cron.yml`, plus `scrape-leads.yml`) using `secrets.CRON_SECRET` as the Bearer token — not an external SaaS scheduler. To add/change a schedule or run a cron manually, edit `cron.yml` (or `gh workflow run cron.yml`, which fires every job via `workflow_dispatch`). Every cron handler verifies `Authorization: Bearer ${CRON_SECRET}` and 401s on mismatch. Current crons: `welcome-emails`, `abandoned-checkouts`, `scheduled-vouchers`, `refresh-google-reviews`, `post-flight-review-sms`, `lead-magnet-emails`, `scrape-cold-leads`, `sync-wfirma-expenses`, `sync-google-calendar` (pulls a public Google Calendar iCal feed `GOOGLE_CALENDAR_ICS_URL` into `calendar_events` with `source='google'`; those events block customer booking slots via `src/lib/calendar-availability.ts`). **Calendar sync is two-way**: the *read* direction is this cron (iCal → D1, parsed by `src/lib/ics-parse.ts`); the *write* direction is `src/lib/google-calendar.ts` (D1 booking/event → Google Calendar API via a **service account** JWT, RS256 over `crypto.subtle` — needs `GOOGLE_SA_CLIENT_EMAIL` + `GOOGLE_SA_PRIVATE_KEY` secrets and the `GOOGLE_CALENDAR_ID` var; all calls are best-effort and return `null` on missing config/API error so they never break the booking flow). The write path is built but gated on those two secrets being set in the dashboard — see the `google-calendar-sync-pending` memory.
- Shared TS modules in `src/lib/`: `pdf`, `email`, `wfirma`, `ksef` (e-faktura whitelist + JPK), `sms`, `pilot-auth`, `admin-auth`, `weather`, `daylight`, `meta-capi`, `validate`, `phone`, `voucher-code`, `rate-limit` (KV-backed counter, binding `RATE_LIMIT_KV`), `turnstile` (Cloudflare CAPTCHA verify; public site key injected by middleware as `window.TURNSTILE_SITE_KEY` from `wrangler.jsonc` `vars`), `audit` (admin action log), `printful`, `lead-magnet`, `lead-scraper`, `abandoned-recovery`, `ics` (calendar invites), `seo-config`, `paynow` (PayNow REST + webhook HMAC), `order-fulfillment` (gateway-agnostic order finalization — see voucher flow below), `vision` (Workers AI vision OCR for the paper technical logbook), `calendar-availability` (single source of truth for bookable slots — used by both `/api/calendar/slots` and `/api/calendar/next-slots`; a slot is blocked by existing bookings, `availability_blocks`, or any aircraft-occupying `calendar_events`), `google-calendar` (D1 → Google Calendar write via service account) + `ics-parse` (iCal → D1 read, used by the sync cron), `logo-pdf` (white logo PNG as base64 for the voucher PDF header, same trick as `fonts/inter.ts`), `types`. `Env` interface and `PACKAGES` constant live in `src/lib/types.ts` - all voucher pricing and product IDs are defined there. Addons (cross-sell) live in `src/lib/types.ts` under `ADDONS` with per-package gating.
- **Email observability**: `functions/api/webhook/resend.ts` ingests Resend delivery events into the `email_events` table; admin "Maile" tab consumes `functions/api/admin/email-events.ts` + `functions/api/admin/failed-deliveries.ts`. Set `RESEND_WEBHOOK_SECRET` for signature verification.

### `email-worker/` - separate Worker (not Pages)
`email-worker/` is a standalone Cloudflare **Worker** (not a Pages Function) that fans out incoming mail to `voucher@`/`info@akrobacja.com` to multiple destinations (CF Email Routing dashboard only allows 1 destination per address). It has its own `package.json` and `wrangler.toml` and a **manual** deploy path: `cd email-worker && npx wrangler deploy`. It is NOT touched by the Pages auto-deploy workflow - bumping it requires the manual command above plus a CF Dashboard wire-up (Email Routing → Custom Address → Action "Send to a Worker" → `akrobacja-email-fanout`).

### Voucher purchase flow (the core path)
The payment webhook is the heart of the app. The actual fulfillment logic (PDF + R2 + invoice + email + CAPI) lives in **`src/lib/order-fulfillment.ts`** and is shared verbatim by both gateways — `functions/api/webhook.ts` (Stripe) and `functions/api/webhook/paynow.ts` (PayNow) both delegate to it so the money path can't diverge. Read `order-fulfillment.ts` together with whichever webhook you're touching.

1. `POST /api/checkout` (`functions/api/checkout.ts`) - creates `orders` row with `status='pending'` and a `voucher_code` (`AKR-XXXX-XXXX`), opens a Stripe Checkout Session (PayNow path currently disabled — see Payments note above).
2. Gateway → webhook on payment success (`checkout.session.completed` for Stripe). Webhook **atomically** flips `pending → processing` (D1 conditional UPDATE - guards against double-fire), then via the shared fulfillment module, in parallel: generates the voucher PDF (`pdf-lib`) and uploads to R2 at `vouchers/{code}.pdf`, issues a wFirma invoice (only when in live mode), and sends the customer email via Resend with the PDF attached.
3. Status flips to `paid`; `ctx.waitUntil` fires Meta CAPI `Purchase` and the owner notification email.
4. Customer lands on `/sukces?code=…&amount=…&pkg=…`. GA4 / Google Ads / Meta Pixel fire conversion from `sessionStorage.akro_checkout_info` (Enhanced Conversions, dedup with the CAPI event via `event_id`).

The `test_naklejka` package (200 gr = 2 PLN, Stripe PLN minimum) deliberately **skips PDF + email + invoice** in the webhook (`src/lib/types.ts:59`) - it exists only to validate live conversion pixels without burning real PDFs/invoices. Reachable only from `/test-konwersji`; don't add it to public UI.

A second flow (`functions/api/cron/scheduled-vouchers.ts`) handles gift vouchers with a future `send_at`: webhook stored the PDF in R2 but skipped the email; cron picks it up on/after `send_at` and sends it.

### Auth model - three separate systems
- **Public endpoints**: no auth.
- **Admin** (`/api/admin/**`): two parallel mechanisms, both live (`src/lib/admin-auth.ts`):
  1. **Legacy**: `Authorization: Bearer ${ADMIN_PASSWORD}` — the password *is* the token. Still accepted; identifies user as `pawel`. Used by `admin.html` localStorage and any cron that calls back into admin endpoints.
  2. **DB-backed login** (newer, multi-user): email+password against `admin_users` (PBKDF2-SHA256, 100k iter, 16-byte salt). Endpoints: `/api/admin/auth/{login,logout,password-reset,password-reset-confirm,seed}`. Successful login returns a session token (Bearer) backed by an `admin_sessions` row. `me.ts`, `login-history.ts`, `recover.ts` belong to this flow. Sync helper `getAdminUser()` only resolves legacy tokens — new endpoints that need DB sessions must use `getAdminUserAsync()`.
- **Pilot portal** (`/api/auth/**`): SMS OTP login. `send-code` rate-limits 3/h/phone, `verify` checks code (5 min TTL), issues a `session_token` stored on `pilots` row + client `localStorage`. All `auth/*` and `auth/insurance` endpoints want `Authorization: Bearer <session_token>`.
- **Cron** (`/api/cron/**`): `Authorization: Bearer ${CRON_SECRET}`. Endpoints are public URLs, so missing/wrong CRON_SECRET must reject - verify before adding new cron handlers.

### Schema policy (important - D1 quirk)
- **`schema.sql` is the only source of truth for bootstrap.** Fresh DBs (local, preview, branch deploy, disaster recovery) MUST be created from it.
- **`migrations/NNN-*.sql` are drift patches only** - they add columns/indexes/tables to the live prod DB. They do NOT form a complete chain from zero; trying to bootstrap from migrations alone will break.
- D1/SQLite has no `ALTER TABLE … ADD COLUMN IF NOT EXISTS`, so every column-adding migration must use guards (`CREATE TABLE IF NOT EXISTS`, partial `UNIQUE`, `CREATE INDEX IF NOT EXISTS`) and be idempotent.
- After any schema change: update **both** `schema.sql` and add a `migrations/NNN-<name>.sql`. Background in `migrations/README.md`.

### Admin technical module (aircraft / logbook / mechanic role)
Airworthiness tracking for the Extra 300L (`aircraft_id` defaults to `speks-001`), gated by a dedicated admin sub-role.
- **Mechanic role**: `admin_users.role` is `'admin' | 'mechanic'` (`src/lib/admin-auth.ts` — `AdminRole`, `getAdminIdentityAsync()`). `functions/_middleware.ts` **centrally** gates it: a `mechanic` session may only reach `MECHANIC_ALLOWED_PREFIXES = ['/api/admin/aircraft', '/api/admin/me', '/api/admin/auth/']` — every other `/api/admin/**` path 403s. So the gate lives in middleware, not per-endpoint; the aircraft handlers themselves only do `checkAdminAuthAsync`.
- **`functions/api/admin/aircraft.ts`** is a single POST router with an `action` switch covering maintenance (`add/complete/delete_maintenance`, `update_hours`), documents (`add/delete_document`), logbook review (`edit/confirm/reject_logbook`), and pilot insurance (`add_insurance_pilot`, `approve/reject/remove_insurance`). It also computes `estimateMaintenance()` — projected days until a `due_hours` is reached, from current airframe hours and the average flight rate of recent confirmed logbook entries.
- **Uploads**: `aircraft/upload.ts` (multipart) stores an MS — *maintenance status* from CAMO — or a document scan in R2 with metadata in the `documents` table (`source='camo'|'manual'`). `aircraft/file/[id].ts` serves those attachments back from R2 and accepts the bearer token via `?t=` so plain `<img>`/`<a>` tags work without an `Authorization` header.
- **Logbook OCR flow (dziennik pokładowy)**: the instructor uploads a photo of a paper logbook page from the **pilot portal** (`functions/api/auth/logbook.ts`, SMS-OTP auth — not admin). `src/lib/vision.ts` (`extractLogbook`, Workers AI vision model `@cf/meta/llama-3.2-11b-vision-instruct`) extracts the fields into a `flight_logbook` row with `status='pending_review'`. A technician/admin then reviews and `confirm_logbook`s it in the aircraft endpoint; **only confirmed entries count toward airframe hours** — the model is unreliable on handwriting, so human review is mandatory before the nalot updates.

## Conventions

- **Polish diacritics** (ą/ć/ę/ł/ń/ó/ś/ź/ż): every Polish-facing string in HTML, emails, and PDFs must use proper Unicode. The voucher PDF now embeds Inter Regular + Bold via `@pdf-lib/fontkit` (`src/lib/fonts/inter.ts`, ~870 KB base64) so all diacritics render correctly. `sanitizeUserText()` in `pdf.ts` is a defensive fallback for emoji/CJK codepoints outside Inter's coverage. Constants in `src/lib/types.ts` (`PACKAGES.name`, `ADDONS.name`) are still ASCII for Stripe metadata safety, but `PACKAGES.subtitle/features` are full PL.
- **PL/EN sync**: when editing a polish page, sync the equivalent English one if it exists, and vice versa.
- **After UX/visual changes**: deploy and verify the rendered output in a browser before declaring done - production is one push away and CSS regressions are easy to miss locally.
- **Deploy gotcha**: `scripts/deploy.mjs` rsyncs `public/` to a temp dir and excludes large `rolki/*.mp4|.mov` files (>25 MiB Cloudflare Pages limit). If you add new large assets, extend the exclude list there or move to R2.
- **Before changing anything**: `git fetch && git log origin/main..HEAD` - auto-deploy means the local working copy can lag behind production.
- **Session memory files** the assistant writes for itself: name them `CLAUDE.md`, never `klot.md` or other variants. The parallel `AGENTS.md` at repo root is the equivalent for other agents (Codex etc.) - keep them separate, don't merge or overwrite.
- **`docs/` folder** holds long-form references that don't fit inline: `deep-code-audit-2026-05-05.md`, `POZYCZKA-NA-KSZTALCENIE-FCL800.md` (BGK loan USP source-of-truth), `SUS-3.0-system-jakosci-BUR.md`. Consult before duplicating their content.

## Known gaps to be aware of

`README.md` § "Znane luki" lists the original prioritized backlog. Live gaps as of the 2026-05 full-site audit:
- Printful fulfilment is per-product via the `products.printful_data` JSON column. A product without it just skips Printful (no throw). Manual fulfilment still required where `printful_data IS NULL`.
- EN site has only 3 pages (lot-akrobacyjny, voucher-prezent, kalendarz) + `en.html` landing. No EN regulamin/polityka - legally required if you sell to non-PL EU customers via Stripe.
- `atrakcje-okolice-warszawy.html` blog post is the only piece of copy with mild AI-slop signal (7× generic superlatives). Everything else passes.

Already fixed since the README was written (don't re-fix): rate limiting on every public GET (`chat`, `subscribe`, `voucher/[code]`, `calendar/slots`, `metar`, `reviews`, `wa-click`, `unsubscribe`, `auth/send-code`, `calendar/book`); cron endpoints all enforce `CRON_SECRET`; webhook handles `checkout.session.expired`, `async_payment_failed`, and `charge.refunded` (out-of-order safe); `calendar/book.ts:44-47` validates `start_time` against `generateSlots(date)`; `sendBookingEmails` notifies both customer and admin; voucher PDF renders full Polish diacritics via Inter (`@pdf-lib/fontkit`); `schema.sql` carries the full state including `products.printful_data` and the May 2026 audit indexes.
