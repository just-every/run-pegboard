-- Each queued trigger pins its reviewed definition and records one atomic effect set.
ALTER TABLE peg_bundle_jobs ADD COLUMN definition_version INTEGER;
ALTER TABLE peg_bundle_jobs ADD COLUMN outcome_reason TEXT;
CREATE TABLE peg_rule_effect_runs (
 run_id TEXT PRIMARY KEY REFERENCES peg_bundle_jobs(id),
 operation_id TEXT UNIQUE REFERENCES peg_bulk_operations(id),
 task_id TEXT NOT NULL, project_id TEXT NOT NULL,
 definition_version INTEGER NOT NULL, activation_epoch INTEGER NOT NULL,
 activating_admin TEXT NOT NULL, work_count INTEGER NOT NULL
);
CREATE TRIGGER peg_rule_effect_runs_immutable BEFORE UPDATE ON peg_rule_effect_runs BEGIN SELECT RAISE(ABORT,'immutable_rule_effect_run'); END;
CREATE TRIGGER peg_rule_effect_runs_no_delete BEFORE DELETE ON peg_rule_effect_runs
WHEN EXISTS(SELECT 1 FROM peg_tasks WHERE id=OLD.task_id) AND NOT EXISTS(SELECT 1 FROM peg_data_erased_objects WHERE object_type='task' AND object_id=OLD.task_id)
BEGIN SELECT RAISE(ABORT,'reviewed_rule_effect_erasure_required'); END;
CREATE TRIGGER peg_rule_effect_task_erased AFTER INSERT ON peg_data_erased_objects WHEN NEW.object_type='task'
BEGIN DELETE FROM peg_rule_effect_runs WHERE task_id=NEW.object_id; END;
CREATE TRIGGER peg_rule_effect_task_deleted AFTER DELETE ON peg_tasks BEGIN DELETE FROM peg_rule_effect_runs WHERE task_id=OLD.id; END;
CREATE TRIGGER peg_rule_effect_runs_revision AFTER INSERT ON peg_rule_effect_runs BEGIN
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
 UPDATE peg_data_revision SET value=value+1 WHERE id=1;
END;
CREATE TRIGGER peg_rule_job_revision AFTER UPDATE ON peg_bundle_jobs BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
