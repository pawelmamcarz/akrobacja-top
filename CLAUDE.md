# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

akrobacja.com — voucher shop for Extra 300L SP-EKS aerobatic flights from Radom-Piastów (EPRP). Also hosts merch, booking calendar, pilot portal (SMS OTP login), admin panel, AI chat, and SEO blog.

Production URL: https://akrobacja.com

Stack: **Cloudflare Pages** (static HTML in `public/`) + **Pages Functions** (TypeScript in `functions/api/`), **D1** (binding `DB`), **R2** (binding `VOUCHER_BUCKET`), **Workers AI** (binding `AI`), Stripe Checkout, wFirma (invoices), Resend (email), SMSAPI (SMS), Printful (merch — partly stubbed).

Full repo layout, data model, all endpoints, and known backlog gaps live in `README.md` — read that first when looking up specifics. Migration policy is documented in `migrations/README.md`.

## Common commands

```bash
npm install
cp .dev.vars.example .dev.vars                    # fill in secrets
npm run dev                                        # wrangler pages dev public --port 8788
npm run types                                      # regenerate worker-configuration.d.ts
npm run db:typecheck                               # tsc --noEmit — actual type check across functions/ + src/
npm run deploy                                     # node scripts/deploy.mjs (rsync + wrangler pages deploy)

# D1 schema — see "Schema policy" below
npm run db:bootstrap:local                                                     # fresh local DB from schema.sql
npm run db:bootstrap:remote                                                    # ⚠ wipes/recreates prod DB — disaster recovery only
npx wrangler d1 execute akrobacja-db --remote --file=migrations/NNN-<name>.sql # prod drift patch (normal path)

# Push secrets to Cloudflare (one at a time)
npx wrangler pages secret put NAME --project-name=akrobacja-top
```

There is no test suite, no linter, no formatter wired up. **`npm run db:typecheck` (TS strict mode, covers `functions/` + `src/`) is the only safety net before a push** — auto-deploy on `main` is ~1 min, so run it before every commit that touches `.ts`. `npm run types` only regenerates the wrangler-derived `worker-configuration.d.ts` and doesn't validate anything.

Auto-deploy: pushes to `main` trigger `.github/workflows/deploy.yml` → `wrangler pages deploy public --project-name=akrobacja-top --branch=main`. Other branches do NOT auto-deploy (locked, since D1/R2/AI bindings are shared with prod and preview deploys would corrupt live data). Use `npm run dev` for local staging. **A commit on `main` goes live within ~1 min of push** — only push when you want it deployed.

## Architecture

### Pages vs Functions split
- `public/` is the deploy target — every `.html` is served as-is by Cloudflare Pages. JS lives inline or in `public/assets/`.
- `functions/_middleware.ts` runs on every request: SEO canonical/robots injection via `HTMLRewriter`, legacy WordPress URL redirects, security headers, and analytics tag injection. Hit it before debugging "why isn't my page rendering."
- `functions/api/**` are the API routes (file-based routing — `functions/api/foo.ts` → `/api/foo`, `functions/api/foo/bar.ts` → `/api/foo/bar`). Two distinct webhooks share the prefix: `functions/api/webhook.ts` is the **Stripe** webhook at `/api/webhook` (signature via `STRIPE_WEBHOOK_SECRET`); `functions/api/webhook/resend.ts` is the **Resend** delivery-events webhook at `/api/webhook/resend` (signature via `RESEND_WEBHOOK_SECRET`). Don't conflate them.
- Cron endpoints live under `functions/api/cron/` and are HTTP-triggered by an external scheduler — every cron handler verifies `Authorization: Bearer ${CRON_SECRET}` and 401s on mismatch. Current crons: `welcome-emails`, `abandoned-checkouts`, `scheduled-vouchers`, `refresh-google-reviews`, `post-flight-review-sms`.
- Shared TS modules in `src/lib/`: `pdf`, `email`, `wfirma`, `sms`, `pilot-auth`, `admin-auth`, `weather`, `daylight`, `meta-capi`, `validate`, `phone`, `voucher-code`, `rate-limit` (KV-backed counter), `turnstile` (Cloudflare CAPTCHA verify), `audit` (admin action log), `printful`, `types`. `Env` interface and `PACKAGES` constant live in `src/lib/types.ts` — all voucher pricing and product IDs are defined there. Addons (cross-sell) live in `src/lib/types.ts` under `ADDONS` with per-package gating.
- **Email observability**: `functions/api/webhook/resend.ts` ingests Resend delivery events into the `email_events` table; admin "Maile" tab consumes `functions/api/admin/email-events.ts` + `functions/api/admin/failed-deliveries.ts`. Set `RESEND_WEBHOOK_SECRET` for signature verification.

