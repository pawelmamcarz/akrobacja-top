-- 024-email-leads.sql
-- Email-first lead capture (lead magnet PDF "Przewodnik po locie akrobacyjnym").
-- subscribers.phone jest UNIQUE NOT NULL, wiec lead magnet (email-only) potrzebuje
-- osobnej tabeli. lead_emails_sent sledzi nurture sequence per-step (D+0, D+2, D+4, ...).

CREATE TABLE IF NOT EXISTS email_leads (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  source TEXT NOT NULL DEFAULT 'lead_magnet_v1',  -- lead_magnet_v1 / popup / footer / ...
  name TEXT,                                       -- imie z formularza (opcjonalne)
  active INTEGER NOT NULL DEFAULT 1,               -- 0 = unsubscribe (reuse /api/unsubscribe)
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_email_leads_active ON email_leads(active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_leads_source ON email_leads(source, created_at DESC);

-- Per-step send tracking (D+0 PDF, D+2 bezpieczenstwo, D+4 social proof, D+7 oferta, D+14 reminder)
CREATE TABLE IF NOT EXISTS lead_emails_sent (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  step INTEGER NOT NULL,                           -- 0 = PDF magnet, 2/4/7/14 = nurture
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(lead_id, step)
);

CREATE INDEX IF NOT EXISTS idx_lead_emails_sent_lead ON lead_emails_sent(lead_id);
