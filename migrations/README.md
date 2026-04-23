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

## Uruchomienie

```bash
npx wrangler d1 execute akrobacja-db --remote --file=migrations/NNN-<nazwa>.sql
```

Wszystkie migracje powinny być idempotentne (`IF NOT EXISTS`), ale zawsze
sprawdź target-state SELECTem przed run — szczególnie jeśli dodajesz UNIQUE
(możliwe duplikaty w danych).
