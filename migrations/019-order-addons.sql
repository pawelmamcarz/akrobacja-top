-- Migration 019: cross-sell addony w checkoutie voucherów (Sprint 1 rozwoju sprzedaży).
--
-- Kontekst: do dzisiaj jedyny addon w lejku to Video 360° (boolean video_addon).
-- Otwieramy 3 nowe pozycje: second_seat (drugi pasażer w tandemie), ground_photo
-- (fotograf z ziemi, 5 JPG w 48h), framed_print (wydruk + rama A3). Każdy addon jest
-- osobnym wpisem w Stripe line_items, osobnym wierszem na fakturze wFirma i ma swoją
-- cenę w `src/lib/types.ts` (stała ADDONS). Persystujemy listę wybranych addonów per
-- order jako JSON array stringów (np. '["second_seat","ground_photo"]'), żeby webhook
-- mógł odtworzyć dokładne pozycje na fakturze przy retry. video_addon zostaje jako
-- legacy boolean — webhook ustawia go true gdy 'video' jest w addons[].
--
-- Run: wrangler d1 execute akrobacja-db --remote --file=migrations/019-order-addons.sql

ALTER TABLE orders ADD COLUMN addons TEXT;
