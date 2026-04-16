-- Migration 003: Pilot portal + calendar + aircraft management + subscribers.email drift
-- Backfills tables that were created ad-hoc in production but never captured in schema.
-- Safe to run on fresh DBs and on existing DBs (IF NOT EXISTS guards everywhere).

-- Pilot portal (SMS OTP login)
CREATE TABLE IF NOT EXISTS pilots (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  email TEXT,
  license_type TEXT,
  license_number TEXT,
  balance_minutes INTEGER NOT NULL DEFAULT 0,
  insurance_status TEXT NOT NULL DEFAULT 'none',
  verified INTEGER NOT NULL DEFAULT 0,
  session_token TEXT,
  last_login TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pilots_phone ON pilots(phone);
CREATE INDEX IF NOT EXISTS idx_pilots_session ON pilots(session_token);

-- One-time codes for SMS login
CREATE TABLE IF NOT EXISTS otp_codes (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone, created_at);

-- Pilot balance audit log
CREATE TABLE IF NOT EXISTS balance_log (
  id TEXT PRIMARY KEY,
  pilot_id TEXT NOT NULL,
  change_minutes INTEGER NOT NULL,
  reason TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_balance_log_pilot ON balance_log(pilot_id, created_at);

-- FCL.800 aerobatic courses
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  license_number TEXT,
  total_flights INTEGER NOT NULL,
  completed_flights INTEGER NOT NULL DEFAULT 0,
  amount INTEGER,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_courses_email ON courses(customer_email);

-- Calendar slots (hour blocks)
CREATE TABLE IF NOT EXISTS slots (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  type TEXT NOT NULL,
  booking_id TEXT,
  status TEXT NOT NULL DEFAULT 'available'
);

CREATE INDEX IF NOT EXISTS idx_slots_date ON slots(date, start_time);
CREATE INDEX IF NOT EXISTS idx_slots_booking ON slots(booking_id);

-- Bookings (flight or course lesson)
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  slot_id TEXT NOT NULL,
  type TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  voucher_code TEXT,
  package_id TEXT,
  course_id TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_at TEXT,
  cancelled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status, created_at);
CREATE INDEX IF NOT EXISTS idx_bookings_voucher ON bookings(voucher_code);

-- Blocked dates (maintenance, weather, personal)
CREATE TABLE IF NOT EXISTS availability_blocks (
  id TEXT PRIMARY KEY,
  date_from TEXT NOT NULL,
  date_to TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_blocks_range ON availability_blocks(date_from, date_to);

-- Aircraft maintenance schedule
CREATE TABLE IF NOT EXISTS maintenance (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  description TEXT,
  due_date TEXT,
  due_hours REAL,
  current_hours REAL,
  status TEXT NOT NULL DEFAULT 'upcoming',
  completed_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Aircraft documents (insurance, ARC, etc.)
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  valid_from TEXT,
  valid_to TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Pilots requesting to be added to aircraft insurance
CREATE TABLE IF NOT EXISTS insurance_pilots (
  id TEXT PRIMARY KEY,
  pilot_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  approved_at TEXT,
  removed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_insurance_pilot ON insurance_pilots(pilot_id, status);

-- NOTE: `subscribers.email` already exists in production (added ad-hoc before
-- this migration was created). Skipping the ALTER here so D1 doesn't roll the
-- whole transaction back on "duplicate column". Schema.sql remains the
-- reference for fresh databases.
