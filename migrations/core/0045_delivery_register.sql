CREATE TABLE peg_delivery_records (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES peg_projects(id), kind TEXT NOT NULL CHECK(kind IN ('risk','blocker','assumption','decision','change')),
 title TEXT NOT NULL, owner_id TEXT NOT NULL, impact TEXT NOT NULL, next_action TEXT NOT NULL, review_date TEXT NOT NULL,
 task_id TEXT, parent_id TEXT REFERENCES peg_delivery_records(id), vector_url TEXT, proposal TEXT NOT NULL, baseline TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('pending','accepted','rejected')), approver_id TEXT NOT NULL, created_by TEXT NOT NULL, created_at INTEGER NOT NULL,
 decided_by TEXT, decided_at INTEGER, reason TEXT
);
CREATE INDEX peg_delivery_project ON peg_delivery_records(project_id);
CREATE TRIGGER peg_delivery_immutable BEFORE UPDATE ON peg_delivery_records WHEN OLD.status<>'pending' OR NEW.baseline<>OLD.baseline OR NEW.proposal<>OLD.proposal BEGIN SELECT RAISE(ABORT,'immutable_delivery_record'); END;
CREATE TABLE peg_status_delivery_records (status_id TEXT NOT NULL REFERENCES peg_status_updates(id),record_id TEXT NOT NULL REFERENCES peg_delivery_records(id),PRIMARY KEY(status_id,record_id));
CREATE TRIGGER peg_delivery_revision AFTER UPDATE ON peg_delivery_records BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
