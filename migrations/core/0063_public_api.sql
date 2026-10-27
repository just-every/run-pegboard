-- Credentials never travel in an installation archive. Current person and project access is checked per call.
CREATE TABLE peg_api_keys (
 id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, owner_version INTEGER NOT NULL,
 token_hash TEXT NOT NULL UNIQUE, name TEXT NOT NULL, projects TEXT NOT NULL,
 personal INTEGER NOT NULL, writable INTEGER NOT NULL, expires_at INTEGER NOT NULL,
 revoked_at INTEGER, created_at INTEGER NOT NULL
);
CREATE TABLE peg_api_intents (
 key_id TEXT NOT NULL, intent TEXT NOT NULL, fingerprint TEXT NOT NULL,
 response TEXT, PRIMARY KEY(key_id,intent)
);
-- An event contains identifiers only; its current readable representation is computed at delivery time.
CREATE TABLE peg_api_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL, kind TEXT NOT NULL, at INTEGER NOT NULL
);
CREATE TRIGGER peg_api_task_created AFTER INSERT ON peg_tasks BEGIN
 INSERT INTO peg_api_events(task_id,kind,at) VALUES(NEW.id,'task.created',NEW.updated_at);
END;
CREATE TRIGGER peg_api_task_updated AFTER UPDATE ON peg_tasks BEGIN
 INSERT INTO peg_api_events(task_id,kind,at) VALUES(NEW.id,'task.updated',NEW.updated_at);
END;
CREATE TABLE peg_api_receipts (
 key_id TEXT NOT NULL, event_id INTEGER NOT NULL, received_at INTEGER NOT NULL,
 PRIMARY KEY(key_id,event_id)
);
CREATE TABLE peg_webhook_deliveries (
 webhook_id TEXT NOT NULL, event_id INTEGER NOT NULL, state TEXT NOT NULL,
 status INTEGER, at INTEGER NOT NULL, PRIMARY KEY(webhook_id,event_id)
);
CREATE TRIGGER peg_api_webhook_insert AFTER INSERT ON peg_webhooks BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_api_webhook_update AFTER UPDATE ON peg_webhooks BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
