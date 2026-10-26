-- A new-task rule is a reviewed immutable definition, never authority copied from a template.
CREATE TABLE peg_template_rules (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, project_id TEXT NOT NULL,
 name TEXT NOT NULL, version INTEGER NOT NULL, definition TEXT NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)), activation_id TEXT,
 created_by TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX peg_template_rules_project ON peg_template_rules(project_id);
CREATE TABLE peg_template_rule_versions (
 rule_id TEXT NOT NULL, version INTEGER NOT NULL, definition TEXT NOT NULL,
 created_by TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(rule_id,version)
);
CREATE TABLE peg_template_rule_activations (
 id TEXT PRIMARY KEY, rule_id TEXT NOT NULL, definition_version INTEGER NOT NULL,
 definition TEXT NOT NULL, template_version INTEGER NOT NULL, activated_by TEXT NOT NULL,
 activated_at INTEGER NOT NULL, preview_token TEXT NOT NULL
);
CREATE TABLE peg_template_rule_runs (
 id TEXT PRIMARY KEY, rule_id TEXT NOT NULL, task_id TEXT NOT NULL,
 definition_version INTEGER NOT NULL, definition TEXT NOT NULL, activation_id TEXT,
 status TEXT NOT NULL CHECK(status IN ('queued','pending','applied','noop')),
 source TEXT NOT NULL, computed_start_date TEXT, result TEXT,
 outcome TEXT, review_history TEXT NOT NULL DEFAULT '[]', exact_review_activation_id TEXT, created_at INTEGER NOT NULL, finished_at INTEGER,
 UNIQUE(rule_id,task_id)
);
CREATE INDEX peg_template_rule_runs_pending ON peg_template_rule_runs(status,rule_id);
CREATE TABLE peg_template_rule_events (
 id TEXT PRIMARY KEY, rule_id TEXT NOT NULL, run_id TEXT, actor_id TEXT,
 action TEXT NOT NULL, at INTEGER NOT NULL
);
CREATE TABLE peg_template_rule_generated_tasks (task_id TEXT PRIMARY KEY, run_id TEXT NOT NULL);
CREATE TABLE peg_template_rule_execution_guards (
 id TEXT PRIMARY KEY, run_id TEXT NOT NULL, rule_id TEXT NOT NULL, actor_id TEXT NOT NULL,
 activation_id TEXT NOT NULL, definition_version INTEGER NOT NULL
);
CREATE TRIGGER peg_template_rule_execution_guard BEFORE INSERT ON peg_template_rule_execution_guards
WHEN NOT EXISTS (
 SELECT 1 FROM peg_template_rules r
 JOIN peg_template_rule_activations a ON a.id=r.activation_id
 JOIN peg_template_rule_runs j ON j.id=NEW.run_id AND j.rule_id=r.id
 WHERE r.id=NEW.rule_id AND r.enabled=1 AND r.version=NEW.definition_version
 AND r.definition=a.definition AND r.version=a.definition_version
 AND a.id=NEW.activation_id AND a.activated_by=NEW.actor_id
 AND j.activation_id=a.id AND j.definition_version=r.version AND j.definition=r.definition
 AND j.status IN ('queued','pending')
)
BEGIN SELECT RAISE(ABORT,'template_rule_activation_changed'); END;
CREATE TRIGGER peg_template_rule_version_immutable BEFORE UPDATE ON peg_template_rule_versions BEGIN SELECT RAISE(ABORT,'immutable_rule_version'); END;
CREATE TRIGGER peg_template_rule_activation_immutable BEFORE UPDATE ON peg_template_rule_activations BEGIN SELECT RAISE(ABORT,'immutable_rule_activation'); END;
CREATE TRIGGER peg_template_rule_event_immutable BEFORE UPDATE ON peg_template_rule_events BEGIN SELECT RAISE(ABORT,'immutable_rule_event'); END;
CREATE TRIGGER peg_template_rule_revision_insert AFTER INSERT ON peg_template_rules BEGIN
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
 UPDATE peg_data_revision SET value=value+1 WHERE id=1;
END;
CREATE TRIGGER peg_template_rule_revision_update AFTER UPDATE ON peg_template_rules BEGIN
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
 UPDATE peg_data_revision SET value=value+1 WHERE id=1;
END;
CREATE TRIGGER peg_template_rule_run_revision_insert AFTER INSERT ON peg_template_rule_runs BEGIN
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
 UPDATE peg_data_revision SET value=value+1 WHERE id=1;
END;
CREATE TRIGGER peg_template_rule_run_revision_update AFTER UPDATE ON peg_template_rule_runs BEGIN
 UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
 UPDATE peg_data_revision SET value=value+1 WHERE id=1;
END;
-- Publishing a new template version removes standing authority for the old mapping.
CREATE TRIGGER peg_template_rule_template_changed AFTER INSERT ON peg_reusable_template_versions BEGIN
 INSERT INTO peg_template_rule_events(id,rule_id,actor_id,action,at)
 SELECT 'ruleevent_'||lower(hex(randomblob(10))),id,NEW.created_by,'template_changed_review_required',NEW.created_at
 FROM peg_template_rules WHERE json_extract(definition,'$.templateId')=NEW.template_id
 AND json_extract(definition,'$.templateVersion')!=NEW.version AND enabled=1;
 UPDATE peg_template_rules SET enabled=0,activation_id=NULL
 WHERE json_extract(definition,'$.templateId')=NEW.template_id AND json_extract(definition,'$.templateVersion')!=NEW.version;
 UPDATE peg_template_rule_runs SET status='pending',outcome='template_version_changed'
 WHERE status='queued' AND rule_id IN (
 SELECT id FROM peg_template_rules WHERE json_extract(definition,'$.templateId')=NEW.template_id
 AND json_extract(definition,'$.templateVersion')!=NEW.version);
END;
