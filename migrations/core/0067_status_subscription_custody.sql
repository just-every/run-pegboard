CREATE TRIGGER peg_status_subscription_insert AFTER INSERT ON peg_status_subscriptions
BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_status_subscription_update AFTER UPDATE ON peg_status_subscriptions
BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_status_subscription_delete AFTER DELETE ON peg_status_subscriptions
BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
