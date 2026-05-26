# CWV + GSC site-wide audit (2026-05-21)

## Executive summary

- **Google Fonts are render-blocking on 19 of 20 pages** - only `lot-akrobacyjny.html` uses the `media="print"` async pattern. This is the single highest-ROI fix across the entire site and will improve LCP on every page.
- **All 7 blog posts under `/blog/` are missing `<link rel="canonical">`**, and `blog.html` and `sklep-merch.html` are also missing it - 9 pages total, creating potential duplicate-content exposure for GSC.
- **`prezent-na-urodziny.html` and `maciej-osiagniecia.html` have no GTM tag** (0 tracking events), meaning conversion attribution is blind for two high-intent pages.

---

## Per-page findings

### public/index.html
- **Page weight:** 16 script tags (1 GTM inline + 3 external deferred), 1 render-blocking stylesheet (`brand.css` in `</head>`), 1 render-blocking Google Fonts (`<link rel="stylesheet">` without `media="print"`). 14 external origins.
- **LCP/images:** Hero uses CSS `background-url('/hero-takeoff.webp')` with `<link rel="preload" fetchpriority="high">` - correct. All `<img>` tags have `loading="lazy"` and explicit `width`/`height`. Logo in footer footer lacks `width` attr on one decorative instance (aria-hidden, minor). No bare `.jpg` refs for images that have `.webp` equivalents.
- **CLS risks:** `brand.css` loads at end of `<head>` (last stylesheet) - triggers late paint; Google Fonts without swap is the main CLS driver. Video autoplay poster image has no explicit dimensions (CSS `width:100%;height:100%` inside fixed container - contained, not a CLS issue).
- **SEO basics:** Title 83 chars (over 60 limit). Description 262 chars (over 160 limit). Canonical present. 8 JSON-LD blocks (LocalBusiness, Product, FAQPage, BreadcrumbList, etc.) - excellent. OG tags complete.
- **A11y:** Skip-link present and focus-visible. Hamburger has `aria-label` + `aria-expanded`. Several `<button>` elements for voucher CTAs lack `aria-label` (text content only - acceptable but not ideal). Modal close `&times;` button has no aria-label.
- **Recommended fixes:**
  - P0: Switch Google Fonts to `media="print" onload="this.media='all'"` pattern (same as `lot-akrobacyjny.html`).
  - P1: Trim title to ≤60 chars and description to ≤160 chars.
  - P2: Add `aria-label` to modal close `×` button.

### public/lot-akrobacyjny.html
- **Page weight:** 13 script tags (1 GTM inline + 1 external deferred `chat-widget.js`), 1 stylesheet (`brand.css`). Google Fonts loaded async (`media="print"`) - correct. 13 external origins including `i.ytimg.com`.
- **LCP/images:** Hero preloaded via `<link rel="preload" href="/speks-flight.webp" fetchpriority="high">`. YouTube thumbnail `<img>` has explicit `width="1280" height="720" loading="lazy"` - correct. `kula.webp` and `samolot-top-web.webp` have dimensions. All content images have `loading="lazy"`.
- **CLS risks:** Google Maps `<iframe>` inside `.location-map` - container styled via CSS class (not inline `width/height` on the `<iframe>` element itself). Needs explicit `width`/`height` attrs or `aspect-ratio` CSS on the iframe to prevent CLS. Font loading is async - no FOIT/CLS from fonts.
- **SEO basics:** Title 70 chars (borderline). Description 163 chars (just over 160). Canonical present. 8 JSON-LD blocks. OG complete.
- **A11y:** Skip-link present. Voucher CTA buttons have visible text but no `aria-label`. Maps iframe has `title` attr.
- **Recommended fixes:**
  - P0: Add `width` and `height` attrs (or `style="aspect-ratio:16/9"`) to the Maps `<iframe>` element to prevent CLS.
  - P1: Trim description to ≤160 chars.
  - P2: Add `aria-label` to purchase buttons for screen reader context.

