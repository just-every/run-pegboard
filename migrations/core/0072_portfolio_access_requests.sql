-- Extend requests without changing existing request IDs, decisions or inbox deliveries.
CREATE TABLE peg_access_requests_next (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, requester_id TEXT NOT NULL, requester_version INTEGER NOT NULL,
  target_type TEXT NOT NULL CHECK(target_type IN ('team','project','task','portfolio')), target_id TEXT NOT NULL,
  level TEXT NOT NULL CHECK(level IN ('viewer','commenter','editor','admin')), message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK(status IN ('pending','approved','denied','expired','stale')),
  policy_rev INTEGER NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL,
  decided_by TEXT, decided_at INTEGER, decision_reason TEXT, granted_level TEXT, grant_id TEXT, duplicates INTEGER NOT NULL DEFAULT 0
);
INSERT INTO peg_access_requests_next SELECT * FROM peg_access_requests;
DROP TABLE peg_access_requests;
ALTER TABLE peg_access_requests_next RENAME TO peg_access_requests;
CREATE UNIQUE INDEX peg_access_requests_active ON peg_access_requests(requester_id,target_type,target_id) WHERE status='pending';
CREATE INDEX peg_access_requests_target ON peg_access_requests(target_type,target_id);
CREATE TRIGGER peg_data_revision_peg_access_requests_insert AFTER INSERT ON peg_access_requests BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_data_revision_peg_access_requests_update AFTER UPDATE ON peg_access_requests BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_data_revision_peg_access_requests_delete AFTER DELETE ON peg_access_requests BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
ALTER TABLE peg_portfolio_members ADD COLUMN request_id TEXT;
ALTER TABLE peg_portfolios ADD COLUMN access_rev INTEGER NOT NULL DEFAULT 0;
-- Monotonic authority revisions also invalidate a preview after a removed Admin is restored.
CREATE TRIGGER peg_portfolio_authority_update AFTER UPDATE OF owner_id,parent_id ON peg_portfolios BEGIN
 UPDATE peg_epoch SET value=value+1 WHERE id=1;
 UPDATE peg_portfolios SET access_rev=(SELECT value FROM peg_epoch WHERE id=1) WHERE id=NEW.id;
END;
CREATE TRIGGER peg_portfolio_members_insert AFTER INSERT ON peg_portfolio_members BEGIN
 UPDATE peg_epoch SET value=value+1 WHERE id=1;
 UPDATE peg_portfolios SET access_rev=(SELECT value FROM peg_epoch WHERE id=1) WHERE id=NEW.portfolio_id;
END;
CREATE TRIGGER peg_portfolio_members_update AFTER UPDATE ON peg_portfolio_members BEGIN
 UPDATE peg_epoch SET value=value+1 WHERE id=1;
 UPDATE peg_portfolios SET access_rev=(SELECT value FROM peg_epoch WHERE id=1) WHERE id=NEW.portfolio_id;
END;
CREATE TRIGGER peg_portfolio_members_delete AFTER DELETE ON peg_portfolio_members BEGIN
 UPDATE peg_epoch SET value=value+1 WHERE id=1;
 UPDATE peg_portfolios SET access_rev=(SELECT value FROM peg_epoch WHERE id=1) WHERE id=OLD.portfolio_id;
END;
CREATE TRIGGER peg_data_revision_peg_portfolio_members_insert AFTER INSERT ON peg_portfolio_members BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_data_revision_peg_portfolio_members_update AFTER UPDATE ON peg_portfolio_members BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_data_revision_peg_portfolio_members_delete AFTER DELETE ON peg_portfolio_members BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
