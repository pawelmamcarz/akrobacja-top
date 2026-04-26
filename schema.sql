-- D1 Database schema for akrobacja.top voucher shop
-- Run: wrangler d1 execute akrobacja-db --file=schema.sql

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  voucher_code TEXT UNIQUE NOT NULL,
  package_id TEXT NOT NULL,
  video_addon INTEGER NOT NULL DEFAULT 0,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_nip TEXT,
  amount INTEGER NOT NULL,
  stripe_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  invoice_id TEXT,
  created_at TEXT NOT NULL,
  paid_at TEXT,
  expires_at TEXT,
  redeemed_at TEXT,
  abandon_email_sent_at TEXT,
  discount_code TEXT,
  recipient_name TEXT,
  dedication TEXT,
  send_at TEXT,
  email_sent_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_voucher_code ON orders(voucher_code);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session ON orders(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_redeemed ON orders(redeemed_at);
CREATE INDEX IF NOT EXISTS idx_orders_abandon ON orders(status, abandon_email_sent_at, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_send_at ON orders(status, send_at, email_sent_at);

-- Merch products
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  category TEXT,
  description TEXT,
  price INTEGER NOT NULL,
  image_url TEXT,
  variants TEXT DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_sort ON products(sort_order);

-- Merch orders
CREATE TABLE IF NOT EXISTS merch_orders (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  shipping_address TEXT NOT NULL,
  shipping_city TEXT NOT NULL,
  shipping_zip TEXT NOT NULL,
  items TEXT NOT NULL,
  total_amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  stripe_session_id TEXT,
  paid_at TEXT,
  shipped_at TEXT,
  tracking_number TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_merch_orders_status ON merch_orders(status);
CREATE INDEX IF NOT EXISTS idx_merch_orders_stripe ON merch_orders(stripe_session_id);

-- SMS subscribers (email column used by welcome email sequence)
CREATE TABLE IF NOT EXISTS subscribers (
  id TEXT PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  name TEXT,
  source TEXT DEFAULT 'website',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_subscribers_phone ON subscribers(phone);
CREATE INDEX IF NOT EXISTS idx_subscribers_active ON subscribers(active);

-- Welcome email sequence tracking (avoids altering subscribers table)
CREATE TABLE IF NOT EXISTS welcome_emails_sent (
  id TEXT PRIMARY KEY,
  subscriber_id TEXT NOT NULL,
  step INTEGER NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(subscriber_id, step)
);

CREATE INDEX IF NOT EXISTS idx_welcome_emails_subscriber ON welcome_emails_sent(subscriber_id);

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
  session_expires_at TEXT,
  last_login TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pilots_phone ON pilots(phone);
CREATE INDEX IF NOT EXISTS idx_pilots_session ON pilots(session_token);

-- Audyt zdarzeń auth: login / login_new_ip / logout (per phone, z IP + UA)
CREATE TABLE IF NOT EXISTS auth_events (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  pilot_id TEXT,
  event_type TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_auth_events_phone ON auth_events(phone, created_at DESC);

CREATE TABLE IF NOT EXISTS otp_codes (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone, created_at);

CREATE TABLE IF NOT EXISTS otp_attempts (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  ip TEXT,
  success INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_otp_attempts_phone ON otp_attempts(phone, created_at);
CREATE INDEX IF NOT EXISTS idx_otp_attempts_ip    ON otp_attempts(ip, created_at);

CREATE TABLE IF NOT EXISTS balance_log (
  id TEXT PRIMARY KEY,
  pilot_id TEXT NOT NULL,
  change_minutes INTEGER NOT NULL,
  reason TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_balance_log_pilot ON balance_log(pilot_id, created_at);

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
CREATE UNIQUE INDEX IF NOT EXISTS idx_slots_unique_active
  ON slots(date, start_time)
  WHERE status != 'available';

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

CREATE TABLE IF NOT EXISTS availability_blocks (
  id TEXT PRIMARY KEY,
  date_from TEXT NOT NULL,
  date_to TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_blocks_range ON availability_blocks(date_from, date_to);

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

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  valid_from TEXT,
  valid_to TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS insurance_pilots (
  id TEXT PRIMARY KEY,
  pilot_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  approved_at TEXT,
  removed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_insurance_pilot ON insurance_pilots(pilot_id, status);
