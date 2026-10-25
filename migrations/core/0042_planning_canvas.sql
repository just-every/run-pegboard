CREATE TABLE peg_canvas_nodes (
 id TEXT PRIMARY KEY,
 project_id TEXT NOT NULL REFERENCES peg_projects(id) ON DELETE CASCADE,
 parent_id TEXT REFERENCES peg_canvas_nodes(id) ON DELETE SET NULL,
 title TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('phase','note','task')),
 internal_only INTEGER NOT NULL DEFAULT 0 CHECK(internal_only IN (0,1)),
 position INTEGER NOT NULL DEFAULT 0,
 version INTEGER NOT NULL DEFAULT 1,
 task_id TEXT REFERENCES peg_tasks(id) ON DELETE CASCADE,
 CHECK((kind='task')=(task_id IS NOT NULL))
);
CREATE INDEX peg_canvas_project ON peg_canvas_nodes(project_id,parent_id,position);
CREATE UNIQUE INDEX peg_canvas_task ON peg_canvas_nodes(project_id,task_id) WHERE task_id IS NOT NULL;
CREATE TABLE peg_canvas_guards(value INTEGER NOT NULL CHECK(value=1));
CREATE TRIGGER peg_canvas_insert AFTER INSERT ON peg_canvas_nodes BEGIN
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
 UPDATE peg_data_revision SET value=value+1 WHERE id=1;
END;
CREATE TRIGGER peg_canvas_update AFTER UPDATE ON peg_canvas_nodes BEGIN
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
 UPDATE peg_data_revision SET value=value+1 WHERE id=1;
END;
CREATE TRIGGER peg_canvas_delete AFTER DELETE ON peg_canvas_nodes BEGIN
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
 UPDATE peg_data_revision SET value=value+1 WHERE id=1;
END;
