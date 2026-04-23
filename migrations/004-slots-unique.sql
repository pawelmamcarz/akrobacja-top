-- Migration 004: partial UNIQUE na slots(date, start_time) dla aktywnych rezerwacji.
--
-- Dwóch klientów POST-ujących ten sam slot równolegle mogło utworzyć dwa
-- bookingi na jedną godzinę (SELECT → INSERT race). Partial unique blokuje
-- duplikat, gdy slot jest 'pending' lub 'booked'; 'available' (po reject/cancel)
-- jest pomijany, żeby nie zablokować kolejnej rezerwacji na ten sam czas.
--
-- Run: wrangler d1 execute akrobacja-db --remote --file=migrations/004-slots-unique.sql

CREATE UNIQUE INDEX IF NOT EXISTS idx_slots_unique_active
  ON slots(date, start_time)
  WHERE status != 'available';
