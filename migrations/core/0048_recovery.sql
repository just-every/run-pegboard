-- Recovery retains graph rows in place. No content snapshot can outlive erasure.
CREATE TABLE peg_recovery (
 object_type TEXT NOT NULL CHECK(object_type IN ('project','task','proof_version')),
 object_id TEXT NOT NULL, workspace_id TEXT NOT NULL, actor_id TEXT NOT NULL,
 removed_at INTEGER NOT NULL, restored_at INTEGER, restored_by TEXT,
 PRIMARY KEY(object_type,object_id)
);
CREATE INDEX peg_recovery_workspace ON peg_recovery(workspace_id,restored_at,removed_at);
CREATE TRIGGER peg_recovery_revision_insert AFTER INSERT ON peg_recovery BEGIN
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
 UPDATE peg_data_revision SET value=value+1 WHERE id=1;
END;
CREATE TRIGGER peg_recovery_revision_update AFTER UPDATE ON peg_recovery BEGIN
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
 UPDATE peg_data_revision SET value=value+1 WHERE id=1;
END;
CREATE TRIGGER peg_recovery_revision_delete AFTER DELETE ON peg_recovery BEGIN
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
 UPDATE peg_data_revision SET value=value+1 WHERE id=1;
END;
