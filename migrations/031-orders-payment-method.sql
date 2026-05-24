-- Distinguishes Stripe-paid orders from manually-recorded ones (cash at event,
-- bank transfer outside Stripe, free/barter voucher). Default NULL = legacy
-- Stripe orders; admin "Nowy voucher" picks one of 'cash' | 'transfer' | 'free'.
ALTER TABLE orders ADD COLUMN payment_method TEXT;
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method);
