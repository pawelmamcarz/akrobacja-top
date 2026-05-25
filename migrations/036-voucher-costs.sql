-- Per-voucher override aktualnych kosztow (paliwo, czas lotu).
-- Default-y w voucher-split.ts (FUEL_PER_FLIGHT_GR * PACKAGE_FLIGHT_COUNT,
-- PACKAGE_FLIGHT_MINUTES) sa fallback gdy brak rekordu w tej tabeli.

CREATE TABLE IF NOT EXISTS voucher_costs (
  voucher_code TEXT PRIMARY KEY,
  fuel_gr INTEGER,                  -- faktyczne paliwo w groszach (NULL = default)
  aircraft_minutes_actual INTEGER,  -- faktyczne minuty lotu (NULL = default z pakietu)
  notes TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);
