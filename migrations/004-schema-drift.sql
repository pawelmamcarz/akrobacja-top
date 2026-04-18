-- Migration 004: schema drift — kolumny używane w kodzie od produkcji,
-- a których zabrakło w schemacie.
--
-- Bez tej migracji:
--   * /api/admin/redeem, /api/admin/orders, /api/calendar/book, /api/auth/my-bookings
--     zwracają 500 przez brak orders.redeemed_at
--   * /sklep-merch i /api/admin/merch się wywalają przez brak slug/category/sort_order
--
-- Run: wrangler d1 execute akrobacja-db --file=migrations/004-schema-drift.sql

-- Voucher redemption timestamp
ALTER TABLE orders ADD COLUMN redeemed_at TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_redeemed ON orders(redeemed_at);

-- Merch products — pola wymagane przez /sklep-merch i /admin merch panel
ALTER TABLE products ADD COLUMN slug TEXT;
ALTER TABLE products ADD COLUMN category TEXT;
ALTER TABLE products ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 100;

CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_sort ON products(sort_order);
