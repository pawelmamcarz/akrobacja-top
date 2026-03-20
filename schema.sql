-- D1 Database schema for akrobacja.top voucher shop
-- Run: wrangler d1 execute akrobacja-db --file=schema.sql

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  voucher_code TEXT UNIQUE NOT NULL,
  package_id TEXT NOT NULL,
  video_addon INTEGER NOT NULL DEFAULT 0,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_nip TEXT,
  amount INTEGER NOT NULL,
  stripe_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  invoice_id TEXT,
  created_at TEXT NOT NULL,
  paid_at TEXT,
  expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_voucher_code ON orders(voucher_code);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session ON orders(stripe_session_id);
