-- Keep visible final reminders subject to cancellation after their finite repeat limit.
DROP TRIGGER peg_followup_policy_changed;
CREATE TRIGGER peg_followup_policy_changed AFTER UPDATE ON peg_approval_followup_settings BEGIN
 UPDATE peg_approval_followup_episodes SET state='cancelled',cause='policy_replaced',next_at=NULL WHERE workspace_id=NEW.workspace_id AND policy_id<>NEW.policy_id AND state IN ('active','exhausted');
END;
DROP TRIGGER peg_followup_route_ended;
CREATE TRIGGER peg_followup_route_ended AFTER UPDATE ON peg_approval_routes WHEN NEW.withdrawn_at IS NOT NULL OR NEW.followup_invalidated_at IS NOT NULL BEGIN
 UPDATE peg_approval_followup_episodes SET state='cancelled',cause=CASE WHEN NEW.withdrawn_at IS NOT NULL THEN 'route_withdrawn' ELSE 'material_changed' END,next_at=NULL WHERE route_id=NEW.id AND state IN ('active','exhausted');
END;
DROP TRIGGER peg_followup_person_changed;
CREATE TRIGGER peg_followup_person_changed AFTER UPDATE OF status,role,version ON oa_operators WHEN NEW.status<>OLD.status OR NEW.role<>OLD.role OR NEW.version<>OLD.version BEGIN
 INSERT OR IGNORE INTO peg_approval_followup_exclusions
 SELECT p.id,NEW.id,'identity_authority_changed' FROM peg_approval_followup_episodes p JOIN peg_approval_routes r ON r.id=p.route_id
 WHERE EXISTS(SELECT 1 FROM json_each(r.stages) s,json_each(json_extract(s.value,'$.people')) n WHERE n.value=NEW.id)
 OR EXISTS(SELECT 1 FROM peg_approval_followup_events e JOIN peg_approval_followup_deliveries d ON d.event_id=e.id WHERE e.episode_id=p.id AND d.recipient_id=NEW.id);
 UPDATE peg_approval_followup_deliveries SET state='cancelled',cause='identity_authority_changed',next_at=NULL WHERE recipient_id=NEW.id AND state IN ('queued','deferred','visible');
 UPDATE peg_approval_followup_episodes SET state='cancelled',cause='policy_or_route_authority_lost',next_at=NULL WHERE state IN ('active','exhausted') AND (route_id IN (SELECT id FROM peg_approval_routes WHERE created_by=NEW.id) OR policy_id IN (SELECT id FROM peg_approval_followup_policies WHERE approved_by=NEW.id));
END;
DROP TRIGGER peg_followup_workspace_update;
CREATE TRIGGER peg_followup_workspace_update AFTER UPDATE ON peg_workspace_members WHEN NEW.role<>OLD.role BEGIN
 INSERT OR IGNORE INTO peg_approval_followup_exclusions SELECT p.id,OLD.operator_id,'membership_changed' FROM peg_approval_followup_episodes p WHERE p.workspace_id=OLD.workspace_id;
 UPDATE peg_approval_followup_deliveries SET state='cancelled',cause='membership_changed',next_at=NULL WHERE recipient_id=OLD.operator_id AND event_id IN (SELECT e.id FROM peg_approval_followup_events e JOIN peg_approval_followup_episodes p ON p.id=e.episode_id WHERE p.workspace_id=OLD.workspace_id) AND state IN ('queued','deferred','visible');
 UPDATE peg_approval_followup_episodes SET state='cancelled',cause='routing_authority_lost',next_at=NULL WHERE workspace_id=OLD.workspace_id AND state IN ('active','exhausted') AND route_id IN (SELECT id FROM peg_approval_routes WHERE created_by=OLD.operator_id);
