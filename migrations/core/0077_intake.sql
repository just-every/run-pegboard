-- Text intake keeps source identity separate from a person's authority.
CREATE TABLE peg_intake_forms (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL, version INTEGER NOT NULL,
 name TEXT NOT NULL, definition TEXT NOT NULL, publisher_id TEXT,
 publisher_version INTEGER, published_version INTEGER, published_calendar TEXT, public_hash TEXT,
 revoked_at INTEGER, created_by TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX peg_intake_capability ON peg_intake_forms(public_hash) WHERE public_hash IS NOT NULL;
CREATE TABLE peg_intake_submissions (
 id TEXT PRIMARY KEY, form_id TEXT NOT NULL, form_version INTEGER NOT NULL,
 request_key TEXT NOT NULL, fingerprint TEXT NOT NULL, task_id TEXT NOT NULL,
 source_actor TEXT NOT NULL, submitted_at INTEGER NOT NULL, deadline INTEGER NOT NULL,
 calendar TEXT NOT NULL, triaged_at INTEGER, triaged_by TEXT,
 escalated_at INTEGER, UNIQUE(form_id,request_key)
);
CREATE TABLE peg_intake_limits (bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL CHECK(attempts<=20), expires_at INTEGER NOT NULL);
CREATE TABLE peg_intake_guards (id TEXT PRIMARY KEY, form_id TEXT NOT NULL, version INTEGER NOT NULL);
CREATE TRIGGER peg_intake_guard BEFORE INSERT ON peg_intake_guards
WHEN NOT EXISTS(SELECT 1 FROM peg_intake_forms f WHERE f.id=NEW.form_id AND f.version=NEW.version AND f.published_version=f.version AND f.revoked_at IS NULL)
BEGIN SELECT RAISE(ABORT,'intake_changed'); END;
CREATE TRIGGER peg_intake_forms_revision_insert AFTER INSERT ON peg_intake_forms BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_intake_forms_revision_update AFTER UPDATE ON peg_intake_forms BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
-- A lost publisher role permanently invalidates its publication, including after reactivation.
CREATE TRIGGER peg_intake_publisher_changed AFTER UPDATE OF status,role,version ON oa_operators
BEGIN UPDATE peg_intake_forms SET revoked_at=1,public_hash=NULL WHERE publisher_id=NEW.id; END;
-- Erasure retains only an opaque source tombstone, so replay cannot recreate erased work.
CREATE TRIGGER peg_intake_task_erased AFTER DELETE ON peg_tasks
BEGIN UPDATE peg_intake_submissions SET source_actor='erased' WHERE task_id=OLD.id; END;
