-- Abandoned checkout recovery — dodaj kolumny do orders.
-- Pending orders >1h bez zapłaty + bez wysłanego maila = kandydaci do recovery email.

ALTER TABLE orders ADD COLUMN abandon_email_sent_at TEXT;
ALTER TABLE orders ADD COLUMN discount_code TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_abandon
  ON orders(status, abandon_email_sent_at, created_at);
