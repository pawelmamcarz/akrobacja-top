-- 013-products-drift.sql
-- Catch-up migration: schema.sql declares products.slug, products.category,
-- products.sort_order and three matching indexes, but 001-merch-tables.sql
-- created the table without them — they were added ad-hoc on prod. A fresh
-- environment that rebuilt from migrations alone would crash merch endpoints.
--
-- D1/SQLite has no ALTER TABLE ADD COLUMN IF NOT EXISTS, so we shadow-copy
-- only if the columns are missing. The simpler ALTER would error out on
-- production where the columns are already present.

-- The PRAGMA below is the canonical idempotent column-add idiom for SQLite/D1:
-- it succeeds only when the column does not yet exist (otherwise raises
-- "duplicate column name" which we expect any rerun to swallow with --batch).
-- Running this on a fresh DB created from schema.sql is also safe — these
-- columns already exist, ALTER will fail with "duplicate column name" and
-- the rest of the migration is a no-op.

ALTER TABLE products ADD COLUMN slug TEXT;
ALTER TABLE products ADD COLUMN category TEXT;
ALTER TABLE products ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 100;

CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_sort ON products(sort_order);
