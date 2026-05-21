-- Migration 025: dodaj target_number do wa_clicks - numer WA do ktorego trafilo klikniecie.
--
-- Dwa glowne numery na serwisie:
--   48535535221 - Pawel (vouchery, ogolny kontakt)
--   48739158131 - Maciej Kulaszewski (pozyczka FCL.800, dotacje)
--
-- Kolumna wypelniana przez frontend (wa-tracker.js v2), ktory parsuje href wa.me/
-- lub api.whatsapp.com/send?phone= i wyciaga cyfry. Backend waliduje /^\d{6,15}$/.
-- Istniejace wiersze maja NULL (brak danych historycznych - OK).
--
-- ONE-SHOT: D1/SQLite nie obsluguje ALTER TABLE ADD COLUMN IF NOT EXISTS.
-- Uruchom dokladnie raz:
--   npx wrangler d1 execute akrobacja-db --remote --file=migrations/025-wa-clicks-target-number.sql
-- Przed commitem / deployem nowego kodu.

ALTER TABLE wa_clicks ADD COLUMN target_number TEXT;

CREATE INDEX IF NOT EXISTS idx_wa_clicks_target ON wa_clicks(target_number, created_at DESC);
