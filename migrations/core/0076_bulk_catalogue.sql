CREATE TABLE peg_catalogue_operations (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, actor_id TEXT NOT NULL,
 action TEXT NOT NULL, created_at INTEGER NOT NULL, undone_at INTEGER
);
CREATE TABLE peg_catalogue_rows (
 operation_id TEXT NOT NULL REFERENCES peg_catalogue_operations(id) ON DELETE CASCADE,
 task_id TEXT NOT NULL, result_id TEXT, outcome TEXT NOT NULL,
 before_state TEXT NOT NULL, after_state TEXT NOT NULL,
 PRIMARY KEY(operation_id,task_id)
);
CREATE TABLE peg_custom_generations(task_id TEXT NOT NULL,field_id TEXT NOT NULL,generation INTEGER NOT NULL,PRIMARY KEY(task_id,field_id));
CREATE TRIGGER peg_custom_generation_insert AFTER INSERT ON peg_field_values BEGIN INSERT INTO peg_custom_generations VALUES(NEW.task_id,NEW.field_id,1) ON CONFLICT(task_id,field_id) DO UPDATE SET generation=generation+1; END;
CREATE TRIGGER peg_custom_generation_update AFTER UPDATE ON peg_field_values BEGIN INSERT INTO peg_custom_generations VALUES(NEW.task_id,NEW.field_id,1) ON CONFLICT(task_id,field_id) DO UPDATE SET generation=generation+1; END;
CREATE TRIGGER peg_custom_generation_delete AFTER DELETE ON peg_field_values BEGIN INSERT INTO peg_custom_generations VALUES(OLD.task_id,OLD.field_id,1) ON CONFLICT(task_id,field_id) DO UPDATE SET generation=generation+1; END;
CREATE TRIGGER peg_catalogue_erased AFTER INSERT ON peg_data_erased_objects WHEN NEW.object_type='task' BEGIN
 DELETE FROM peg_catalogue_rows WHERE task_id=NEW.object_id OR result_id=NEW.object_id;
 DELETE FROM peg_custom_generations WHERE task_id=NEW.object_id;
END;
CREATE TRIGGER peg_catalogue_revision AFTER INSERT ON peg_catalogue_rows BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_catalogue_undo_revision AFTER UPDATE ON peg_catalogue_operations BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
