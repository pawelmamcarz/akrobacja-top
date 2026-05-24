-- Wielogodzinne eventy pilotow (loty, szkolenia, maintenance, pokazy).
-- Niezalezne od tabeli `slots` (per-1h bookingi klientow). Event = blok
-- przypisany do pilota i opcjonalnie samolotu. Eksportowane do Google
-- Calendar przez ICS feed (/api/calendar/feed.ics?token=...).
--
-- ALTER TABLE pilots: D1 nie ma "ADD COLUMN IF NOT EXISTS". Uruchamiac raz.
-- Jesli kolumna juz istnieje (re-run), pominac wszystkie ALTERY.

CREATE TABLE IF NOT EXISTS aircrafts (
  id TEXT PRIMARY KEY,
  tail TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_aircrafts_tail ON aircrafts(tail);

CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  pilot_id TEXT NOT NULL,
  aircraft_id TEXT,
  type TEXT NOT NULL,                              -- 'flight'|'training'|'maintenance'|'show'|'other'
  title TEXT,
  notes TEXT,
  start_at TEXT NOT NULL,                          -- ISO UTC z 'Z'
  end_at TEXT NOT NULL,                            -- ISO UTC z 'Z'
  status TEXT NOT NULL DEFAULT 'confirmed',        -- 'confirmed'|'tentative'|'cancelled'
  source TEXT NOT NULL DEFAULT 'manual',           -- 'manual'|'booking' (auto z approve)
  booking_id TEXT,                                 -- link do bookings.id (UUID) gdy source='booking'
  created_by TEXT,                                 -- email admina / 'system'
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_calendar_events_pilot ON calendar_events(pilot_id, start_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_aircraft ON calendar_events(aircraft_id, start_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_range ON calendar_events(start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON calendar_events(type, start_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_booking ON calendar_events(booking_id) WHERE booking_id IS NOT NULL;

-- ALTER pilots: dodaj calendar_token i is_instructor. Uruchamiac OSOBNO
-- (D1 wykona kazda instrukcje, ale ALTER moze rzucic blad jesli kolumna
-- istnieje - reszta przejdzie).
ALTER TABLE pilots ADD COLUMN calendar_token TEXT;
ALTER TABLE pilots ADD COLUMN is_instructor INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS idx_pilots_calendar_token ON pilots(calendar_token) WHERE calendar_token IS NOT NULL;

-- Seed: SP-EKS + dwoch instruktorow.
-- Tokeny calendar_token generujemy POZNIEJ przez admin panel
-- (akcja "Generuj token" w zakladce Piloci) bo D1 nie ma hex(randomblob).
INSERT OR IGNORE INTO aircrafts (id, tail, type, notes)
  VALUES ('speks-001', 'SP-EKS', 'Extra 300L', 'Glowny samolot akrobacyjny');

INSERT OR IGNORE INTO pilots (id, phone, name, email, is_instructor, verified, balance_minutes)
  VALUES
    ('pilot-pawel', '+48535535221', 'Pawel Mamcarz', 'pawel@mamcarz.com', 1, 1, 0),
    ('pilot-maciej', '+48739158131', 'Maciej Kulaszewski', 'maciej@akrobacja.com', 1, 1, 0);

-- Na wypadek gdyby wiersze juz istnialy pod inna konfiguracja:
UPDATE pilots SET is_instructor = 1, name = 'Pawel Mamcarz', email = 'pawel@mamcarz.com'
  WHERE phone = '+48535535221';
UPDATE pilots SET is_instructor = 1, name = 'Maciej Kulaszewski', email = 'maciej@akrobacja.com'
  WHERE phone = '+48739158131';
