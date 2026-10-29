-- Source records remain in custody; canonical aliases never bypass current access.
CREATE TABLE peg_task_merges (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, actor_id TEXT NOT NULL,
 source_id TEXT NOT NULL, survivor_id TEXT NOT NULL, review_token TEXT NOT NULL UNIQUE,
 before_state TEXT NOT NULL, after_state TEXT NOT NULL, created_at INTEGER NOT NULL, undone_at INTEGER
);
CREATE UNIQUE INDEX peg_active_merge_source ON peg_task_merges(source_id) WHERE undone_at IS NULL;
CREATE TABLE peg_merge_items (
 operation_id TEXT NOT NULL REFERENCES peg_task_merges(id) ON DELETE CASCADE,
 kind TEXT NOT NULL, object_id TEXT NOT NULL, source_id TEXT NOT NULL,
 PRIMARY KEY(operation_id,kind,object_id)
);
CREATE TABLE peg_task_duplicates (
 source_id TEXT PRIMARY KEY, target_id TEXT NOT NULL, actor_id TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE peg_work_marks (
 workspace_id TEXT NOT NULL, person_id TEXT NOT NULL REFERENCES oa_operators(id) ON DELETE CASCADE,
 task_id TEXT NOT NULL, favorite INTEGER NOT NULL DEFAULT 0, visited_at INTEGER,
 PRIMARY KEY(person_id,task_id)
);
CREATE TRIGGER peg_merge_insert_revision AFTER INSERT ON peg_task_merges BEGIN
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
 UPDATE peg_data_revision SET value=value+1 WHERE id=1;
END;
CREATE TRIGGER peg_merge_update_revision AFTER UPDATE ON peg_task_merges BEGIN
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
 UPDATE peg_data_revision SET value=value+1 WHERE id=1;
END;
CREATE TRIGGER peg_duplicate_insert_revision AFTER INSERT ON peg_task_duplicates BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_duplicate_delete_revision AFTER DELETE ON peg_task_duplicates BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_merge_erased AFTER INSERT ON peg_data_erased_objects WHEN NEW.object_type='task' BEGIN
 DELETE FROM peg_work_marks WHERE task_id=NEW.object_id;
 DELETE FROM peg_task_duplicates WHERE source_id=NEW.object_id OR target_id=NEW.object_id;
 DELETE FROM peg_task_merges WHERE source_id=NEW.object_id OR survivor_id=NEW.object_id;
END;
