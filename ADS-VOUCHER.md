# Google Ads + Meta + Multi-channel — Vouchery akrobacja.com

Gotowy zestaw pod kopiuj-wklej do Google Ads / Meta. Landing: **`https://akrobacja.com/voucher-prezent`**.

---

## 0. STATUS — co już skonfigurowane (stan na 2026-04-16)

### W kodzie (deployed na produkcję):

| Funkcja | Status | Plik |
|---------|--------|------|
| Landing `/voucher-prezent` (no nav, jeden CTA) | ✅ Live | `public/voucher-prezent.html` |
| Landing `/test-konwersji` (1 zł produkt testowy, noindex) | ✅ Live | `public/test-konwersji.html` |
| Product schema na `/lot-akrobacyjny` (sku, aggregateRating, shippingDetails) | ✅ Live | `public/lot-akrobacyjny.html` |
| GMC feed `merchant-feed.xml` (3 vouchery, RSS 2.0 g:) | ✅ Live | `public/merchant-feed.xml` |
| Google Ads `gtag.js` z **AW-928813824** (hardcoded) | ✅ Live | `functions/_middleware.ts` |
| Google Ads conversion label **3g00CNLcnZwcElCm8roD** „Zakup Vouchera" (hardcoded) | ✅ Live | `functions/_middleware.ts` |
| Consent Mode v2 (defaults DENIED w EU/PL) + banner cookies | ✅ Live | `public/assets/consent-banner.js` |
| E-commerce events (view_item_list, begin_checkout, purchase) | ✅ Live | `public/assets/ecommerce-events.js` |
| Enhanced Conversions (sessionStorage email/imie → user_data) | ✅ Live | `functions/_middleware.ts` |
| Meta Pixel (client-side, warunkowy z env META_PIXEL_ID) | ⚙️ Code ready, **czeka na env vars** | `functions/_middleware.ts` |
| Meta Conversions API (server-side z webhook Stripe) | ⚙️ Code ready, **czeka na env vars** | `src/lib/meta-capi.ts` |
| Abandoned cart recovery + kod WRACAM5 (-5%) | ✅ Live | `functions/api/cron/abandoned-checkouts.ts` |
| Stripe `cancel_url` mapowany przez body.source (Stripe Back wraca tam skąd przyszedł) | ✅ Live | `functions/api/checkout.ts` |
| Email regex validation w checkout API | ✅ Live | `functions/api/checkout.ts` |
| D1 migration: `abandon_email_sent_at` + `discount_code` | ✅ Applied (2026-04-16) | `migrations/002-abandoned-checkout.sql` |

### Czeka na user-action:

| Akcja | Gdzie | Krytyczność | Sekcja |
|-------|-------|-------------|--------|
| 🔴 **Zweryfikuj domenę akrobacja.com w Resend** | `resend.com/domains` + DNS w Cloudflare | KRYTYCZNE — wszystkie maile (vouchery PDF, abandoned cart, welcome, owner notif.) | §15 „Resend domain verify" |
| 🟡 GA4 property + Measurement ID → env `GA_MEASUREMENT_ID` | Cloudflare Pages env vars | Wysoka — bez tego brak danych w GA4 | §8 |
| 🟡 Meta Pixel ID + CAPI Token → env `META_PIXEL_ID`, `META_CAPI_TOKEN` | Cloudflare Pages env vars | Wysoka — bez tego brak Meta tracking | §14 |
| 🟢 Cron job dla `/api/cron/abandoned-checkouts` (co 1h) | cron-job.org / GitHub Actions | Średnia — bez tego brak recovery email | §15 |
| 🟢 Utworzyć 7 remarketing audiences | Google Ads → Audience Manager | Średnia — bez tego brak retargetingu | §11 |
| 🟢 Odpalić kampanie (Search Generic, PMax, Search Prezent) | Google Ads → Campaigns | Średnia — kanał akwizycji | §2, §6 |
| ⚪ Cleanup śmieciowych orderów testowych | wrangler CLI | Niska | §16 |

---

## 1. Struktura kont

**3 kampanie równolegle:**

| # | Typ | Cel | Budżet start | Bidding |
|---|-----|-----|--------------|---------|
| 1 | Search — Generic | Intent „voucher lot akrobacyjny" | 50 zł/dzień | Max Conversions (po 20 konwersjach → tCPA 150 zł) |
| 2 | Search — Prezent | Intent „prezent dla faceta / szefa / taty" | 40 zł/dzień | Max Conversions |
| 3 | Performance Max | Rozszerzenie: Shopping + YouTube + Discover + Display | 60 zł/dzień | Max Conversion Value (tROAS 400%) |

Total start: **150 zł/dzień** (~4 500 zł/mies.). Przy CPC 3–6 zł, CVR 2–4% i AOV 2 500 zł — ROAS oczekiwany 4–8x.

---

## 2. Responsive Search Ads — Kampania „Generic"

**Final URL:** `https://akrobacja.com/voucher-prezent?utm_source=google&utm_medium=cpc&utm_campaign=voucher-generic&utm_content={adgroupid}&utm_term={keyword}`

**Display Path:** `akrobacja.com / voucher-prezent`

### Headlines (15 — wklej wszystkie):

```
Voucher na Lot Akrobacyjny
Prezent, Którego Nie Zapomni
Lot Akrobacyjny Extra 300L
Voucher PDF w 3 Minuty
Od 1999 zł — Płatność Online
Pilot z 3 000+ h Doświadczenia
Ważny 12 Miesięcy
Mistrz Polski w Akrobacji
Samolot Extra 300L SP-EKS
Prezent Dla Faceta, Który Ma Wszystko
187 Opinii · 4.9/5
PDF Natychmiast w Mailu
Bez Doświadczenia Lotniczego
Lotnisko Radom · 1h z Warszawy
Gwarancja Zwrotu 14 Dni
```

### Descriptions (4 — wszystkie):

```
Voucher PDF na lot akrobacyjny Extra 300L. W mailu w kilka minut, ważny 12 miesięcy. Płatność online — Blik, karta, P24.
Pilot o 3 000+ h doświadczenia. Figury do +6G w certyfikowanym Extra 300L. 187 weryfikowanych opinii — 4.9/5.
Prezent, którego nie zapomni nigdy. Zero planowania — kupujesz, dostajesz PDF, on sam umawia lot. Gwarancja 14 dni.
Od 1999 zł za 15 min do 4999 zł za Masterclass z Mistrzem Polski. Faktura VAT dla firm. Radom, 1h z Warszawy.
```

---

## 3. Responsive Search Ads — Kampania „Prezent"

**Final URL:** `https://akrobacja.com/voucher-prezent?utm_source=google&utm_medium=cpc&utm_campaign=voucher-gift`