### `email-worker/` — separate Worker (not Pages)
`email-worker/` is a standalone Cloudflare **Worker** (not a Pages Function) that fans out incoming mail to `voucher@`/`info@akrobacja.com` to multiple destinations (CF Email Routing dashboard only allows 1 destination per address). It has its own `package.json` and `wrangler.toml` and a **manual** deploy path: `cd email-worker && npx wrangler deploy`. It is NOT touched by the Pages auto-deploy workflow — bumping it requires the manual command above plus a CF Dashboard wire-up (Email Routing → Custom Address → Action "Send to a Worker" → `akrobacja-email-fanout`).

### Voucher purchase flow (the core path)
The Stripe webhook is the heart of the app. Read `functions/api/webhook.ts` end-to-end before touching it.

1. `POST /api/checkout` (`functions/api/checkout.ts`) — creates `orders` row with `status='pending'` and a `voucher_code` (`AKR-XXXX-XXXX`), opens a Stripe Checkout Session.
2. Stripe → `POST /api/webhook` on `checkout.session.completed`. Webhook **atomically** flips `pending → processing` (D1 conditional UPDATE — guards against double-fire), then in parallel: generates the voucher PDF (`pdf-lib`) and uploads to R2 at `vouchers/{code}.pdf`, issues a wFirma invoice (only when `STRIPE_SECRET_KEY` contains `_live_`), and sends the customer email via Resend with the PDF attached.
3. Status flips to `paid`; `ctx.waitUntil` fires Meta CAPI `Purchase` and the owner notification email.
4. Customer lands on `/sukces?code=…&amount=…&pkg=…`. GA4 / Google Ads / Meta Pixel fire conversion from `sessionStorage.akro_checkout_info` (Enhanced Conversions, dedup with the CAPI event via `event_id`).

The `test_naklejka` package (200 gr = 2 PLN, Stripe PLN minimum) deliberately **skips PDF + email + invoice** in the webhook (`src/lib/types.ts:59`) — it exists only to validate live conversion pixels without burning real PDFs/invoices. Reachable only from `/test-konwersji`; don't add it to public UI.

A second flow (`functions/api/cron/scheduled-vouchers.ts`) handles gift vouchers with a future `send_at`: webhook stored the PDF in R2 but skipped the email; cron picks it up on/after `send_at` and sends it.

### Auth model — three separate systems
- **Public endpoints**: no auth.
- **Admin** (`/api/admin/**`): `Authorization: Bearer ${ADMIN_PASSWORD}`. Token is the password itself, stored in `localStorage` on the admin client. No JWT, no TTL.
- **Pilot portal** (`/api/auth/**`): SMS OTP login. `send-code` rate-limits 3/h/phone, `verify` checks code (5 min TTL), issues a `session_token` stored on `pilots` row + client `localStorage`. All `auth/*` and `auth/insurance` endpoints want `Authorization: Bearer <session_token>`.
- **Cron** (`/api/cron/**`): `Authorization: Bearer ${CRON_SECRET}`. Endpoints are public URLs, so missing/wrong CRON_SECRET must reject — verify before adding new cron handlers.

