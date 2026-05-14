-- 011-bookings-voucher-unique.sql
-- Partial UNIQUE index on bookings.voucher_code so two concurrent POST /api/calendar/book
-- with the same voucher_code cannot both succeed (race that previously let one voucher
-- reserve multiple slots). 'rejected' bookings are excluded so a re-booking after a
-- rejection still works.

CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_voucher_unique_active
  ON bookings(voucher_code)
  WHERE voucher_code IS NOT NULL AND status != 'rejected';
