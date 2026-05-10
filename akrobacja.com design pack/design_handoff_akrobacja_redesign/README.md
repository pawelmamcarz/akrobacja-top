# Handoff: akrobacja.com — Redesign + Brand System

## Overview

This bundle contains the design direction, brand system and full landing-page mock for **akrobacja.com** — szkoła lotnictwa akrobacyjnego, oferująca loty zapoznawcze i szkolenia FCL.800 na samolocie wyczynowym Extra 300L (rejestracja **SP-EKS**) z lotniska Radom-Piastów (EPRP).

The goal of the redesign is to evolve the existing site (repo: `pawelmamcarz/akrobacja-top`, deploy: akrobacja.com / akrobacja.top) into a sharper, more emotional and conversion-focused product. The brand identity (logo, palette, typography) is preserved; the site frame, hero, packaging of products and merchandise system are new.

## About the Design Files

The files in this bundle are **design references created in HTML** — prototypes showing intended look, behavior and copy. They are **not** production code to copy directly. The HTML uses inline JSX via Babel, a custom `<DesignCanvas>` pan/zoom shell and a `<TweaksPanel>` — none of those should ship.

The task is to **recreate these designs inside the existing codebase** (`pawelmamcarz/akrobacja-top` — Cloudflare Pages, server-rendered HTML/JS, see `public/` and the README in repo). Use the patterns already in the repo (the existing voucher checkout flow, Stripe integration, copy in PL, EPRP / SP-EKS facts) and lift the visual treatment, layout and copy from the mocks below.

## Fidelity

**High-fidelity.** Mocks contain final-ish copy, exact colors, typography, spacing, photography placement and component structure. Recreate pixel-close, but use the production codebase's stack (current site is server-rendered HTML in `public/` + Cloudflare Functions; keep that — do not introduce a heavy SPA framework unless the team wants to).

---

## Screens / Views

The HTML files break down as:

| File | What it contains |
|---|---|
| `akrobacja-brand.html` | Brand canvas — fundamentals, logo direction (L1 chosen), site landing mock, merch range. Open this first; it's the master. |
| `akrobacja-logo-pack.html` | Logo files in production formats (primary, on-navy, mark, mark-on-black) + a **proposed flat-vector alt** for embroidery / engraving. |
| `akrobacja-logo-druk.html` | Print-ready logo SVG/PNG export (4 variants, 4800 px). |

### 01 · Brand fundamentals (in `akrobacja-brand.html`, section "01 Fundamenty")

- **Tone:** kokpit-precision, no corporate fluff, polish + english tech labels (PL primary, EN micro-copy).
- **Voice tags:** "Make it vertical", "Lot, którego nie zapomnisz. Naprawdę.", aviation jargon used confidently (CAVOK, EPRP RWY 27, ±8G, FCL.800).
- **Photography:** real airframe photos, contrails, smoke. No AI/stock.

### 02 · Logo (chosen direction: L1)

- **Primary lockup:** existing 3D rendered logo (file `assets/akrobacja-logo.webp`).
- **Variants:**
  - Primary (color, light bg) — `akrobacja-logo.webp`
  - On navy (white version) — `akrobacja-logo-light.webp`
  - Mark only (avatar / favicon) — `akrobacja-logo-mark.webp`
  - Mark on black — `akrobacja-logo-mark-light.webp`
- **Flat vector alt** (proposal) — for embroidery, engraving, 1-color sito druk. See `akrobacja-logo-pack.html` "Uproszczona wersja wektorowa" section. Awaiting approval before final SVG/AI delivery.
- **Clearspace:** min 1× height of the lowercase mark width on every side.
- **Min sizes:** mark 16 px (web favicon), full lockup 96 px wide (web), 24 mm wide (print).

### 03 · Landing page (in `akrobacja-brand.html`, section "03 Strona", artboard `site-landing`, 1440×1720)

