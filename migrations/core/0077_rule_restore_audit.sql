-- Restoring an archive fences queued rule work. Record that terminal result
-- alongside the preserved queue receipt, without restoring execution authority.
CREATE TRIGGER peg_local_rule_restore_audit AFTER UPDATE OF applying ON rer_portability_state
WHEN OLD.applying=1 AND NEW.applying=0
 AND EXISTS(SELECT 1 FROM rer_portability_jobs WHERE id=OLD.import_job AND phase='complete')
BEGIN
 INSERT INTO peg_permanent_audit(workspace_id,at,actor_id,action,target_type,target_id,result,detail)
 SELECT a.workspace_id,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER),r.activated_by,
  'rule.run_blocked','rule',r.rule_id,'blocked',
  json_set(a.detail,'$.outcome','restored_inactive','$.workCount',0)
 FROM peg_local_rule_runs r JOIN peg_permanent_audit a
  ON a.action='rule.run_queued' AND json_extract(a.detail,'$.runId')=r.id
 WHERE r.status='pending' AND r.outcome='restored_inactive'
  AND NOT EXISTS(SELECT 1 FROM peg_permanent_audit terminal
   WHERE json_extract(terminal.detail,'$.runId')=r.id
    AND terminal.action IN ('rule.run_applied','rule.run_noop','rule.run_blocked'));
END;
