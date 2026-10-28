CREATE TABLE peg_local_rules (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1, definition TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 0,
 activation_id TEXT, activated_by TEXT, created_at INTEGER NOT NULL
);
CREATE TABLE peg_local_rule_activations (
 id TEXT PRIMARY KEY, rule_id TEXT NOT NULL, version INTEGER NOT NULL,
 definition TEXT NOT NULL, activated_by TEXT NOT NULL, activated_at INTEGER NOT NULL
);
CREATE TABLE peg_local_rule_runs (
 id TEXT PRIMARY KEY, rule_id TEXT NOT NULL, event_id TEXT NOT NULL,
 task_id TEXT NOT NULL, version INTEGER NOT NULL, definition TEXT NOT NULL,
 activation_id TEXT, activated_by TEXT, source TEXT NOT NULL, status TEXT NOT NULL,
 outcome TEXT, computed TEXT, operation_id TEXT, work_count INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, finished_at INTEGER,
 UNIQUE(rule_id,event_id)
);
CREATE INDEX peg_local_rule_queue ON peg_local_rule_runs(status,created_at);
-- Configuration and runs participate in the same optimistic authority guard as work edits.
CREATE TRIGGER peg_local_rule_revision_insert AFTER INSERT ON peg_local_rules BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_local_rule_revision_update AFTER UPDATE ON peg_local_rules BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_local_run_revision_update AFTER UPDATE ON peg_local_rule_runs BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_local_run_revision_insert AFTER INSERT ON peg_local_rule_runs BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_local_activation_immutable BEFORE UPDATE ON peg_local_rule_activations BEGIN SELECT RAISE(ABORT,'immutable_rule_activation'); END;
CREATE TABLE peg_rule_suggestions (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL, requested_by TEXT NOT NULL, message TEXT NOT NULL,
 status TEXT NOT NULL, reviewed_by TEXT, created_at INTEGER NOT NULL, reviewed_at INTEGER
);
CREATE TRIGGER peg_rule_suggestion_revision_insert AFTER INSERT ON peg_rule_suggestions BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_rule_suggestion_revision_update AFTER UPDATE ON peg_rule_suggestions BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TABLE peg_rule_requests (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL, request_key TEXT NOT NULL, fingerprint TEXT NOT NULL,
 task_id TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE(project_id,request_key)
);
CREATE TRIGGER peg_rule_request_revision_insert AFTER INSERT ON peg_rule_requests BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
-- Persist agent provenance independently of a person's later role or activation.
CREATE TABLE peg_rule_agent_sources (task_id TEXT PRIMARY KEY);
INSERT OR IGNORE INTO peg_rule_agent_sources(task_id)
SELECT DISTINCT h.task_id FROM peg_history h JOIN peg_tasks t ON t.id=h.task_id
JOIN peg_workspace_members m ON m.operator_id=h.actor_id AND m.workspace_id=t.workspace_id
WHERE m.role='agent' AND (h.kind IN ('created','fields.changed','status.changed') OR json_type(h.detail,'$.start_date') IS NOT NULL OR json_type(h.detail,'$.due_date') IS NOT NULL OR json_type(h.detail,'$.owner_id') IS NOT NULL OR json_type(h.detail,'$.status') IS NOT NULL);
CREATE TRIGGER peg_rule_agent_source_history AFTER INSERT ON peg_history
WHEN EXISTS(SELECT 1 FROM peg_tasks t JOIN peg_workspace_members m ON m.workspace_id=t.workspace_id WHERE t.id=NEW.task_id AND m.operator_id=NEW.actor_id AND m.role='agent')
AND (NEW.kind IN ('created','fields.changed','status.changed') OR json_type(NEW.detail,'$.start_date') IS NOT NULL OR json_type(NEW.detail,'$.due_date') IS NOT NULL OR json_type(NEW.detail,'$.owner_id') IS NOT NULL OR json_type(NEW.detail,'$.status') IS NOT NULL)
BEGIN INSERT OR IGNORE INTO peg_rule_agent_sources VALUES(NEW.task_id); END;