### Headlines (15):

```
Prezent Dla Faceta Który Ma Wszystko
Oryginalny Prezent Dla Niego
Prezent Na 30-tkę / 40-tkę / 50-tkę
Prezent Dla Szefa, Który Zapamięta
Prezent Dla Taty — Coś Prawdziwego
Voucher Lot Akrobacyjny
Ekstremalny Prezent Dla Mężczyzny
Prezent Firmowy Dla Kontrahenta
Prezent Na Urodziny Faceta
PDF w Mailu w 3 Minuty
Nie Krawat. Lot Akrobacyjny.
Prezent Który Opowiada Latami
Idealny Prezent Ślubny / Kawalerski
Prezent Na Dzień Ojca
Od 1999 zł · Voucher 12 Miesięcy
```

### Descriptions (4):

```
Koniec z krawatami. Kup voucher na lot akrobacyjny — PDF natychmiast, ważny rok. Od 1999 zł. On sam umawia termin.
Prezent firmowy dla kontrahenta? Faktura VAT, elegancki PDF, zero logistyki. 187 opinii 4.9/5 — sprawdzony.
Na 30, 40, 50-tkę. Kawalerski. Dzień Ojca. Komunia. Lot akrobacyjny Extra 300L to wspomnienie na lata — nie przedmiot.
Wielokrotny Mistrz Polski, 3 000+ h w powietrzu, certyfikowany samolot do +10G. Bezpieczeństwo to procedura, nie slogan.
```

---

## 4. Keywords

### Exact match (najpewniejsze intencje — CPC 3–6 zł):

```
[voucher lot akrobacyjny]
[voucher na lot akrobacyjny]
[lot akrobacyjny prezent]
[prezent lot akrobacyjny]
[voucher samolot prezent]
[lot samolotem akrobacyjnym prezent]
[voucher na lot samolotem]
[lot akrobacyjny voucher]
[voucher extra 300]
[lot akrobacyjny dla faceta]
```

### Phrase match (szerzej — CPC 2–5 zł):

```
"voucher lot akrobacyjny"
"lot akrobacyjny prezent"
"prezent lot samolotem"
"ekstremalny prezent"
"prezent dla faceta lot"
"voucher lotniczy"
"voucher na lot"
"prezent dla szefa lot"
"lot akrobacyjny Warszawa"
"lot akrobacyjny Radom"
"lot akrobacyjny Kraków"
```

### Broad match (testowo, z bid modifier -30% i uważnie czytać search terms):

```
prezent dla mężczyzny
oryginalny prezent
prezent na 40 urodziny
prezent firmowy dla kontrahenta
lot akrobacyjny
```

---

## 5. Negative keywords (WAŻNE — wklej wszystkie)

Oszczędzą ~30–40% budżetu, blokując irrelewantne kliki:

```
-darmowy
-free
-za darmo
-praca
-symulator
-gra
-game
-gta
-paralotnia
-paralotnie
-skoki
-spadochron
-bungee
-tandem
-balon
-śmigłowiec
-helikopter
-szybowiec
-samolot rc
-modelarstwo
-model
-zabawka
-dziecko
-dzieci
-symulator lotu
-lot samolotem pasażerskim
-linie lotnicze
-bilet lotniczy
-tanie loty
-loty rejsowe
-wynajem samolotu
-szkolenie pilota
-licencja pilota
-ppl
```

Dla „firmowy" i „integracja" kampanii — dodatkowo:
```
-pracownik
-rekrutacja
-cv
-oferta pracy
```

---

## 6. Performance Max — konfiguracja

**Final URL expansion:** `ON`
**URL contains:** `akrobacja.com/voucher-prezent`

**Asset Group: „Voucher Prezent"**
- **Images:** `/samolot-top-web.webp`, `/cockpit-closeup.webp`, `/hero-takeoff.webp`, `/mamcarz.webp`, `/speks-flight.webp`, `/speks-city.webp` + 3–5 dodatkowych 1:1 do zrobienia (minimum 5 różnych orientacji)
- **Logo:** `/akrobacja-logo.png`, `/akrobacja-logo-mark.png`
- **Video:** YouTube `SlSr4NH2ftQ` (już używane na `/`)
- **Headlines:** te same co z „Generic" powyżej
- **Long headlines (3):**
  - `Voucher na Lot Akrobacyjny Extra 300L — Prezent PDF od 1999 zł`
  - `Prezent Dla Niego, Który Zapamięta Na Zawsze — Lot z Mistrzem Polski`
  - `Lot Akrobacyjny w Prezencie. PDF w Mailu w 3 Minuty. Ważny 12 Miesięcy.`
- **Descriptions:** te same co z „Generic"
- **Call to action:** `Kup teraz` / `Shop now`

**Audience signals:**
- Custom: „luxury gift buyers", „aviation enthusiasts", „adrenaline sports"
- In-market: `Travel > Air Travel`, `Gifts & Special Event Items`
- Affinity: `Adventure Travelers`, `Luxury Shoppers`

**Wykluczenia w Campaign Settings:**
- Exclude brand from Shopping (żeby nie licytować się na własną markę — robi to Search Brand)
- Placement exclusions: apps (gry), YouTube kids

---

## 7. UTM preset (kopiuj do Final URL Suffix na poziomie konta)

```
utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_content={adgroupid}&utm_term={keyword}&gclid={gclid}
```

Dla Meta (FB/IG):
```
utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&fbclid={{fbclid}}
```

---

## 8. Konwersje — konfiguracja Google Ads / GA4

### Stan aktualny (już skonfigurowane):

- ✅ Google Ads tag **AW-928813824** — hardcoded fallback w `functions/_middleware.ts`
- ✅ Conversion action **„Zakup Vouchera"** label `3g00CNLcnZwcElCm8roD` — hardcoded fallback
- ✅ Conversion event firuje na `/sukces?code=X&amount=Y&pkg=Z` przez middleware
- ✅ Zweryfikowane Tag Assistantem (2026-04-15)

### Co jeszcze (opcjonalne, podnosi jakość danych):

**GA4 Property** — bez tego nie zobaczysz danych w analytics.google.com:
1. `analytics.google.com` → Admin → Create Property → `akrobacja.com` → Web stream → skopiuj **Measurement ID** (`G-XXXXXXXXXX`)
2. Cloudflare Pages → Settings → Environment Variables (Production):
   ```
   GA_MEASUREMENT_ID = G-XXXXXXXXXX
   ```
