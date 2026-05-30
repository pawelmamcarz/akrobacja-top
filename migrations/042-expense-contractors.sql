-- Whitelist kontrahentow do auto-pull faktur kosztowych z wFirmy.
-- Cron sync-wfirma-expenses (oraz przycisk "Pobierz z wFirmy") zaciaga TYLKO
-- faktury od kontrahentow z tej listy: dopasowanie po fragmencie nazwy
-- (case-insensitive substring) lub po NIP. Dodatkowo obowiazuje data graniczna
-- 2026-01-01 (EXPENSES_SINCE w sync-wfirma-expenses.ts). Rekordy source='wfirma'
-- ktore nie pasuja (zly kontrahent lub data < granicy) sa przycinane przy
-- kazdym sync. Wpisy source='manual' nie sa ruszane.
CREATE TABLE IF NOT EXISTS expense_contractors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_name TEXT NOT NULL,
  nip TEXT,
  label TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_expense_contractors_active ON expense_contractors(active);

-- Seed startowy (idempotentny - guard po lower(match_name)).
INSERT INTO expense_contractors (match_name, nip, label, active, created_at)
SELECT 'Milik', NULL, 'Michał Milik', 1, strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM expense_contractors WHERE lower(match_name) = 'milik');
INSERT INTO expense_contractors (match_name, nip, label, active, created_at)
SELECT 'Kulaszewski', NULL, 'Kulaszewski', 1, strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM expense_contractors WHERE lower(match_name) = 'kulaszewski');
INSERT INTO expense_contractors (match_name, nip, label, active, created_at)
SELECT 'Ibex', NULL, 'Ibex', 1, strftime('%s','now')
WHERE NOT EXISTS (SELECT 1 FROM expense_contractors WHERE lower(match_name) = 'ibex');
