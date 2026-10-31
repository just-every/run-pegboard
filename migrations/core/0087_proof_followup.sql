-- Human proof follow-through has its own owner-reviewed authority and lifetime.
CREATE TABLE peg_proof_followup_policies (
 id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,projects TEXT NOT NULL,recipients TEXT NOT NULL,escalation TEXT NOT NULL,calendar TEXT NOT NULL,
 repeat_minutes INTEGER NOT NULL,max_rounds INTEGER NOT NULL,approved_by TEXT NOT NULL,approver_version INTEGER NOT NULL,approved_at INTEGER NOT NULL,enabled INTEGER NOT NULL,stop_condition TEXT NOT NULL
);
CREATE TABLE peg_proof_followup_settings (workspace_id TEXT PRIMARY KEY,policy_id TEXT NOT NULL);
CREATE TABLE peg_proof_followup_episodes (
 id TEXT PRIMARY KEY,proof_id TEXT NOT NULL,task_id TEXT NOT NULL,workspace_id TEXT NOT NULL,policy_id TEXT NOT NULL,
 accountable_id TEXT NOT NULL,accountable_version INTEGER NOT NULL,created_by TEXT NOT NULL,created_at INTEGER NOT NULL,
 route_id TEXT NOT NULL,version_id TEXT NOT NULL,digest TEXT NOT NULL,state TEXT NOT NULL,cause TEXT,next_at INTEGER,round INTEGER NOT NULL DEFAULT 0,
 UNIQUE(proof_id,route_id)
);
CREATE UNIQUE INDEX peg_proof_followup_one_open ON peg_proof_followup_episodes(proof_id) WHERE state IN ('active','awaiting_revision','awaiting_route');
CREATE TABLE peg_proof_followup_bindings (
 id TEXT PRIMARY KEY,episode_id TEXT NOT NULL,route_id TEXT NOT NULL,version_id TEXT NOT NULL,digest TEXT NOT NULL,reviewed_by TEXT NOT NULL,at INTEGER NOT NULL,UNIQUE(episode_id,route_id)
);
CREATE TABLE peg_proof_followup_events (
 id TEXT PRIMARY KEY,episode_id TEXT NOT NULL,binding_id TEXT NOT NULL,ordinal INTEGER NOT NULL,recipient_id TEXT NOT NULL,recipient_version INTEGER NOT NULL,
 state TEXT NOT NULL,cause TEXT,next_at INTEGER,visible_at INTEGER,created_at INTEGER NOT NULL,UNIQUE(binding_id,ordinal)
);
CREATE INDEX peg_proof_followup_inbox ON peg_proof_followup_events(recipient_id,state);
CREATE TABLE peg_proof_followup_outcomes (id INTEGER PRIMARY KEY AUTOINCREMENT,episode_id TEXT NOT NULL,event_id TEXT,state TEXT NOT NULL,cause TEXT,at INTEGER NOT NULL);
CREATE TRIGGER peg_proof_policy_immutable BEFORE UPDATE ON peg_proof_followup_policies BEGIN SELECT RAISE(ABORT,'immutable_proof_policy'); END;
CREATE TRIGGER peg_proof_policy_replaced AFTER UPDATE ON peg_proof_followup_settings BEGIN
 UPDATE peg_proof_followup_episodes SET state='cancelled',cause='policy_replaced',next_at=NULL WHERE workspace_id=NEW.workspace_id AND policy_id<>NEW.policy_id AND state IN ('active','awaiting_revision','awaiting_route');
END;
CREATE TRIGGER peg_proof_episode_transition AFTER UPDATE OF state,route_id,version_id ON peg_proof_followup_episodes WHEN NEW.state<>'active' OR OLD.route_id<>NEW.route_id OR OLD.version_id<>NEW.version_id BEGIN
 UPDATE peg_proof_followup_events SET state='cancelled',cause=NEW.cause,next_at=NULL WHERE episode_id=NEW.id AND state IN ('queued','deferred','visible');
END;
CREATE TRIGGER peg_proof_replacement AFTER UPDATE OF current_version ON peg_proofs WHEN OLD.current_version IS NOT NEW.current_version BEGIN
 UPDATE peg_proof_followup_episodes SET state='awaiting_route',cause='replacement_requires_review',next_at=NULL WHERE proof_id=NEW.id AND state IN ('active','awaiting_revision','awaiting_route');
END;
CREATE TRIGGER peg_proof_route_changed AFTER UPDATE OF withdrawn_at,stages ON peg_approval_routes WHEN NEW.kind='proof' AND (NEW.withdrawn_at IS NOT NULL OR NEW.stages<>OLD.stages) BEGIN
 UPDATE peg_proof_followup_episodes SET state='awaiting_route',cause='route_requires_review',next_at=NULL WHERE route_id=NEW.id AND state IN ('active','awaiting_revision','awaiting_route');
