# akrobacja.com

Strona sprzedaży voucherów na loty akrobacyjne Extra 300L SP-EKS (Radom-Piastów EPRP).
Stack: Cloudflare Pages + Pages Functions (TypeScript), D1, R2, Workers AI, Stripe, wFirma, Resend, SMSAPI, Printful.
Repo layout i pełny opis stacku: `README.md`.

## Deployment
- Always verify git status and remote sync (`git fetch` + `git log origin/main..HEAD`) BEFORE making changes — the local repo may be many commits behind production.
- Confirm which Cloudflare project type is in use (Workers vs Pages) before debugging deploy issues.

## Data Integrity
- Never use estimated/guessed values for TCO, rankings, or pricing — always run the real calculation engine.
- Filter scraper data for invalid brand-model combinations (e.g., 'MG Mercedes CLE') before any production merge or deploy.

## Localization
- All Polish content must include proper diacritics (ą, ć, ę, ł, ń, ó, ś, ź, ż) — verify before commit.
- When updating one language version (PL/EN), always sync the equivalent change to the other.

## Session Conventions
- Session summary/memory files must be named `CLAUDE.md` (never `klot.md` or other variants).
- After any UX/visual change, deploy and verify rendered output before declaring done.
