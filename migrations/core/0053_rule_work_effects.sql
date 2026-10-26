CREATE TABLE peg_rule_work_effects (
 id TEXT PRIMARY KEY, operation_id TEXT NOT NULL REFERENCES peg_bulk_operations(id),
 task_id TEXT NOT NULL, kind TEXT NOT NULL, target_id TEXT NOT NULL,
 before_value TEXT NOT NULL, after_value TEXT NOT NULL,
 generation INTEGER NOT NULL, history_id INTEGER NOT NULL,
 task_decisions INTEGER NOT NULL, proof_decisions INTEGER NOT NULL
);
CREATE INDEX peg_rule_work_effects_operation ON peg_rule_work_effects(operation_id);
CREATE TABLE peg_rule_link_generations(kind TEXT NOT NULL,task_id TEXT NOT NULL,target_id TEXT NOT NULL,generation INTEGER NOT NULL,PRIMARY KEY(kind,task_id,target_id));
CREATE TRIGGER peg_rule_work_effects_immutable BEFORE UPDATE ON peg_rule_work_effects BEGIN SELECT RAISE(ABORT,'immutable_rule_work_effect'); END;
CREATE TRIGGER peg_rule_work_effects_no_delete BEFORE DELETE ON peg_rule_work_effects
WHEN EXISTS(SELECT 1 FROM peg_tasks WHERE id=OLD.task_id) AND NOT EXISTS(SELECT 1 FROM peg_data_erased_objects WHERE object_type='task' AND object_id IN(OLD.task_id,OLD.target_id))
BEGIN SELECT RAISE(ABORT,'reviewed_rule_effect_erasure_required'); END;
CREATE TRIGGER peg_rule_work_task_erased AFTER INSERT ON peg_data_erased_objects WHEN NEW.object_type='task' BEGIN
 DELETE FROM peg_rule_work_effects WHERE task_id=NEW.object_id OR (kind='subtask' AND target_id=NEW.object_id);
 DELETE FROM peg_rule_link_generations WHERE task_id=NEW.object_id;
END;
CREATE TRIGGER peg_rule_work_task_deleted AFTER DELETE ON peg_tasks BEGIN
 DELETE FROM peg_rule_work_effects WHERE task_id=OLD.id;
 DELETE FROM peg_rule_link_generations WHERE task_id=OLD.id;
END;
CREATE TRIGGER peg_rule_work_revision AFTER INSERT ON peg_rule_work_effects BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_rule_generation_collaborator_insert AFTER INSERT ON peg_task_collaborators BEGIN
 INSERT INTO peg_rule_link_generations VALUES('collaborator',NEW.task_id,NEW.operator_id,1) ON CONFLICT(kind,task_id,target_id) DO UPDATE SET generation=generation+1;
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
END;
CREATE TRIGGER peg_rule_generation_collaborator_delete AFTER DELETE ON peg_task_collaborators BEGIN
 INSERT INTO peg_rule_link_generations VALUES('collaborator',OLD.task_id,OLD.operator_id,1) ON CONFLICT(kind,task_id,target_id) DO UPDATE SET generation=generation+1;
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
END;
CREATE TRIGGER peg_rule_generation_collaborator_update AFTER UPDATE ON peg_task_collaborators BEGIN
 INSERT INTO peg_rule_link_generations VALUES('collaborator',NEW.task_id,NEW.operator_id,1) ON CONFLICT(kind,task_id,target_id) DO UPDATE SET generation=generation+1;
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
END;
CREATE TRIGGER peg_rule_generation_project_insert AFTER INSERT ON peg_task_projects BEGIN
 INSERT INTO peg_rule_link_generations VALUES('project',NEW.task_id,NEW.project_id,1) ON CONFLICT(kind,task_id,target_id) DO UPDATE SET generation=generation+1;
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
END;
CREATE TRIGGER peg_rule_generation_project_delete AFTER DELETE ON peg_task_projects BEGIN
 INSERT INTO peg_rule_link_generations VALUES('project',OLD.task_id,OLD.project_id,1) ON CONFLICT(kind,task_id,target_id) DO UPDATE SET generation=generation+1;
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
END;
CREATE TRIGGER peg_rule_generation_project_update AFTER UPDATE ON peg_task_projects BEGIN
 INSERT INTO peg_rule_link_generations VALUES('project',NEW.task_id,NEW.project_id,1) ON CONFLICT(kind,task_id,target_id) DO UPDATE SET generation=generation+1;
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
END;
CREATE TRIGGER peg_rule_generation_tag_insert AFTER INSERT ON peg_task_tags BEGIN
 INSERT INTO peg_rule_link_generations VALUES('tag',NEW.task_id,NEW.tag_id,1) ON CONFLICT(kind,task_id,target_id) DO UPDATE SET generation=generation+1;
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
END;
CREATE TRIGGER peg_rule_generation_tag_delete AFTER DELETE ON peg_task_tags BEGIN
 INSERT INTO peg_rule_link_generations VALUES('tag',OLD.task_id,OLD.tag_id,1) ON CONFLICT(kind,task_id,target_id) DO UPDATE SET generation=generation+1;
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
END;
CREATE TRIGGER peg_rule_generation_tag_update AFTER UPDATE ON peg_task_tags BEGIN
 INSERT INTO peg_rule_link_generations VALUES('tag',NEW.task_id,NEW.tag_id,1) ON CONFLICT(kind,task_id,target_id) DO UPDATE SET generation=generation+1;
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
END;