### public/voucher-prezent.html
- **Page weight:** 5 script tags (1 GTM inline, 0 external - no chat widget), 1 render-blocking stylesheet (`brand.css`). Google Fonts **render-blocking** (no `media="print"`). 0 external JS dependencies.
- **LCP/images:** `<link rel="preload" href="/pilot-cockpit.webp" fetchpriority="high">` present. Hero uses CSS background - not an `<img>`, so preload is correct. `mamcarz.webp` has explicit dimensions with `loading="lazy"`. No bare .jpg for any image with a .webp equivalent.
- **CLS risks:** Google Fonts blocking. Several `<button>` elements with no dimensions - buttons themselves fine, but adjacent text layout may shift on font load.
- **SEO basics:** Title 67 chars (over 60). Description 158 chars (within 160). Canonical present. 2 JSON-LD blocks (Product + FAQPage - adequate). OG complete. Missing `og:title` explicitly - present as `og:title`.
- **A11y:** No skip-link. Purchase buttons lack `aria-label`. No `aria-expanded` on any toggle.
- **Recommended fixes:**
  - P0: Fix Google Fonts to async load.
  - P1: Add skip-link; trim title to ≤60 chars.
  - P2: Add `aria-label` to purchase buttons.

### public/kalendarz.html
- **Page weight:** 5 script tags (1 GTM inline + 2 external: `chat-widget.js`, `site-enhancements.js`), 1 render-blocking stylesheet. Google Fonts **render-blocking**. No hero image preload.
- **LCP/images:** No hero image at all - page is primarily a calendar UI rendered by JS. No `<img>` tags outside nav/footer. LCP is likely text, which is acceptable for a functional page.
- **CLS risks:** Calendar grid is JS-rendered - entire above-fold content paints after JS executes. This is a structural CLS risk; consider skeleton placeholder.
- **SEO basics:** Title 31 chars (good). Description 135 chars (good). Canonical present. 1 JSON-LD block (LocalBusiness only - missing `Event` schema for calendar slots). OG complete.
- **A11y:** No skip-link. Calendar slots rendered dynamically - unclear if ARIA roles/labels are applied to slot buttons (JS-rendered, not auditable statically).
- **Recommended fixes:**
  - P0: Fix Google Fonts async; add calendar skeleton to reduce CLS.
  - P1: Add `Event` JSON-LD schema for available slots.
  - P2: Add skip-link.

### public/sklep-merch.html
- **Page weight:** 5 script tags (1 GTM inline + 2 external), 1 render-blocking stylesheet. Google Fonts **render-blocking** (includes extra `Share+Tech+Mono` family). No hero image preload (`merch-hero.jpg` - no WebP version exists).
- **LCP/images:** Hero is CSS `background-image: url('/merch-hero.jpg')` - no preload. `merch-hero.jpg` is 380 KB - acceptable but no WebP version available (only `.jpg`). Product images are JS-rendered from API with `loading="lazy"` but without explicit `width`/`height` attrs (CLS risk as they load).
- **CLS risks:** Product grid loads via API fetch - images appear without reserved dimensions, causing layout shifts. `merch-hero.jpg` not preloaded.
- **SEO basics:** Title 47 chars (good). Description 131 chars (good). **Canonical missing.** 1 JSON-LD block (Store schema - adequate). OG complete.
- **A11y:** No skip-link. Cart toggle button (`cartToggleBtn`) has no `aria-label`. Cart close and checkout close buttons use `&times;` with no label.
- **Recommended fixes:**
  - P0: Add `<link rel="canonical">`. Fix Google Fonts async. Add `width`/`height` to JS-rendered product `<img>` elements.
  - P1: Create `merch-hero.webp`; add hero preload.
  - P2: Add `aria-label` to cart/checkout close buttons.

