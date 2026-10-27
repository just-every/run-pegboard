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
 id INTEGER PRIMARY KEY AUTOINCREMENT, public_id TEXT NOT NULL UNIQUE DEFAULT ('evt_'||lower(hex(randomblob(10)))), task_id TEXT NOT NULL, kind TEXT NOT NULL, at INTEGER NOT NULL
);
CREATE TRIGGER peg_api_task_created AFTER INSERT ON peg_tasks BEGIN
 INSERT INTO peg_api_events(task_id,kind,at) VALUES(NEW.id,'task.created',NEW.updated_at);
END;
CREATE TRIGGER peg_api_task_updated AFTER UPDATE ON peg_tasks BEGIN
 INSERT INTO peg_api_events(task_id,kind,at) VALUES(NEW.id,'task.updated',NEW.updated_at);
END;
CREATE TABLE peg_api_receipts (
 key_id TEXT NOT NULL, event_id TEXT NOT NULL, received_at INTEGER NOT NULL,
 PRIMARY KEY(key_id,event_id)
);
CREATE TABLE peg_webhook_deliveries (
 webhook_id TEXT NOT NULL, event_id TEXT NOT NULL, state TEXT NOT NULL,
 status INTEGER, at INTEGER NOT NULL, PRIMARY KEY(webhook_id,event_id)
);
CREATE TRIGGER peg_api_webhook_insert AFTER INSERT ON peg_webhooks BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_api_webhook_update AFTER UPDATE ON peg_webhooks BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TABLE peg_api_guards (key_id TEXT NOT NULL);
CREATE TRIGGER peg_api_guard_check BEFORE INSERT ON peg_api_guards BEGIN
 SELECT CASE WHEN NOT EXISTS(
  SELECT 1 FROM peg_api_keys k JOIN oa_operators o ON o.id=k.owner_id
  WHERE k.id=NEW.key_id AND k.revoked_at IS NULL AND k.writable=1
   AND k.expires_at>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)
   AND o.status='active' AND o.version=k.owner_version
   AND EXISTS(SELECT 1 FROM peg_workspaces w WHERE w.id='ws_main' AND COALESCE(json_extract(w.settings,'$.integrationsEnabled'),1)=1)
 ) THEN RAISE(ABORT,'api_credential_changed') END;
END;
CREATE TRIGGER peg_api_guard_consume AFTER INSERT ON peg_api_guards BEGIN DELETE FROM peg_api_guards WHERE rowid=NEW.rowid; END;
CREATE TRIGGER peg_api_key_insert AFTER INSERT ON peg_api_keys BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_departure_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_api_key_update AFTER UPDATE ON peg_api_keys BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_departure_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_api_key_delete AFTER DELETE ON peg_api_keys BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_departure_revision SET value=value+1 WHERE id=1; END;

CREATE TABLE peg_api_cursors (id TEXT PRIMARY KEY,key_id TEXT NOT NULL,after_id INTEGER NOT NULL);
