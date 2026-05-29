-- 041-tech-module.sql
-- Modul techniczny: rola mechanika, multi-samolot (aircraft_id FK), pliki przy
-- dokumentach (MS od CAMO), cyfrowy dziennik pokladowy.
--
-- UWAGA: ALTER ADD COLUMN nie jest idempotentne w D1/SQLite. Jednorazowy patch -
-- uruchom raz na produkcji. Re-run wywali sie na "duplicate column name" (oczekiwane).
-- Bootstrap/DR idzie przez schema.sql.

-- Multi-samolot: powiazanie maintenance/documents z konkretnym samolotem.
ALTER TABLE maintenance ADD COLUMN aircraft_id TEXT DEFAULT 'speks-001';
ALTER TABLE documents ADD COLUMN aircraft_id TEXT DEFAULT 'speks-001';

-- Pliki przy dokumentach (skany, MS od CAMO).
ALTER TABLE documents ADD COLUMN r2_key TEXT;
ALTER TABLE documents ADD COLUMN source TEXT DEFAULT 'manual';

-- Nalot narastajaco na samolocie (do estymacji przegladow po godzinach).
ALTER TABLE aircrafts ADD COLUMN current_hours REAL;
ALTER TABLE aircrafts ADD COLUMN hours_updated_at TEXT;

-- Cyfrowy dziennik pokladowy.
CREATE TABLE IF NOT EXISTS flight_logbook (
  id TEXT PRIMARY KEY,
  aircraft_id TEXT NOT NULL DEFAULT 'speks-001',
  pilot_id TEXT,
  photo_r2_key TEXT,
  flight_date TEXT,
  flights_count INTEGER,
  flight_minutes INTEGER,
  landings INTEGER,
  hours_after REAL,
  fuel_l REAL,
  remarks TEXT,
  extracted_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review',
  confirmed_by TEXT,
  confirmed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_flight_logbook_aircraft ON flight_logbook(aircraft_id, flight_date DESC);
CREATE INDEX IF NOT EXISTS idx_flight_logbook_status ON flight_logbook(status, created_at DESC);
