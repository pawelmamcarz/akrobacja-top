-- Migration: indexes on hot WHERE/ORDER BY paths found in full-site audit
--
-- 1) auth/my-bookings.ts: SELECT * FROM courses WHERE customer_phone = ? ORDER BY created_at DESC
--    Previously full-scan on courses, slow once a pilot has any course history.
-- 2) admin/merch.ts: SELECT * FROM merch_orders ORDER BY created_at DESC LIMIT 100
--    Full-scan on every admin panel poll.
--
-- Idempotent via IF NOT EXISTS.

CREATE INDEX IF NOT EXISTS idx_courses_customer_phone ON courses(customer_phone);
CREATE INDEX IF NOT EXISTS idx_merch_orders_created_at ON merch_orders(created_at DESC);