### Schema policy (important — D1 quirk)
- **`schema.sql` is the only source of truth for bootstrap.** Fresh DBs (local, preview, branch deploy, disaster recovery) MUST be created from it.
- **`migrations/NNN-*.sql` are drift patches only** — they add columns/indexes/tables to the live prod DB. They do NOT form a complete chain from zero; trying to bootstrap from migrations alone will break.
- D1/SQLite has no `ALTER TABLE … ADD COLUMN IF NOT EXISTS`, so every column-adding migration must use guards (`CREATE TABLE IF NOT EXISTS`, partial `UNIQUE`, `CREATE INDEX IF NOT EXISTS`) and be idempotent.
- After any schema change: update **both** `schema.sql` and add a `migrations/NNN-<name>.sql`. Background in `migrations/README.md`.

## Conventions

- **Polish diacritics** (ą/ć/ę/ł/ń/ó/ś/ź/ż): every Polish-facing string in HTML, emails, and PDFs must use proper Unicode. The voucher PDF now embeds Inter Regular + Bold via `@pdf-lib/fontkit` (`src/lib/fonts/inter.ts`, ~870 KB base64) so all diacritics render correctly. `sanitizeUserText()` in `pdf.ts` is a defensive fallback for emoji/CJK codepoints outside Inter's coverage. Constants in `src/lib/types.ts` (`PACKAGES.name`, `ADDONS.name`) are still ASCII for Stripe metadata safety, but `PACKAGES.subtitle/features` are full PL.
- **PL/EN sync**: when editing a polish page, sync the equivalent English one if it exists, and vice versa.
- **After UX/visual changes**: deploy and verify the rendered output in a browser before declaring done — production is one push away and CSS regressions are easy to miss locally.
- **Deploy gotcha**: `scripts/deploy.mjs` rsyncs `public/` to a temp dir and excludes large `rolki/*.mp4|.mov` files (>25 MiB Cloudflare Pages limit). If you add new large assets, extend the exclude list there or move to R2.
- **Before changing anything**: `git fetch && git log origin/main..HEAD` — auto-deploy means the local working copy can lag behind production.
- **Session memory files** the assistant writes for itself: name them `CLAUDE.md`, never `klot.md` or other variants. The parallel `AGENTS.md` at repo root is the equivalent for other agents (Codex etc.) — keep them separate, don't merge or overwrite.
- **`docs/` folder** holds long-form references that don't fit inline: `deep-code-audit-2026-05-05.md`, `POZYCZKA-NA-KSZTALCENIE-FCL800.md` (BGK loan USP source-of-truth), `SUS-3.0-system-jakosci-BUR.md`. Consult before duplicating their content.

## Known gaps to be aware of

`README.md` § "Znane luki" lists the original prioritized backlog. Live gaps as of the 2026-05 full-site audit:
- Printful fulfilment is per-product via the `products.printful_data` JSON column. A product without it just skips Printful (no throw). Manual fulfilment still required where `printful_data IS NULL`.
- EN site has only 3 pages (lot-akrobacyjny, voucher-prezent, kalendarz) + `en.html` landing. No EN regulamin/polityka — legally required if you sell to non-PL EU customers via Stripe.
- `atrakcje-okolice-warszawy.html` blog post is the only piece of copy with mild AI-slop signal (7× generic superlatives). Everything else passes.

Already fixed since the README was written (don't re-fix): rate limiting on every public GET (`chat`, `subscribe`, `voucher/[code]`, `calendar/slots`, `metar`, `reviews`, `wa-click`, `unsubscribe`, `auth/send-code`, `calendar/book`); cron endpoints all enforce `CRON_SECRET`; webhook handles `checkout.session.expired`, `async_payment_failed`, and `charge.refunded` (out-of-order safe); `calendar/book.ts:44-47` validates `start_time` against `generateSlots(date)`; `sendBookingEmails` notifies both customer and admin; voucher PDF renders full Polish diacritics via Inter (`@pdf-lib/fontkit`); `schema.sql` carries the full state including `products.printful_data` and the May 2026 audit indexes.