3. Redeploy (push pusty commit albo Retry deployment z dashboard)
4. Admin → Product Links → Google Ads → Link → wybierz konto Ads (ID 928813824)
5. Włącz Enhanced Conversions w Google Ads: Tools → Conversions → Zakup Vouchera → Enhanced conversions ON → metoda: „Google tag"

### Override w razie potrzeby

Jeśli potrzebujesz **innego** Google Ads tagu lub label (np. nowy konto, refactor):
```
GOOGLE_ADS_ID            = AW-XXXXXXXXX        # nadpisuje 928813824
GOOGLE_ADS_PURCHASE_LABEL = XXXXXXXXXXXXXX     # nadpisuje 3g00CNLcnZwcElCm8roD
```

### Weryfikacja

1. **Tag Assistant (Chrome)** → wejdź na `/sukces?code=AKR-TEST-TEST&amount=1999&pkg=pierwszy_lot` → kliknij „Zgoda na wszystkie" w cookie banner → Tag Assistant powinien pokazać konwersję `Zakup Vouchera` jako wykryta
2. **Google Ads → Conversions** → Status powinien być `Recording conversions` (po ~30 min od pierwszego eventu)
3. **DevTools → Network → filter `google.com`** → szukaj request do `pagead/conversion/928813824/` (po consent grant)

---

## 9. Sezonowość — agresywniej w tych okresach

| Okres | Dlaczego | Akcja |
|-------|----------|-------|
| **1–15 czerwca** | Dzień Ojca (26.06 de facto start poszukiwań) | Budżet ×1.5, headline „Prezent Na Dzień Ojca" |
| **15 paźdź. – 20 grud.** | Mikołaj, święta, prezenty korpo | Budżet ×2.0, landing z timerem „PDF w mailu przed Wigilią" |
| **1 lut. – 14 lut.** | Walentynki | Headline „Dla Niej/Niego — Coś Innego Niż Kwiaty" |

W martwym sezonie (styczeń, luty, sierpień) → redukcja budżetu do 40%, skupiamy się na PMax + remarketing.

---

## 10. Quick checklist przed odpaleniem

- [x] Google Ads konto + Conversion „Zakup Vouchera" (AW-928813824 / `3g00CNLcnZwcElCm8roD`)
- [x] Tag Assistant verified (2026-04-15)
- [x] Cookie consent banner + Consent Mode v2
- [x] Landing `/voucher-prezent` + `/test-konwersji` (1 zł test)
- [ ] **Resend domain `akrobacja.com` zweryfikowana** (KRYTYCZNE — wszystkie maile zależą)
- [ ] Google Merchant Center + feed `https://akrobacja.com/merchant-feed.xml` (24–72h)
- [ ] GA4 property + Measurement ID w env (`GA_MEASUREMENT_ID`)
- [ ] Cron job dla `/api/cron/abandoned-checkouts` (cron-job.org)
- [ ] Remarketing audiences (§ 11)
- [ ] Meta Pixel ID + CAPI Token w env (`META_PIXEL_ID`, `META_CAPI_TOKEN`) → § 14
- [ ] Pierwsza kampania odpalona: Search Generic 40 zł/dzień + PMax 50 zł/dzień (§ 12 day 1)

---

## 11. Remarketing audiences — utwórz wszystkie w Google Ads

Google Ads → **Tools → Audience manager → Data segments → New → Website visitors**

Kod wstrzykuje już `user_properties.page_type` (home / voucher_landing / product_page / blog / purchase_confirmation) oraz eventy `view_item_list`, `begin_checkout`, `purchase`. Poniższe listy oprą się na tych sygnałach.

### Lista 1: „Voucher — Cart Abandoners" (priorytet #1 — największy ROI)

| Pole | Wartość |
|------|---------|
| Typ | Website visitors |
| Include | Event `begin_checkout` w ciągu 30 dni |
| Exclude | Event `purchase` w ciągu 30 dni |
| Membership duration | 30 dni |

**Użycie:** Osobna kampania **Search — Remarketing Cart Abandoners** z bid +50%, headline „Dokończ zakup vouchera — PDF w 3 minuty", oferta rabatu 5% (kod `WRACAM5` przez webhook Stripe coupon albo manualna obsługa).

### Lista 2: „Voucher Viewers — All"

| Pole | Wartość |
|------|---------|
| Include | `page_type` equals `voucher_landing` OR `product_page` |
| Duration | 60 dni |

**Użycie:** PMax audience signal, Display remarketing.

### Lista 3: „Voucher Viewers — 7-day Hot"

| Pole | Wartość |
|------|---------|
| Include | `page_type` equals `voucher_landing` OR `product_page` |
| Duration | 7 dni |

**Użycie:** Najintensywniejszy retargeting (wyższe stawki, +80% bid), cały Display + YouTube preroll.

### Lista 4: „Blog Readers — Cross-Sell"

| Pole | Wartość |
|------|---------|
| Include | `page_type` equals `blog` |
| Exclude | `page_type` equals `purchase_confirmation` |
| Duration | 90 dni |

**Użycie:** Miękka kampania Display z USP voucherem — czytali o akrobacji, nie kupili. Bid -30%.

### Lista 5: „Past Purchasers — Repeat/Cross-Sell"

| Pole | Wartość |
|------|---------|
| Include | Event `purchase` |
| Duration | 540 dni (18 mies.) |

**Użycie:**
- **Exclude** z kampanii akwizycyjnych (Search Generic, PMax) — żeby nie płacić za klientów ponownie
- **Include** w kampanii „Następny lot" (po 6 miesiącach) z headline „Dla niego było za mało? Masterclass czeka"

### Lista 6: „Gift Intent — High Value"

| Pole | Wartość |
|------|---------|
| Include | Event `begin_checkout` WHERE `value >= 2999` |
| Exclude | `purchase` |
| Duration | 60 dni |

**Użycie:** Ludzie którzy chcieli kupić Adrenalinę lub Masterclass — tu bid ×2.5, oferta „zadzwoń a pomożemy" w kreacji.

### Lista 7: „Kalendarz/Pokazy Visitors"

| Pole | Wartość |
|------|---------|
| Include | `page_type` equals `calendar` OR `shows` |
| Duration | 30 dni |

**Użycie:** Ciepły leads — zainteresowani terminami, być może nie wiedzieli o voucherze. Display z USP „nie wiesz kiedy? daj voucher".

---

## 12. Plan Day 1–30 — uruchamianie krok po kroku

### Dzień 1 (dziś, po konfiguracji konwersji):
- [ ] Test `/sukces?code=AKR-TEST-TEST&amount=1999&pkg=pierwszy_lot` w Tag Assistant → potwierdź purchase + conversion
- [ ] Włącz **Search Generic** — budżet 40 zł/dzień, Max Clicks (bez Max Conversions dopóki 0 konwersji)
- [ ] Włącz **PMax** — budżet 50 zł/dzień, Max Conversion Value (bez tROAS dopóki brak danych)
- [ ] Utwórz wszystkie 7 audiences (§ 11) — potrzebują 30 członków żeby się aktywować