END;
DROP TRIGGER peg_followup_workspace_delete;
CREATE TRIGGER peg_followup_workspace_delete AFTER DELETE ON peg_workspace_members BEGIN
 INSERT OR IGNORE INTO peg_approval_followup_exclusions SELECT p.id,OLD.operator_id,'membership_changed' FROM peg_approval_followup_episodes p WHERE p.workspace_id=OLD.workspace_id;
 UPDATE peg_approval_followup_deliveries SET state='cancelled',cause='membership_changed',next_at=NULL WHERE recipient_id=OLD.operator_id AND event_id IN (SELECT e.id FROM peg_approval_followup_events e JOIN peg_approval_followup_episodes p ON p.id=e.episode_id WHERE p.workspace_id=OLD.workspace_id) AND state IN ('queued','deferred','visible');
 UPDATE peg_approval_followup_episodes SET state='cancelled',cause='routing_authority_lost',next_at=NULL WHERE workspace_id=OLD.workspace_id AND state IN ('active','exhausted') AND route_id IN (SELECT id FROM peg_approval_routes WHERE created_by=OLD.operator_id);
END;
-- Delegation may precede the first delivery row; remember lost grants for the named route too.
CREATE TRIGGER peg_followup_named_grant_update AFTER UPDATE ON peg_grants BEGIN
 INSERT OR IGNORE INTO peg_approval_followup_exclusions
 SELECT p.id,n.value,'access_changed' FROM peg_approval_followup_episodes p JOIN peg_approval_routes r ON r.id=p.route_id,
 json_each(r.stages) s,json_each(json_extract(s.value,'$.people')) n
 WHERE p.state IN ('active','exhausted')
 AND ((OLD.grantee_type='person' AND n.value=OLD.grantee_id)
 OR (OLD.grantee_type='team' AND n.value IN (SELECT grantee_id FROM peg_grants WHERE object_type='team' AND object_id=OLD.grantee_id AND grantee_type='person' AND revoked_at IS NULL)))
 AND ((OLD.object_type='task' AND OLD.object_id=r.task_id)
 OR EXISTS(SELECT 1 FROM peg_task_projects tp JOIN peg_projects pr ON pr.id=tp.project_id WHERE tp.task_id=r.task_id
 AND ((OLD.object_type='project' AND OLD.object_id=tp.project_id)
 OR (OLD.object_type='team' AND (pr.team_id=OLD.object_id OR EXISTS(SELECT 1 FROM peg_grants g WHERE g.object_type='project' AND g.object_id=pr.id AND g.grantee_type='team' AND g.grantee_id=OLD.object_id))))));
END;
CREATE TRIGGER peg_followup_named_grant_delete AFTER DELETE ON peg_grants BEGIN
 INSERT OR IGNORE INTO peg_approval_followup_exclusions
 SELECT p.id,n.value,'access_changed' FROM peg_approval_followup_episodes p JOIN peg_approval_routes r ON r.id=p.route_id,
 json_each(r.stages) s,json_each(json_extract(s.value,'$.people')) n
 WHERE p.state IN ('active','exhausted')
 AND ((OLD.grantee_type='person' AND n.value=OLD.grantee_id)
 OR (OLD.grantee_type='team' AND n.value IN (SELECT grantee_id FROM peg_grants WHERE object_type='team' AND object_id=OLD.grantee_id AND grantee_type='person' AND revoked_at IS NULL)))
 AND ((OLD.object_type='task' AND OLD.object_id=r.task_id)
 OR EXISTS(SELECT 1 FROM peg_task_projects tp JOIN peg_projects pr ON pr.id=tp.project_id WHERE tp.task_id=r.task_id
 AND ((OLD.object_type='project' AND OLD.object_id=tp.project_id)
 OR (OLD.object_type='team' AND (pr.team_id=OLD.object_id OR EXISTS(SELECT 1 FROM peg_grants g WHERE g.object_type='project' AND g.object_id=pr.id AND g.grantee_type='team' AND g.grantee_id=OLD.object_id))))));
END;
