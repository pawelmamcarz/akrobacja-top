-- 013-products-drift.sql
-- Catch-up migration: schema.sql declares products.slug, products.category,
-- products.sort_order and three matching indexes, but 001-merch-tables.sql
-- created the table without them — they were added ad-hoc on prod. A fresh
-- environment that rebuilt from migrations alone would crash merch endpoints.
--
-- D1/SQLite has NO `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, and there is no
-- pure-SQL idempotent column-add idiom. These ALTERs are a ONE-SHOT drift patch:
-- run once against a prod DB that lacks the columns. Re-running this file (or
-- running it against a DB that already has the columns) WILL fail with
-- "duplicate column name" and abort — that is expected, not a safety net.
--
-- Never rebuild a DB by replaying migrations. Fresh/DR bootstrap always goes
-- through schema.sql (which already declares these columns + indexes). See
-- migrations/README.md.

ALTER TABLE products ADD COLUMN slug TEXT;
ALTER TABLE products ADD COLUMN category TEXT;
ALTER TABLE products ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 100;

CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_sort ON products(sort_order);
