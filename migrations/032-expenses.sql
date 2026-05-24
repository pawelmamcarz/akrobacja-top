-- Operating costs ledger. Two sources:
--   'wfirma'  rows pulled daily by cron from wFirma's expenses module (faktury
--             kosztowe). Idempotent upsert keyed by wfirma_id. category synced
--             from wFirma; manual_category, when set, overrides it in the UI.
--   'manual'  rows added by admin for cash paragons / costs without invoice
--             (paliwo, drobne wydatki). No wfirma_id.
--
-- All amounts in grosze. issue_date is the invoice/receipt date (YYYY-MM-DD),
-- used for monthly P&L bucketing in /api/admin/finance/summary.
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  wfirma_id TEXT UNIQUE,
  invoice_number TEXT,
  contractor_name TEXT,
  contractor_nip TEXT,
  net_amount INTEGER NOT NULL,
  vat_amount INTEGER NOT NULL DEFAULT 0,
  gross_amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PLN',
  category TEXT,
  manual_category TEXT,
  issue_date TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL,
  added_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_expenses_issue_date ON expenses(issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_contractor ON expenses(contractor_name);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_source ON expenses(source);
