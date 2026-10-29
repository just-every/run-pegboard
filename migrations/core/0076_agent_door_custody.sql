-- A captured door decision invalidates any earlier native erasure review.
-- Native custody remains retained until a client-scoped door disposition exists.
CREATE TRIGGER peg_door_custody_call_insert AFTER INSERT ON agent_door_calls BEGIN
 UPDATE peg_data_revision SET value=value+1 WHERE id=1;
END;
CREATE TRIGGER peg_door_custody_call_update AFTER UPDATE ON agent_door_calls BEGIN
 UPDATE peg_data_revision SET value=value+1 WHERE id=1;
END;
CREATE TRIGGER peg_door_custody_approval_insert AFTER INSERT ON agent_door_approvals BEGIN
 UPDATE peg_data_revision SET value=value+1 WHERE id=1;
END;
CREATE TRIGGER peg_door_custody_review_insert AFTER INSERT ON agent_door_reviews BEGIN
 UPDATE peg_data_revision SET value=value+1 WHERE id=1;
END;
CREATE TRIGGER peg_door_custody_audit_insert AFTER INSERT ON agent_door_audit BEGIN
 UPDATE peg_data_revision SET value=value+1 WHERE id=1;
END;