### public/dotacje-szkolenie-lotnicze.html
- **Page weight:** 6 script tags (1 GTM inline + 3 external), 1 render-blocking stylesheet. Google Fonts **render-blocking**. No LCP image preload (hero is CSS background `/pilot-cockpit.webp` - `.webp` exists but no preload `<link>`).
- **LCP/images:** No `<link rel="preload">` for the hero background image. `pilot-cockpit.webp` (171 KB) is a good size. No content `<img>` tags beyond nav/footer (text-heavy page).
- **CLS risks:** Google Fonts blocking. No significant CLS risk beyond fonts.
- **SEO basics:** Title 78 chars (over 60). Description 145 chars (good). Canonical present. 2 JSON-LD blocks (LocalBusiness + Course). OG complete.
- **A11y:** No skip-link. Forms present - unclear if labels are properly associated (inline HTML, acceptable).
- **Recommended fixes:**
  - P0: Fix Google Fonts async. Add `<link rel="preload">` for hero background.
  - P1: Trim title to ≤60 chars.
  - P2: Add skip-link.

### public/sponsoring.html
- **Page weight:** 6 script tags (1 GTM inline + 2 external), 1 render-blocking stylesheet. Google Fonts **render-blocking**. No LCP image preload.
- **LCP/images:** Hero CSS background `/samolot-top-web.webp` - WebP exists (211 KB) but no preload. Logo img in nav lacks `width` attr (height only: `height="42"`).
- **CLS risks:** Nav logo `<img>` has `height` but no `width` - minor CLS on nav. Google Fonts blocking.
- **SEO basics:** Title 71 chars (over 60). Description 148 chars (good). Canonical present. 2 JSON-LD blocks. OG complete. Note: description contains ASCII `a` instead of `ą` in "Wylaczny" and "wylaczny" - diacritic error in meta.
- **A11y:** No skip-link.
- **Recommended fixes:**
  - P0: Fix Google Fonts async.
  - P1: Add `width` to nav logo `<img>`; fix diacritic in meta description ("Wyłączny").
  - P2: Add skip-link; trim title.

### public/pokazy-lotnicze.html
- **Page weight:** 6 script tags (1 GTM inline + 1 external), 1 render-blocking stylesheet. Google Fonts **render-blocking**. No hero preload. Nav logo img has `height` only.
- **LCP/images:** Hero CSS background `/speks-flight.webp` (134 KB) - no preload. No content images beyond nav/footer.
- **CLS risks:** Nav logo missing `width`. Google Fonts blocking.
- **SEO basics:** Title 63 chars (borderline). Description 134 chars (good). Canonical present. 2 JSON-LD blocks. OG complete.
- **A11y:** No skip-link. CTA buttons (form submit) lack aria-labels.
- **Recommended fixes:**
  - P0: Fix Google Fonts async; add hero preload.
  - P1: Add `width` to nav logo. Add skip-link.
  - P2: Trim title slightly.

### public/camp-akrobacyjny.html
- **Page weight:** 6 script tags (1 GTM inline + 2 external), 1 render-blocking stylesheet. Google Fonts **render-blocking**. No hero preload.
- **LCP/images:** Hero CSS background `/speks-flight.webp` - no preload. WhatsApp/email CTAs use inline SVGs - fine.
- **CLS risks:** Google Fonts blocking. No significant image CLS.
- **SEO basics:** Title 59 chars (good). Description 165 chars (just over 160). Canonical present. 2 JSON-LD blocks (LocalBusiness + Event). OG complete.
- **A11y:** No skip-link.
- **Recommended fixes:**
  - P0: Fix Google Fonts async; add hero preload for `/speks-flight.webp`.
  - P1: Trim description to ≤160 chars.
  - P2: Add skip-link.

