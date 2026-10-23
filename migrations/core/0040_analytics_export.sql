-- Analyst credentials and temporary export material never travel in an archive.
CREATE TABLE peg_analytics_keys (
 id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,owner_id TEXT NOT NULL,owner_version INTEGER NOT NULL,
 name TEXT NOT NULL,token_hash TEXT NOT NULL,projects TEXT NOT NULL,fields TEXT NOT NULL,
 created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,revoked_at INTEGER
);
CREATE TABLE peg_analytics_snapshots (
 id TEXT PRIMARY KEY,key_id TEXT NOT NULL REFERENCES peg_analytics_keys(id) ON DELETE CASCADE,
 captured_at INTEGER NOT NULL,source_revision INTEGER NOT NULL,expires_at INTEGER NOT NULL
);
CREATE INDEX peg_analytics_snapshot_key ON peg_analytics_snapshots(key_id);
CREATE TABLE peg_analytics_rows (
 snapshot_id TEXT NOT NULL REFERENCES peg_analytics_snapshots(id) ON DELETE CASCADE,
 dataset TEXT NOT NULL,id TEXT NOT NULL,task_id TEXT,project_id TEXT,body TEXT,hash TEXT NOT NULL,
 PRIMARY KEY(snapshot_id,dataset,id)
);
CREATE INDEX peg_analytics_row_task ON peg_analytics_rows(task_id);
-- Preserve only opaque removal identity; never serve erased payload from an older snapshot.
CREATE TRIGGER peg_analytics_task_erased AFTER DELETE ON peg_tasks BEGIN
 UPDATE peg_analytics_rows SET body=NULL WHERE task_id=OLD.id;
END;
CREATE TRIGGER peg_analytics_project_erased AFTER DELETE ON peg_projects BEGIN
 UPDATE peg_analytics_rows SET body=NULL WHERE project_id=OLD.id;
END;
CREATE TRIGGER peg_analytics_key_revoked AFTER UPDATE OF revoked_at ON peg_analytics_keys WHEN NEW.revoked_at IS NOT NULL BEGIN
 DELETE FROM peg_analytics_snapshots WHERE key_id=NEW.id;
END;
CREATE TABLE peg_analytics_guards (id TEXT PRIMARY KEY,key_id TEXT NOT NULL,revision INTEGER NOT NULL,not_after INTEGER NOT NULL);
CREATE TRIGGER peg_analytics_check BEFORE INSERT ON peg_analytics_guards BEGIN
 SELECT CASE WHEN NEW.revision<>(SELECT value FROM peg_data_revision WHERE id=1)
 OR NEW.not_after<=CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)
 OR NOT EXISTS(SELECT 1 FROM peg_analytics_keys k JOIN oa_operators o ON o.id=k.owner_id WHERE k.id=NEW.key_id AND k.revoked_at IS NULL AND k.expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER) AND o.status='active' AND o.version=k.owner_version)
 THEN RAISE(ABORT,'analyst_read_changed') END;
END;
CREATE TRIGGER peg_analytics_consume AFTER INSERT ON peg_analytics_guards BEGIN DELETE FROM peg_analytics_guards WHERE id=NEW.id; END;
