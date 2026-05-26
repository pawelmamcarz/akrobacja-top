-- KSeF integration: pull faktur kosztowych (PURCHASE) z whitelistowanych kontrahentow.
-- expenses zostaje wspolna tabela (source='ksef' obok 'wfirma'/'manual').

-- Whitelist NIPow ktorych faktury automatycznie zaciagamy do expenses.
-- Manage przez admin panel: zakladka Koszty -> sekcja KSeF Whitelist.
CREATE TABLE IF NOT EXISTS ksef_whitelist (
  nip TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  label TEXT,                            -- przyjazna nazwa (np. "Marketing FB")
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Dla idempotent upsert ksef invoices. Reuse tabeli expenses, ale dodaj UNIQUE
-- na ksef_invoice_uuid (analog do wfirma_id).
ALTER TABLE expenses ADD COLUMN ksef_invoice_uuid TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_ksef_uuid ON expenses(ksef_invoice_uuid) WHERE ksef_invoice_uuid IS NOT NULL;
