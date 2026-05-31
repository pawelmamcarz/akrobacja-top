-- F2 dyplom uczestnika: znacznik wyslania dyplomu (idempotencja generacji po locie).
-- F3 oswiadczenie o bezpieczenstwie: znacznik akceptacji przy zakupie (dowod zgody).
-- D1/SQLite nie ma ADD COLUMN IF NOT EXISTS - migracja jednorazowa; przy ponownym
-- uruchomieniu blad "duplicate column" mozna zignorowac.
ALTER TABLE orders ADD COLUMN diploma_sent_at TEXT;
ALTER TABLE orders ADD COLUMN safety_accepted_at TEXT;