END;
CREATE TRIGGER peg_proof_authority_peg_grants_update AFTER UPDATE ON peg_grants BEGIN UPDATE peg_proof_followup_episodes SET state='cancelled',cause='authority_changed',next_at=NULL WHERE state IN ('active','awaiting_revision','awaiting_route') AND (task_id=OLD.object_id OR task_id IN (SELECT task_id FROM peg_task_projects WHERE project_id=OLD.object_id OR project_id IN (SELECT id FROM peg_projects WHERE team_id=OLD.object_id)) OR (OLD.object_type='team' AND workspace_id IN (SELECT workspace_id FROM peg_teams WHERE id=OLD.object_id))); END;
CREATE TRIGGER peg_proof_authority_peg_workspace_members_update AFTER UPDATE ON peg_workspace_members BEGIN UPDATE peg_proof_followup_episodes SET state='cancelled',cause='authority_changed',next_at=NULL WHERE state IN ('active','awaiting_revision','awaiting_route') AND (workspace_id=OLD.workspace_id); END;
CREATE TRIGGER peg_proof_authority_peg_projects_update AFTER UPDATE ON peg_projects BEGIN UPDATE peg_proof_followup_episodes SET state='cancelled',cause='authority_changed',next_at=NULL WHERE state IN ('active','awaiting_revision','awaiting_route') AND (task_id IN (SELECT task_id FROM peg_task_projects WHERE project_id=OLD.id)); END;
CREATE TRIGGER peg_proof_authority_peg_approval_links_update AFTER UPDATE ON peg_approval_links WHEN NEW.revoked_at IS NOT NULL OR NEW.expires_at<OLD.expires_at BEGIN UPDATE peg_proof_followup_episodes SET state='cancelled',cause='authority_changed',next_at=NULL WHERE state IN ('active','awaiting_revision','awaiting_route') AND (route_id=OLD.route_id); END;
CREATE TRIGGER peg_proof_authority_peg_grants_delete AFTER DELETE ON peg_grants BEGIN UPDATE peg_proof_followup_episodes SET state='cancelled',cause='authority_changed',next_at=NULL WHERE state IN ('active','awaiting_revision','awaiting_route') AND (task_id=OLD.object_id OR task_id IN (SELECT task_id FROM peg_task_projects WHERE project_id=OLD.object_id OR project_id IN (SELECT id FROM peg_projects WHERE team_id=OLD.object_id)) OR (OLD.object_type='team' AND workspace_id IN (SELECT workspace_id FROM peg_teams WHERE id=OLD.object_id))); END;
CREATE TRIGGER peg_proof_authority_peg_workspace_members_delete AFTER DELETE ON peg_workspace_members BEGIN UPDATE peg_proof_followup_episodes SET state='cancelled',cause='authority_changed',next_at=NULL WHERE state IN ('active','awaiting_revision','awaiting_route') AND (workspace_id=OLD.workspace_id); END;
CREATE TRIGGER peg_proof_authority_peg_projects_delete AFTER DELETE ON peg_projects BEGIN UPDATE peg_proof_followup_episodes SET state='cancelled',cause='authority_changed',next_at=NULL WHERE state IN ('active','awaiting_revision','awaiting_route') AND (task_id IN (SELECT task_id FROM peg_task_projects WHERE project_id=OLD.id)); END;
CREATE TRIGGER peg_proof_authority_peg_approval_links_delete AFTER DELETE ON peg_approval_links BEGIN UPDATE peg_proof_followup_episodes SET state='cancelled',cause='authority_changed',next_at=NULL WHERE state IN ('active','awaiting_revision','awaiting_route') AND (route_id=OLD.route_id); END;
CREATE TRIGGER peg_proof_identity_changed AFTER UPDATE OF status,role,version ON oa_operators WHEN NEW.status<>OLD.status OR NEW.role<>OLD.role OR NEW.version<>OLD.version BEGIN
 UPDATE peg_proof_followup_episodes SET state='cancelled',cause='identity_authority_changed',next_at=NULL WHERE state IN ('active','awaiting_revision','awaiting_route') AND (accountable_id=NEW.id OR created_by=NEW.id OR route_id IN (SELECT r.id FROM peg_approval_routes r WHERE r.created_by=NEW.id OR EXISTS(SELECT 1 FROM json_each(r.stages) s,json_each(json_extract(s.value,'$.people')) p WHERE p.value=NEW.id)));
END;
CREATE TRIGGER peg_proof_outcome_peg_proof_followup_episodes_insert AFTER INSERT ON peg_proof_followup_episodes WHEN COALESCE((SELECT applying FROM rer_portability_state WHERE id=1),0)=0 BEGIN
 INSERT INTO peg_proof_followup_outcomes(episode_id,event_id,state,cause,at) VALUES(NEW.id,NULL,NEW.state,NEW.cause,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER));
 INSERT INTO peg_permanent_audit(workspace_id,at,actor_id,action,target_type,target_id,result,detail) SELECT workspace_id,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER),NULL,'proof_followup.transition','proof',proof_id,NEW.state,'{}' FROM peg_proof_followup_episodes WHERE id=NEW.id;
