-- Migration 005: tabela otp_attempts dla rate-limitu na /api/auth/verify.
--
-- Bez tego brute force 6-cyfrowego kodu był realny: send-code ma limit 3/h,
-- ale verify nie miał żadnego. Logujemy każdą próbę (sukces/porażka) per
-- telefon + IP (CF-Connecting-IP). Polityka (w kodzie): 10 nieudanych prób
-- w oknie 10 min per phone albo per IP → 429. Po sukcesie czyścimy nieudane
-- próby dla danego numeru.
--
-- Run: wrangler d1 execute akrobacja-db --remote --file=migrations/005-otp-attempts.sql

CREATE TABLE IF NOT EXISTS otp_attempts (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  ip TEXT,
  success INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_otp_attempts_phone ON otp_attempts(phone, created_at);
CREATE INDEX IF NOT EXISTS idx_otp_attempts_ip    ON otp_attempts(ip, created_at);
