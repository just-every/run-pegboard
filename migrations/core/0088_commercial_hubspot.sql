-- Events hold identities only. Tenant authority always comes from a current human grant.
CREATE TABLE peg_commercial_portals (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, portal_id TEXT NOT NULL,
 actor_id TEXT NOT NULL, actor_version INTEGER NOT NULL, active INTEGER NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX peg_commercial_active_portal ON peg_commercial_portals(portal_id) WHERE active=1;
CREATE TABLE peg_commercial_handoffs (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, portal_auth_id TEXT NOT NULL,
 portal_id TEXT NOT NULL, deal_id TEXT NOT NULL, state TEXT NOT NULL,
 project_id TEXT, source_revision TEXT, commitment TEXT NOT NULL DEFAULT '{}',
 actor_id TEXT, created_at INTEGER NOT NULL,
 UNIQUE(workspace_id,portal_id,deal_id)
);
CREATE TABLE peg_commercial_events (
 portal_id TEXT NOT NULL, event_id TEXT NOT NULL, handoff_id TEXT NOT NULL,
 occurred_at INTEGER NOT NULL, PRIMARY KEY(portal_id,event_id)
);
CREATE TABLE peg_commercial_reviews (
 id TEXT PRIMARY KEY, handoff_id TEXT NOT NULL, kind TEXT NOT NULL,
 actor_id TEXT NOT NULL, actor_version INTEGER NOT NULL, plan TEXT NOT NULL,
 state TEXT NOT NULL, cause TEXT, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX peg_commercial_review_handoff ON peg_commercial_reviews(handoff_id,created_at);
CREATE TRIGGER peg_commercial_portals_insert AFTER INSERT ON peg_commercial_portals
BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_commercial_portals_update AFTER UPDATE ON peg_commercial_portals
BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_commercial_portals_delete AFTER DELETE ON peg_commercial_portals
BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_commercial_handoffs_insert AFTER INSERT ON peg_commercial_handoffs
BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_commercial_handoffs_update AFTER UPDATE ON peg_commercial_handoffs
BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_commercial_handoffs_delete AFTER DELETE ON peg_commercial_handoffs
BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_commercial_events_insert AFTER INSERT ON peg_commercial_events
BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_commercial_events_update AFTER UPDATE ON peg_commercial_events
BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_commercial_events_delete AFTER DELETE ON peg_commercial_events
BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_commercial_reviews_insert AFTER INSERT ON peg_commercial_reviews
BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_commercial_reviews_update AFTER UPDATE ON peg_commercial_reviews
BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_commercial_reviews_delete AFTER DELETE ON peg_commercial_reviews
BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