### Dzień 3–7:
- [ ] Audit search terms w Search Generic — dodaj co najmniej 10 negatives do listy
- [ ] Sprawdź że audiences się budują (Tools → Audience Manager → widok Size)
- [ ] PMax — dostosuj Asset Group: usuń headliny z CTR < 1%, dodaj nowe warianty

### Dzień 7–14:
- [ ] Po 10–15 konwersjach → przełącz Search Generic na **Max Conversions** (automatyczne stawki)
- [ ] Włącz **Search Remarketing Cart Abandoners** — budżet 20 zł/dzień, bid +50%
- [ ] Włącz **Search Prezent** (tylko jeśli budżet na to pozwala)

### Dzień 14–21:
- [ ] Po 20–30 konwersjach → przełącz na **tCPA 150 zł** (Search) i **tROAS 400%** (PMax)
- [ ] Enhanced Conversions w Google Ads → sprawdź coverage (powinno być > 70% po 2 tygodniach)
- [ ] Porównaj Conversion Paths w GA4 — który kanał ile daje

### Dzień 21–30:
- [ ] Skalowanie: najlepsza kampania — budżet ×2
- [ ] Ucinamy najsłabszą o 50% lub pauzujemy
- [ ] Tworzymy kreację wideo z YouTube `SlSr4NH2ftQ` (16:9, 9:16, 1:1) — dodajemy do PMax
- [ ] Jeśli CAC < 400 zł przy AOV 2500 zł → dokładamy budżet, odpalamy **Demand Gen** campaign

### Kryteria sukcesu po 30 dniach:
- ROAS ≥ 4x (tzn. 1 zł → 4 zł przychodu)
- CAC ≤ 500 zł
- Min. 20 konwersji (daje podstawę do pełnej automatyzacji bid)
- Min. 5 list remarketingowych aktywnych (size > 1000)

---

## 13. Enhanced Conversions — co się dzieje pod spodem

Kod automatycznie:
1. **Checkout form submit** (w `voucher-prezent.html` lub `lot-akrobacyjny.html`) → `ecommerce-events.js` zapisuje email + imię do `sessionStorage` (klucz `akro_checkout_info`)
2. **Redirect do Stripe** → użytkownik płaci
3. **Redirect na `/sukces?code=X&amount=Y&pkg=Z`** → middleware wstrzykuje skrypt który:
   - Czyta `sessionStorage.akro_checkout_info`
   - Wysyła `gtag('set', 'user_data', { email, address: { first_name, last_name } })` — Google hashuje to lokalnie (SHA-256)
   - Dopiero potem odpala `gtag('event', 'purchase', …)` i `gtag('event', 'conversion', …)`
   - Czyści sessionStorage

**Efekt:** Atrybucja wzrasta o 10–15%, bo Google potrafi połączyć zakup z adwords-clikiem nawet gdy cookie GCLID zostało stracone (inne urządzenie, ITP, browser clean).

Weryfikacja po 2 tygodniach: Google Ads → Conversions → Purchase → **Enhanced conversions** tab → powinieneś widzieć coverage > 70%.

---

## 14. Meta Ads (FB/IG) — Pixel + Conversions API

Kod już wszystko wstrzykuje automatycznie po podpięciu ID. Dwa kanały danych:
- **Pixel (client-side)** — śledzi w przeglądarce, blokowany przez iOS 14+ ATT i blokery (~35–40% strat)
- **CAPI (server-side)** — wysyłka z webhooka Stripe, niezależna od przeglądarki → odzyskuje te stracone ~40%

Obie strony używają **tego samego `event_id`** (`purchase_{voucherCode}`) → Meta automatycznie deduplikuje, nie liczy podwójnie.

### Krok 1 — Business Manager
1. `business.facebook.com` → utwórz Business Account (jeśli nie masz)
2. Events Manager → **Connect Data Sources → Web → Pixel** → nazwa „akrobacja.com" → skopiuj **Pixel ID** (15-16 cyfr)

### Krok 2 — Token CAPI
1. Events Manager → Settings → **Conversions API → Generate access token**
2. Skopiuj token (rozpoczyna się od `EAA…`, długi)
3. **Zachowaj bezpiecznie** — nie commituj do repo

### Krok 3 — Env Vars w Cloudflare Pages
Settings → Environment Variables (Production):

```
META_PIXEL_ID       = 1234567890123456
META_CAPI_TOKEN     = EAAxxxxxxxxxxxxxx…
```

**Opcjonalnie (do testów):**
```
META_TEST_EVENT_CODE = TEST12345
```
Przy tym evencie CAPI pokazuje się w Events Manager → Test Events tab (nie trafia do audiences). Usuń po weryfikacji.

→ Redeploy Pages (kolejny push albo manualny).

### Krok 4 — Weryfikacja
1. Incognito → `https://akrobacja.com/voucher-prezent` → kliknij „Kup voucher"
2. Events Manager → **Test Events** (jeśli ustawiłeś test code) → powinieneś zobaczyć:
   - `PageView` (client)
   - `ViewContent` (client, kategoria Voucher)
   - `InitiateCheckout` (client, value=2999 PLN)
3. Rzeczywisty zakup → `Purchase` event z **dwoma źródłami: Browser + Server**, dedupe status: `Deduplicated`

### Krok 5 — Kampanie Meta

**Struktura:**

| Kampania | Cel | Budżet start | Audience |
|----------|-----|--------------|----------|
| Meta — Advantage+ Shopping | Sales / Purchase | 30 zł/dzień | AI pełny auto (feed GMC jeśli podpięty, w przeciwnym razie landing /voucher-prezent) |
| Meta — Retargeting Cart Abandon | Sales / Purchase | 20 zł/dzień | Custom Audience: `InitiateCheckout` minus `Purchase` 30d |
| Meta — Lookalike | Sales / Purchase | 30 zł/dzień | 1% Lookalike od Purchase audience (po ≥ 50 konwersjach) |

**Kreacje (3 warianty po 1080×1080 i 1080×1920):**

1. **Emocjonalny** — zdjęcie z lotu / hero takeoff + text overlay „Prezent, którego NIE ZAPOMNI"
2. **Produktowy** — kokpit + 3 pakiety z cenami „Voucher od 1999 zł · PDF w mailu"
3. **Video** — clip z YouTube `SlSr4NH2ftQ` (first 15s) + CTA „Kup voucher →"

