-- HubSpot event IDs are not globally unique. Bind the retained witness to its
-- portal, native source deal and occurrence, retaining every existing witness.
ALTER TABLE peg_commercial_events RENAME TO peg_commercial_events_legacy;
CREATE TABLE peg_commercial_events (
 portal_id TEXT NOT NULL, deal_id TEXT NOT NULL, event_id TEXT NOT NULL,
 handoff_id TEXT NOT NULL, occurred_at INTEGER NOT NULL,
 PRIMARY KEY(portal_id,deal_id,event_id,occurred_at)
);
INSERT INTO peg_commercial_events SELECT e.portal_id,h.deal_id,e.event_id,e.handoff_id,e.occurred_at FROM peg_commercial_events_legacy e JOIN peg_commercial_handoffs h ON h.id=e.handoff_id;
DROP TABLE peg_commercial_events_legacy;
CREATE TRIGGER peg_commercial_events_insert AFTER INSERT ON peg_commercial_events
BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_commercial_events_update AFTER UPDATE ON peg_commercial_events
BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_commercial_events_delete AFTER DELETE ON peg_commercial_events
BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
