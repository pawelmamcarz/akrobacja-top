-- Post-flight media share: photos/videos uploaded after flight, shared with
-- passenger via magic-link tokens. Two tables:
--   flight_media   one row per uploaded file (R2 key + metadata)
--   flight_shares  one row per generated link (token, voucher_code, expires)
-- A voucher_code can have many media files and multiple shares (re-issue if
-- needed). Public surface is /lot/[token] which lists everything for that
-- voucher_code, streams files via /api/share/[token]/file/[media_id].

CREATE TABLE IF NOT EXISTS flight_media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  voucher_code TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  filename TEXT NOT NULL,
  size INTEGER NOT NULL,
  content_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  duration_sec REAL,
  uploaded_at INTEGER NOT NULL,
  uploaded_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_flight_media_voucher ON flight_media(voucher_code, uploaded_at DESC);

CREATE TABLE IF NOT EXISTS flight_shares (
  token TEXT PRIMARY KEY,
  voucher_code TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  created_by TEXT,
  notify_sent_at INTEGER,
  view_count INTEGER NOT NULL DEFAULT 0,
  last_viewed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_flight_shares_voucher ON flight_shares(voucher_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_flight_shares_expires ON flight_shares(expires_at);
