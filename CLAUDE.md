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
npm run deploy                                     # node scripts/deploy.mjs (rsync + wrangler pages deploy)

# D1 schema — see "Schema policy" below
npx wrangler d1 execute akrobacja-db --local  --file=schema.sql                # fresh local DB
npx wrangler d1 execute akrobacja-db --remote --file=migrations/NNN-<name>.sql # prod drift patch

# Push secrets to Cloudflare (one at a time)
npx wrangler pages secret put NAME --project-name=akrobacja-top
```

There is no test suite, no linter, no formatter wired up. `npm run types` is the closest thing to a check.

Auto-deploy: any push to any branch triggers `.github/workflows/deploy.yml` → `wrangler pages deploy public --project-name=akrobacja-top --branch=<ref>`. `main` is production. **A commit will go live within ~1 min of push** — only push when you want it deployed.

## Architecture

### Pages vs Functions split
- `public/` is the deploy target — every `.html` is served as-is by Cloudflare Pages. JS lives inline or in `public/assets/`.
- `functions/_middleware.ts` runs on every request: SEO canonical/robots injection via `HTMLRewriter`, legacy WordPress URL redirects, security headers, and analytics tag injection. Hit it before debugging "why isn't my page rendering."
- `functions/api/**` are the API routes (file-based routing — `functions/api/foo.ts` → `/api/foo`). Cron endpoints live under `functions/api/cron/` and are HTTP-triggered by an external scheduler (must send `Authorization: Bearer ${CRON_SECRET}`).
- Shared TS modules in `src/lib/` (pdf, email, wfirma, sms, pilot-auth, admin-auth, weather, daylight, meta-capi, validate, types). `Env` interface and `PACKAGES` constant live in `src/lib/types.ts` — all voucher pricing and product IDs are defined there.

### Voucher purchase flow (the core path)
The Stripe webhook is the heart of the app. Read `functions/api/webhook.ts` end-to-end before touching it.

1. `POST /api/checkout` (`functions/api/checkout.ts`) — creates `orders` row with `status='pending'` and a `voucher_code` (`AKR-XXXX-XXXX`), opens a Stripe Checkout Session.
2. Stripe → `POST /api/webhook` on `checkout.session.completed`. Webhook **atomically** flips `pending → processing` (D1 conditional UPDATE — guards against double-fire), then in parallel: generates the voucher PDF (`pdf-lib`) and uploads to R2 at `vouchers/{code}.pdf`, issues a wFirma invoice (only when `STRIPE_SECRET_KEY` contains `_live_`), and sends the customer email via Resend with the PDF attached.
3. Status flips to `paid`; `ctx.waitUntil` fires Meta CAPI `Purchase` and the owner notification email.
4. Customer lands on `/sukces?code=…&amount=…&pkg=…`. GA4 / Google Ads / Meta Pixel fire conversion from `sessionStorage.akro_checkout_info` (Enhanced Conversions, dedup with the CAPI event via `event_id`).

The `test_naklejka` package (200 gr / 2 PLN) deliberately **skips PDF + email + invoice** — it exists only to validate live conversion pixels without burning real PDFs/invoices. Don't add it to public UI.

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

- **Polish diacritics** (ą/ć/ę/ł/ń/ó/ś/ź/ż): every Polish-facing string in HTML, emails, and PDFs must use proper Unicode. The `pdf-lib` voucher template uses a font that supports them — if you change fonts, verify rendering. Note: a few constants in `src/lib/types.ts` (`PACKAGES`) intentionally use ASCII for safety inside Stripe metadata.
- **PL/EN sync**: when editing a polish page, sync the equivalent English one if it exists, and vice versa.
- **After UX/visual changes**: deploy and verify the rendered output in a browser before declaring done — production is one push away and CSS regressions are easy to miss locally.
- **Deploy gotcha**: `scripts/deploy.mjs` rsyncs `public/` to a temp dir and excludes large `rolki/*.mp4|.mov` files (>25 MiB Cloudflare Pages limit). If you add new large assets, extend the exclude list there or move to R2.
- **Before changing anything**: `git fetch && git log origin/main..HEAD` — auto-deploy means the local working copy can lag behind production.
- **Session memory files** the assistant writes for itself: name them `CLAUDE.md`, never `klot.md` or other variants.

## Known gaps to be aware of

`README.md` § "Znane luki" lists prioritized backlog. The ones most likely to trip up changes today:
- `PRINTFUL_PRODUCTS = {}` in `src/lib/printful.ts` — calling `createPrintfulOrder` throws. Merch orders ship manually for now.
- `/api/chat` (Workers AI) and `/api/subscribe` have no rate limiting.
- Webhook only handles `checkout.session.completed` — `expired` / `payment_failed` sessions stay `pending` forever.
- `GEMINI_API_KEY` is in `Env` but unused.
