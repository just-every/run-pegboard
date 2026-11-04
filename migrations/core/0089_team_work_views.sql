-- Team views contain selected configuration, never grants or captured task data.
CREATE TABLE peg_team_work_views (
 id TEXT PRIMARY KEY,
 team_id TEXT NOT NULL REFERENCES peg_teams(id) ON DELETE CASCADE,
 owner_id TEXT NOT NULL REFERENCES oa_operators(id) ON DELETE CASCADE,
 name TEXT NOT NULL,
 config TEXT NOT NULL,
 shared INTEGER NOT NULL DEFAULT 0 CHECK(shared IN (0,1)),
 revision INTEGER NOT NULL DEFAULT 1,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX peg_team_work_views_team ON peg_team_work_views(team_id,owner_id);
CREATE TABLE peg_team_work_view_defaults (
 team_id TEXT NOT NULL REFERENCES peg_teams(id) ON DELETE CASCADE,
 subject_id TEXT NOT NULL,
 view_id TEXT REFERENCES peg_team_work_views(id) ON DELETE SET NULL,
 updated_by TEXT NOT NULL REFERENCES oa_operators(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL DEFAULT 1,
 PRIMARY KEY(team_id,subject_id)
);
CREATE TRIGGER peg_team_work_views_insert AFTER INSERT ON peg_team_work_views BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_team_work_views_update AFTER UPDATE ON peg_team_work_views BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_team_work_views_delete AFTER DELETE ON peg_team_work_views BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_team_work_view_defaults_insert AFTER INSERT ON peg_team_work_view_defaults BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_team_work_view_defaults_update AFTER UPDATE ON peg_team_work_view_defaults BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_team_work_view_defaults_delete AFTER DELETE ON peg_team_work_view_defaults BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