### public/prezent-na-urodziny.html
- **Page weight:** 2 script tags (0 GTM, 0 external JS - **no tracking at all**), 1 render-blocking stylesheet. Google Fonts **render-blocking**. Has `<link rel="preload" href="/hero-takeoff.webp" fetchpriority="high">`.
- **LCP/images:** Hero preload present. No content images visible in markup (text-heavy landing page).
- **CLS risks:** Google Fonts blocking. Missing GTM means no GA4/Ads conversion tracking - this is a business risk, not just CWV.
- **SEO basics:** Title 75 chars (over 60). Description 156 chars (good). Canonical present. 2 JSON-LD blocks. OG complete.
- **A11y:** No skip-link. Purchase buttons without aria-labels.
- **Recommended fixes:**
  - P0: **Add GTM tag** (missing tracking is a conversion attribution gap). Fix Google Fonts async.
  - P1: Trim title. Add skip-link.
  - P2: Add aria-labels to purchase buttons.

### public/blog.html
- **Page weight:** 3 script tags (1 GTM inline + 2 external), 1 render-blocking stylesheet. Google Fonts **render-blocking**. No hero image preload.
- **LCP/images:** Hero is a CSS background - text-only layout. No content `<img>` tags. LCP is text - acceptable.
- **CLS risks:** Google Fonts blocking. Blog card images loaded via JS may cause layout shift if dimensions not set in JS template.
- **SEO basics:** Title 61 chars (borderline). Description 148 chars (good). **Canonical missing.** 0 JSON-LD blocks - missing `CollectionPage` or `Blog` schema. OG has `og:url` but no `<link rel="canonical">`.
- **A11y:** No skip-link.
- **Recommended fixes:**
  - P0: Add `<link rel="canonical" href="https://akrobacja.com/blog">`. Fix Google Fonts async.
  - P1: Add `Blog`/`CollectionPage` JSON-LD.
  - P2: Add skip-link.

### public/blog/co-czuje-pasazer-podczas-lotu-akrobacyjnego.html
- **Status:** File does not exist yet (Agent 7 will create). No audit possible. When created, apply the same pattern as `figury-akrobacyjne.html` (Article JSON-LD, canonical, async fonts, hero preload).

### public/blog/lot-akrobacyjny-warszawa.html
- **Page weight:** 6 script tags (1 GTM inline + 2 external), 1 render-blocking stylesheet. Google Fonts **render-blocking**. No hero preload (text-hero, CSS only).
- **LCP/images:** No content images - text article. Logo images lack `width` attr.
- **CLS risks:** Logo `<img src="/assets/logo-mark.png">` missing `width`/`height` - minor CLS. Google Fonts blocking.
- **SEO basics:** Title 72 chars (over 60). Description 135 chars (good). **Canonical missing.** 3 JSON-LD blocks (Article, LocalBusiness, BreadcrumbList - good). OG complete.
- **A11y:** No skip-link.
- **Recommended fixes:**
  - P0: Add canonical. Fix Google Fonts async.
  - P1: Add `width`/`height` to logo `<img>`. Trim title.
  - P2: Add skip-link.

### public/blog/lot-akrobacyjny-radom.html
- **Page weight:** 5 script tags (1 GTM + 2 external), 1 render-blocking stylesheet. Google Fonts **render-blocking**.
- **LCP/images:** Text-only article. Logo imgs missing `width`.
- **CLS risks:** Same logo image CLS as above. Google Fonts blocking.
- **SEO basics:** Title 60 chars (exactly at limit). Description 106 chars (short - could include more). **Canonical missing.** 2 JSON-LD blocks (Article + LocalBusiness). OG complete.
- **A11y:** No skip-link.
- **Recommended fixes:**
  - P0: Add canonical. Fix Google Fonts async.
  - P1: Expand description. Add logo `width`/`height`.
  - P2: Add skip-link.

### public/blog/extra-300l-samolot-akrobacyjny.html
- **Page weight:** 5 script tags (1 GTM + 2 external), 1 render-blocking stylesheet. Google Fonts **render-blocking**.
- **LCP/images:** Text-only. Logo imgs missing `width`.
- **SEO basics:** Title 58 chars (good). Description 113 chars (short). **Canonical missing.** 2 JSON-LD blocks. OG complete.
- **A11y:** No skip-link.
- **Recommended fixes:**
  - P0: Add canonical. Fix Google Fonts async.
  - P1: Expand description to ~150 chars. Add logo dims.
  - P2: Add skip-link.

