CREATE TABLE peg_sheet_exports (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES peg_workspaces(id), owner_id TEXT NOT NULL REFERENCES oa_operators(id),
 owner_version INTEGER NOT NULL, spreadsheet_id TEXT NOT NULL, sheet_id INTEGER NOT NULL, tab_title TEXT NOT NULL,
 projects TEXT NOT NULL, fields TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1, version INTEGER NOT NULL DEFAULT 1,
 watermark TEXT, last_review TEXT, created_at INTEGER NOT NULL,
 UNIQUE(spreadsheet_id,sheet_id)
);
CREATE TABLE peg_sheet_rows (
 export_id TEXT NOT NULL REFERENCES peg_sheet_exports(id) ON DELETE CASCADE, task_id TEXT NOT NULL,
 row_number INTEGER NOT NULL, PRIMARY KEY(export_id,task_id), UNIQUE(export_id,row_number)
);
CREATE TABLE peg_sheet_reviews (
 id TEXT PRIMARY KEY, export_id TEXT NOT NULL REFERENCES peg_sheet_exports(id) ON DELETE CASCADE,
 export_version INTEGER NOT NULL, packet TEXT, source_digest TEXT NOT NULL, destination_digest TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('review','pending','confirmed','not_applied','conflict','invalidated')),
 expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX peg_sheet_one_pending ON peg_sheet_reviews(export_id) WHERE state='pending';
CREATE TRIGGER peg_sheet_export_update AFTER UPDATE ON peg_sheet_exports BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
-- Erasure invalidates saved content and old sends; an opaque row identity remains for a future deletion marker.
CREATE TRIGGER peg_sheet_task_erasure AFTER DELETE ON peg_tasks BEGIN UPDATE peg_sheet_reviews SET packet=NULL,state='invalidated' WHERE packet IS NOT NULL; END;
CREATE TRIGGER peg_sheet_project_erasure AFTER DELETE ON peg_projects BEGIN UPDATE peg_sheet_reviews SET packet=NULL,state='invalidated' WHERE packet IS NOT NULL; END;
CREATE TRIGGER peg_sheet_person_change AFTER UPDATE ON oa_operators BEGIN UPDATE peg_sheet_reviews SET packet=NULL,state='invalidated' WHERE packet IS NOT NULL; END;
