-- BaseLinker order ID stored on fulfilled merch orders
ALTER TABLE merch_orders ADD COLUMN baselinker_order_id INTEGER;
