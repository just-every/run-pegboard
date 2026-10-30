-- A changed definition does not inherit the activation retired by its edit.
-- Earlier permanent records remain immutable; new receipts name both versions.
DROP TRIGGER peg_template_rule_lifecycle_audit;
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
  'version',COALESCE(NEW.definition_version,r.version),
  'activationId',CASE WHEN NEW.action='definition_changed_review_required' THEN NULL ELSE COALESCE(NEW.activation_id,r.activation_id) END,
  'previousActivationId',CASE WHEN NEW.action='definition_changed_review_required' THEN NEW.activation_id END,
  'previousVersion',CASE WHEN NEW.action='definition_changed_review_required' THEN NEW.definition_version-1 END,
  'activatedById',a.activated_by,'runId',NEW.run_id)
 FROM peg_template_rules r LEFT JOIN peg_template_rule_activations a ON a.id=COALESCE(NEW.activation_id,r.activation_id)
 WHERE r.id=NEW.rule_id;
END;
