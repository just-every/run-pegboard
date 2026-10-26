-- PEG-006 reviewed template definitions and concrete adoption provenance.
CREATE TABLE peg_reusable_templates(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,name TEXT NOT NULL,family TEXT NOT NULL,authority_project TEXT,created_by TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE peg_reusable_template_versions(template_id TEXT NOT NULL,version INTEGER NOT NULL,definition TEXT NOT NULL,created_by TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(template_id,version));
CREATE TRIGGER peg_reusable_template_version_immutable BEFORE UPDATE ON peg_reusable_template_versions BEGIN SELECT RAISE(ABORT,'immutable_template_version'); END;
CREATE TRIGGER peg_reusable_template_version_retained BEFORE DELETE ON peg_reusable_template_versions BEGIN SELECT RAISE(ABORT,'immutable_template_version'); END;
CREATE TABLE peg_template_applications(id TEXT PRIMARY KEY,template_id TEXT NOT NULL,version INTEGER NOT NULL,project_id TEXT NOT NULL,workspace_id TEXT NOT NULL,actor_id TEXT NOT NULL,request_key TEXT NOT NULL,input TEXT NOT NULL,result TEXT NOT NULL,created_at INTEGER NOT NULL,UNIQUE(workspace_id,actor_id,request_key));
CREATE TABLE peg_template_task_origins(application_id TEXT NOT NULL,task_key TEXT NOT NULL,task_id TEXT NOT NULL,base TEXT NOT NULL,PRIMARY KEY(application_id,task_key));
CREATE TABLE peg_template_staged_rules(id TEXT PRIMARY KEY,application_id TEXT NOT NULL,project_id TEXT NOT NULL,rule_key TEXT NOT NULL,definition TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 0 CHECK(active IN(0,1)));
CREATE TABLE peg_template_adoption_history(id TEXT PRIMARY KEY,application_id TEXT NOT NULL,version INTEGER NOT NULL,actor_id TEXT NOT NULL,selection TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TRIGGER peg_reusable_template_revision AFTER INSERT ON peg_reusable_template_versions BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_template_application_revision AFTER INSERT ON peg_template_applications BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_template_application_updated AFTER UPDATE ON peg_template_applications BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_template_origin_revision AFTER UPDATE ON peg_template_task_origins BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;

CREATE TRIGGER peg_template_staged_rule_revision AFTER UPDATE ON peg_template_staged_rules BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;

-- Reviewed template structure and reference allocation share the native optimistic revision.
CREATE TRIGGER peg_template_section_insert_revision AFTER INSERT ON peg_sections BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_template_section_update_revision AFTER UPDATE ON peg_sections BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_template_section_delete_revision AFTER DELETE ON peg_sections BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_template_prefix_update_revision AFTER UPDATE ON peg_ref_prefixes BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