**Primary text (body):**
```
Kup voucher na lot akrobacyjny Extra 300L.
PDF w mailu w kilka minut. Ważny 12 miesięcy.
Pilot z 3 000+ h doświadczenia — 187 opinii 4.9/5.

Od 1999 zł. Zero logistyki. Ty kupujesz, on leci.
```

**Headline:** `Lot Akrobacyjny Extra 300L · Voucher PDF`
**Description:** `Idealny prezent dla faceta. Od 1999 zł.`
**CTA:** `Shop Now` (Sklep teraz)
**URL:** `https://akrobacja.com/voucher-prezent?utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}`

### Krok 6 — Custom Audiences Meta (odpowiedniki Google)

Events Manager → Audiences → Create → Custom Audience → Website:

- **Cart Abandoners** — „People who triggered `InitiateCheckout`" in last 30d, EXCLUDE „People who triggered `Purchase`" in last 30d → duration 30d
- **Voucher Viewers All** — `ViewContent` gdzie `content_category = Voucher`, duration 60d
- **Hot Viewers** — wszyscy co byli na `/voucher-prezent` w 7d
- **Blog Readers** — URL contains `/blog/`, duration 90d, EXCLUDE Purchase
- **Past Purchasers** — `Purchase`, duration 180d (exclude z akwizycji, include w cross-sell)

**Lookalike** (po ≥ 50 konwersjach):
- 1% LAL od Past Purchasers (PL) — najciasniejszy, najlepszy do skalowania
- 1–3% LAL od Cart Abandoners (backup)

### Krok 7 — Share of budget

Po 30 dniach z danymi:

| Kanał | Przy ROAS 4x+ | Przy ROAS 2–4x | Przy ROAS < 2x |
|-------|---------------|----------------|-----------------|
| Google Search + PMax | 60% budżetu | 50% | 40% |
| Meta (FB/IG) | 30% | 35% | 20% |
| Remarketing (wszędzie) | 10% | 15% | 40% (ratujemy co się da) |

### Dlaczego CAPI jest kluczowe dla akrobacji:

1. **iOS 14.5+ ATT** — ~40% userów blokuje Pixel. CAPI to omija.
2. **Długa ścieżka konwersji** — voucher 2500 zł to nie impuls. Średnio 3–7 wizyt w 7 dniach. Pixel traci cookie pomiędzy wizytami, CAPI łączy przez email/imię.
3. **Mobile-first** — 70% ruchu z urządzeń mobilnych (IG Reels). iOS ogranicza przeglądarkowe śledzenie bardziej niż Android.
4. **Dedup** — dzięki `event_id` Meta łączy Browser + Server event w jeden → poprawia Event Match Quality (EMQ).

Cel: **EMQ > 7.5** (Events Manager → Overview → Event Match Quality). Poniżej 6.5 → sprawdź, czy CAPI wysyła `em`, `fn`, `ln`, `country`.

### Dlaczego nie Pixel sam, bez CAPI:

Bez CAPI mobilne zakupy z iOS są niewidoczne dla algorytmu → kampanie się „zamykają" (algorytm optymalizuje pod widocznych konwertów, pomija segmenty). Z CAPI ujawniają się → skalują się lepiej i taniej o 20–35%.

---

## 15. Abandoned Cart Recovery — auto-mail z rabatem 5%

### Jak działa

1. Klient wypełnia formularz w modalu, klika „Przejdź do płatności" → `/api/checkout` tworzy order ze statusem `pending`, redirect do Stripe
2. Klient **nie kończy** płatności (zamknął kartę, zmienił zdanie, rozproszył się)
3. Po **1h od rozpoczęcia** i w oknie **do 48h** cron wywołuje `/api/cron/abandoned-checkouts`:
   - Znajduje wszystkie `orders.status='pending'` bez `abandon_email_sent_at`
   - Wysyła premium mail z kodem **`WRACAM5`** (−5%)
   - Zapisuje `abandon_email_sent_at = NOW()` → idempotentnie, nie wysyła drugi raz
4. Klient klika link w mailu → `/voucher-prezent?pkg=X&discount=WRACAM5` → modal otwiera się z auto-wpisanym kodem i widoczną przekreśloną ceną bazową
5. Klient kończy → nowy order ze statusem `pending`, po zapłacie → `purchase` + conversion (Google Ads/Meta), oryginalny order zostaje z `status='pending'` w D1 (śmieci, ale nieszkodliwe)

### Konfiguracja cron (zewnętrzny scheduler — pick one)

**Opcja A: cron-job.org (darmowe, 1 min setup)**
1. `cron-job.org` → Register → Create cronjob
2. URL: `https://akrobacja.com/api/cron/abandoned-checkouts`
3. Schedule: `Every 1 hour`
4. Success criteria: HTTP 200 (response zawiera `ok:true`)
5. Notifications: email gdy failure > 3 razy

**Opcja B: GitHub Actions**
Utwórz `.github/workflows/abandoned-cart-cron.yml`:
```yaml
name: Abandoned Cart Recovery
on:
  schedule:
    - cron: '15 * * * *'  # co godzinę, 15 min po pełnej
  workflow_dispatch:
jobs:
  trigger:
    runs-on: ubuntu-latest
    steps:
      - run: curl -sSf -X POST https://akrobacja.com/api/cron/abandoned-checkouts
```

**Opcja C: Cloudflare Cron Trigger** (wymaga osobnego Worker — nie Pages) — tylko jak już masz. Cloudflare Pages Functions nie obsługują cronów natywnie.

### Weryfikacja po deployu

1. Utwórz testowy order: wejdź na `/voucher-prezent`, kliknij „Kup voucher", wypełnij dane, kliknij „Przejdź do płatności", **zamknij Stripe checkout przed płatnością**
2. W D1 (Cloudflare Dashboard → D1 → akrobacja-db) sprawdź:
   ```sql
   SELECT id, customer_email, status, created_at FROM orders WHERE status='pending' ORDER BY created_at DESC LIMIT 5;
   ```
3. Poczekaj 1h (albo zmień `created_at` ręcznie w D1 na datę sprzed 2h — `UPDATE orders SET created_at = datetime('now', '-2 hours') WHERE id = '...'`)
4. Wywołaj ręcznie: `curl https://akrobacja.com/api/cron/abandoned-checkouts`
5. Sprawdź inbox — powinien przyjść mail „Dokończ zakup ze zniżką 5%"
6. W D1:
   ```sql
   SELECT id, abandon_email_sent_at FROM orders WHERE abandon_email_sent_at IS NOT NULL;
   ```

### Rozbudowa — kolejne kroki (opcjonalne)

