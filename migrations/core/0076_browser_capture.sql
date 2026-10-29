-- Capture previews hold no membership authority. A terminal intent is a replay tombstone.
CREATE TABLE peg_capture_intents (
 id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, session_hash TEXT NOT NULL,
 source_id TEXT NOT NULL, source_url TEXT NOT NULL, title TEXT NOT NULL, excerpt TEXT NOT NULL,
 proof_hash TEXT NOT NULL, payload_hash TEXT NOT NULL, project_id TEXT, owner_id TEXT,
 review_revision INTEGER, review_token TEXT, state TEXT NOT NULL DEFAULT 'pending'
 CHECK(state IN ('pending','created','cancelled','erased')), task_id TEXT,
 created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
 UNIQUE(actor_id,source_id)
);
CREATE TABLE peg_capture_sources (
 task_id TEXT PRIMARY KEY REFERENCES peg_tasks(id) ON DELETE CASCADE,
 capture_id TEXT NOT NULL UNIQUE, source_id TEXT NOT NULL, source_url TEXT NOT NULL,
 captured_by TEXT NOT NULL, captured_at INTEGER NOT NULL
);
CREATE TRIGGER peg_capture_task_erased AFTER DELETE ON peg_tasks BEGIN
 UPDATE peg_capture_intents SET state='erased',title='',excerpt='',source_url='',proof_hash='',review_token=NULL WHERE task_id=OLD.id;
 DELETE FROM peg_capture_sources WHERE task_id=OLD.id;
END;
CREATE TRIGGER peg_capture_actor_changed AFTER UPDATE OF status,version ON oa_operators
 WHEN NEW.status<>'active' OR NEW.version<>OLD.version BEGIN
 UPDATE peg_capture_intents SET state=CASE WHEN state='pending' THEN 'cancelled' ELSE state END,
 title='',excerpt='',source_url='',proof_hash='',review_token=NULL WHERE actor_id=OLD.id;
END;
CREATE TABLE peg_capture_guards (id TEXT NOT NULL, token TEXT NOT NULL);
CREATE TRIGGER peg_capture_commit_guard BEFORE INSERT ON peg_capture_guards BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM peg_capture_intents WHERE id=NEW.id AND state='pending' AND review_token=NEW.token AND expires_at>unixepoch('subsec')*1000) THEN RAISE(ABORT,'capture_review_changed') END;
END;
