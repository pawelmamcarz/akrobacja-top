-- 018-review-request-sent.sql
-- Mark which bookings have already had a post-flight review-request SMS sent,
-- so the daily cron doesn't pester the same passenger twice. Stamp is set
-- AFTER the SMS API confirms successful submission.

ALTER TABLE bookings ADD COLUMN review_request_sent_at TEXT;
CREATE INDEX IF NOT EXISTS idx_bookings_review_pending
  ON bookings(status, review_request_sent_at)
  WHERE review_request_sent_at IS NULL;
