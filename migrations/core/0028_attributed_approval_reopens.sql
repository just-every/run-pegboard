CREATE TABLE peg_approval_reopen_guards (task_id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, cause TEXT NOT NULL, at INTEGER NOT NULL);
CREATE TRIGGER peg_approval_reopen_attribution BEFORE UPDATE OF status ON peg_tasks
WHEN OLD.status='done' AND NEW.status<>'done' AND EXISTS(SELECT 1 FROM peg_approval_tasks WHERE task_id=OLD.id) AND NOT EXISTS(SELECT 1 FROM peg_decision_guards WHERE task_id=OLD.id) AND NOT EXISTS(SELECT 1 FROM peg_approval_reopen_guards WHERE task_id=OLD.id)
BEGIN SELECT RAISE(ABORT,'attributed_reopen_required'); END;
CREATE TRIGGER peg_approval_reopened_history AFTER UPDATE OF status ON peg_tasks
WHEN OLD.status='done' AND NEW.status<>'done' AND EXISTS(SELECT 1 FROM peg_approval_tasks WHERE task_id=OLD.id) AND NOT EXISTS(SELECT 1 FROM peg_decision_guards WHERE task_id=OLD.id)
BEGIN
 INSERT INTO peg_history(task_id,project_id,at,actor_id,kind,detail) SELECT task_id,NULL,at,actor_id,'decision.reopened',json_object('cause',cause) FROM peg_approval_reopen_guards WHERE task_id=OLD.id;
 DELETE FROM peg_approval_reopen_guards WHERE task_id=OLD.id;
END;
