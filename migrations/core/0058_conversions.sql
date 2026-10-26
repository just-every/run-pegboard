-- Conversions own relationships, never copies of work, evidence, or historical decisions.
CREATE TABLE peg_conversions (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, actor_id TEXT NOT NULL, kind TEXT NOT NULL,
 source_type TEXT NOT NULL, source_id TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT NOT NULL,
 review_token TEXT NOT NULL UNIQUE, options TEXT NOT NULL, reconciliation TEXT NOT NULL,
 created_at INTEGER NOT NULL, undone_at INTEGER, undone_by TEXT
);
CREATE TABLE peg_conversion_effects (
 conversion_id TEXT NOT NULL, position INTEGER NOT NULL, kind TEXT NOT NULL, task_id TEXT NOT NULL,
 project_id TEXT, before_state TEXT NOT NULL, after_state TEXT NOT NULL, undone_at INTEGER,
 PRIMARY KEY(conversion_id,position)
);
CREATE TABLE peg_conversion_links (
 conversion_id TEXT NOT NULL, object_type TEXT NOT NULL, object_id TEXT NOT NULL, relation TEXT NOT NULL,
 PRIMARY KEY(conversion_id,object_type,object_id,relation)
);
CREATE INDEX peg_conversion_links_object ON peg_conversion_links(object_type,object_id);
CREATE TABLE peg_conversion_repairs (
 conversion_id TEXT NOT NULL, kind TEXT NOT NULL, source_id TEXT NOT NULL, project_id TEXT,
 inert INTEGER NOT NULL DEFAULT 1 CHECK(inert=1), PRIMARY KEY(conversion_id,kind,source_id)
);
CREATE TRIGGER peg_conversion_revision_insert AFTER INSERT ON peg_conversions BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_conversion_revision_update AFTER UPDATE ON peg_conversions BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_conversion_cleanup AFTER DELETE ON peg_conversions BEGIN
 DELETE FROM peg_conversion_effects WHERE conversion_id=OLD.id;
 DELETE FROM peg_conversion_links WHERE conversion_id=OLD.id;
 DELETE FROM peg_conversion_repairs WHERE conversion_id=OLD.id;
END;
-- Erasure must not leave retained mapping or reconciliation snapshots outside native custody.
CREATE TRIGGER peg_conversion_task_erased AFTER DELETE ON peg_tasks BEGIN
 DELETE FROM peg_conversions WHERE id IN(SELECT conversion_id FROM peg_conversion_links WHERE object_type='task' AND object_id=OLD.id);
END;
CREATE TRIGGER peg_conversion_project_erased AFTER DELETE ON peg_projects BEGIN
 DELETE FROM peg_conversions WHERE id IN(SELECT conversion_id FROM peg_conversion_links WHERE object_type='project' AND object_id=OLD.id);
END;
