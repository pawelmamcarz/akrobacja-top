-- Proper admin auth: email + password (PBKDF2-SHA256), session tokens, reset links.
-- Legacy Bearer ADMIN_PASSWORD / MAGDA_PASSWORD env vars stay supported as
-- fallback in checkAdminAuth() — only new "admin_users" rows go through email
-- login. Magda stays on legacy until she opts in.

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,      -- base64(PBKDF2-SHA256, 100k iter, 32-byte output)
  password_salt TEXT NOT NULL,      -- base64(16 random bytes)
  role TEXT NOT NULL DEFAULT 'admin',
  created_at INTEGER NOT NULL,
  last_login_at INTEGER,
  password_reset_token TEXT,        -- single-use, 32-char hex, expires in 1h
  password_reset_expires_at INTEGER,
  password_changed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_reset ON admin_users(password_reset_token) WHERE password_reset_token IS NOT NULL;

-- Browser sessions. Default lifetime 30 days; admin can extend by re-logging.
-- Token is the value sent as Bearer in Authorization header (or in cookie).
CREATE TABLE IF NOT EXISTS admin_sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  ip TEXT,
  user_agent TEXT,
  last_used_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES admin_users(id)
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_user ON admin_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);
