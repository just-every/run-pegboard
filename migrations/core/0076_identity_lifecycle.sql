-- Seed authority is canceled atomically even when status changes through Base's published account door.
-- Existing responsibilities and historical decisions stay attributable. No provider grant is represented here.
CREATE TABLE peg_identity_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT, operator_id TEXT NOT NULL, status TEXT NOT NULL, at INTEGER NOT NULL
);
CREATE TABLE peg_identity_request_cancellations (
 request_id TEXT NOT NULL, operator_id TEXT NOT NULL, PRIMARY KEY(request_id,operator_id)
);
CREATE TABLE peg_identity_approval_cancellations (
 route_id TEXT NOT NULL, operator_id TEXT NOT NULL, PRIMARY KEY(route_id,operator_id)
);
CREATE TRIGGER peg_identity_status AFTER UPDATE OF status ON oa_operators
WHEN OLD.status<>NEW.status BEGIN
 INSERT INTO peg_identity_events(operator_id,status,at) VALUES(NEW.id,NEW.status,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER));
END;
CREATE TRIGGER peg_identity_deactivate AFTER UPDATE OF status ON oa_operators
WHEN OLD.status<>NEW.status AND NEW.status='inactive' BEGIN
 UPDATE peg_api_keys SET revoked_at=COALESCE(revoked_at,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)) WHERE owner_id=NEW.id;
 UPDATE peg_analytics_keys SET revoked_at=COALESCE(revoked_at,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)) WHERE owner_id=NEW.id;
 UPDATE peg_analytics_schedules SET stopped_at=COALESCE(stopped_at,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)) WHERE key_id IN (SELECT id FROM peg_analytics_keys WHERE owner_id=NEW.id);
 UPDATE peg_grants SET revoked_at=COALESCE(revoked_at,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)),revoked_by=NEW.id WHERE revoked_at IS NULL AND grantee_type='person' AND ((created_by=NEW.id AND grantee_id IN (SELECT operator_id FROM peg_workspace_members WHERE role='agent')) OR (grantee_id=NEW.id AND EXISTS(SELECT 1 FROM peg_workspace_members WHERE operator_id=NEW.id AND role='agent')));
 DELETE FROM peg_personal_rules WHERE operator_id=NEW.id;
 UPDATE peg_recurrences SET active=0 WHERE created_by=NEW.id AND active=1;
 UPDATE peg_bundle_adoptions SET enabled=0,epoch=epoch+1 WHERE activated_by=NEW.id AND enabled=1;
 UPDATE peg_bundle_jobs SET status='cancelled',outcome_reason='identity_deactivated',finished_at=CAST((julianday('now')-2440587.5)*86400000 AS INTEGER) WHERE actor_id=NEW.id AND status IN ('queued','pending');
 UPDATE peg_local_rules SET enabled=0,activation_id=NULL WHERE activated_by=NEW.id;
 UPDATE peg_local_rule_runs SET status='noop',outcome='identity_deactivated',finished_at=CAST((julianday('now')-2440587.5)*86400000 AS INTEGER) WHERE activated_by=NEW.id AND status IN ('queued','pending');
 UPDATE peg_template_rules SET enabled=0,activation_id=NULL WHERE activation_id IN (SELECT id FROM peg_template_rule_activations WHERE activated_by=NEW.id);
 UPDATE peg_template_rule_runs SET status='noop',outcome='identity_deactivated',finished_at=CAST((julianday('now')-2440587.5)*86400000 AS INTEGER) WHERE status IN ('queued','pending') AND activation_id IN (SELECT id FROM peg_template_rule_activations WHERE activated_by=NEW.id);
 UPDATE peg_webhooks SET revoked_at=COALESCE(revoked_at,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)) WHERE created_by=NEW.id;
 UPDATE peg_approval_links SET revoked_at=COALESCE(revoked_at,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)) WHERE recipient_id=NEW.id OR route_id IN (SELECT id FROM peg_approval_routes WHERE created_by=NEW.id);
 INSERT OR IGNORE INTO peg_identity_approval_cancellations SELECT id,NEW.id FROM peg_approval_routes WHERE withdrawn_at IS NULL;
 INSERT OR IGNORE INTO peg_identity_request_cancellations SELECT id,NEW.id FROM peg_access_requests WHERE status='pending';
 UPDATE peg_access_requests SET status='stale' WHERE requester_id=NEW.id AND status='pending';
 DELETE FROM peg_inbox WHERE operator_id=NEW.id AND kind IN ('request','fallback');
END;

CREATE TRIGGER peg_identity_erased BEFORE UPDATE OF status ON oa_operators
WHEN OLD.status<>NEW.status AND NEW.status='active' AND EXISTS(SELECT 1 FROM peg_erased_people WHERE operator_id=NEW.id)
BEGIN SELECT RAISE(ABORT,'identity_erased'); END;
