-- Migration 021: tabela wa_clicks - tracking klikniec w WhatsApp CTA na stronach
-- FCL.800 / dotacje / pozyczka 0%. User chce widziec w admin panelu kiedy
-- ktos klikal "Chce pozyczke 0%" -> WhatsApp Kulaszewskiego.
--
-- Endpoint POST /api/wa-click przyjmuje dane z frontendu (navigator.sendBeacon),
-- INSERTuje wiersz. Endpoint GET /api/admin/wa-clicks (admin auth) zwraca
-- ostatnie 200 + grupowanie po stronie / lokalizacji / 24h.
--
-- IP i user_agent zbieramy do dedup (jeden user moze klikac 3x ten sam CTA),
-- ale nie jako PII - rate-limit i statystyki tylko, brak korelacji z konkretna
-- osoba. Anonimizacja przez sam fakt ze WhatsApp link nie zna toza konstytuje
-- klienta (numer telefonu poznajemy dopiero z konwersacji WA).
--
-- Run: wrangler d1 execute akrobacja-db --remote --file=migrations/021-wa-clicks.sql

CREATE TABLE IF NOT EXISTS wa_clicks (
  id TEXT PRIMARY KEY,
  page TEXT NOT NULL,            -- np. '/dotacje-szkolenie-lotnicze'
  location TEXT,                  -- np. 'hero-cta', '10-krokow-cta', 'footer'
  prefilled_text TEXT,            -- tekst z parametru ?text= w wa.me (intent)
  ip TEXT,
  user_agent TEXT,
  referer TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wa_clicks_created ON wa_clicks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_clicks_page ON wa_clicks(page, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_clicks_location ON wa_clicks(location, created_at DESC);
