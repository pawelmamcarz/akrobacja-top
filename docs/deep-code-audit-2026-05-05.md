# Głęboki audyt kodu akrobacja.com - 2026-05-05

Zakres: Cloudflare Pages + Pages Functions, D1/R2, Stripe, Resend, SMSAPI, wFirma, Printful, pilot portal, admin panel, kalendarz i chat AI.

Stan repo przed audytem:
- `git fetch` wykonany.
- `main` jest zsynchronizowany z `origin/main` (`origin/main..HEAD` i `HEAD..origin/main` puste).
- Workspace ma wiele nieśledzonych plików/artefaktów; audyt ich nie ruszał.
- Potwierdzony typ projektu: Cloudflare Pages (`wrangler.jsonc` ma `pages_build_output_dir: "public"` i Pages Functions w `functions/`).

## Executive summary

Kod jest w lepszym stanie niż backlog w `README.md` sugeruje: część dawnych luk została już naprawiona, np. `calendar/book` wysyła maile, webhook obsługuje `checkout.session.expired` i `checkout.session.async_payment_failed`, OTP verify ma rate-limit, sesje pilota mają TTL, a kalendarz waliduje slot względem `generateSlots(date)`.

Najważniejsze aktualne ryzyka to:
1. Merch może wywalić się w produkcji przez drift migracji `products`.
2. Merch checkout nie waliduje ilości produktów.
3. Crony są zabezpieczone tylko jeśli `CRON_SECRET` istnieje, czyli fail-open.
4. Chat AI przyjmuje dowolną historię/role od klienta i nie ma limitów kosztowych.
5. Webhook Stripe nie sprawdza wieku sygnatury, więc poprawnie podpisany payload może być replayowany.

## Ustalenia

### P0 - Produkcyjny drift D1 może zepsuć `/api/merch/products`

`functions/api/merch/products.ts:6` robi:

```sql
SELECT id, name, slug, category, description, price, variants, image_url
FROM products
WHERE active = 1
ORDER BY sort_order
```

Ale `migrations/001-merch-tables.sql:4-13` tworzy `products` bez `slug`, `category` i `sort_order`. `schema.sql` ma pełną wersję tabeli, ale nie ma migracji, która dodaje te kolumny do istniejącej bazy. Jeżeli produkcyjna D1 powstała z migracji 001 i nie dostała ad-hoc patcha, endpoint sklepu merch zwróci błąd SQL zamiast listy produktów.

Rekomendacja:
- Dodać migrację `008-products-shape.sql`, która idempotentnie sprawdza i dodaje `slug`, `category`, `sort_order` albo wykonać ręczny drift patch po sprawdzeniu `PRAGMA table_info(products)` na prod.
- Dodać smoke check `/api/merch/products` po deployu.

### P1 - Merch checkout nie waliduje `quantity`

`functions/api/merch/checkout.ts:36-57` używa `item.quantity` bez sprawdzenia typu, liczby całkowitej, zakresu i dodatniości. Potem `subtotal = product.price * item.quantity`, `totalAmount` trafia do D1, a `quantity` idzie do Stripe (`lines 86-90`).

Skutki:
- `0`, liczby ujemne, `NaN`, ułamki lub ekstremalnie duże wartości mogą tworzyć śmieciowe rekordy `pending`, powodować błędy Stripe po insercie do D1 albo rozjeżdżać kwoty raportowe.
- Przy ujemnych ilościach backend liczy ujemny subtotal i dopiero Stripe najpewniej odrzuca checkout, ale DB ma już order.

Rekomendacja:
- Przed jakimkolwiek DB insertem wymusić `Number.isInteger(quantity) && quantity >= 1 && quantity <= 20`.
- Odrzucać duplikaty `product_id + variant` albo scalać je po stronie backendu.
- Gdy Stripe creation failuje, oznaczać `merch_orders.status = 'failed'`, analogicznie do voucher checkoutu.

### P1 - Crony są fail-open bez `CRON_SECRET`

`functions/api/cron/welcome-emails.ts:205-211`, `functions/api/cron/abandoned-checkouts.ts:114-120` i `functions/api/cron/scheduled-vouchers.ts:28-34` sprawdzają Authorization tylko wtedy, gdy `ctx.env.CRON_SECRET` jest ustawiony. Jeśli sekret nie istnieje albo zostanie pominięty w preview/prod, endpointy są publiczne.

Skutki:
- Osoba z internetu może odpalić wysyłkę welcome/recovery/scheduled voucher emails.
- To generuje koszt Resend, ryzyko spamu i potencjalnie wysyłkę voucherów w niekontrolowanym momencie.

Rekomendacja:
- Zmienić logikę na fail-closed: jeśli `CRON_SECRET` pusty, zwrócić `500 Cron not configured`.
- Porównanie tokenu wykonać constant-time, tak jak admin auth.
- Dodać `CRON_SECRET` do listy wymaganych sekretów i workflow/procedury deploy.

### P1 - Chat AI przyjmuje dowolną historię i nie ma limitu kosztowego

