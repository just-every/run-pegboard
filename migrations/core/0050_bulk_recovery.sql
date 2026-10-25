-- Owned field effects are append-only until their underlying task is erased.
CREATE TABLE peg_bulk_operations (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, actor_id TEXT NOT NULL,
 applied_at INTEGER NOT NULL, task_count INTEGER NOT NULL
);
CREATE TABLE peg_bulk_effects (
 id TEXT PRIMARY KEY, operation_id TEXT NOT NULL REFERENCES peg_bulk_operations(id),
 task_id TEXT NOT NULL, field TEXT NOT NULL CHECK(field IN ('owner_id','start_date','due_date','priority')),
 before_value TEXT NOT NULL, after_value TEXT NOT NULL, history_id INTEGER NOT NULL,
 task_decisions INTEGER NOT NULL, proof_decisions INTEGER NOT NULL,
 UNIQUE(operation_id,task_id,field)
);
CREATE INDEX peg_bulk_effects_task ON peg_bulk_effects(task_id,operation_id);
CREATE TABLE peg_bulk_undos (
 operation_id TEXT PRIMARY KEY REFERENCES peg_bulk_operations(id), actor_id TEXT NOT NULL,
 undone_at INTEGER NOT NULL, restored INTEGER NOT NULL, conflicts TEXT NOT NULL
);
-- Editable activity also participates in the exact review fence.
CREATE TRIGGER peg_bulk_history_insert_revision AFTER INSERT ON peg_history BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_bulk_history_update_revision AFTER UPDATE ON peg_history BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_bulk_history_delete_revision AFTER DELETE ON peg_history BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_bulk_operations_immutable BEFORE UPDATE ON peg_bulk_operations BEGIN SELECT RAISE(ABORT,'immutable_bulk_operation'); END;
CREATE TRIGGER peg_bulk_operations_no_delete BEFORE DELETE ON peg_bulk_operations BEGIN SELECT RAISE(ABORT,'immutable_bulk_operation'); END;
CREATE TRIGGER peg_bulk_effects_immutable BEFORE UPDATE ON peg_bulk_effects BEGIN SELECT RAISE(ABORT,'immutable_bulk_effect'); END;
CREATE TRIGGER peg_bulk_effects_no_delete BEFORE DELETE ON peg_bulk_effects
WHEN EXISTS(SELECT 1 FROM peg_tasks WHERE id=OLD.task_id) AND NOT EXISTS(SELECT 1 FROM peg_data_erased_objects WHERE object_type='task' AND object_id=OLD.task_id)
BEGIN SELECT RAISE(ABORT,'reviewed_bulk_effect_erasure_required'); END;
CREATE TRIGGER peg_bulk_undos_immutable BEFORE UPDATE ON peg_bulk_undos BEGIN SELECT RAISE(ABORT,'immutable_bulk_undo'); END;
CREATE TRIGGER peg_bulk_undos_no_delete BEFORE DELETE ON peg_bulk_undos BEGIN SELECT RAISE(ABORT,'immutable_bulk_undo'); END;
CREATE TRIGGER peg_bulk_task_erased AFTER INSERT ON peg_data_erased_objects WHEN NEW.object_type='task'
BEGIN DELETE FROM peg_bulk_effects WHERE task_id=NEW.object_id; END;
CREATE TRIGGER peg_bulk_task_deleted AFTER DELETE ON peg_tasks BEGIN DELETE FROM peg_bulk_effects WHERE task_id=OLD.id; END;
CREATE TRIGGER peg_bulk_operations_revision AFTER INSERT ON peg_bulk_operations BEGIN
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
 UPDATE peg_data_revision SET value=value+1 WHERE id=1;
END;
CREATE TRIGGER peg_bulk_effects_revision AFTER INSERT ON peg_bulk_effects BEGIN
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
 UPDATE peg_data_revision SET value=value+1 WHERE id=1;
END;
CREATE TRIGGER peg_bulk_effects_erasure_revision AFTER DELETE ON peg_bulk_effects BEGIN
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
 UPDATE peg_data_revision SET value=value+1 WHERE id=1;
END;
CREATE TRIGGER peg_bulk_undos_revision AFTER INSERT ON peg_bulk_undos BEGIN
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
 UPDATE peg_data_revision SET value=value+1 WHERE id=1;
END;
