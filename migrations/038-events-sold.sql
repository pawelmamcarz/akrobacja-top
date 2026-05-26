-- Sprzedane eventy (pokazy, korpo, prywatne). Sprzedaje glownie Magda.
-- 3-way split: Pawel (samolot), Maciej (paliwo + smok), Magda (prowizja sprzedaz).
-- NIE myli sie z calendar_events (loty pilotow do kalendarza).

CREATE TABLE IF NOT EXISTS events_sold (
  id TEXT PRIMARY KEY,
  event_date TEXT NOT NULL,                 -- YYYY-MM-DD
  client_name TEXT NOT NULL,
  location TEXT,                            -- np. "Lotnisko EPMO Modlin"
  gross_amount_gr INTEGER NOT NULL,         -- cena netto / brutto w groszach
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
