-- Native readiness is a committed graph transition, independent of the writer that completes work.
CREATE TABLE peg_readiness_state (
 task_id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, blocked INTEGER NOT NULL CHECK(blocked IN (0,1)),
 generation INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE peg_readiness_transitions (
 task_id TEXT NOT NULL, generation INTEGER NOT NULL, workspace_id TEXT NOT NULL, committed_at INTEGER NOT NULL,
 state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','delivered','cancelled','suppressed')),
 deferred_until INTEGER, deferred_reason TEXT, PRIMARY KEY(task_id,generation)
);
CREATE INDEX peg_readiness_pending ON peg_readiness_transitions(workspace_id,state,committed_at);
CREATE TABLE peg_readiness_deliveries (
 task_id TEXT NOT NULL, generation INTEGER NOT NULL, recipient_id TEXT NOT NULL, visible_at INTEGER NOT NULL,
 share_revision TEXT NOT NULL, PRIMARY KEY(task_id,generation),
 FOREIGN KEY(task_id,generation) REFERENCES peg_readiness_transitions(task_id,generation)
);
CREATE INDEX peg_readiness_recipient ON peg_readiness_deliveries(recipient_id,visible_at);
CREATE TABLE peg_readiness_preferences (
 workspace_id TEXT NOT NULL, operator_id TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
 muted INTEGER NOT NULL DEFAULT 0 CHECK(muted IN (0,1)), inbox_enabled INTEGER NOT NULL DEFAULT 1 CHECK(inbox_enabled IN (0,1)),
 dnd_until INTEGER, digest_until INTEGER, PRIMARY KEY(workspace_id,operator_id)
);
CREATE TABLE peg_readiness_task_preferences (
 task_id TEXT NOT NULL, operator_id TEXT NOT NULL, muted INTEGER NOT NULL DEFAULT 0 CHECK(muted IN (0,1)),
 PRIMARY KEY(task_id,operator_id)
);

-- Seed current blocking truth without inventing a completion event for historical work.
INSERT INTO peg_readiness_state(task_id,workspace_id,blocked)
 SELECT t.id,t.workspace_id,EXISTS(SELECT 1 FROM peg_dependencies d LEFT JOIN peg_tasks p ON p.id=d.predecessor_id
 WHERE d.successor_id=t.id AND (p.id IS NULL OR p.status<>'done'))
 FROM peg_tasks t WHERE EXISTS(SELECT 1 FROM peg_dependencies d WHERE d.successor_id=t.id);

CREATE TRIGGER peg_readiness_ready AFTER UPDATE OF blocked ON peg_readiness_state
WHEN OLD.blocked=1 AND NEW.blocked=0 BEGIN
 UPDATE peg_readiness_state SET generation=OLD.generation+1 WHERE task_id=NEW.task_id;
 INSERT INTO peg_readiness_transitions(task_id,generation,workspace_id,committed_at)
 SELECT NEW.task_id,OLD.generation+1,NEW.workspace_id,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)
 FROM peg_tasks t WHERE t.id=NEW.task_id AND t.status<>'done';
END;
CREATE TRIGGER peg_readiness_blocked AFTER UPDATE OF blocked ON peg_readiness_state
WHEN NEW.blocked=1 BEGIN
 UPDATE peg_readiness_transitions SET state='cancelled',deferred_until=NULL,deferred_reason=NULL
 WHERE task_id=NEW.task_id AND state='queued';
END;
CREATE TRIGGER peg_readiness_dependency_added AFTER INSERT ON peg_dependencies BEGIN
 INSERT OR IGNORE INTO peg_readiness_state(task_id,workspace_id,blocked)
 SELECT t.id,t.workspace_id,EXISTS(SELECT 1 FROM peg_dependencies d LEFT JOIN peg_tasks p ON p.id=d.predecessor_id
 WHERE d.successor_id=t.id AND (p.id IS NULL OR p.status<>'done')) FROM peg_tasks t WHERE t.id=NEW.successor_id;
 UPDATE peg_readiness_state SET blocked=EXISTS(SELECT 1 FROM peg_dependencies d LEFT JOIN peg_tasks p ON p.id=d.predecessor_id
 WHERE d.successor_id=task_id AND (p.id IS NULL OR p.status<>'done')) WHERE task_id=NEW.successor_id;
END;
CREATE TRIGGER peg_readiness_dependency_removed AFTER DELETE ON peg_dependencies BEGIN
 UPDATE peg_readiness_state SET blocked=EXISTS(SELECT 1 FROM peg_dependencies d LEFT JOIN peg_tasks p ON p.id=d.predecessor_id
 WHERE d.successor_id=task_id AND (p.id IS NULL OR p.status<>'done')) WHERE task_id=OLD.successor_id;