`functions/api/chat.ts:204-210` przepuszcza klientowskie `history` do modelu bez limitu długości i bez whitelisty ról. Klient może wysłać dodatkową rolę `system`, bardzo długą historię albo masowo wywoływać endpoint. `README.md` słusznie wspomina brak rate-limitu, ale problem jest szerszy: koszt + prompt hierarchy.

Rekomendacja:
- Dopuścić tylko role `user` i `assistant`/`model`; ignorować lub odrzucać `system`, `tool`, inne.
- Limitować `message` i `history`: np. max 1000 znaków wiadomości, max 8 ostatnich wiadomości historii, max 6000 znaków łącznie.
- Dodać prosty D1/KV rate-limit po IP: np. 20 requestów / 10 min.

### P2 - Stripe webhook nie sprawdza timestamp tolerance

`functions/api/webhook.ts:44-67` poprawnie liczy HMAC, ale nie sprawdza, czy `t=` ze Stripe signature jest świeże. To oznacza, że poprawnie podpisany payload może być replayowany bez ograniczenia czasowego.

Obecna idempotencja `pending -> processing` mocno zmniejsza wpływ na voucher ordery, ale brak tolerance nadal jest odstępstwem od standardowego modelu Stripe.

Rekomendacja:
- Odrzucać sygnatury starsze niż 5 minut, np. `Math.abs(Date.now()/1000 - Number(timestamp)) > 300`.
- Porównywać podpis constant-time.

### P2 - Migracje nie są idempotentne mimo polityki w README

`README.md` mówi, że migracje mają mieć guardy, ale migracje 002, 006 i 007 używają zwykłego `ALTER TABLE ... ADD COLUMN`. SQLite/D1 przerwie taką migrację, jeśli kolumna już istnieje po ręcznym hotfixie/prod drift.

Rekomendacja:
- Dla nowych migracji używać skryptu/praktyki `PRAGMA table_info` przed `ALTER`, albo zaakceptować nieidempotentność i poprawić README.
- Dodać checklistę drift patch: najpierw `PRAGMA table_info`, potem właściwy SQL.

### P2 - Polskie teksty bez diakrytyków w kodzie widocznym dla użytkownika

Przykłady:
- `src/lib/types.ts:39-50`: `Pelen`, `Pelny`, `petle`, `odwrocony`, `pilotow`, `korkociagu`.
- `functions/api/auth/insurance.ts`: `Uzupelnij`, `imie`, `Jestes`, `juz`, `zlozony`, `oczekujacy`.
- `public/admin.html`: liczne teksty typu `lotow`, `Tresc SMS`, `oczekujacych`.

To łamie instrukcję projektu: polskie treści muszą mieć diakrytyki.

Rekomendacja:
- Naprawić najpierw teksty widoczne publicznie (`src/lib/types.ts`, API errors), potem admin UI.
- Dodać prosty check na najczęstsze bezogonkowe formy w CI.

### P3 - `README.md` backlog jest częściowo nieaktualny

Nieaktualne lub częściowo nieaktualne punkty:
- `calendar/book` już wysyła maile do klienta i admina.
- Webhook obsługuje `checkout.session.expired` i `checkout.session.async_payment_failed`.
- OTP/session hardening jest już częściowo wdrożony.
- `calendar/book` waliduje `start_time` względem `generateSlots(date)`.

Rekomendacja:
- Zaktualizować backlog, żeby nie kierował pracy na już naprawione rzeczy.

## Dodatkowe obserwacje

- `npx tsc --noEmit` przechodzi.
- `npx wrangler pages functions build --outdir /private/tmp/akrobacja-functions-build` przechodzi po uruchomieniu poza sandboxem.
- `package.json` nie ma skryptu testów ani smoke testów endpointów.
- `package.json` ma tylko `dev`, `deploy`, `types`; warto dodać `typecheck`, `functions:build`, `audit:static`.
- `src/lib/printful.ts` nadal ma pusty mapping produktów, więc webhook merch oznacza płatność jako `paid`, ale fulfilment pozostaje ręczny.

## Proponowana kolejność napraw

1. D1 drift dla `products` + smoke `/api/merch/products`.
2. Walidacja `quantity` i status `failed` dla merch checkout przy błędzie Stripe.
3. Cron auth fail-closed i konfiguracja `CRON_SECRET`.
4. Chat role/length/rate-limit.
5. Stripe timestamp tolerance.
6. Diakrytyki w publicznych tekstach/API.
7. Aktualizacja `README.md`.

## Weryfikacja wykonana

```bash
git fetch
git log --oneline origin/main..HEAD
git log --oneline HEAD..origin/main
git status --short --branch
npx tsc --noEmit
npx wrangler pages functions build --outdir /private/tmp/akrobacja-functions-build
rg -n "TODO|FIXME|HACK|CRON_SECRET|Authorization|localStorage|innerHTML|fetch\\(" functions src public/*.html public/assets public/*.js
rg -n "Pelen|Pelny|pilotow|Uzupelnij|imie|Jestes|juz|zlozony|oczekujacy|lotow|korkociagu|odwrocony" src functions public/*.html public/blog public/assets public/*.js
```
