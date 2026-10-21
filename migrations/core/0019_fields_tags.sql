-- Shared definitions retain identity and values across projects. Existing project fields retain every value.
ALTER TABLE peg_project_fields RENAME TO peg_project_fields_old;
CREATE TABLE peg_field_definitions (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, authority_project TEXT NOT NULL, key TEXT NOT NULL,
 label TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('text','number','currency','date','people','single','multi','checkbox','formula','rollup')),
 visibility TEXT NOT NULL CHECK(visibility IN ('everyone','internal','editors','admins')), units TEXT NOT NULL DEFAULT '', config TEXT NOT NULL DEFAULT '{}', version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE peg_project_fields (project_id TEXT NOT NULL, key TEXT NOT NULL, field_id TEXT NOT NULL, PRIMARY KEY(project_id,key), UNIQUE(project_id,field_id));
INSERT INTO peg_field_definitions(id,workspace_id,authority_project,key,label,type,visibility)
 SELECT f.project_id||':'||f.key,p.workspace_id,f.project_id,f.key,f.label,f.type,f.visibility FROM peg_project_fields_old f JOIN peg_projects p ON p.id=f.project_id;
INSERT INTO peg_project_fields SELECT project_id,key,project_id||':'||key FROM peg_project_fields_old;
CREATE TABLE peg_field_values (task_id TEXT NOT NULL, field_id TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY(task_id,field_id));
INSERT INTO peg_field_values SELECT tp.task_id,f.field_id,json_quote(j.value) FROM peg_task_projects tp JOIN json_each(tp.fields) j JOIN peg_project_fields f ON f.project_id=tp.project_id AND f.key=j.key;
DROP TABLE peg_project_fields_old;
CREATE TABLE peg_tags (id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,owner_id TEXT,creator_id TEXT NOT NULL,name TEXT NOT NULL,color TEXT NOT NULL DEFAULT '#287bc1',visibility TEXT NOT NULL DEFAULT 'internal' CHECK(visibility IN ('internal','project')),archived INTEGER NOT NULL DEFAULT 0);
CREATE TABLE peg_tag_projects(tag_id TEXT NOT NULL,project_id TEXT NOT NULL,PRIMARY KEY(tag_id,project_id));
CREATE TABLE peg_task_tags(task_id TEXT NOT NULL,tag_id TEXT NOT NULL,PRIMARY KEY(task_id,tag_id));
CREATE TRIGGER peg_field_rev_peg_field_definitions_insert AFTER INSERT ON peg_field_definitions BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_field_rev_peg_field_definitions_update AFTER UPDATE ON peg_field_definitions BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_field_rev_peg_field_definitions_delete AFTER DELETE ON peg_field_definitions BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_field_rev_peg_project_fields_insert AFTER INSERT ON peg_project_fields BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_field_rev_peg_project_fields_update AFTER UPDATE ON peg_project_fields BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_field_rev_peg_project_fields_delete AFTER DELETE ON peg_project_fields BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_field_rev_peg_field_values_insert AFTER INSERT ON peg_field_values BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_field_rev_peg_field_values_update AFTER UPDATE ON peg_field_values BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_field_rev_peg_field_values_delete AFTER DELETE ON peg_field_values BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
