-- Native reporting records event-time state. Earlier installed history is explicitly unknown.
CREATE TABLE peg_report_events (
 seq INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL, at INTEGER NOT NULL,
 kind TEXT NOT NULL, status TEXT NOT NULL, effort REAL NOT NULL, projects TEXT NOT NULL
);
CREATE INDEX peg_report_events_task ON peg_report_events(task_id,at,seq);
CREATE TABLE peg_report_dashboards (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, owner_id TEXT NOT NULL,
 name TEXT NOT NULL, definition TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE peg_report_snapshots (
 id TEXT PRIMARY KEY, dashboard_id TEXT NOT NULL, owner_id TEXT NOT NULL,
 captured_at INTEGER NOT NULL, revision INTEGER NOT NULL, body TEXT NOT NULL
);
CREATE TABLE peg_report_guards (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, actor_id TEXT NOT NULL);
CREATE TRIGGER peg_report_guard BEFORE INSERT ON peg_report_guards BEGIN
 SELECT CASE WHEN NEW.revision<>(SELECT value FROM peg_data_revision WHERE id=1)
 OR NOT EXISTS(SELECT 1 FROM oa_operators WHERE id=NEW.actor_id AND status='active')
 THEN RAISE(ABORT,'report_source_changed') END;
END;
CREATE TRIGGER peg_report_guard_consume AFTER INSERT ON peg_report_guards BEGIN DELETE FROM peg_report_guards WHERE id=NEW.id; END;
INSERT INTO peg_report_events(task_id,at,kind,status,effort,projects) SELECT t.id,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER),'baseline',t.status,t.estimate_hours,(WITH RECURSIVE parents(id,parent_id) AS (SELECT id,parent_id FROM peg_tasks WHERE id=t.id UNION SELECT t.id,t.parent_id FROM peg_tasks t JOIN parents p ON t.id=p.parent_id) SELECT json_group_array(project_id) FROM (SELECT DISTINCT project_id FROM peg_task_projects WHERE task_id IN(SELECT id FROM parents) ORDER BY project_id)) FROM peg_tasks t WHERE 1;
CREATE TRIGGER peg_report_created AFTER INSERT ON peg_tasks BEGIN INSERT INTO peg_report_events(task_id,at,kind,status,effort,projects) SELECT t.id,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER),'created',t.status,t.estimate_hours,(WITH RECURSIVE parents(id,parent_id) AS (SELECT id,parent_id FROM peg_tasks WHERE id=t.id UNION SELECT t.id,t.parent_id FROM peg_tasks t JOIN parents p ON t.id=p.parent_id) SELECT json_group_array(project_id) FROM (SELECT DISTINCT project_id FROM peg_task_projects WHERE task_id IN(SELECT id FROM parents) ORDER BY project_id)) FROM peg_tasks t WHERE t.id=NEW.id; END;
CREATE TRIGGER peg_report_state AFTER UPDATE OF status,estimate_hours ON peg_tasks WHEN NEW.status<>OLD.status OR NEW.estimate_hours<>OLD.estimate_hours BEGIN INSERT INTO peg_report_events(task_id,at,kind,status,effort,projects) SELECT t.id,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER),'state',t.status,t.estimate_hours,(WITH RECURSIVE parents(id,parent_id) AS (SELECT id,parent_id FROM peg_tasks WHERE id=t.id UNION SELECT t.id,t.parent_id FROM peg_tasks t JOIN parents p ON t.id=p.parent_id) SELECT json_group_array(project_id) FROM (SELECT DISTINCT project_id FROM peg_task_projects WHERE task_id IN(SELECT id FROM parents) ORDER BY project_id)) FROM peg_tasks t WHERE t.id=NEW.id; END;
CREATE TRIGGER peg_report_scope_insert AFTER INSERT ON peg_task_projects BEGIN INSERT INTO peg_report_events(task_id,at,kind,status,effort,projects) SELECT t.id,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER),'scope_added',t.status,t.estimate_hours,(WITH RECURSIVE parents(id,parent_id) AS (SELECT id,parent_id FROM peg_tasks WHERE id=t.id UNION SELECT t.id,t.parent_id FROM peg_tasks t JOIN parents p ON t.id=p.parent_id) SELECT json_group_array(project_id) FROM (SELECT DISTINCT project_id FROM peg_task_projects WHERE task_id IN(SELECT id FROM parents) ORDER BY project_id)) FROM peg_tasks t WHERE t.id IN(WITH RECURSIVE children(id) AS (SELECT NEW.task_id UNION SELECT c.id FROM peg_tasks c JOIN children p ON c.parent_id=p.id) SELECT id FROM children); END;
CREATE TRIGGER peg_report_scope_delete AFTER DELETE ON peg_task_projects BEGIN INSERT INTO peg_report_events(task_id,at,kind,status,effort,projects) SELECT t.id,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER),'scope_removed',t.status,t.estimate_hours,(WITH RECURSIVE parents(id,parent_id) AS (SELECT id,parent_id FROM peg_tasks WHERE id=t.id UNION SELECT t.id,t.parent_id FROM peg_tasks t JOIN parents p ON t.id=p.parent_id) SELECT json_group_array(project_id) FROM (SELECT DISTINCT project_id FROM peg_task_projects WHERE task_id IN(SELECT id FROM parents) ORDER BY project_id)) FROM peg_tasks t WHERE t.id IN(WITH RECURSIVE children(id) AS (SELECT OLD.task_id UNION SELECT c.id FROM peg_tasks c JOIN children p ON c.parent_id=p.id) SELECT id FROM children); END;
CREATE TRIGGER peg_report_parent AFTER UPDATE OF parent_id ON peg_tasks WHEN NEW.parent_id IS NOT OLD.parent_id BEGIN INSERT INTO peg_report_events(task_id,at,kind,status,effort,projects) SELECT t.id,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER),'scope_changed',t.status,t.estimate_hours,(WITH RECURSIVE parents(id,parent_id) AS (SELECT id,parent_id FROM peg_tasks WHERE id=t.id UNION SELECT t.id,t.parent_id FROM peg_tasks t JOIN parents p ON t.id=p.parent_id) SELECT json_group_array(project_id) FROM (SELECT DISTINCT project_id FROM peg_task_projects WHERE task_id IN(SELECT id FROM parents) ORDER BY project_id)) FROM peg_tasks t WHERE t.id IN(WITH RECURSIVE children(id) AS (SELECT NEW.id UNION SELECT c.id FROM peg_tasks c JOIN children p ON c.parent_id=p.id) SELECT id FROM children); END;
-- Erasure clears cached titles and event references. Deleted history cannot be replayed into a new report.
CREATE TRIGGER peg_report_task_erased AFTER DELETE ON peg_tasks BEGIN
 DELETE FROM peg_report_snapshots;
 DELETE FROM peg_report_events WHERE task_id=OLD.id;
END;
CREATE TRIGGER peg_report_person_erased AFTER UPDATE OF display_name,email ON oa_operators BEGIN DELETE FROM peg_report_snapshots; END;
CREATE TRIGGER peg_report_project_erased AFTER DELETE ON peg_projects BEGIN DELETE FROM peg_report_snapshots; END;
