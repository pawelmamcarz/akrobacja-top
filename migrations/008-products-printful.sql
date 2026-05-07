-- Migration: Add missing columns to products + printful_data
ALTER TABLE products ADD COLUMN slug TEXT;
ALTER TABLE products ADD COLUMN category TEXT;
ALTER TABLE products ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 100;
ALTER TABLE products ADD COLUMN printful_data TEXT;

CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_sort ON products(sort_order);
