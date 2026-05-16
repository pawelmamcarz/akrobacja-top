-- Migration 020: tabela reviews + akumulacja Google Reviews + seed opinii historycznych.
--
-- Kontekst: do dzisiaj sekcja "Opinie" w public/index.html ma 8 hardcoded kart
-- (6 z Google Reviews + 2 z Facebooka). Kazda nowa opinia na Google wymagala
-- recznego dopisania w HTML. Teraz cron co 6h pobiera z Google Places API i
-- akumuluje w tej tabeli, frontend renderuje z /api/reviews z paginacja.
--
-- google_review_id to stable dedup key — Places API nie daje stabilnego ID,
-- wiec hashujemy time + author_name. Przy retry / update opinia jest
-- aktualizowana (text, relative_time, photo) zamiast duplikowana.
--
-- Seed: 8 obecnych opinii z index.html jako historyczne dane. Time'y rosnaco
-- w przeszlosci (mar 2025 do paz 2025 — tylko stable order, nie rzeczywiste).
-- Po pierwszym cron run beda one nizej w sortowaniu niz nowe z Google API.
--
-- Run: wrangler d1 execute akrobacja-db --remote --file=migrations/020-reviews.sql

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'google',     -- 'google' | 'facebook' | 'manual'
  google_review_id TEXT,                     -- dedup key dla Google (hash time + author)
  author_name TEXT NOT NULL,
  author_url TEXT,
  profile_photo_url TEXT,
  rating INTEGER NOT NULL,                   -- 1-5
  text TEXT NOT NULL,
  language TEXT,
  relative_time TEXT,                        -- 'a week ago', 'tydzien temu' itd. (z Google)
  time INTEGER NOT NULL,                     -- Unix timestamp (z Google API)
  visible INTEGER NOT NULL DEFAULT 1,        -- 0 = ukryty (1-3 gwiazdki, lub manual ban)
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_google_id
  ON reviews(google_review_id) WHERE google_review_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_visible_time ON reviews(visible, time DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_source ON reviews(source);

-- Seed 8 hardcoded opinii z public/index.html. Time'y wybrane rosnaco w 2025
-- zeby seed mial deterministyczny porzadek. Po pierwszym cron run nowe Google
-- reviews z 2026+ beda u gory.
INSERT OR IGNORE INTO reviews (id, source, google_review_id, author_name, rating, text, time, visible, created_at) VALUES
  ('seed-001', 'google',   'seed_g_mariusz_kosciolek',   'Mariusz Kosciolek', 5, 'Lot akrobacyjny? Petarda! Nawet dla totalnego swiezaka w temacie, wrazenia jak po pierwszym przeciagnieciu i beczce. Pilot pelen profesjonalizm, briefing konkretny, a cala operacja dopieta jak w checklistach przed startem. Sprzet zadbany.', 1741000000, 1, datetime('now')),
  ('seed-002', 'google',   'seed_g_pawel_murak',         'Pawel Murak',       5, 'Wrazenia nie z (tej) ziemii! Wspanialy prezent dla uzaleznionych od adrenaliny!', 1743000000, 1, datetime('now')),
  ('seed-003', 'google',   'seed_g_marcin_kwiatosz',     'Marcin Kwiatosz',   5, 'Doskonale zaplecze szkoleniowe i swietnie utrzymana maszyna. Akrobacja uczy pokory i doskonalego czucia sterow, a tutaj ucza tego najlepiej. Instruktor nie odpuszcza, dopoki figura nie jest wykrecona w punkt. To miejsce, gdzie buduje sie prawdziwy kunszt pilotazowy.', 1745000000, 1, datetime('now')),
  ('seed-004', 'google',   'seed_g_kuczero91',           'kuczero91',         5, 'Lot dostalem w prezencie od zony. Niesamowite przezycie!!! Polecam kazdemu.', 1747000000, 1, datetime('now')),
  ('seed-005', 'google',   'seed_g_rafal_madejewski',    'Rafal Madejewski',  5, 'Polecam! Super zabawa! Niesamowita adrenalina ;)', 1749000000, 1, datetime('now')),
  ('seed-006', 'google',   'seed_g_filmolot',            'FilmoLot',          5, '★★★★★', 1751000000, 1, datetime('now')),
  ('seed-007', 'facebook', NULL,                         'Tomasz Filipiak',   5, 'Wrazenia niesamowite. Przeciazenia dodatnie 5G, ujemne 2G mielismy. Jak na pierwszy raz bylo mega. Maciej Kulaszewski dzieki bardzo za fantastyczny dzien spedzony w Powietrzu.', 1753000000, 1, datetime('now')),
  ('seed-008', 'facebook', NULL,                         'Pawel P.',          5, 'Mialem okazje latac z Mistrzem Swiata w akrobacji lotniczej. To nie byl lot widokowy, to byla precyzja, dyscyplina i poziom, ktory otwiera oczy. Jezeli ktos z Was mysli o rozpoczeciu przygody z akrobacja, serio, lepiej trafic sie nie da. Trening z kims, kto zna granice samolotu... i wlasne. Polecam z pelnym przekonaniem.', 1755000000, 1, datetime('now'));