**Email sequence (3 etapy):**
- **T+1h** — pierwszy mail (−5%, obecny)
- **T+24h** — przypomnienie z social proof (opinie klientów, FOMO „187 osób kupiło w tym miesiącu")
- **T+48h** — last chance, podbijamy do −10% (`OSTATNIASZANSA10`), deadline 24h

Implementacja: dodać kolumnę `abandon_step INTEGER DEFAULT 0`, w cron endpointcie iterować steps jak w `welcome-emails.ts`. Expected uplift: +5–10 pp do recovery rate.

**SMS recovery (T+4h):**
Przez `SMSAPI_TOKEN` (już masz w env). Krótki: „Cześć! Twój voucher na lot akrobacyjny czeka — kod WRACAM5 (−5%) ważny 48h: akrobacja.com/voucher-prezent?discount=WRACAM5". Działa gdy checkout zbierze telefon (obecnie nie zbiera, trzeba dodać pole do modalu).

**Koszty i ROI (założenia branżowe):**
- Abandon rate voucherów na Stripe: ~60–70% (wysokie bo duża wartość + wymaga dojścia do karty)
- Recovery rate z 1 emailem z rabatem: ~10–15% z uciekinierów
- Przy 100 rozpoczętych checkoutach → ~65 ucieka → odzyskujemy ~7–10 → +14–20 tys. zł przychodu miesięcznie przy skali 100 checkoutów
- Koszt: ~0 zł (Resend free tier 3 000 maili/mies., Cron free, kod rabatowy 5% z 2500 zł = 125 zł per recovered sale)

### Kod rabatowy WRACAM5 — gdzie jest w systemie

- **Definicja:** `functions/api/checkout.ts` → const `DISCOUNTS = { WRACAM5: { pct: 5 } }`
- **Walidacja UI:** `public/voucher-prezent.html` → `DISCOUNTS` object, live preview przy każdej zmianie inputu
- **Auto-fill z URL:** `?discount=WRACAM5` automatycznie wpisuje się do inputu przy otwarciu
- **Stripe:** jeden line_item z totalAmount (zamiast 2) + opis „rabat 5% kod WRACAM5"
- **D1:** zapisuje się w kolumnie `orders.discount_code` — można analizować skuteczność:
  ```sql
  SELECT discount_code, COUNT(*) as orders, SUM(amount)/100 as revenue_pln
  FROM orders
  WHERE status = 'paid' AND discount_code IS NOT NULL
  GROUP BY discount_code;
  ```

Aby dodać kolejny kod — np. `URODZINY10` na kampanię urodzinową — wystarczy jedna linia w `DISCOUNTS` (serwer + klient).

---

## 16. Test konwersji — produkt 1 zł „Naklejka testowa"

Dedykowany flow do weryfikacji **końcowej konwersji** z prawdziwą transakcją w Stripe live mode (tańsze niż voucher za 1999 zł).

### Gdzie

```
https://akrobacja.com/test-konwersji
```

Strona jest **noindex** (middleware), nie ma jej w sitemap, nie linkuje z nikąd. Dostęp tylko przez bezpośredni URL.

### Co dokładnie się dzieje

| Krok | Co | Co weryfikuje |
|------|-----|----------------|
| 1 | Wpisujesz email + imię → kliknij „Kup naklejkę za 1 zł" | Walidacja UI + email regex w `/api/checkout` |
| 2 | Redirect do Stripe Checkout (BLIK / karta / P24) | Stripe live mode + cancel_url poprawny |
| 3 | Płacisz 1 zł | Real money flow (sprawdzasz że Stripe nie blokuje) |
| 4 | Redirect na `/sukces?code=AKR-XXXX-YYYY&amount=1&pkg=test_naklejka` | Conversion event |
| 5 | Middleware fairuje na `/sukces`: `gtag('event','purchase')`, `gtag('event','conversion')` z label `3g00CNLcnZwcElCm8roD`, `fbq('track','Purchase')` z eventID dla dedup CAPI | Client-side tracking |
| 6 | Webhook Stripe (`/api/webhook`) → wykrywa `package_id='test_naklejka'` → SKIP voucher PDF + faktura wfirma + welcome email → tylko `UPDATE status='paid'` + `sendMetaPurchase` server-side CAPI | Server-side tracking + brak śmieciowych voucherów |

### Symulacja BEZ wydawania 1 zł (czysty test client-side)

Wejdź bezpośrednio (otwórz w incognito):

```
https://akrobacja.com/sukces?code=AKR-TEST-TEST&amount=1&pkg=test_naklejka
```

Odpala wszystkie client-side eventy (gtag conversion, GA4 purchase, Pixel Purchase). **Brak server-side CAPI** bo nie ma realnego webhook callbacku — ale do testu Tag Assistant wystarczy.

### Cleanup po testach

```bash
# Usuń wszystkie test_naklejka orders z bazy
wrangler d1 execute akrobacja-db --remote \
  --command="UPDATE orders SET status='cancelled' WHERE package_id='test_naklejka'"
```

Albo zostaw — pojawią się w stats jako 1 zł, więc nie zaszkodzą revenue, tylko będą zaśmiecać `paid_at` w D1.

### Bezpieczeństwo testu

- Strona `/test-konwersji` ma `<meta name="robots" content="noindex,nofollow">` (przez middleware)
- Brak linków do niej z publicznych stron
- Nie pojawia się w sitemap
- Webhook nie generuje PDF/faktury/email dla `test_naklejka` → zero śladów u klienta
- Twój zakup pójdzie też do Resend jako conversion email do owner (`dto@akrobacja.com`) — w treści zobaczysz „Voucher Naklejka testowa — 1.00 PLN"

### Kiedy używać

- ✅ Po każdej zmianie Conversion Action w Google Ads (label changed)
- ✅ Po dodaniu Meta Pixel + CAPI (sprawdza dedup eventID)
- ✅ Po włączeniu nowej kampanii (stress test pełnego stacku)
- ✅ Po zmianie env vars w Cloudflare Pages

---

## 17. Resend — weryfikacja domeny `akrobacja.com` (KRYTYCZNE)

Bez tego **żaden mail z systemu nie chodzi**:
- ❌ Vouchery PDF po zakupie (klient nie dostaje vouchera!)
- ❌ Owner notifications („nowe zamówienie" do `dto@akrobacja.com`)
- ❌ Welcome email sequence (3 maile po zapisie)
- ❌ Abandoned cart recovery (nasz nowy system rabatu WRACAM5)
- ✅ Działa tylko: maile do `pawel@mamcarz.com` (właściciel konta Resend — sandbox)

### Setup (10 min)

**1.** `resend.com/domains` → **Add Domain**:
- Domain: `akrobacja.com`
- Region: `eu-west-1` (Frankfurt — najbliżej PL)
- Click „Add"

**2.** Resend pokaże zestaw rekordów DNS — typowo:

| Type | Name | Value |
|------|------|-------|
| TXT | `send.akrobacja.com` | `v=spf1 include:amazonses.com ~all` |
| TXT | `resend._domainkey.akrobacja.com` | `p=MIGfMA0GCSqG…` (długi klucz publiczny RSA) |
| MX | `send.akrobacja.com` | `feedback-smtp.eu-west-1.amazonses.com` (priority 10) |
| TXT | `_dmarc.akrobacja.com` | `v=DMARC1; p=none;` (opcjonalne ale rekomendowane) |

**3.** Cloudflare Dashboard → `akrobacja.com` → **DNS** → **Add record** dla każdego:
- Type: jak w Resend
- Name: jak w Resend (Cloudflare doda automatycznie sufiks `.akrobacja.com`)
- Content/Target: jak w Resend
- **WAŻNE: wyłącz pomarańczową chmurkę (proxy)** dla rekordów Resend → kliknij ikonę → szara „DNS only"
- TTL: Auto

**4.** Wracaj na `resend.com/domains` → kliknij **Verify DNS Records** → status powinien się zmienić na ✅ Verified w 1–10 min (czasem do 1h)

**5.** Po weryfikacji nic w kodzie nie trzeba zmieniać — `FROM_EMAIL` w `welcome-emails.ts` i `abandoned-checkouts.ts` używa `dto@akrobacja.com` które działa od razu.

### Weryfikacja działania

```bash
# Wymuś re-run abandoned cart cron (powinien teraz wysłać te 2 maile co dotąd dawały 403)
curl -s https://akrobacja.com/api/cron/abandoned-checkouts | jq .

# Powinno pokazać:
# {
#   "ok": true,
#   "processed": 2,
#   "results": [
#     { "order": "...", "email": "p@f.pl", "status": "sent" },
#     { "order": "...", "email": "test@test.com", "status": "sent" }
#   ]
# }
```

### Co jeszcze sprawdzić

```bash
# Czy są opłacone zamówienia, które klienci nigdy nie dostali (bo Resend 403)?
wrangler d1 execute akrobacja-db --remote \
  --command="SELECT id, voucher_code, customer_email, paid_at FROM orders WHERE status='paid' ORDER BY paid_at DESC LIMIT 20"
```

Jeśli są — masz **awarię klientów** którą trzeba ratować ręcznie:
- Po weryfikacji Resend → wejdź na `/admin` (panel) i ręcznie wyślij voucher PDF dla każdego z tych orderów
- Albo dopisz endpoint `/api/admin/resend-voucher?code=AKR-XXXX-YYYY` który re-triggeruje sendVoucherEmail

### Monitoring na przyszłość

Resend → Settings → **Webhooks** → URL: `https://akrobacja.com/api/webhooks/resend` → events: `email.bounced`, `email.complained`, `email.delivery_delayed`. Webhook może powiadamiać Cię SMS-em (przez SMSAPI_TOKEN) gdy mail się nie doszedł, żebyś nie odkrywał awarii dopiero przy testach.

---

## Historia zmian (changelog)

| Data | Co | Commit |
|------|-----|--------|
| 2026-04-14 | Landing /voucher-prezent + GMC feed + Product schema | `0b405c3` |
| 2026-04-14 | Conversion tracking middleware + ADS-VOUCHER playbook | `f06975d` |
| 2026-04-15 | Hardcode AW-928813824 (tag), `3g00CNLcnZwcElCm8roD` (label) | `975be7c` `b723751` |
| 2026-04-15 | Cookie consent banner + Consent Mode v2 | `12ed740` |
| 2026-04-15 | E-commerce events + Enhanced Conversions (sessionStorage) | `8c6d0ca` |
| 2026-04-15 | Meta Pixel + Conversions API (server-side) | `c864467` |
| 2026-04-16 | Abandoned cart recovery + WRACAM5 -5% | `8ece6b7` |
| 2026-04-16 | Permanent fail handling + email regex validation | `51fb354` |
| 2026-04-16 | Test produkt 1 zł `/test-konwersji` + cancel_url fix | `9526622` |
| 2026-04-19 | Kody IG10, FB10, MAJOWKA (-10%) + eksponowanie PIERWSZY100 | (ta sesja) |

---

# 🚀 FIRST SALE PUSH, 48h kampania (gotowe do uruchomienia)

## Co już jest na stronie (po tej sesji)

- **Banner promocyjny** `PIERWSZY100` (-100 zł) widoczny na `/voucher-prezent` i home
- **Kody** w backendzie i client-side: `PIERWSZY100` (-100 zł), `WRACAM5` (-5%), `IG10`, `FB10`, `MAJOWKA` (-10% każdy)
- **Placeholder w polu kodu** w checkout modalu: "np. PIERWSZY100 (-100 zł)"

## Krok 1, Instagram @bullet.aerobatics (8 786 obserwujących)

**Post** (1 zdjęcie kokpitu/samolotu + caption):

```
Sezon 2026 otwarty. Pierwsze 10 lotów z kodem IG10 (-10%).

+6G / -2G / figury akrobacyjne na Extra 300L SP-EKS.
Lotnisko Radom, 100 km od Warszawy.
Voucher PDF natychmiast. Ważny 12 miesięcy.

Kod IG10 w polu "kod rabatowy" przy zakupie.
Link w bio.

#akrobacjalotnicza #extra300l #aerobatics
```

**Link w bio**: `https://akrobacja.com/voucher-prezent?discount=IG10&utm_source=instagram&utm_medium=social&utm_campaign=ig10_first_sale`

**Story**: ankieta „Kto marzy o akrobacji?" + swipe-up na ten sam link.

## Krok 2, Facebook @bullet.aerobatics

Ten sam post. Dodatkowo proś 5 znajomych o share. Tag żony / partnera / braci.

## Krok 3, WhatsApp broadcast do 10-20 znajomych

Osobista wiadomość:
```
Cześć, nie pytam czy kupisz, pytam czy znasz kogoś kto w tym roku ma okrągłe urodziny / rocznicę / kawalerski i marzy o adrenalinie. Jeśli tak, podrzuć mu link:
https://akrobacja.com/voucher-prezent?discount=PIERWSZY100

-100 zł na pierwszy voucher. Dzięki.
```

## Krok 4, Google Ads (30 PLN/dzień starter)

### Struktura

**1 kampania, 3 ad groups, 900 PLN/miesiąc startowo (30 zł × 30 dni)**

Cel kampanii: `Conversions` (konwersja już zmapowana: AW-928813824 / `3g00CNLcnZwcElCm8roD`)
Lokalizacja: Polska (Warszawa + 100 km promień priorytet)
Urządzenia: mobile + desktop
Harmonogram: 24/7, start dzisiaj
Budżet: 30 zł/dzień
Strategia: `Maximize conversions` (po 5-10 konwersjach przełącz na `Target CPA` = 100 zł)

### Ad Group 1, "Prezent"

**Keywords (phrase match):**
```
"lot akrobacyjny prezent"
"voucher na lot akrobacyjny"
"prezent dla chłopaka przygoda"
"prezent dla mężczyzny lot"
"prezent urodzinowy adrenalina"
"prezent dzień ojca lot"
"prezent kawalerski przygoda"
"prezent rocznica ślubu lot"
```

**Negative keywords:**
```
-praca, -zatrudnienie, -zarobki
-film, -gra, -symulator
-szkolenie (tylko w kampanii szkoleniowej)
-modelarstwo, -dron
-balonowy, -paragliding
```

### Ad Group 2, "Lot akrobacyjny (intent)"

**Keywords:**
```
[lot akrobacyjny]
[lot akrobacyjny warszawa]
"lot akrobacyjny radom"
"akrobacja samolotowa"
"extra 300l lot"
"samolot akrobacyjny warszawa"
"lot pętle beczki"
"lot z pilotem akrobacja"
```

### Ad Group 3, "Retargeting (RLSA)"

Audience: wszyscy odwiedzający `akrobacja.com` w ostatnich 30 dniach. Keywords: szerokie (brand + lot + prezent). Bid +50% vs zimne AG.

### Ad copy (responsive search ad)

**Headlines (15 pól, wybierz 10-12):**
```
Lot Akrobacyjny Extra 300L
Z Mistrzem Świata Akrobacji
Voucher PDF w 2 Minuty
Od 1 999 zł, Kod -100 zł
Prezent, Który Zapamiętają
Radom, 100 km z Warszawy
Mistrz Świata 2022 za Sterami
Ważny 12 Miesięcy
+6G, -2G, Pełna Akrobacja
Bezpłatne Przełożenie Terminu
★ 5.0 / 8 Opinii
3 Pakiety, od 1 999 zł
Dokończ Zakup, Kod PIERWSZY100
4 000+ h Nalotu Pilota
Kup w 2 Minuty Online
```

**Descriptions (4 pola):**
```
1. Lot akrobacyjny z Mistrzem Świata 2022. Extra 300L, +6G, pętle, beczki. Voucher PDF natychmiast. Kod PIERWSZY100 = -100 zł.

2. Najlepszy prezent 2026 dla poszukiwacza adrenaliny. 3 pakiety od 1 999 zł. PDF w mailu w 2 min. Ważny 12 miesięcy.

3. Lotnisko Radom-Piastów (EPRP), 1h 15 min z Warszawy trasą S7. Pilot: 4 000+ h nalotu, 3× Mistrz Polski.

4. 8 opinii 5/5. Bezpłatne przełożenie terminu. Faktura VAT. Zwrot 14 dni. Kup online, zapłać kartą, P24 lub BLIK.
```

**Final URL**: `https://akrobacja.com/voucher-prezent`
**Display URL**: `akrobacja.com/voucher`
**Tracking template**: `{lpurl}?utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_content={adgroupid}&utm_term={keyword}&gclid={gclid}`

### Sitelinks (min. 4)

| Text | URL |
|------|-----|
| Pakiety lotów | `https://akrobacja.com/#sklep` |
| Poznaj pilota | `https://akrobacja.com/#pilot` |
| Opinie klientów | `https://akrobacja.com/#opinie` |
| Kalendarz | `https://akrobacja.com/kalendarz` |

### Callouts (min. 6)

```
Voucher PDF natychmiast
Ważny 12 miesięcy
Mistrz Świata 2022
Extra 300L SP-EKS
Bezpłatne przełożenie
Zwrot 14 dni
Karta, P24, BLIK
4 000+ h nalotu
```

### Structured snippets

- Type: **Styles**
- Values: `Pierwszy Lot, Adrenalina, Masterclass`

### Phone extension

`+48 535 535 221`

### Promotion extension

- Promotion type: `10% off`
- Promo code: `IG10`
- Occasion: Kampania sezonowa
- Discount type: Percent discount
- Discount: 10%
- Date: od teraz do +30 dni

## Krok 5, zimna lista firm eventowych (B2B partnership)

**Cel**: 1 firma = 10-50 voucherów/rok.

Lista (startowe 5):
- GiftEvent.pl
- Prezentmarzeń.pl
- Pimp My Weekend
- Imagine Eurasia
- Atrakcja.pl / Prezent na Prezent

**Template emaila**:
```
Tytuł: Partnerstwo, voucher akrobacyjny Extra 300L + 15% prowizji

Dzień dobry,

Nazywam się [imię], reprezentuję akrobacja.com, platformę lotów akrobacyjnych Extra 300L z Mistrzem Świata 2022 Maciejem Kulaszewskim.

Proponuję włączenie naszych voucherów do Państwa oferty:
- 3 pakiety: 1 999 zł / 2 999 zł / 4 999 zł
- PDF voucher natychmiast po zakupie
- 15% prowizji dla Państwa firmy
- Ważność 12 miesięcy, realizacja Radom (1h z Warszawy)

Państwa klienci dostaną unikalne doświadczenie (nie kolejny kupon na masaż), Państwo dostają marżę i nowy produkt premium w ofercie.

Chętnie umówię 15-minutową rozmowę:
https://wa.me/48535535221

Pozdrawiam,
Paweł Mamcarz
akrobacja.com
```

## Weryfikacja konwersji (zanim puścisz budżet)

1. Otwórz incognito `https://akrobacja.com/test-konwersji`
2. Dokonaj zakupu 2 zł (`test_naklejka`)
3. Sprawdź w Google Ads → Narzędzia → Konwersje → status „Aktualna" + "Ostatnia konwersja zarejestrowana"
4. Jeśli OK, uruchom kampanię

## Daily monitoring (pierwsze 7 dni)

Rano, 5 minut:
- Google Ads: impressions, CTR, cost, konwersje (cel CTR > 3%, CPA < 200 zł)
- GA4 → Realtime: użytkownicy na stronie
- Stripe Dashboard: płatności (cel: 1 sprzedaż do 48h)
- Meta Ads Manager (jeśli też uruchomione)

Jeśli po 7 dniach 0 sprzedaży:
- Obniż cenę o -10% (użyj kodu MAJOWKA lub zmień pakiet)
- Przerzuć budżet do najlepiej performującego AG
- Dodaj lookalike audience w Meta Ads



