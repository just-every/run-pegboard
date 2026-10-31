-- Content-free events are committed with the human change, never with a provider send.
CREATE TABLE peg_notice_policy (
 workspace_id TEXT PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 generation INTEGER NOT NULL DEFAULT 1, owner_id TEXT NOT NULL, owner_version INTEGER NOT NULL, approved_at INTEGER NOT NULL
);
CREATE TABLE peg_notice_preferences (
 workspace_id TEXT NOT NULL, operator_id TEXT NOT NULL, muted INTEGER NOT NULL DEFAULT 0 CHECK(muted IN (0,1)),
 dnd_until INTEGER, PRIMARY KEY(workspace_id,operator_id)
);
CREATE TABLE peg_notice_follows (
 task_id TEXT NOT NULL REFERENCES peg_tasks(id) ON DELETE CASCADE, operator_id TEXT NOT NULL,
 following INTEGER NOT NULL CHECK(following IN (0,1)), PRIMARY KEY(task_id,operator_id)
);
CREATE TABLE peg_notice_events (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, task_id TEXT NOT NULL REFERENCES peg_tasks(id) ON DELETE CASCADE,
 comment_id TEXT REFERENCES peg_comments(id) ON DELETE CASCADE,
 kind TEXT NOT NULL CHECK(kind IN ('assignment','comment','approval')), actor_id TEXT NOT NULL,
 policy_generation INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX peg_notice_event_task ON peg_notice_events(task_id,kind,created_at);
CREATE TABLE peg_notice_targets (
 event_id TEXT NOT NULL REFERENCES peg_notice_events(id) ON DELETE CASCADE, recipient_id TEXT NOT NULL, recipient_version INTEGER NOT NULL,
 reason TEXT NOT NULL CHECK(reason IN ('assignment','comment','mention','approval')),
 state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','delivered','suppressed')),
 visible_at INTEGER, read_at INTEGER, snoozed_until INTEGER,
 PRIMARY KEY(event_id,recipient_id)
);
CREATE INDEX peg_notice_recipient ON peg_notice_targets(recipient_id,state);
CREATE TABLE peg_notice_commands (
 actor_id TEXT NOT NULL, task_id TEXT NOT NULL REFERENCES peg_tasks(id) ON DELETE CASCADE,
 operation_id TEXT NOT NULL, fingerprint TEXT NOT NULL, result_id TEXT NOT NULL,
 PRIMARY KEY(actor_id,task_id,operation_id)
);
-- Preference and policy races participate in the same fence as task permissions.
CREATE TRIGGER peg_notice_policy_insert AFTER INSERT ON peg_notice_policy BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_notice_policy_update AFTER UPDATE ON peg_notice_policy BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_notice_preference_insert AFTER INSERT ON peg_notice_preferences BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_notice_preference_update AFTER UPDATE ON peg_notice_preferences BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_notice_follow_insert AFTER INSERT ON peg_notice_follows BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_notice_follow_update AFTER UPDATE ON peg_notice_follows BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_notice_mute_insert AFTER INSERT ON peg_readiness_task_preferences BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_notice_mute_update AFTER UPDATE ON peg_readiness_task_preferences BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
-- Explicit cleanup also applies to receiving stores without foreign key enforcement.
CREATE TRIGGER peg_notice_task_erasure AFTER DELETE ON peg_tasks BEGIN
 DELETE FROM peg_notice_targets WHERE event_id IN (SELECT id FROM peg_notice_events WHERE task_id=OLD.id);
 DELETE FROM peg_notice_events WHERE task_id=OLD.id;
 DELETE FROM peg_notice_follows WHERE task_id=OLD.id;
 DELETE FROM peg_notice_commands WHERE task_id=OLD.id;
END;
CREATE TRIGGER peg_notice_comment_erasure AFTER DELETE ON peg_comments BEGIN
 DELETE FROM peg_notice_targets WHERE event_id IN (SELECT id FROM peg_notice_events WHERE comment_id=OLD.id);
 DELETE FROM peg_notice_events WHERE comment_id=OLD.id;
END;

-- A brief mute also cancels queued deliveries; unmuting does not resurrect them.
CREATE TRIGGER peg_notice_cancel_muted_stream_insert AFTER INSERT ON peg_readiness_task_preferences WHEN NEW.muted=1 BEGIN
 UPDATE peg_notice_targets SET state='suppressed' WHERE recipient_id=NEW.operator_id AND state='queued'
 AND event_id IN (SELECT id FROM peg_notice_events WHERE task_id=NEW.task_id);
END;
CREATE TRIGGER peg_notice_cancel_muted_stream_update AFTER UPDATE ON peg_readiness_task_preferences WHEN NEW.muted=1 BEGIN
 UPDATE peg_notice_targets SET state='suppressed' WHERE recipient_id=NEW.operator_id AND state='queued'
 AND event_id IN (SELECT id FROM peg_notice_events WHERE task_id=NEW.task_id);
END;
CREATE TRIGGER peg_notice_cancel_muted_workspace_insert AFTER INSERT ON peg_notice_preferences WHEN NEW.muted=1 BEGIN
 UPDATE peg_notice_targets SET state='suppressed' WHERE recipient_id=NEW.operator_id AND state='queued'
 AND event_id IN (SELECT id FROM peg_notice_events WHERE workspace_id=NEW.workspace_id);
END;
CREATE TRIGGER peg_notice_cancel_muted_workspace_update AFTER UPDATE ON peg_notice_preferences WHEN NEW.muted=1 BEGIN
 UPDATE peg_notice_targets SET state='suppressed' WHERE recipient_id=NEW.operator_id AND state='queued'
 AND event_id IN (SELECT id FROM peg_notice_events WHERE workspace_id=NEW.workspace_id);
END;
