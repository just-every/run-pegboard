-- A real, redacted owner follow-up for a declared processor copy. No provider call or confirmation is fabricated.
CREATE TABLE peg_processor_deletions (
 id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,processor TEXT NOT NULL,subject_id TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state='needs_owner_action'),requested_by TEXT NOT NULL,created_at INTEGER NOT NULL,
 UNIQUE(processor,subject_id)
);
CREATE TRIGGER peg_processor_deletion_revision_insert AFTER INSERT ON peg_processor_deletions BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_processor_deletion_immutable_update BEFORE UPDATE ON peg_processor_deletions BEGIN SELECT RAISE(ABORT,'unverified_processor_deletion'); END;
CREATE TRIGGER peg_processor_deletion_immutable_delete BEFORE DELETE ON peg_processor_deletions BEGIN SELECT RAISE(ABORT,'unresolved_processor_deletion'); END;
