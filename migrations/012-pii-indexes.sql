-- 012-pii-indexes.sql
-- Hot-path indexes for PII columns used by admin listings, my-bookings, abandoned-cart.
-- Without these every query is a full table scan once we accumulate a few thousand rows.

CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_phone ON bookings(customer_phone);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_email ON bookings(customer_email);
