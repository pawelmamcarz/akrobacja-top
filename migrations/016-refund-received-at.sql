-- 016-refund-received-at.sql
-- Track when Stripe charge.refunded arrived for each order, independently of the
-- current status. Needed because Stripe doesn't guarantee event ordering — refund
-- can arrive BEFORE checkout.session.completed. The current refund handler only
-- flips paid→refunded, so an early refund hits a pending row, becomes a no-op,
-- then the late completed event flips the order to paid and ships a PDF the
-- customer already got refunded for. Webhook now stamps refund_received_at on
-- refund events and the completed handler checks it before issuing the voucher.

ALTER TABLE orders ADD COLUMN refund_received_at TEXT;
ALTER TABLE merch_orders ADD COLUMN refund_received_at TEXT;
