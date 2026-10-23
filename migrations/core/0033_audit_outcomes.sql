-- Preserve all earlier permanent rows; future provider attempts distinguish transport completion from provider outcome.
DROP TRIGGER peg_audit_permanent;
CREATE TRIGGER peg_audit_permanent AFTER INSERT ON peg_audit WHEN COALESCE((SELECT applying FROM rer_portability_state WHERE id=1),0)=0 BEGIN
 INSERT INTO peg_permanent_audit(workspace_id,at,actor_id,action,target_type,target_id,subject_id,result,detail)
 VALUES(NEW.workspace_id,NEW.at,NEW.actor_id,NEW.action,NEW.target_type,NEW.target_id,NEW.subject_id,
 CASE WHEN NEW.action='time.provider_delivery' AND json_extract(NEW.detail,'$.uncertain')>0 THEN 'uncertain'
 WHEN NEW.action='time.provider_delivery' AND json_extract(NEW.detail,'$.rejected')>0 THEN 'failure'
 WHEN NEW.action='time.provider_delivery' AND (json_extract(NEW.detail,'$.remaining')>0 OR json_extract(NEW.detail,'$.inProgress')>0) THEN 'partial'
 ELSE 'success' END,
 CASE WHEN NEW.action='time.provider_delivery' THEN json_object('acknowledged',json_extract(NEW.detail,'$.acknowledged'),'rejected',json_extract(NEW.detail,'$.rejected'),'uncertain',json_extract(NEW.detail,'$.uncertain')) ELSE '{}' END);
END;
CREATE TRIGGER peg_personal_rule_audit AFTER INSERT ON peg_personal_moves WHEN COALESCE((SELECT applying FROM rer_portability_state WHERE id=1),0)=0 BEGIN
 INSERT INTO peg_permanent_audit(workspace_id,at,actor_id,action,target_type,target_id,subject_id)
 VALUES(NULL,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER),NEW.operator_id,'rule.personal_effect','task',NEW.task_id,NEW.rule_id);
END;
CREATE TRIGGER peg_personal_rule_undo_audit AFTER UPDATE OF undone ON peg_personal_moves WHEN NEW.undone=1 AND OLD.undone=0 BEGIN
 INSERT INTO peg_permanent_audit(workspace_id,at,actor_id,action,target_type,target_id,subject_id)
 VALUES(NULL,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER),NEW.operator_id,'rule.personal_effect_undone','task',NEW.task_id,NEW.rule_id);
END;
CREATE TRIGGER peg_occurrence_audit AFTER INSERT ON peg_occurrences WHEN COALESCE((SELECT applying FROM rer_portability_state WHERE id=1),0)=0 BEGIN
 INSERT INTO peg_permanent_audit(workspace_id,at,actor_id,action,target_type,target_id,subject_id)
 SELECT r.workspace_id,NEW.created_at,NULL,'recurrence.generated',t.source_type,NEW.object_id,r.created_by FROM peg_recurrences r JOIN peg_work_templates t ON t.id=NEW.template_id WHERE r.id=NEW.schedule_id;
END;
CREATE TRIGGER peg_archive_export_audit AFTER UPDATE OF phase ON rer_portability_jobs WHEN NEW.kind='export' AND NEW.phase='complete' AND OLD.phase<>'complete' BEGIN
 INSERT INTO peg_permanent_audit(workspace_id,at,actor_id,action,target_type,target_id)
 VALUES(NULL,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER),NEW.actor,'archive.exported','archive',NEW.id);
END;
CREATE TRIGGER peg_archive_restore_audit AFTER UPDATE OF applying ON rer_portability_state
WHEN OLD.applying=1 AND NEW.applying=0 AND EXISTS(SELECT 1 FROM rer_portability_jobs WHERE id=OLD.import_job AND phase='complete') BEGIN
 INSERT INTO peg_permanent_audit(workspace_id,at,actor_id,action,target_type,target_id)
 SELECT NULL,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER),actor,'archive.restored','archive',OLD.import_job FROM rer_portability_jobs WHERE id=OLD.import_job;
END;
