-- Reviewed non-project scope and local reports never travel as active authority.
ALTER TABLE peg_analytics_keys ADD COLUMN scopes TEXT NOT NULL DEFAULT '{}';
CREATE TABLE peg_analytics_dependencies (
 snapshot_id TEXT NOT NULL REFERENCES peg_analytics_snapshots(id) ON DELETE CASCADE,
 object_type TEXT NOT NULL,object_id TEXT NOT NULL,PRIMARY KEY(snapshot_id,object_type,object_id)
);
CREATE TABLE peg_analytics_schedules (
 key_id TEXT PRIMARY KEY REFERENCES peg_analytics_keys(id) ON DELETE CASCADE,
 hours INTEGER NOT NULL,next_at INTEGER NOT NULL,last_snapshot TEXT,stopped_at INTEGER
);
CREATE TABLE peg_analytics_runs (
 key_id TEXT NOT NULL REFERENCES peg_analytics_keys(id) ON DELETE CASCADE,
 due_at INTEGER NOT NULL,snapshot_id TEXT NOT NULL,PRIMARY KEY(key_id,due_at)
);
CREATE TRIGGER peg_analytics_erased_task AFTER DELETE ON peg_tasks BEGIN
 UPDATE peg_analytics_rows SET body=NULL WHERE snapshot_id IN (SELECT snapshot_id FROM peg_analytics_dependencies WHERE object_type='task' AND object_id=OLD.id);
END;
CREATE TRIGGER peg_analytics_erased_project AFTER DELETE ON peg_projects BEGIN
 UPDATE peg_analytics_rows SET body=NULL WHERE snapshot_id IN (SELECT snapshot_id FROM peg_analytics_dependencies WHERE object_type='project' AND object_id=OLD.id);
END;
CREATE TRIGGER peg_analytics_erased_portfolio AFTER DELETE ON peg_portfolios BEGIN
 UPDATE peg_analytics_rows SET body=NULL WHERE snapshot_id IN (SELECT snapshot_id FROM peg_analytics_dependencies WHERE object_type='portfolio' AND object_id=OLD.id);
END;
CREATE TRIGGER peg_analytics_erased_goal AFTER DELETE ON peg_goals BEGIN
 UPDATE peg_analytics_rows SET body=NULL WHERE snapshot_id IN (SELECT snapshot_id FROM peg_analytics_dependencies WHERE object_type='goal' AND object_id=OLD.id);
END;
CREATE TRIGGER peg_analytics_erased_proof AFTER DELETE ON peg_proofs BEGIN
 UPDATE peg_analytics_rows SET body=NULL WHERE snapshot_id IN (SELECT snapshot_id FROM peg_analytics_dependencies WHERE object_type='proof' AND object_id=OLD.id);
END;