-- Mutation counters outlive editable activity and its reviewed retention expiry.
ALTER TABLE peg_bulk_effects ADD COLUMN field_generation INTEGER;
CREATE TABLE peg_rule_mutation_generations(task_id TEXT NOT NULL,kind TEXT NOT NULL,generation INTEGER NOT NULL,PRIMARY KEY(task_id,kind));
CREATE TRIGGER peg_rule_task_generation_insert AFTER INSERT ON peg_tasks BEGIN INSERT INTO peg_rule_mutation_generations VALUES(NEW.id,'task',1); END;
CREATE TRIGGER peg_rule_task_generation_update AFTER UPDATE ON peg_tasks BEGIN INSERT INTO peg_rule_mutation_generations VALUES(NEW.id,'task',1) ON CONFLICT(task_id,kind) DO UPDATE SET generation=generation+1; END;
CREATE TRIGGER peg_rule_task_generation_delete AFTER DELETE ON peg_tasks BEGIN DELETE FROM peg_rule_mutation_generations WHERE task_id=OLD.id; END;
CREATE TRIGGER peg_rule_field_generation_owner_id AFTER UPDATE ON peg_tasks WHEN OLD.owner_id IS NOT NEW.owner_id BEGIN
 INSERT INTO peg_rule_mutation_generations VALUES(NEW.id,'owner_id',1) ON CONFLICT(task_id,kind) DO UPDATE SET generation=generation+1;
END;
CREATE TRIGGER peg_rule_field_generation_start_date AFTER UPDATE ON peg_tasks WHEN OLD.start_date IS NOT NEW.start_date BEGIN
 INSERT INTO peg_rule_mutation_generations VALUES(NEW.id,'start_date',1) ON CONFLICT(task_id,kind) DO UPDATE SET generation=generation+1;
END;
CREATE TRIGGER peg_rule_field_generation_due_date AFTER UPDATE ON peg_tasks WHEN OLD.due_date IS NOT NEW.due_date BEGIN
 INSERT INTO peg_rule_mutation_generations VALUES(NEW.id,'due_date',1) ON CONFLICT(task_id,kind) DO UPDATE SET generation=generation+1;
END;
CREATE TRIGGER peg_rule_field_generation_priority AFTER UPDATE ON peg_tasks WHEN OLD.priority IS NOT NEW.priority BEGIN
 INSERT INTO peg_rule_mutation_generations VALUES(NEW.id,'priority',1) ON CONFLICT(task_id,kind) DO UPDATE SET generation=generation+1;
END;
CREATE TRIGGER peg_rule_field_generation_status AFTER UPDATE ON peg_tasks WHEN OLD.status IS NOT NEW.status OR OLD.completed_at IS NOT NEW.completed_at BEGIN
 INSERT INTO peg_rule_mutation_generations VALUES(NEW.id,'status',1) ON CONFLICT(task_id,kind) DO UPDATE SET generation=generation+1;
END;
CREATE TRIGGER peg_rule_child_generation_peg_comments_insert AFTER INSERT ON peg_comments BEGIN
 INSERT INTO peg_rule_mutation_generations VALUES(NEW.task_id,'task',1) ON CONFLICT(task_id,kind) DO UPDATE SET generation=generation+1;
END;
CREATE TRIGGER peg_rule_child_generation_peg_comments_update AFTER UPDATE ON peg_comments BEGIN
 INSERT INTO peg_rule_mutation_generations VALUES(NEW.task_id,'task',1) ON CONFLICT(task_id,kind) DO UPDATE SET generation=generation+1;
END;
CREATE TRIGGER peg_rule_child_generation_peg_comments_delete AFTER DELETE ON peg_comments BEGIN
 INSERT INTO peg_rule_mutation_generations VALUES(OLD.task_id,'task',1) ON CONFLICT(task_id,kind) DO UPDATE SET generation=generation+1;
