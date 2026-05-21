-- Migration 027: admin_logins - log kazdego zalogowania do /admin.
--
-- Cel: widzialnosc kto i kiedy uzywal panelu (Pawel vs Magda vs przyszli).
-- Insert robi /api/admin/me przy kazdym pierwszym calu po zalogowaniu, z
-- 1-godzinnym debounce per (username, ip) - zeby nie zapelniac tabeli przy
-- czestym przeladowywaniu strony admina.
--
-- Uruchom dokladnie raz:
--   npx wrangler d1 execute akrobacja-db --remote --file=migrations/027-admin-logins.sql

CREATE TABLE IF NOT EXISTS admin_logins (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  logged_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_logins_user ON admin_logins(username, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logins_at ON admin_logins(logged_at DESC);
