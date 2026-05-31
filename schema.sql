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
  email_sent_at TEXT,
  refund_received_at TEXT,
  addons TEXT,
  payment_method TEXT,
  payment_gateway TEXT,
  paynow_payment_id TEXT,
  diploma_sent_at TEXT,
  safety_accepted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_voucher_code ON orders(voucher_code);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_refund_received_at ON orders(refund_received_at) WHERE refund_received_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session ON orders(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_redeemed ON orders(redeemed_at);
CREATE INDEX IF NOT EXISTS idx_orders_abandon ON orders(status, abandon_email_sent_at, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_send_at ON orders(status, send_at, email_sent_at);
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method);

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
  printful_data TEXT,
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
  refund_received_at TEXT,
  baselinker_order_id INTEGER,
  payment_gateway TEXT,
  paynow_payment_id TEXT,
  -- Dostawa + kurier apaczka.pl (migracja 044)
  delivery_method TEXT NOT NULL DEFAULT 'courier', -- 'courier' | 'inpost_locker'
  inpost_point_code TEXT,        -- ID punktu apaczka (→ receiver.foreign_address_id)
  apaczka_order_id TEXT,         -- ID przesyłki w apaczka
  apaczka_label_r2_key TEXT,     -- klucz PDF etykiety w R2 (labels/merch/{id}.pdf)
  parcel_weight_g INTEGER,       -- waga paczki w gramach (domyślnie 1000)
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_merch_orders_status ON merch_orders(status);
CREATE INDEX IF NOT EXISTS idx_merch_orders_stripe ON merch_orders(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_merch_orders_created_at ON merch_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_merch_orders_apaczka ON merch_orders(apaczka_order_id);

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

-- Email-first lead capture (lead magnet PDF). Osobno od subscribers, bo subscribers.phone
-- jest UNIQUE NOT NULL — lead magnet nie wymaga telefonu.
CREATE TABLE IF NOT EXISTS email_leads (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  source TEXT NOT NULL DEFAULT 'lead_magnet_v1',
  name TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_email_leads_active ON email_leads(active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_leads_source ON email_leads(source, created_at DESC);

CREATE TABLE IF NOT EXISTS lead_emails_sent (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL,
  step INTEGER NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(lead_id, step)
);

CREATE INDEX IF NOT EXISTS idx_lead_emails_sent_lead ON lead_emails_sent(lead_id);

-- Audit table for outbound delivery failures (Resend, SMSAPI, wFirma, Meta CAPI).
-- Append-only. Admin panel reads grouped counts to spot misconfigured providers.
CREATE TABLE IF NOT EXISTS failed_deliveries (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL,
  ref_id TEXT,
  recipient TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_failed_deliveries_channel_created ON failed_deliveries(channel, created_at);
CREATE INDEX IF NOT EXISTS idx_failed_deliveries_ref ON failed_deliveries(ref_id);

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
  session_token_hash TEXT,
  session_expires_at TEXT,
  last_login TEXT,
  calendar_token TEXT,
  is_instructor INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pilots_phone ON pilots(phone);
CREATE INDEX IF NOT EXISTS idx_pilots_session ON pilots(session_token);
CREATE INDEX IF NOT EXISTS idx_pilots_session_token_hash ON pilots(session_token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pilots_calendar_token ON pilots(calendar_token) WHERE calendar_token IS NOT NULL;

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
CREATE INDEX IF NOT EXISTS idx_courses_customer_phone ON courses(customer_phone);

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
  review_request_sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status, created_at);
CREATE INDEX IF NOT EXISTS idx_bookings_review_pending ON bookings(status, review_request_sent_at) WHERE review_request_sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_voucher ON bookings(voucher_code);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_phone ON bookings(customer_phone);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_email ON bookings(customer_email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_voucher_unique_active
  ON bookings(voucher_code)
  WHERE voucher_code IS NOT NULL AND status != 'rejected';

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
  aircraft_id TEXT DEFAULT 'speks-001',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  valid_from TEXT,
  valid_to TEXT,
  notes TEXT,
  aircraft_id TEXT DEFAULT 'speks-001',
  r2_key TEXT,                          -- skan/plik (np. MS od CAMO); NULL = brak pliku
  source TEXT DEFAULT 'manual',         -- 'manual' | 'camo'
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

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'google',
  google_review_id TEXT,
  author_name TEXT NOT NULL,
  author_url TEXT,
  profile_photo_url TEXT,
  rating INTEGER NOT NULL,
  text TEXT NOT NULL,
  language TEXT,
  relative_time TEXT,
  time INTEGER NOT NULL,
  visible INTEGER NOT NULL DEFAULT 1,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_google_id
  ON reviews(google_review_id) WHERE google_review_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_visible_time ON reviews(visible, time DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_source ON reviews(source);

CREATE TABLE IF NOT EXISTS wa_clicks (
  id TEXT PRIMARY KEY,
  page TEXT NOT NULL,
  location TEXT,
  prefilled_text TEXT,
  target_number TEXT,              -- cyfry numeru WA bez '+' (np. '48739158131')
  ip TEXT,
  user_agent TEXT,
  referer TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wa_clicks_created ON wa_clicks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_clicks_page ON wa_clicks(page, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_clicks_location ON wa_clicks(location, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_clicks_target ON wa_clicks(target_number, created_at DESC);

-- Resend webhook events log: kazdy event (sent/delivered/opened/clicked/bounced/
-- complained/delivery_delayed/failed) zapisywany dla observability.
CREATE TABLE IF NOT EXISTS email_events (
  id TEXT PRIMARY KEY,
  resend_id TEXT,
  type TEXT NOT NULL,
  sender TEXT,
  recipient TEXT,
  subject TEXT,
  tag_type TEXT,
  tag_extra TEXT,
  raw_payload TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_email_events_created ON email_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_events_type ON email_events(type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_events_sender ON email_events(sender, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_events_resend_id ON email_events(resend_id);
CREATE INDEX IF NOT EXISTS idx_email_events_tag_type ON email_events(tag_type, created_at DESC);

-- Leady (Magda + cold-lead-scraper).
-- Centralna tabela kontaktow B2B z workflow new -> contacted -> responded ->
-- qualified -> won/lost. Kategorie odzwierciedlaja kanaly sprzedazy.
-- UWAGA: category jest walidowana w warstwie aplikacji (leads.ts VALID_CATEGORIES),
-- nie na poziomie DB (SQLite nie ma natywnych enumow).
-- Aktualne wartosci (2026-05):
--   event_agency, airshow, voucher_channel, b2b_benefit, municipal,
--   corp_b2b, wedding, automotive, influencer_agency, media,
--   foundation, csr_influencer, scraped_tender,
--   private_banking, stag_hen, car_club, film_production, foreign_marketplace,
--   other
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  url TEXT,
  city TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  priority TEXT,
  source TEXT,
  value_estimate_pln INTEGER,
  notes TEXT,
  next_action_at TEXT,
  last_contacted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(name, category)
);

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_priority ON leads(priority);
CREATE INDEX IF NOT EXISTS idx_leads_category ON leads(category);
CREATE INDEX IF NOT EXISTS idx_leads_next_action ON leads(next_action_at);

-- Zrodla dla cold-lead-scrapera (e-Zamowienia, TED, eGospodarka RSS, etc.).
-- search_template to JSON {keywords, cpv, country, ...} interpretowany przez
-- src/lib/lead-scraper.ts.
CREATE TABLE IF NOT EXISTS scraper_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  source_type TEXT NOT NULL,
  search_template TEXT,
  category TEXT NOT NULL DEFAULT 'scraped_tender',
  enabled INTEGER NOT NULL DEFAULT 1,
  last_run_at TEXT,
  last_hit_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scraper_runs (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  ran_at TEXT NOT NULL DEFAULT (datetime('now')),
  hits_found INTEGER DEFAULT 0,
  leads_created INTEGER DEFAULT 0,
  error TEXT,
  duration_ms INTEGER,
  FOREIGN KEY (source_id) REFERENCES scraper_sources(id)
);

CREATE INDEX IF NOT EXISTS idx_scraper_runs_source ON scraper_runs(source_id, ran_at DESC);

-- Log logowan do /admin (Pawel/Magda/...). Insert robi /api/admin/me z 1h
-- debounce per (username, ip).
CREATE TABLE IF NOT EXISTS admin_logins (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  logged_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_logins_user ON admin_logins(username, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_logins_at ON admin_logins(logged_at DESC);

-- Photographer submission queue. Public form POSTs to /api/photographer/upload,
-- file lands in R2 under submissions/{uuid}.jpg, row stays 'pending' until an admin
-- approves it from the "Zdjecia" tab. Approved rows surface on /galeria via /api/gallery.
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
  submitter_ua TEXT,
  event_tag TEXT
);
CREATE INDEX IF NOT EXISTS idx_gallery_subs_status ON gallery_submissions(status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_gallery_subs_event ON gallery_submissions(event_tag);

-- Post-flight media share. Admin uploads photos/videos per voucher_code into
-- R2 (prefix flight/{voucher_code}/{uuid}.ext); a flight_share row holds a
-- random token the passenger uses to view everything at /lot/[token]. Tokens
-- expire (default 180 days). Multiple shares per voucher allowed for re-issue.
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

-- Operating costs ledger. source = 'wfirma' (pulled daily from wFirma /expenses)
-- or 'manual' (admin-added paragon / cost without invoice). All amounts in grosze.
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  wfirma_id TEXT UNIQUE,
  invoice_number TEXT,
  contractor_name TEXT,
  contractor_nip TEXT,
  net_amount INTEGER NOT NULL,
  vat_amount INTEGER NOT NULL DEFAULT 0,
  gross_amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PLN',
  category TEXT,
  manual_category TEXT,
  issue_date TEXT NOT NULL,
  description TEXT,
  created_at INTEGER NOT NULL,
  added_by TEXT,
  ksef_invoice_uuid TEXT
);
CREATE INDEX IF NOT EXISTS idx_expenses_issue_date ON expenses(issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_contractor ON expenses(contractor_name);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_source ON expenses(source);
CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_ksef_uuid ON expenses(ksef_invoice_uuid) WHERE ksef_invoice_uuid IS NOT NULL;

-- Whitelist kontrahentow do auto-pull faktur kosztowych z wFirmy. Sync zaciaga
-- TYLKO faktury od tych kontrahentow (match po fragmencie nazwy lub NIP) i tylko
-- od daty granicznej (EXPENSES_SINCE = 2026-01-01). Patrz migrations/042.
CREATE TABLE IF NOT EXISTS expense_contractors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_name TEXT NOT NULL,
  nip TEXT,
  label TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_expense_contractors_active ON expense_contractors(active);

-- Proper admin auth — email + PBKDF2 password + session tokens + magic-link reset.
-- Legacy ADMIN_PASSWORD / MAGDA_PASSWORD Bearer secrets still work in parallel as
-- fallback (cron jobs and any non-migrated users keep working).
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at INTEGER NOT NULL,
  last_login_at INTEGER,
  password_reset_token TEXT,
  password_reset_expires_at INTEGER,
  password_changed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_reset ON admin_users(password_reset_token) WHERE password_reset_token IS NOT NULL;

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

-- Samoloty + wielogodzinne eventy pilotow (loty, szkolenia, maintenance).
-- Niezalezne od `slots` (per-1h bookingi klientow). Eksport do GCal przez
-- ICS feed /api/calendar/feed.ics?token=<pilots.calendar_token>.
CREATE TABLE IF NOT EXISTS aircrafts (
  id TEXT PRIMARY KEY,
  tail TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  notes TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  current_hours REAL,                   -- nalot narastajaco (z ostatniego zatwierdzonego wpisu dziennika)
  hours_updated_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_aircrafts_tail ON aircrafts(tail);

-- Cyfrowy dziennik pokladowy: wpisy auto-uzupelniane ze zdjec papierowego dziennika
-- technicznego (Workers AI wizja), z obowiazkowa recenzja czlowieka przed zatwierdzeniem.
CREATE TABLE IF NOT EXISTS flight_logbook (
  id TEXT PRIMARY KEY,
  aircraft_id TEXT NOT NULL DEFAULT 'speks-001',
  pilot_id TEXT,
  photo_r2_key TEXT,                    -- zdjecie strony dziennika w R2
  flight_date TEXT,                     -- YYYY-MM-DD
  flights_count INTEGER,
  flight_minutes INTEGER,               -- laczny czas lotu w danym dniu (min)
  landings INTEGER,
  hours_after REAL,                     -- nalot narastajaco po locie (h)
  fuel_l REAL,
  remarks TEXT,                         -- uwagi / usterki
  extracted_json TEXT,                  -- surowy wynik ekstrakcji AI (audyt)
  status TEXT NOT NULL DEFAULT 'pending_review', -- pending_review | confirmed | rejected
  confirmed_by TEXT,
  confirmed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_flight_logbook_aircraft ON flight_logbook(aircraft_id, flight_date DESC);
CREATE INDEX IF NOT EXISTS idx_flight_logbook_status ON flight_logbook(status, created_at DESC);

CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  pilot_id TEXT NOT NULL,
  aircraft_id TEXT,
  type TEXT NOT NULL,
  title TEXT,
  notes TEXT,
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  source TEXT NOT NULL DEFAULT 'manual',
  booking_id TEXT,
  created_by TEXT,
  google_event_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_calendar_events_pilot ON calendar_events(pilot_id, start_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_aircraft ON calendar_events(aircraft_id, start_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_range ON calendar_events(start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON calendar_events(type, start_at);
CREATE INDEX IF NOT EXISTS idx_calendar_events_booking ON calendar_events(booking_id) WHERE booking_id IS NOT NULL;

-- Per-voucher override kosztow (paliwo, czas lotu). Brak rekordu = default.
CREATE TABLE IF NOT EXISTS voucher_costs (
  voucher_code TEXT PRIMARY KEY,
  fuel_gr INTEGER,
  aircraft_minutes_actual INTEGER,
  notes TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);

-- KSeF whitelist: NIPy kontrahentow ktorych faktury kosztowe zaciagamy automatycznie
-- do expenses (source='ksef'). Manage przez admin panel: Koszty -> KSeF Whitelist.
-- (migracja 037-ksef.sql)
CREATE TABLE IF NOT EXISTS ksef_whitelist (
  nip TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  label TEXT,                            -- przyjazna nazwa (np. "Marketing FB")
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sprzedane eventy (pokazy, korpo, prywatne). 3-way split Pawel/Maciej/Magda.
-- NIE myli sie z calendar_events (loty pilotow). (migracja 038-events-sold.sql)
CREATE TABLE IF NOT EXISTS events_sold (
  id TEXT PRIMARY KEY,
  event_date TEXT NOT NULL,                 -- YYYY-MM-DD
  client_name TEXT NOT NULL,
  location TEXT,                            -- np. "Lotnisko EPMO Modlin"
  gross_amount_gr INTEGER NOT NULL,         -- cena w groszach
  dolot_minutes INTEGER NOT NULL DEFAULT 30,   -- minuty samolotu do miejsca i z powrotem
  pokaz_minutes INTEGER NOT NULL DEFAULT 30,   -- minuty pokazu na miejscu
  smok_cost_gr INTEGER NOT NULL DEFAULT 40000, -- koszt smoka/pirotechniki (default 400 zl)
  magda_share_pct INTEGER NOT NULL DEFAULT 10, -- % prowizji Magdy od ceny (default 10%)
  status TEXT NOT NULL DEFAULT 'planned',   -- planned/confirmed/done/cancelled
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_sold_date ON events_sold(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_events_sold_status ON events_sold(status, event_date DESC);

-- Per-email jednorazowe kody rabatowe (np. PHOTO-XXXX dla fotografow po akceptacji
-- zdjec). Checkout.ts najpierw sprawdza statyczny DISCOUNTS, potem fallback tutaj.
-- (migracja 039-personal-discount-codes.sql)
CREATE TABLE IF NOT EXISTS personal_discount_codes (
  code TEXT PRIMARY KEY,
  customer_email TEXT NOT NULL,
  pct INTEGER,                       -- rabat procentowy (np. 10 dla -10%)
  fixed_gr INTEGER,                  -- ALBO kwota fixed w groszach
  source TEXT,                       -- np. 'photo_thankyou', 'event_partner'
  expires_at TEXT,                   -- YYYY-MM-DD lub NULL = bez limitu
  used_at TEXT,                      -- gdy wykorzystany
  used_order_id TEXT,                -- orders.id ktore go wykorzystalo
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_personal_codes_email ON personal_discount_codes(customer_email);
CREATE INDEX IF NOT EXISTS idx_personal_codes_source ON personal_discount_codes(source, created_at DESC);
