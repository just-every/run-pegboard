-- PEG-004: baselines, and the change sets that move dates. A change set is the exact reviewed set of date moves; it executes
-- once, attributed to the person who confirmed it, and can be undone while the dates are still as it left them.
CREATE TABLE peg_baselines (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL, created_by TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE peg_baseline_tasks (baseline_id TEXT NOT NULL, task_id TEXT NOT NULL, start_date TEXT, due_date TEXT, PRIMARY KEY(baseline_id,task_id));
CREATE TRIGGER peg_baseline_task_immutable BEFORE UPDATE ON peg_baseline_tasks BEGIN SELECT RAISE(ABORT,'immutable_baseline'); END;
CREATE TABLE peg_schedule_sets (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, initiator_id TEXT NOT NULL, initiator_kind TEXT NOT NULL CHECK(initiator_kind IN ('human','agent')),
 approver_id TEXT, status TEXT NOT NULL CHECK(status IN ('pending','applied','undone','rejected')), moves TEXT NOT NULL, stamp TEXT NOT NULL,
 created_at INTEGER NOT NULL, decided_by TEXT, decided_at INTEGER, undone_by TEXT, undone_at INTEGER
);
CREATE INDEX peg_schedule_sets_status ON peg_schedule_sets(workspace_id,status);
CREATE TABLE peg_schedule_changes (
 set_id TEXT NOT NULL, task_id TEXT NOT NULL, from_start TEXT, from_due TEXT, to_start TEXT, to_due TEXT, PRIMARY KEY(set_id,task_id)
);
CREATE TRIGGER peg_dependency_revision_insert AFTER INSERT ON peg_dependencies BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_dependency_revision_update AFTER UPDATE ON peg_dependencies BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_dependency_revision_delete AFTER DELETE ON peg_dependencies BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