### public/blog/kurs-akrobacji-fcl800.html
- **Page weight:** 5 script tags (1 GTM + 3 external including `wa-tracker.js`), 1 render-blocking stylesheet. Google Fonts **render-blocking**.
- **LCP/images:** Text-only. Logo imgs missing `width`.
- **SEO basics:** Title 68 chars (over 60). Description 106 chars (short). **Canonical missing.** 1 JSON-LD block (Article only - missing BreadcrumbList). OG complete.
- **A11y:** No skip-link.
- **Recommended fixes:**
  - P0: Add canonical. Fix Google Fonts async.
  - P1: Trim title. Add BreadcrumbList JSON-LD. Expand description.
  - P2: Add skip-link.

### public/blog/figury-akrobacyjne.html
- **Page weight:** 5 script tags (1 GTM + 2 external), 1 render-blocking stylesheet. Google Fonts **render-blocking**.
- **LCP/images:** Text-only. Footer logo missing `width` on `logo-mark.png`.
- **SEO basics:** Title 68 chars (over 60). Description 165 chars (over 160). **Canonical missing.** 2 JSON-LD blocks (Article + FAQPage - good). OG complete.
- **A11y:** No skip-link.
- **Recommended fixes:**
  - P0: Add canonical. Fix Google Fonts async.
  - P1: Trim title and description.
  - P2: Add skip-link.

### public/blog/przeciazenia-g-force-lot.html
- **Page weight:** 5 script tags (1 GTM + 2 external), 1 render-blocking stylesheet. Google Fonts **render-blocking**.
- **LCP/images:** Text-only. Same logo `<img>` missing dims.
- **SEO basics:** Title 58 chars (good). Description 117 chars (acceptable). **Canonical missing.** 2 JSON-LD blocks (Article + FAQPage). OG complete.
- **A11y:** No skip-link.
- **Recommended fixes:**
  - P0: Add canonical. Fix Google Fonts async.
  - P1: Expand description slightly. Add logo dims.
  - P2: Add skip-link.

### public/blog/uprt-szkolenie-upset-recovery.html
- **Page weight:** 5 script tags (1 GTM + 2 external), 1 render-blocking stylesheet. Google Fonts **render-blocking**.
- **LCP/images:** Text-only. Logo missing dims.
- **SEO basics:** Title 71 chars (over 60). Description 117 chars (acceptable). **Canonical missing.** 2 JSON-LD blocks. OG complete.
- **A11y:** No skip-link.
- **Recommended fixes:**
  - P0: Add canonical. Fix Google Fonts async.
  - P1: Trim title. Add logo dims.
  - P2: Add skip-link.

### public/maciej-osiagniecia.html
- **Page weight:** 1 script tag (0 GTM, 0 external JS - **no tracking**), 1 render-blocking stylesheet. Google Fonts **render-blocking**. Has `<link rel="preload" href="/kula.webp" fetchpriority="high">`.
- **LCP/images:** Hero preload present and correct. No content images beyond hero.
- **CLS risks:** Google Fonts blocking.
- **SEO basics:** Title 64 chars (borderline). Description 151 chars (good). Canonical present. 1 JSON-LD block (Person schema). OG complete (uses `kula.jpg` as OG image - unique, good). Missing `BreadcrumbList`.
- **A11y:** No skip-link.
- **Recommended fixes:**
  - P0: **Add GTM tag** (no tracking = zero conversion data for show organizer page). Fix Google Fonts async.
  - P1: Add BreadcrumbList JSON-LD. Add skip-link.
  - P2: Trim title slightly.

---

## Site-wide patterns (issues on 5+ pages)

