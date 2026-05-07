-- Migration: Add printful_data column to products
ALTER TABLE products ADD COLUMN printful_data TEXT;