END;
CREATE TRIGGER peg_rule_child_generation_peg_attachments_insert AFTER INSERT ON peg_attachments BEGIN
 INSERT INTO peg_rule_mutation_generations VALUES(NEW.task_id,'task',1) ON CONFLICT(task_id,kind) DO UPDATE SET generation=generation+1;
END;
CREATE TRIGGER peg_rule_child_generation_peg_attachments_update AFTER UPDATE ON peg_attachments BEGIN
 INSERT INTO peg_rule_mutation_generations VALUES(NEW.task_id,'task',1) ON CONFLICT(task_id,kind) DO UPDATE SET generation=generation+1;
END;
CREATE TRIGGER peg_rule_child_generation_peg_attachments_delete AFTER DELETE ON peg_attachments BEGIN
 INSERT INTO peg_rule_mutation_generations VALUES(OLD.task_id,'task',1) ON CONFLICT(task_id,kind) DO UPDATE SET generation=generation+1;
END;
CREATE TRIGGER peg_rule_child_generation_peg_field_values_insert AFTER INSERT ON peg_field_values BEGIN
 INSERT INTO peg_rule_mutation_generations VALUES(NEW.task_id,'task',1) ON CONFLICT(task_id,kind) DO UPDATE SET generation=generation+1;
END;
CREATE TRIGGER peg_rule_child_generation_peg_field_values_update AFTER UPDATE ON peg_field_values BEGIN
 INSERT INTO peg_rule_mutation_generations VALUES(NEW.task_id,'task',1) ON CONFLICT(task_id,kind) DO UPDATE SET generation=generation+1;
END;
CREATE TRIGGER peg_rule_child_generation_peg_field_values_delete AFTER DELETE ON peg_field_values BEGIN
 INSERT INTO peg_rule_mutation_generations VALUES(OLD.task_id,'task',1) ON CONFLICT(task_id,kind) DO UPDATE SET generation=generation+1;
END;
CREATE TRIGGER peg_rule_child_generation_peg_time_entries_insert AFTER INSERT ON peg_time_entries BEGIN
 INSERT INTO peg_rule_mutation_generations VALUES(NEW.task_id,'task',1) ON CONFLICT(task_id,kind) DO UPDATE SET generation=generation+1;
END;
CREATE TRIGGER peg_rule_child_generation_peg_time_entries_update AFTER UPDATE ON peg_time_entries BEGIN
 INSERT INTO peg_rule_mutation_generations VALUES(NEW.task_id,'task',1) ON CONFLICT(task_id,kind) DO UPDATE SET generation=generation+1;
END;
CREATE TRIGGER peg_rule_child_generation_peg_time_entries_delete AFTER DELETE ON peg_time_entries BEGIN
 INSERT INTO peg_rule_mutation_generations VALUES(OLD.task_id,'task',1) ON CONFLICT(task_id,kind) DO UPDATE SET generation=generation+1;
END;
CREATE TRIGGER peg_rule_child_generation_peg_task_tags_insert AFTER INSERT ON peg_task_tags BEGIN
 INSERT INTO peg_rule_mutation_generations VALUES(NEW.task_id,'task',1) ON CONFLICT(task_id,kind) DO UPDATE SET generation=generation+1;
END;
CREATE TRIGGER peg_rule_child_generation_peg_task_tags_update AFTER UPDATE ON peg_task_tags BEGIN
 INSERT INTO peg_rule_mutation_generations VALUES(NEW.task_id,'task',1) ON CONFLICT(task_id,kind) DO UPDATE SET generation=generation+1;
END;
CREATE TRIGGER peg_rule_child_generation_peg_task_tags_delete AFTER DELETE ON peg_task_tags BEGIN
 INSERT INTO peg_rule_mutation_generations VALUES(OLD.task_id,'task',1) ON CONFLICT(task_id,kind) DO UPDATE SET generation=generation+1;
END;
CREATE TRIGGER peg_rule_child_generation_peg_task_collaborators_insert AFTER INSERT ON peg_task_collaborators BEGIN
 INSERT INTO peg_rule_mutation_generations VALUES(NEW.task_id,'task',1) ON CONFLICT(task_id,kind) DO UPDATE SET generation=generation+1;
END;
CREATE TRIGGER peg_rule_child_generation_peg_task_collaborators_update AFTER UPDATE ON peg_task_collaborators BEGIN
 INSERT INTO peg_rule_mutation_generations VALUES(NEW.task_id,'task',1) ON CONFLICT(task_id,kind) DO UPDATE SET generation=generation+1;
END;
CREATE TRIGGER peg_rule_child_generation_peg_task_collaborators_delete AFTER DELETE ON peg_task_collaborators BEGIN
 INSERT INTO peg_rule_mutation_generations VALUES(OLD.task_id,'task',1) ON CONFLICT(task_id,kind) DO UPDATE SET generation=generation+1;
END;
