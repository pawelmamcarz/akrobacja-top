-- Migration 006: TTL dla session_token + audyt zdarzeń auth (auth_events).
--
-- Bez TTL token sesji żył do następnego logowania (de facto wieczność).
-- Po tej migracji każdy nowy token ma session_expires_at = +30 dni;
-- helper getPilotFromToken sprawdza wygaśnięcie i zwraca null po expirze.
--
-- auth_events loguje login / login_new_ip / logout per phone+pilot, z IP
-- i user_agent. Daje audyt + możliwość wykrycia hijacku tokena.
--
-- Run: wrangler d1 execute akrobacja-db --remote --file=migrations/006-session-ttl.sql

ALTER TABLE pilots ADD COLUMN session_expires_at TEXT;

CREATE INDEX IF NOT EXISTS idx_pilots_session ON pilots(session_token);

CREATE TABLE IF NOT EXISTS auth_events (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  pilot_id TEXT,
  event_type TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_auth_events_phone ON auth_events(phone, created_at DESC);