1. **Google Fonts render-blocking (19/20 pages)** - `<link href="https://fonts.googleapis.com/css2?..." rel="stylesheet">` without `media="print"` blocks rendering. Only `lot-akrobacyjny.html` has fixed this. One template change fixes all pages.
2. **No skip-link (18/20 pages)** - Only `index.html` and `lot-akrobacyjny.html` have skip navigation. Low implementation cost, WCAG 2.1 AA required.
3. **Missing `<link rel="canonical">` on 9 pages** - All 7 blog posts under `/blog/` plus `blog.html` and `sklep-merch.html`. GSC will flag these as missing or may pick the wrong canonical.
4. **`brand.css` loaded at bottom of `<head>` (all pages)** - Injected after a large inline `<style>` block at `</head>`. Parser-blocking but at least in `<head>`, not body. Could be preloaded.
5. **Nav logo `<img>` missing `width` attr on several pages** - `sponsoring.html`, `pokazy-lotnicze.html`, and all 7 blog posts use `height` only on logo mark, creating minor CLS.
6. **Meta titles over 60 chars (8 pages)** - `index.html` (83), `dotacje` (78), `prezent-na-urodziny` (75), `lot-akrobacyjny` (70), `sponsoring` (71), `lot-akrobacyjny-warszawa` (72), `uprt` (71), `figury` (68), `kurs-fcl800` (68).
7. **No hero image preload on 5 pages** - `dotacje`, `sponsoring`, `pokazy-lotnicze`, `camp-akrobacyjny`, `blog.html` - all use CSS background images with no `<link rel="preload">`.
8. **No GTM on 2 high-intent pages** - `prezent-na-urodziny.html` and `maciej-osiagniecia.html` fire zero analytics events, meaning revenue from birthday-gift traffic and show-organizer contacts is unattributed.
9. **JSON-LD missing on low-content pages** - `blog.html` (0 blocks), `sklep-merch.html` (Store only, no Product schema on the index), `kalendarz.html` (LocalBusiness only, no Event).
10. **`speks-flight.jpg` (10 MB) still in public/** - `.webp` exists (134 KB) and is used in CSS backgrounds, but the raw `.jpg` is an accident waiting to happen if any page accidentally references it.

---

## Top 10 highest-ROI fixes

| # | Fix | Pages affected | Impact |
|---|-----|---------------|--------|
| 1 | Switch Google Fonts to `media="print" onload="this.media='all'"` + `<noscript>` fallback | 19 | LCP -200–400ms on every page, eliminates render-blocking resource warning |
| 2 | Add GTM to `prezent-na-urodziny.html` and `maciej-osiagniecia.html` | 2 | Restores conversion tracking on birthday-gift and airshow-organizer traffic |
| 3 | Add `<link rel="canonical">` to all 7 `/blog/` posts + `blog.html` + `sklep-merch.html` | 9 | Prevents GSC canonical confusion; protects blog SEO equity |
| 4 | Add `<link rel="preload" as="image" fetchpriority="high">` for hero background on `dotacje`, `sponsoring`, `pokazy`, `camp` | 4 | LCP improvement on money pages |
| 5 | Add `width`/`height` attrs (or `aspect-ratio` CSS) to Maps `<iframe>` in `lot-akrobacyjny.html` | 1 | Eliminates iframe CLS on the highest-traffic page |
| 6 | Trim `<title>` tags to ≤60 chars on 8 over-limit pages | 8 | CTR improvement; avoids Google rewriting titles |
| 7 | Add `width`/`height` to nav logo `<img>` on blog posts and secondary pages | 7 | Eliminates minor CLS on nav during font load |
| 8 | Add `aria-label` to modal close buttons (`×`) and purchase CTA buttons site-wide | 12+ | WCAG 2.1 AA compliance; screen reader usability |
| 9 | Add skip-link to all pages missing it (copy pattern from `index.html`) | 18 | WCAG 2.1 AA compliance; one-line HTML change per page |
| 10 | Add `CollectionPage` JSON-LD to `blog.html` and `Product` schema to `sklep-merch.html` | 2 | Rich results eligibility; GSC schema coverage |