**Hero (top, full-bleed, 780 px tall):**
- Background: `assets/hero-takeoff.webp` (real photo of SP-EKS taking off with smoke).
- Tonal navy gradient overlay left → transparent right (`linear-gradient(90deg, rgba(4,14,42,.78) 0%, rgba(10,47,124,.55) 35%, rgba(0,0,0,0) 65%)`).
- Diagonal hi-vis stripe (#E11E26 + #FFB300) top edge 12 px and bottom edge 12 px.
- HUD strip top, JetBrains Mono 11/3, cyan: `● LIVE · EPRP RWY 27 · WIND 240/06 · CAVOK` (left) and `N51°23'21" E021°12'48"` (right).
- Eyebrow: `20 MIN · 12 MIN AKROBACJI · ±8G` (mono, cyan, 12px, ls 6).
- H1: **"LOT, KTÓREGO NIE ZAPOMNISZ. NAPRAWDĘ."** — Anton 108 / 0.86, white, last word "NAPRAWDĘ." in cyan (#00E5FF).
- Lead body: 18 / 1.55, white .92 alpha, max 480 px. Copy: "Akrobacja z pilotem instruktorem na dwumiejscowym **Extra 300L SP-EKS**. Lotnisko Radom-Piastów, 90 minut z Warszawy. Ten sam typ samolotu, którym lata reprezentacja Polski."
- CTAs side-by-side: red filled `ZAREZERWUJ — od 1 490 zł →` + ghost outline `VOUCHER PREZENT`. Padding 18×26, weight 700, ls 2.
- Bottom-left metrics row: 6 000h / NA EXTRA 300L · ±10G / CERTYFIKAT · 4.97★ / GOOGLE · 1 200+ / PASAŻERÓW. Each has 2 px cyan left rule.
- Top-right tail tag: `REG. NUMBER` (mono cyan) / **SP-EKS** (Anton 42, ls 6) / `EXTRA 300L · S/N 1290`.

**3 packages section:**
- Three cards: **Pierwszy G** (1 490 zł, 20 min, 12 min akro, ±6–8G) · **Pełny program** (2 490 zł, 30 min, 20 min akro, kompletny zestaw figur) · **Masterclass** (4 990 zł, 60 min + 1h brief, szkolenie FCL.800 starter).
- Each: navy header bar, price in Anton 56, feature list with checkmarks, red CTA bottom.

**"Jak to działa" checklist:**
- 4-step horizontal: 01 Wybierasz pakiet · 02 Bookujesz termin · 03 Brief + sprzęt · 04 Latasz.
- Numbered with Anton 80 in navy outline, cyan accent.

**Pilot strip footer (full-bleed black):**
- Left: `YOUR PILOT IN COMMAND` (mono cyan 11/4) · **MACIEJ KULASZEWSKI** (Anton 64) · Bio: "Pilot akrobacyjny z 6 000h nalotu. Reprezentacja Polski. Instruktor FCL.800. Lata SP-EKS od 2018 roku."
- Right: pilot photo placeholder (need real photo from team).

### 04 · Merch (in `akrobacja-brand.html`, section "04 Merch")

Range to produce:
- **T-shirt navy** — front: small mark left chest, back: large `MAKE IT VERTICAL` + SP-EKS livery diagram.
- **T-shirt bone** — back-print focused, navy + red ink.
- **Hoodie navy** — heavy cotton, embroidered mark.
- **Tote bag bone** — single-color print, full lockup.
- **Sticker pack 4 szt.** — mark, SP-EKS plate, hi-vis stripe, "FLY VERTICAL".
- **Plakat A2** — diagram-style aircraft schematic with specs.
- **Kubek 330 ml** — wraparound livery stripe.
- **Bidon 750 ml** — black, single-color white print.
- **Cap (dad hat)** — navy 6-panel unstructured, low profile, chain-stitch embroidered side logo, red flag tab on visor edge. (NOT a flat-brim snapback — user explicitly rejected the snapback variant.)

---

## Interactions & Behavior

- **Voucher checkout** — keep existing flow from current site. Add price tier selection upfront before personalisation.
- **Calendar** — slot picker for booking real-flight dates. Integrate with whatever the current backend uses (check repo).
- **Hover states:** CTAs darken 8% on hover; cards lift 4 px with shadow `0 12px 32px rgba(10,47,124,.18)`.
- **Hi-vis stripe animation:** subtle horizontal scroll on hero stripe (60 s loop, optional).
- **HUD live indicator:** the `● LIVE` dot can blink at 1.2 s interval (optional, low priority).
- **Responsive:** hero collapses to stacked text+CTA, photo behind. Metrics row goes 2×2 on mobile. Tail tag moves below H1 on mobile.

## State Management

- Cart state for vouchers (existing).
- Booking state: selected package → datetime → personal info → payment → confirmation.
- No new state primitives needed beyond what the repo already uses.

## Design Tokens

```
--navy: #0A2F7C    /* primary brand */
--navy-deep: #06205A
--navy-ink: #040E2A
--red: #E11E26     /* accent — CTA, accents */
--cyan: #00E5FF    /* HUD / micro-copy on dark */
--bone: #F4F1EA    /* warm off-white body bg */
--white: #FFFFFF
--black: #070F1A
--ink: #0E1A35     /* body text */

--hi-vis-stripe: repeating-linear-gradient(45deg, #E11E26 0 14px, #FFB300 14px 28px)

Typography:
- Display:   "Anton", Impact, sans-serif      (headings, numbers)
- Body:      "Inter", system-ui, sans-serif   (400/600/700)
- Mono:      "JetBrains Mono", monospace      (HUD, labels, codes)

Type scale (1440 design grid):
- Hero H1:   108 / 0.86 / ls 1
- H2:        64 / 0.9
- H3:        36 / 1.05
- Body L:    18 / 1.55
- Body:      15 / 1.6
- Mono S:    11 / 1.4 / ls 3-6
- Mono XS:   9-10 / ls 2-4

Spacing scale: 4, 8, 12, 14, 16, 20, 24, 32, 36, 48, 56, 80
Borders: 1 px solid #E6E2D8 on cards. No rounded corners on cards (sharp 0 px) — only buttons can be 0 px or 4 px.
Shadows used sparingly; avoid soft drop shadows on hero. Use them only on hover for cards.
```

## Assets (in `assets/`)

- `akrobacja-logo.webp` — primary lockup, color, transparent bg
- `akrobacja-logo-light.webp` — primary lockup, white version for dark bg
- `akrobacja-logo-mark.webp` — mark only (the "A" symbol), for favicon / avatar
- `akrobacja-logo-mark-light.webp` — mark only, white
- `extra-300l-illustration.png` — Extra 300L illustration in brand style (used in logo lockups + decorative)
- `hero-takeoff.webp` — real photo of SP-EKS at takeoff with smoke. Hero background.

All sourced from the existing repo `pawelmamcarz/akrobacja-top` `public/` folder.

## Files

| File in this bundle | What to use it for |
|---|---|
| `akrobacja-brand.html` | Master design canvas — open this for the full picture (fundamentals, logo, site, merch). |
| `akrobacja-logo-pack.html` | Logo pack with download buttons for production WEBP/PNG. Includes proposal for flat-vector alt. |
| `akrobacja-logo-druk.html` | Print-ready SVG/PNG exports (4800 px, 4 variants). |
| `_source/*.jsx` | The React/JSX source of the canvas — useful as documentation, but **not to ship**. Lift values, copy and structure from here. |
| `_source/brand.css` | Brand CSS variables and base styles — port these tokens to the production stylesheet. |
| `assets/*` | Final image assets. Copy these into the production `public/` (most are already there). |

## Open questions / awaiting decisions

1. **Flat-vector logo alt** — does the user accept the simplified vector for embroidery / engraving / 1-color print? Final SVG/AI delivery pending approval.
2. **Pilot photo** — need real high-res photo of Maciej for the pilot strip.
3. **Merch photos** — when merch is produced, replace mock SVG illustrations with real product shots.
4. **Calendar provider** — confirm what's behind the current booking flow before redesigning.

---

*Designed by Anthropic Claude (design assistant) for Paweł Mamcarz, May 2026.*
