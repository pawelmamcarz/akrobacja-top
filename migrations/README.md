# Migrations

## Policy

- **`schema.sql` = source of truth dla bootstrapu.** Świeża D1 zawsze budowana
  z `schema.sql`, nie z migracji.
- **`migrations/NNN-*.sql` = drift patches.** Doklejają kolumny/indeksy/tabele
  do baz, które już żyją na produkcji (kolejne deploye). Kolejne pliki nie
  tworzą kompletnego łańcucha od zera — wielu brakujących rzeczy (np.
  bootstrapowych tabel `orders`, `vouchers`) nigdy nie było w migracji, bo
  powstały razem ze `schema.sql` v1.
- Po każdej zmianie schematu: zaktualizuj `schema.sql` **i** dodaj migrację
  drift z `IF NOT EXISTS` / partial-unique / `CREATE INDEX IF NOT EXISTS`,
  żeby była idempotentna na produkcyjnej bazie.

## Why this model

D1/SQLite nie wspiera `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, więc każda
migracja kolumnowa musi być uruchamiana ręcznie i z wiedzą o stanie targetu.
Próba odtworzenia bazy wyłącznie z łańcucha migracji rozsypuje się na pierwszej
kolumnie, którą prod dostał ad-hoc, zanim ktoś napisał odpowiedni plik
w `migrations/`.

## Historia

- `001-merch-tables.sql` — tabele merch (products, merch_orders, subscribers).
- `002-abandoned-checkout.sql` — flaga `abandon_email_sent_at` na orders + indeks.
- `003-pilots-calendar.sql` — portal pilota, OTP, balance log, sloty, bookings,
  availability blocks, maintenance, documents, insurance_pilots, aircraft.
- `004-slots-unique.sql` — partial `UNIQUE(date, start_time) WHERE status != 'available'`
  na slots (anti-race dla rezerwacji).
- `005-otp-attempts.sql` — tabela `otp_attempts` dla rate-limitu na /api/auth/verify.
- `007-voucher-personalization.sql` — kolumny `recipient_name`, `dedication`,
  `send_at`, `email_sent_at` dla orders (voucher prezentowy z dedykacją + planowaną wysyłką).

## Uruchomienie

```bash
npx wrangler d1 execute akrobacja-db --remote --file=migrations/NNN-<nazwa>.sql
```

Migracje tworzące tabele/indeksy używają `IF NOT EXISTS` i są idempotentne.
Migracje kolumnowe (`ALTER TABLE ... ADD COLUMN`) **nie są** i być nie mogą —
D1/SQLite nie ma `ADD COLUMN IF NOT EXISTS` ani warunkowego DDL w czystym SQL.
Traktuj je jako jednorazowe: uruchom raz na bazie, której brakuje kolumny;
ponowny run wywali się na "duplicate column name" i to jest oczekiwane.
Zawsze sprawdź target-state SELECTem / `PRAGMA table_info(tabela)` przed runem —
szczególnie przy UNIQUE (możliwe duplikaty w danych).

**Nie odtwarzaj bazy przez replay migracji.** Bootstrap/DR zawsze idzie przez
`schema.sql`, który musi zawierać KOMPLETNY stan prod (wszystkie kolumny i
tabele dodane kiedykolwiek migracjami). Po dodaniu migracji kolumnowej dopisz
tę samą kolumnę do `schema.sql` w tej samej zmianie.
