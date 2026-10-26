-- Direct duplication keeps provenance separate from the source's access and decisions.
CREATE TABLE peg_project_duplicates (
 project_id TEXT PRIMARY KEY, source_project TEXT NOT NULL, actor_id TEXT NOT NULL,
 review_token TEXT NOT NULL UNIQUE, options TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE peg_duplicate_tasks (
 project_id TEXT NOT NULL, task_id TEXT NOT NULL UNIQUE, source_task TEXT NOT NULL,
 PRIMARY KEY(project_id,task_id)
);
CREATE TABLE peg_duplicate_staged (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('member','rule')),
 source_id TEXT NOT NULL, config TEXT NOT NULL, activated_at INTEGER, activated_by TEXT
);
CREATE INDEX peg_duplicate_staged_project ON peg_duplicate_staged(project_id);
CREATE TRIGGER peg_duplicate_staged_insert AFTER INSERT ON peg_duplicate_staged BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_duplicate_staged_update AFTER UPDATE ON peg_duplicate_staged BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_duplicate_staged_delete AFTER DELETE ON peg_duplicate_staged BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
-- Section edits must also invalidate an in-flight duplication review.
CREATE TRIGGER peg_duplicate_section_insert AFTER INSERT ON peg_sections BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_duplicate_section_update AFTER UPDATE ON peg_sections BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_duplicate_section_delete AFTER DELETE ON peg_sections BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
