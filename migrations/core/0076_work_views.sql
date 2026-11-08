-- View sharing stores configuration only. It never creates a work-graph grant.
CREATE TABLE peg_work_views (
 id TEXT PRIMARY KEY,
 project_id TEXT NOT NULL REFERENCES peg_projects(id) ON DELETE CASCADE,
 owner_id TEXT NOT NULL REFERENCES oa_operators(id) ON DELETE CASCADE,
 name TEXT NOT NULL,
 config TEXT NOT NULL,
 shared INTEGER NOT NULL DEFAULT 0 CHECK(shared IN (0,1)),
 revision INTEGER NOT NULL DEFAULT 1,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX peg_work_views_project ON peg_work_views(project_id,owner_id);
CREATE TABLE peg_work_view_defaults (
 project_id TEXT NOT NULL REFERENCES peg_projects(id) ON DELETE CASCADE,
 -- Empty subject is the project team default; all other subjects are personal.
 subject_id TEXT NOT NULL,
 view_id TEXT REFERENCES peg_work_views(id) ON DELETE SET NULL,
 updated_by TEXT NOT NULL REFERENCES oa_operators(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL DEFAULT 1,
 PRIMARY KEY(project_id,subject_id)
);
CREATE TRIGGER peg_work_views_insert AFTER INSERT ON peg_work_views BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_work_views_update AFTER UPDATE ON peg_work_views BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_work_views_delete AFTER DELETE ON peg_work_views BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_work_view_defaults_insert AFTER INSERT ON peg_work_view_defaults BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_work_view_defaults_update AFTER UPDATE ON peg_work_view_defaults BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_work_view_defaults_delete AFTER DELETE ON peg_work_view_defaults BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
