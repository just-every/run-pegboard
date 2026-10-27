-- Custody authority is limited to one tracked request, never a work browsing grant.
CREATE TABLE peg_status_rights_requests (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, target_type TEXT NOT NULL CHECK(target_type IN ('task','project','person')),
 target_id TEXT NOT NULL, received_at INTEGER NOT NULL, ack_due INTEGER NOT NULL, response_due INTEGER NOT NULL,
 handler_id TEXT NOT NULL, handler_until INTEGER NOT NULL, version INTEGER NOT NULL DEFAULT 1,
 acknowledged_at INTEGER, responded_at INTEGER, final_due INTEGER,
 state TEXT NOT NULL DEFAULT 'review' CHECK(state IN ('review','controlled_resolution_pending','justified_retention')),
 next_review_at INTEGER,
 disposition TEXT NOT NULL DEFAULT '', retention_basis TEXT, retention_authority TEXT, retention_review_at INTEGER,
 extension_rule TEXT, extension_reason TEXT, extension_notice TEXT, extension_notified_at INTEGER,
 created_by TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE peg_status_rights_copies (
 request_id TEXT NOT NULL REFERENCES peg_status_rights_requests(id), copy_type TEXT NOT NULL, copy_id TEXT NOT NULL,
 PRIMARY KEY(request_id,copy_type,copy_id)
);
CREATE TABLE peg_status_rights_events (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES peg_status_rights_requests(id), actor_id TEXT NOT NULL,
 action TEXT NOT NULL, at INTEGER NOT NULL, detail TEXT NOT NULL
);
CREATE TABLE peg_status_rights_guards (id TEXT PRIMARY KEY, valid INTEGER NOT NULL CHECK(valid=1));
-- Fence new snapshots and updates as well as the copies inventoried at receipt.
CREATE TRIGGER peg_status_rights_draft_insert BEFORE INSERT ON peg_status_drafts
WHEN EXISTS (
 SELECT 1 FROM peg_status_rights_requests q WHERE q.workspace_id=NEW.workspace_id AND (
 (q.target_type='person' AND (q.target_id=NEW.created_by OR EXISTS(SELECT 1 FROM json_each(NEW.recipients) p WHERE json_extract(p.value,'$.id')=q.target_id))) OR
 (q.target_type='project' AND NEW.subject_type='project' AND NEW.subject_id=q.target_id) OR
 EXISTS(SELECT 1 FROM json_each(NEW.sources) s WHERE (q.target_type='task' AND json_extract(s.value,'$.id')=q.target_id) OR (q.target_type='project' AND EXISTS(SELECT 1 FROM peg_task_projects p WHERE p.task_id=json_extract(s.value,'$.id') AND p.project_id=q.target_id)))
 )) BEGIN SELECT RAISE(ABORT,'status_rights_custody_review'); END;
CREATE TRIGGER peg_status_rights_draft_update BEFORE UPDATE ON peg_status_drafts
WHEN EXISTS(SELECT 1 FROM peg_status_rights_copies WHERE copy_type='draft' AND copy_id=OLD.id) OR EXISTS (
 SELECT 1 FROM peg_status_rights_requests q WHERE q.workspace_id=NEW.workspace_id AND (
 (q.target_type='person' AND (q.target_id=NEW.created_by OR EXISTS(SELECT 1 FROM json_each(NEW.recipients) p WHERE json_extract(p.value,'$.id')=q.target_id))) OR
 (q.target_type='project' AND NEW.subject_type='project' AND NEW.subject_id=q.target_id) OR
 EXISTS(SELECT 1 FROM json_each(NEW.sources) s WHERE (q.target_type='task' AND json_extract(s.value,'$.id')=q.target_id) OR (q.target_type='project' AND EXISTS(SELECT 1 FROM peg_task_projects p WHERE p.task_id=json_extract(s.value,'$.id') AND p.project_id=q.target_id)))
 ))
BEGIN SELECT RAISE(ABORT,'status_rights_custody_review'); END;
CREATE TRIGGER peg_status_rights_revision_insert BEFORE INSERT ON peg_status_revisions
WHEN EXISTS(SELECT 1 FROM peg_status_rights_copies WHERE copy_type='draft' AND copy_id=NEW.draft_id)
BEGIN SELECT RAISE(ABORT,'status_rights_custody_review'); END;

CREATE TRIGGER peg_status_rights_comment_insert BEFORE INSERT ON peg_status_comments
WHEN EXISTS(SELECT 1 FROM peg_status_rights_copies WHERE copy_type='revision' AND copy_id=NEW.revision_id)
BEGIN SELECT RAISE(ABORT,'status_rights_custody_review'); END;
CREATE TRIGGER peg_status_rights_comment_update BEFORE UPDATE ON peg_status_comments
WHEN EXISTS(SELECT 1 FROM peg_status_rights_copies WHERE copy_type='revision' AND copy_id=NEW.revision_id)
BEGIN SELECT RAISE(ABORT,'status_rights_custody_review'); END;
