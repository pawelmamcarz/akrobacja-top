-- 015-session-token-hash.sql
-- Hash pilots.session_token at rest. The new column session_token_hash stores
-- SHA-256(token) hex; the legacy session_token (plaintext) column is kept for
-- backward compat so existing logged-in pilots aren't kicked out — pilot-auth.ts
-- falls back to plaintext match if no hash hit is found, and on success migrates
-- the row by populating session_token_hash and clearing session_token.
-- After ~30 days (when all 30-day TTL legacy sessions expire) drop session_token
-- entirely with a follow-up migration.

ALTER TABLE pilots ADD COLUMN session_token_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_pilots_session_token_hash ON pilots(session_token_hash);
