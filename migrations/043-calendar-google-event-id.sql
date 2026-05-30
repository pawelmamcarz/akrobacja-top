-- Dwustronny zapis kalendarza: id eventu Google dla wpisów utworzonych w aplikacji
-- (push strona -> Google). Pozwala patch/delete po stronie Google oraz dedup z
-- odczytem ICS. Idempotentne — D1/SQLite nie ma ADD COLUMN IF NOT EXISTS, więc guard
-- przez próbę i ignorowanie błędu duplikatu kolumny po stronie operatora.
ALTER TABLE calendar_events ADD COLUMN google_event_id TEXT;
