-- 014-drop-baselinker.sql
-- BaseLinker was removed from the codebase (commit 09af946). The merch_orders.
-- baselinker_order_id column added in 010-baselinker.sql is no longer read or
-- written by any application code, so drop it to keep schema.sql consistent.
-- D1/SQLite supports ALTER TABLE … DROP COLUMN since 3.35 (2021), so this is
-- a single-statement migration.

ALTER TABLE merch_orders DROP COLUMN baselinker_order_id;
