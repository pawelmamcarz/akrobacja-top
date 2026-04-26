-- Migration 007: personalizacja vouchera — imię obdarowanego, dedykacja, planowana wysyłka.
--
-- Kontekst: voucher kupowany jako prezent (np. Marta kupuje mężowi na 50-tkę).
-- Bez tych pól voucher jest bezimienny ("Voucher dla: Marta Kowalska") i PDF
-- leci od razu na maila kupującego — nie da się odłożyć wysyłki na dzień urodzin.
--
-- Pola (wszystkie opcjonalne, default = obecne zachowanie):
--   recipient_name   — imię obdarowanego, używane w PDF zamiast customer_name
--   dedication       — tekst dedykacji wyświetlany w ramce na voucherze (max 200 znaków)
--   send_at          — ISO datetime, wysyłka maila zaplanowana (cron scheduled-vouchers)
--   email_sent_at    — kiedy faktycznie wysłaliśmy voucher email (idempotency dla crona)
--
-- Run: wrangler d1 execute akrobacja-db --remote --file=migrations/007-voucher-personalization.sql

ALTER TABLE orders ADD COLUMN recipient_name TEXT;
ALTER TABLE orders ADD COLUMN dedication TEXT;
ALTER TABLE orders ADD COLUMN send_at TEXT;
ALTER TABLE orders ADD COLUMN email_sent_at TEXT;

-- Index na cron scheduled-vouchers (filtruje paid + send_at <= now + email_sent_at IS NULL).
CREATE INDEX IF NOT EXISTS idx_orders_send_at
  ON orders(status, send_at, email_sent_at);
