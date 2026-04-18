-- Migration 004: schema drift — idempotentna.
--
-- Pierwotnie miała dodać kolumny orders.redeemed_at, products.slug/category/sort_order,
-- ale w produkcji są one już dodane ad-hoc. D1 nie wspiera ADD COLUMN IF NOT EXISTS,
-- więc ALTER-y rollowały całą transakcję. Zostają same indeksy (bezpieczne via
-- IF NOT EXISTS) — świeża baza dostaje kolumny z schema.sql, produkcja tylko indeksy.
--
-- Run: wrangler d1 execute akrobacja-db --remote --file=migrations/004-schema-drift.sql

CREATE INDEX IF NOT EXISTS idx_orders_redeemed   ON orders(redeemed_at);
CREATE INDEX IF NOT EXISTS idx_products_slug     ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_sort     ON products(sort_order);
