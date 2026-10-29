-- Keep the existing append-only scalar effect ledger and its guards intact.
CREATE TABLE peg_bulk_status_effects (
 id TEXT PRIMARY KEY, operation_id TEXT NOT NULL REFERENCES peg_bulk_operations(id),
 task_id TEXT NOT NULL, field TEXT NOT NULL CHECK(field='status'),
 before_value TEXT NOT NULL, after_value TEXT NOT NULL, history_id INTEGER NOT NULL,
 task_decisions INTEGER NOT NULL, proof_decisions INTEGER NOT NULL, field_generation INTEGER,
 UNIQUE(operation_id,task_id,field)
);
CREATE TRIGGER peg_bulk_status_immutable BEFORE UPDATE ON peg_bulk_status_effects BEGIN SELECT RAISE(ABORT,'immutable_bulk_effect'); END;
CREATE TRIGGER peg_bulk_status_erased_fence BEFORE INSERT ON peg_bulk_status_effects WHEN EXISTS(SELECT 1 FROM peg_data_erased_objects WHERE object_type='task' AND object_id=NEW.task_id) BEGIN SELECT RAISE(ABORT,'erased_object'); END;
CREATE TRIGGER peg_bulk_status_no_delete BEFORE DELETE ON peg_bulk_status_effects WHEN EXISTS(SELECT 1 FROM peg_tasks WHERE id=OLD.task_id) AND NOT EXISTS(SELECT 1 FROM peg_data_erased_objects WHERE object_type='task' AND object_id=OLD.task_id) BEGIN SELECT RAISE(ABORT,'reviewed_bulk_effect_erasure_required'); END;
CREATE TRIGGER peg_bulk_status_task_erased AFTER INSERT ON peg_data_erased_objects WHEN NEW.object_type='task' BEGIN DELETE FROM peg_bulk_status_effects WHERE task_id=NEW.object_id; END;
CREATE TRIGGER peg_bulk_status_task_deleted AFTER DELETE ON peg_tasks BEGIN DELETE FROM peg_bulk_status_effects WHERE task_id=OLD.id; END;
CREATE TRIGGER peg_bulk_status_revision AFTER INSERT ON peg_bulk_status_effects BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
