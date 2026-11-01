-- Existing requests retain an explicitly labelled migration-time mapped-work snapshot.
-- New requests retain the exact mapped text before anyone can edit the task.
CREATE TABLE peg_intake_sources (
 submission_id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
 provenance TEXT NOT NULL CHECK(provenance IN ('submitted_text','mapped_work_snapshot'))
);
INSERT INTO peg_intake_sources SELECT s.id,t.title,t.description,'mapped_work_snapshot' FROM peg_intake_submissions s JOIN peg_tasks t ON t.id=s.task_id;
CREATE TRIGGER peg_intake_source_no_update BEFORE UPDATE ON peg_intake_sources BEGIN SELECT RAISE(ABORT,'intake_source_immutable'); END;
CREATE TRIGGER peg_intake_source_revision_insert AFTER INSERT ON peg_intake_sources BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_intake_source_revision_delete AFTER DELETE ON peg_intake_sources BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