END;
CREATE TRIGGER peg_proof_outcome_peg_proof_followup_episodes_update AFTER UPDATE ON peg_proof_followup_episodes WHEN COALESCE((SELECT applying FROM rer_portability_state WHERE id=1),0)=0 AND (OLD.state<>NEW.state OR OLD.cause IS NOT NEW.cause) BEGIN
 INSERT INTO peg_proof_followup_outcomes(episode_id,event_id,state,cause,at) VALUES(NEW.id,NULL,NEW.state,NEW.cause,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER));
 INSERT INTO peg_permanent_audit(workspace_id,at,actor_id,action,target_type,target_id,result,detail) SELECT workspace_id,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER),NULL,'proof_followup.transition','proof',proof_id,NEW.state,'{}' FROM peg_proof_followup_episodes WHERE id=NEW.id;
END;
CREATE TRIGGER peg_proof_outcome_peg_proof_followup_events_insert AFTER INSERT ON peg_proof_followup_events WHEN COALESCE((SELECT applying FROM rer_portability_state WHERE id=1),0)=0 BEGIN
 INSERT INTO peg_proof_followup_outcomes(episode_id,event_id,state,cause,at) VALUES(NEW.episode_id,NEW.id,NEW.state,NEW.cause,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER));
 INSERT INTO peg_permanent_audit(workspace_id,at,actor_id,action,target_type,target_id,result,detail) SELECT workspace_id,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER),NULL,'proof_followup.transition','proof',proof_id,NEW.state,'{}' FROM peg_proof_followup_episodes WHERE id=NEW.episode_id;
END;
CREATE TRIGGER peg_proof_outcome_peg_proof_followup_events_update AFTER UPDATE ON peg_proof_followup_events WHEN COALESCE((SELECT applying FROM rer_portability_state WHERE id=1),0)=0 AND (OLD.state<>NEW.state OR OLD.cause IS NOT NEW.cause) BEGIN
 INSERT INTO peg_proof_followup_outcomes(episode_id,event_id,state,cause,at) VALUES(NEW.episode_id,NEW.id,NEW.state,NEW.cause,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER));
 INSERT INTO peg_permanent_audit(workspace_id,at,actor_id,action,target_type,target_id,result,detail) SELECT workspace_id,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER),NULL,'proof_followup.transition','proof',proof_id,NEW.state,'{}' FROM peg_proof_followup_episodes WHERE id=NEW.episode_id;
END;
CREATE TRIGGER peg_proof_revision_peg_proof_followup_policies_insert AFTER INSERT ON peg_proof_followup_policies BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_proof_revision_peg_proof_followup_policies_update AFTER UPDATE ON peg_proof_followup_policies BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_proof_revision_peg_proof_followup_policies_delete AFTER DELETE ON peg_proof_followup_policies BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_proof_revision_peg_proof_followup_settings_insert AFTER INSERT ON peg_proof_followup_settings BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_proof_revision_peg_proof_followup_settings_update AFTER UPDATE ON peg_proof_followup_settings BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_proof_revision_peg_proof_followup_settings_delete AFTER DELETE ON peg_proof_followup_settings BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_proof_revision_peg_proof_followup_episodes_insert AFTER INSERT ON peg_proof_followup_episodes BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_proof_revision_peg_proof_followup_episodes_update AFTER UPDATE ON peg_proof_followup_episodes BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_proof_revision_peg_proof_followup_episodes_delete AFTER DELETE ON peg_proof_followup_episodes BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_proof_revision_peg_proof_followup_bindings_insert AFTER INSERT ON peg_proof_followup_bindings BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_proof_revision_peg_proof_followup_bindings_update AFTER UPDATE ON peg_proof_followup_bindings BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_proof_revision_peg_proof_followup_bindings_delete AFTER DELETE ON peg_proof_followup_bindings BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_proof_revision_peg_proof_followup_events_insert AFTER INSERT ON peg_proof_followup_events BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_proof_revision_peg_proof_followup_events_update AFTER UPDATE ON peg_proof_followup_events BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_proof_revision_peg_proof_followup_events_delete AFTER DELETE ON peg_proof_followup_events BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_proof_revision_peg_proof_followup_outcomes_insert AFTER INSERT ON peg_proof_followup_outcomes BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_proof_revision_peg_proof_followup_outcomes_update AFTER UPDATE ON peg_proof_followup_outcomes BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_proof_revision_peg_proof_followup_outcomes_delete AFTER DELETE ON peg_proof_followup_outcomes BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