END;
CREATE TRIGGER peg_readiness_dependency_changed AFTER UPDATE ON peg_dependencies BEGIN
 INSERT OR IGNORE INTO peg_readiness_state(task_id,workspace_id,blocked)
 SELECT t.id,t.workspace_id,EXISTS(SELECT 1 FROM peg_dependencies d LEFT JOIN peg_tasks p ON p.id=d.predecessor_id
 WHERE d.successor_id=t.id AND (p.id IS NULL OR p.status<>'done')) FROM peg_tasks t WHERE t.id=NEW.successor_id;
 UPDATE peg_readiness_state SET blocked=EXISTS(SELECT 1 FROM peg_dependencies d LEFT JOIN peg_tasks p ON p.id=d.predecessor_id
 WHERE d.successor_id=task_id AND (p.id IS NULL OR p.status<>'done')) WHERE task_id IN (OLD.successor_id,NEW.successor_id);
END;
CREATE TRIGGER peg_readiness_task_status AFTER UPDATE OF status ON peg_tasks WHEN OLD.status<>NEW.status BEGIN
 UPDATE peg_readiness_state SET blocked=EXISTS(SELECT 1 FROM peg_dependencies d LEFT JOIN peg_tasks p ON p.id=d.predecessor_id
 WHERE d.successor_id=task_id AND (p.id IS NULL OR p.status<>'done'))
 WHERE task_id IN (SELECT successor_id FROM peg_dependencies WHERE predecessor_id=NEW.id);
 UPDATE peg_readiness_transitions SET state='cancelled',deferred_until=NULL,deferred_reason=NULL
 WHERE task_id=NEW.id AND NEW.status='done' AND state='queued';
END;
CREATE TRIGGER peg_readiness_task_removed AFTER DELETE ON peg_tasks BEGIN
 UPDATE peg_readiness_state SET blocked=1 WHERE task_id IN (SELECT successor_id FROM peg_dependencies WHERE predecessor_id=OLD.id);
 UPDATE peg_readiness_transitions SET state='cancelled',deferred_until=NULL,deferred_reason=NULL WHERE task_id=OLD.id AND state='queued';
END;
CREATE TRIGGER peg_readiness_reassigned AFTER UPDATE OF owner_id ON peg_tasks WHEN OLD.owner_id<>NEW.owner_id BEGIN
 UPDATE peg_readiness_transitions SET deferred_until=NULL,deferred_reason=NULL WHERE task_id=NEW.id AND state='queued';
END;

-- An explicit opt-out consumes queued notices, so unmuting cannot resurrect an old transition.
CREATE TRIGGER peg_readiness_preferences_insert AFTER INSERT ON peg_readiness_preferences
WHEN NEW.enabled=0 OR NEW.muted=1 OR NEW.inbox_enabled=0 BEGIN
 UPDATE peg_readiness_transitions SET state='suppressed',deferred_until=NULL,deferred_reason=NULL
 WHERE workspace_id=NEW.workspace_id AND state='queued' AND task_id IN (SELECT id FROM peg_tasks WHERE owner_id=NEW.operator_id);
END;
CREATE TRIGGER peg_readiness_preferences_update AFTER UPDATE ON peg_readiness_preferences
WHEN NEW.enabled=0 OR NEW.muted=1 OR NEW.inbox_enabled=0 BEGIN
 UPDATE peg_readiness_transitions SET state='suppressed',deferred_until=NULL,deferred_reason=NULL
 WHERE workspace_id=NEW.workspace_id AND state='queued' AND task_id IN (SELECT id FROM peg_tasks WHERE owner_id=NEW.operator_id);
END;
CREATE TRIGGER peg_readiness_task_preferences_insert AFTER INSERT ON peg_readiness_task_preferences WHEN NEW.muted=1 BEGIN
 UPDATE peg_readiness_transitions SET state='suppressed',deferred_until=NULL,deferred_reason=NULL
 WHERE task_id=NEW.task_id AND state='queued' AND EXISTS(SELECT 1 FROM peg_tasks WHERE id=NEW.task_id AND owner_id=NEW.operator_id);
END;
CREATE TRIGGER peg_readiness_task_preferences_update AFTER UPDATE ON peg_readiness_task_preferences WHEN NEW.muted=1 BEGIN
 UPDATE peg_readiness_transitions SET state='suppressed',deferred_until=NULL,deferred_reason=NULL
 WHERE task_id=NEW.task_id AND state='queued' AND EXISTS(SELECT 1 FROM peg_tasks WHERE id=NEW.task_id AND owner_id=NEW.operator_id);
END;
CREATE TRIGGER peg_readiness_initial_preferences AFTER INSERT ON peg_readiness_transitions BEGIN
 UPDATE peg_readiness_transitions SET state='suppressed'
 WHERE task_id=NEW.task_id AND generation=NEW.generation AND (
 EXISTS(SELECT 1 FROM peg_tasks t JOIN peg_readiness_preferences p ON p.workspace_id=t.workspace_id AND p.operator_id=t.owner_id
 WHERE t.id=NEW.task_id AND (p.enabled=0 OR p.muted=1 OR p.inbox_enabled=0))
 OR EXISTS(SELECT 1 FROM peg_tasks t JOIN peg_readiness_task_preferences p ON p.task_id=t.id AND p.operator_id=t.owner_id
 WHERE t.id=NEW.task_id AND p.muted=1));
END;
