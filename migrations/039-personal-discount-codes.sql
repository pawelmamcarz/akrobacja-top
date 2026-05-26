-- Per-email jednorazowe kody rabatowe (np. PHOTO-XXXX dla fotografow po akceptacji zdjec).
-- Checkout.ts najpierw sprawdza statyczny DISCOUNTS, potem fallback do tej tabeli.

CREATE TABLE IF NOT EXISTS personal_discount_codes (
  code TEXT PRIMARY KEY,
  customer_email TEXT NOT NULL,
  pct INTEGER,                       -- rabat procentowy (np. 10 dla -10%)
  fixed_gr INTEGER,                  -- ALBO kwota fixed w groszach
  source TEXT,                       -- np. 'photo_thankyou', 'event_partner'
  expires_at TEXT,                   -- YYYY-MM-DD lub NULL = bez limitu
  used_at TEXT,                      -- gdy wykorzystany
  used_order_id TEXT,                -- orders.id ktore go wykorzystalo
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_personal_codes_email ON personal_discount_codes(customer_email);
CREATE INDEX IF NOT EXISTS idx_personal_codes_source ON personal_discount_codes(source, created_at DESC);
