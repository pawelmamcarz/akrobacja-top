-- 017-failed-deliveries.sql
-- Audit table for outbound delivery failures (Resend, SMSAPI, wFirma). Today the
-- only signal that something is broken is an empty owner inbox or a customer
-- complaint. This table is appended to from every soft-failure catch in the
-- webhook / cron paths, so the admin panel can show a "things are failing"
-- counter without us hand-crafting CF Logs queries.
--
-- Designed append-only — no UPDATE, no per-record state. Cleanup is a scheduled
-- DELETE in a later cron (skip for now, the table is small).

CREATE TABLE IF NOT EXISTS failed_deliveries (
  id TEXT PRIMARY KEY,
  -- 'voucher_email' | 'owner_notify' | 'sms' | 'wfirma_invoice' | 'meta_capi' | 'abandoned_email' | 'welcome_email' | 'scheduled_voucher_email'
  channel TEXT NOT NULL,
  -- Loose foreign key: orders.id / merch_orders.id / subscribers.id / pilots.id depending on channel
  ref_id TEXT,
  recipient TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_failed_deliveries_channel_created ON failed_deliveries(channel, created_at);
CREATE INDEX IF NOT EXISTS idx_failed_deliveries_ref ON failed_deliveries(ref_id);
