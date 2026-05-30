-- Integracja kuriera apaczka.pl + wybór sposobu dostawy (kurier / paczkomat InPost)
-- dla zamówień merch. Dostawca (rola 'supplier') generuje etykietę z panelu, co woła
-- API apaczka, zapisuje numer przesyłki i klucz PDF etykiety w R2.
--
-- D1/SQLite nie ma ADD COLUMN IF NOT EXISTS — kolumny dodajemy świadomie, migracja
-- jednorazowa. Jeśli któraś kolumna już istnieje, operator ignoruje błąd "duplicate column".
ALTER TABLE merch_orders ADD COLUMN delivery_method TEXT NOT NULL DEFAULT 'courier'; -- 'courier' | 'inpost_locker'
ALTER TABLE merch_orders ADD COLUMN inpost_point_code TEXT;     -- ID punktu apaczka (→ receiver.foreign_address_id)
ALTER TABLE merch_orders ADD COLUMN apaczka_order_id TEXT;      -- ID przesyłki w apaczka
ALTER TABLE merch_orders ADD COLUMN apaczka_label_r2_key TEXT;  -- klucz PDF etykiety w R2 (labels/merch/{id}.pdf)
ALTER TABLE merch_orders ADD COLUMN parcel_weight_g INTEGER;    -- waga paczki w gramach (domyślnie 1000)

CREATE INDEX IF NOT EXISTS idx_merch_orders_apaczka ON merch_orders(apaczka_order_id);
