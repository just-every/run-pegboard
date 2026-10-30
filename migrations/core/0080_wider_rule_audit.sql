-- Native template rule events retain opaque execution provenance alongside the
-- existing product log. No historical rows or execution permissions change.
ALTER TABLE peg_template_rule_events ADD COLUMN definition_version INTEGER;
ALTER TABLE peg_template_rule_events ADD COLUMN activation_id TEXT;
CREATE TRIGGER peg_template_rule_lifecycle_audit AFTER INSERT ON peg_template_rule_events
WHEN COALESCE((SELECT applying FROM rer_portability_state WHERE id=1),0)=0
 AND NEW.action IN ('created','definition_changed_review_required','activated','deactivated','template_changed_review_required','pending_run_mapping_reviewed')
BEGIN
 INSERT INTO peg_permanent_audit(workspace_id,at,actor_id,action,target_type,target_id,result,detail)
 SELECT r.workspace_id,NEW.at,NEW.actor_id,
  CASE NEW.action WHEN 'created' THEN 'template_rule.created'
   WHEN 'definition_changed_review_required' THEN 'template_rule.edited'
   WHEN 'activated' THEN 'template_rule.activated'
   WHEN 'deactivated' THEN 'template_rule.deactivated'
   WHEN 'template_changed_review_required' THEN 'template_rule.template_changed'
   ELSE 'template_rule.run_reviewed' END,
  'rule',r.id,'success',json_object('kind','template','ruleId',r.id,
  'version',COALESCE(NEW.definition_version,r.version),'activationId',COALESCE(NEW.activation_id,r.activation_id),
  'runId',NEW.run_id)
 FROM peg_template_rules r WHERE r.id=NEW.rule_id;
END;
CREATE TRIGGER peg_template_rule_queue_audit AFTER INSERT ON peg_template_rule_runs
WHEN COALESCE((SELECT applying FROM rer_portability_state WHERE id=1),0)=0
BEGIN
 INSERT INTO peg_permanent_audit(workspace_id,at,actor_id,action,target_type,target_id,result,detail)
 SELECT r.workspace_id,NEW.created_at,json_extract(NEW.source,'$.creatorId'),
  CASE WHEN NEW.status='queued' THEN 'template_rule.run_queued' ELSE 'template_rule.run_blocked' END,
  'rule',r.id,CASE WHEN NEW.status='queued' THEN 'queued' ELSE 'blocked' END,
  json_object('kind','template','ruleId',r.id,'version',NEW.definition_version,'activationId',NEW.activation_id,
  'runId',NEW.id,'taskId',NEW.task_id,'triggerActorId',json_extract(NEW.source,'$.creatorId'),
  'activatedById',a.activated_by,'outcome',CASE WHEN NEW.status='queued' THEN 'queued' ELSE 'activation_required' END)
 FROM peg_template_rules r LEFT JOIN peg_template_rule_activations a ON a.id=NEW.activation_id WHERE r.id=NEW.rule_id;
END;
CREATE TRIGGER peg_template_rule_outcome_audit AFTER UPDATE ON peg_template_rule_runs
WHEN COALESCE((SELECT applying FROM rer_portability_state WHERE id=1),0)=0
 AND (NEW.status<>OLD.status OR (NEW.status='queued' AND NEW.activation_id IS NOT OLD.activation_id))
BEGIN
 INSERT INTO peg_permanent_audit(workspace_id,at,actor_id,action,target_type,target_id,result,detail)
 SELECT r.workspace_id,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER),a.activated_by,
  CASE NEW.status WHEN 'queued' THEN 'template_rule.run_queued' WHEN 'applied' THEN 'template_rule.run_applied'
   WHEN 'noop' THEN 'template_rule.run_noop' ELSE 'template_rule.run_blocked' END,'rule',r.id,
  CASE NEW.status WHEN 'queued' THEN 'queued' WHEN 'applied' THEN 'applied' WHEN 'noop' THEN 'noop' ELSE 'blocked' END,
  json_object('kind','template','ruleId',r.id,'version',NEW.definition_version,'activationId',NEW.activation_id,
  'runId',NEW.id,'taskId',NEW.task_id,'triggerActorId',json_extract(NEW.source,'$.creatorId'),
  'activatedById',a.activated_by,'operationId',(SELECT id FROM peg_template_applications WHERE request_key='template-rule:'||NEW.id AND workspace_id=r.workspace_id),'count',CASE WHEN NEW.status='applied' THEN json_array_length(json_extract(NEW.result,'$.taskIds')) ELSE 0 END,
  'outcome',CASE WHEN NEW.outcome IN ('applied','source_date_missing','activation_required','definition_changed','template_version_changed',
   'activation_changed','activating_admin_unavailable','activation_scope_changed','activation_mapping_changed','ai_source_requires_exact_review',
   'mapping_review_required','rule_source_date_missing','restored_inactive') THEN NEW.outcome ELSE 'blocked' END)
 FROM peg_template_rules r LEFT JOIN peg_template_rule_activations a ON a.id=NEW.activation_id WHERE r.id=NEW.rule_id;
END;
CREATE TRIGGER peg_template_rule_restore_audit AFTER UPDATE OF applying ON rer_portability_state
WHEN OLD.applying=1 AND NEW.applying=0
 AND EXISTS(SELECT 1 FROM rer_portability_jobs WHERE id=OLD.import_job AND phase='complete')
BEGIN
 INSERT INTO peg_permanent_audit(workspace_id,at,actor_id,action,target_type,target_id,result,detail)
 SELECT a.workspace_id,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER),json_extract(a.detail,'$.activatedById'),
 'template_rule.run_blocked','rule',r.rule_id,'blocked',json_set(a.detail,'$.outcome','restored_inactive')
 FROM peg_template_rule_runs r JOIN peg_permanent_audit a
 ON a.action='template_rule.run_queued' AND json_extract(a.detail,'$.runId')=r.id
 WHERE r.status='pending' AND r.outcome='restored_inactive'
 AND a.id=(SELECT MAX(q.id) FROM peg_permanent_audit q WHERE q.action='template_rule.run_queued' AND json_extract(q.detail,'$.runId')=r.id)
 AND NOT EXISTS(SELECT 1 FROM peg_permanent_audit t WHERE json_extract(t.detail,'$.runId')=r.id AND t.id>a.id
  AND t.action IN ('template_rule.run_applied','template_rule.run_noop','template_rule.run_blocked'));
END;

-- Restore never resumes the source installation's standing bundle authority.
CREATE TRIGGER peg_bundle_rule_restore_audit AFTER UPDATE OF applying ON rer_portability_state
WHEN OLD.applying=1 AND NEW.applying=0
 AND EXISTS(SELECT 1 FROM rer_portability_jobs WHERE id=OLD.import_job AND phase='complete')
BEGIN
 INSERT INTO peg_permanent_audit(workspace_id,at,actor_id,action,target_type,target_id,result,detail)
 SELECT a.workspace_id,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER),r.actor_id,
 'bundle_rule.run_blocked','rule',a.target_id,'blocked',json_set(a.detail,'$.outcome','restored_inactive')
 FROM peg_bundle_jobs r JOIN peg_permanent_audit a
 ON a.action='bundle_rule.run_queued' AND json_extract(a.detail,'$.runId')=r.id
 WHERE r.status='cancelled'
 AND NOT EXISTS(SELECT 1 FROM peg_permanent_audit t WHERE json_extract(t.detail,'$.runId')=r.id AND t.id>a.id
 AND t.action IN ('bundle_rule.run_applied','bundle_rule.run_noop','bundle_rule.run_blocked'));
END;
