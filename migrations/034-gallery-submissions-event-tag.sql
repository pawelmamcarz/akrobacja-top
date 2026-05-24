-- Photographer submissions can now be tagged with the event they were shot at
-- (Airsky2026, ATAM37, …) so the admin can later sort / filter / route per
-- event. Free-form TEXT — new event names just get added to the dropdown in
-- public/wyslij-zdjecia.html without a migration.
ALTER TABLE gallery_submissions ADD COLUMN event_tag TEXT;
CREATE INDEX IF NOT EXISTS idx_gallery_subs_event ON gallery_submissions(event_tag);
