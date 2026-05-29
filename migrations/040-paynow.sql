-- 040-paynow.sql
-- PayNow (paynow.pl) jako dodatkowa bramka płatności obok Stripe.
-- Dodaje znacznik bramki + identyfikator płatności PayNow na orders i merch_orders.
--
-- UWAGA: ALTER TABLE ADD COLUMN nie jest idempotentne w D1/SQLite (brak IF NOT
-- EXISTS). To jednorazowy patch - uruchom raz na produkcji. Re-run wywali się na
-- "duplicate column name" i to jest oczekiwane. Bootstrap/DR idzie przez schema.sql.

ALTER TABLE orders ADD COLUMN payment_gateway TEXT;
ALTER TABLE orders ADD COLUMN paynow_payment_id TEXT;
ALTER TABLE merch_orders ADD COLUMN payment_gateway TEXT;
ALTER TABLE merch_orders ADD COLUMN paynow_payment_id TEXT;
