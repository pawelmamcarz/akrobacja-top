-- Photographer submission queue for galeria.html.
-- Files land in R2 under prefix submissions/ ; row goes pending until admin approves.
CREATE TABLE IF NOT EXISTS gallery_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  r2_key TEXT NOT NULL UNIQUE,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  photographer_name TEXT NOT NULL,
  photographer_city TEXT,
  photographer_instagram TEXT,
  photographer_email TEXT,
  caption TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_at INTEGER NOT NULL,
  approved_at INTEGER,
  approved_by TEXT,
  submitter_ip TEXT,
  submitter_ua TEXT
);
CREATE INDEX IF NOT EXISTS idx_gallery_subs_status ON gallery_submissions(status, submitted_at DESC);
