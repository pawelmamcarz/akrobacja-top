-- 023-email-events.sql
-- Resend webhook events log: kazdy event (sent, delivered, opened, clicked, bounced,
-- complained, delivery_delayed, failed) zapisywany jako wiersz dla observability.
-- Zrodlo: Resend webhook -> POST /api/webhook/resend (HMAC SHA256 verify Svix-Signature).

CREATE TABLE IF NOT EXISTS email_events (
  id TEXT PRIMARY KEY,
  resend_id TEXT,                    -- Resend email_id (laczy wszystkie events dla tego maila)
  type TEXT NOT NULL,                -- email.sent / email.delivered / email.opened / email.bounced / etc
  sender TEXT,                       -- from address (voucher@/system@/info@)
  recipient TEXT,                    -- to[0]
  subject TEXT,
  tag_type TEXT,                     -- nasza kategoria z tags: voucher/booking/welcome/owner/abandoned
  tag_extra TEXT,                    -- dodatkowy tag (np. package=adrenalina)
  raw_payload TEXT,                  -- pelny JSON eventu dla debugowania
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_email_events_created ON email_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_events_type ON email_events(type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_events_sender ON email_events(sender, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_events_resend_id ON email_events(resend_id);
CREATE INDEX IF NOT EXISTS idx_email_events_tag_type ON email_events(tag_type, created_at DESC);
