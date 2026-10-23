-- Add a permanent audit alongside the pre-existing access activity. No historical activity is rewritten.
CREATE TABLE peg_permanent_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,workspace_id TEXT,at INTEGER NOT NULL,actor_id TEXT,action TEXT NOT NULL,
 target_type TEXT,target_id TEXT,subject_id TEXT,result TEXT NOT NULL DEFAULT 'success',detail TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX peg_permanent_audit_workspace ON peg_permanent_audit(workspace_id,id);
-- Historical rows are preserved as redacted permanent records, with no free-form metadata.
INSERT INTO peg_permanent_audit(workspace_id,at,actor_id,action,target_type,target_id,subject_id)
 SELECT workspace_id,at,actor_id,action,target_type,target_id,subject_id FROM peg_audit ORDER BY id;
CREATE TRIGGER peg_audit_permanent AFTER INSERT ON peg_audit WHEN COALESCE((SELECT applying FROM rer_portability_state WHERE id=1),0)=0 BEGIN
 INSERT INTO peg_permanent_audit(workspace_id,at,actor_id,action,target_type,target_id,subject_id,detail)
 VALUES(NEW.workspace_id,NEW.at,NEW.actor_id,NEW.action,NEW.target_type,NEW.target_id,NEW.subject_id,'{}');
END;
CREATE TRIGGER peg_permanent_audit_no_update BEFORE UPDATE ON peg_permanent_audit BEGIN SELECT RAISE(ABORT,'audit_append_only'); END;
CREATE TRIGGER peg_permanent_audit_no_delete BEFORE DELETE ON peg_permanent_audit BEGIN SELECT RAISE(ABORT,'audit_append_only'); END;
CREATE TRIGGER peg_history_audit AFTER INSERT ON peg_history WHEN COALESCE((SELECT applying FROM rer_portability_state WHERE id=1),0)=0 BEGIN
 INSERT INTO peg_permanent_audit(workspace_id,at,actor_id,action,target_type,target_id)
 SELECT CASE WHEN EXISTS(SELECT 1 FROM peg_task_projects WHERE task_id=NEW.task_id) THEN t.workspace_id ELSE NULL END,
 NEW.at,NEW.actor_id,'task.'||NEW.kind,'task',NEW.task_id FROM peg_tasks t WHERE t.id=NEW.task_id;
END;
CREATE TRIGGER peg_signin_audit AFTER INSERT ON oa_sessions BEGIN
 INSERT INTO peg_permanent_audit(workspace_id,at,actor_id,action,target_type,target_id)
 VALUES(NULL,NEW.created_at,NEW.operator_id,'authentication.signed_in','person',NEW.operator_id);
END;
CREATE TRIGGER peg_auth_change_audit AFTER INSERT ON oa_auth_audit BEGIN
 INSERT INTO peg_permanent_audit(workspace_id,at,actor_id,action,target_type,target_id)
 VALUES(NULL,NEW.created_at,NEW.actor_id,'authentication.configuration_changed','person',NEW.actor_id);
END;
CREATE TABLE peg_erased_people (operator_id TEXT PRIMARY KEY, erased_at INTEGER NOT NULL);
