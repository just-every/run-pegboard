-- Extend retained recovery to native files without copying bytes or labels.
CREATE TABLE peg_recovery_attachments (
 object_type TEXT NOT NULL CHECK(object_type IN ('project','task','proof_version','attachment')),
 object_id TEXT NOT NULL, workspace_id TEXT NOT NULL, actor_id TEXT NOT NULL,
 removed_at INTEGER NOT NULL, restored_at INTEGER, restored_by TEXT,
 PRIMARY KEY(object_type,object_id)
);
INSERT INTO peg_recovery_attachments SELECT * FROM peg_recovery;
DROP TABLE peg_recovery;
ALTER TABLE peg_recovery_attachments RENAME TO peg_recovery;
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
-- Irreversible erasure removes the restore handle as well as the underlying bytes.
CREATE TRIGGER peg_attachment_recovery_erasure AFTER DELETE ON peg_attachments BEGIN
 DELETE FROM peg_recovery WHERE object_type='attachment' AND object_id=OLD.id;
END;
