CREATE TABLE peg_brief_versions (
 project_id TEXT NOT NULL REFERENCES peg_projects(id) ON DELETE CASCADE,
 version INTEGER NOT NULL CHECK(version>0), text TEXT NOT NULL,
 actor_id TEXT NOT NULL, created_at INTEGER NOT NULL, restored_from INTEGER,
 PRIMARY KEY(project_id,version)
);
CREATE TRIGGER peg_brief_versions_immutable BEFORE UPDATE ON peg_brief_versions BEGIN
 SELECT RAISE(ABORT,'immutable_brief_version');
END;
CREATE TRIGGER peg_brief_versions_preserved BEFORE DELETE ON peg_brief_versions
 WHEN EXISTS(SELECT 1 FROM peg_projects WHERE id=OLD.project_id) BEGIN
 SELECT RAISE(ABORT,'project_erasure_required');
END;
-- Also clean up when a receiving database has foreign key enforcement disabled.
CREATE TRIGGER peg_project_brief_erasure AFTER DELETE ON peg_projects BEGIN
 DELETE FROM peg_brief_versions WHERE project_id=OLD.id;
END;
CREATE TRIGGER peg_brief_version_fence BEFORE INSERT ON peg_brief_versions
 WHEN NOT EXISTS(SELECT 1 FROM peg_projects WHERE id=NEW.project_id)
 OR EXISTS(SELECT 1 FROM peg_data_erased_objects WHERE object_type='project' AND object_id=NEW.project_id) BEGIN
 SELECT RAISE(ABORT,'erased_object');
END;
CREATE TRIGGER peg_brief_revision_insert AFTER INSERT ON peg_brief_versions BEGIN
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
 UPDATE peg_data_revision SET value=value+1 WHERE id=1;
END;
CREATE TRIGGER peg_brief_revision_delete AFTER DELETE ON peg_brief_versions BEGIN
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
 UPDATE peg_data_revision SET value=value+1 WHERE id=1;
END;
