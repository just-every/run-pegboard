CREATE TABLE peg_calendar_connections (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES peg_workspaces(id) ON DELETE CASCADE,
 owner_id TEXT NOT NULL REFERENCES oa_operators(id), owner_version INTEGER NOT NULL,
 service TEXT NOT NULL CHECK(service IN ('google','microsoft')), calendar_id TEXT NOT NULL,
 active INTEGER NOT NULL DEFAULT 1, revision INTEGER NOT NULL DEFAULT 1,
 UNIQUE(owner_id,service,calendar_id)
);
CREATE TABLE peg_calendar_blocks (
 id TEXT PRIMARY KEY, connection_id TEXT NOT NULL REFERENCES peg_calendar_connections(id) ON DELETE CASCADE,
 task_id TEXT NOT NULL REFERENCES peg_tasks(id) ON DELETE CASCADE,
 transaction_id TEXT NOT NULL UNIQUE, event_id TEXT, etag TEXT,
 start_at TEXT NOT NULL, end_at TEXT NOT NULL, zone TEXT NOT NULL, task_revision TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('pending','scheduled','conflict','cancelled')), cause TEXT,
 revision INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX peg_calendar_one_active ON peg_calendar_blocks(connection_id,task_id) WHERE state<>'cancelled';
CREATE TABLE peg_calendar_previews (
 id TEXT PRIMARY KEY, connection_id TEXT NOT NULL REFERENCES peg_calendar_connections(id) ON DELETE CASCADE,
 task_id TEXT NOT NULL REFERENCES peg_tasks(id) ON DELETE CASCADE, owner_id TEXT NOT NULL,
 task_revision TEXT NOT NULL, connection_revision INTEGER NOT NULL, block_id TEXT,
 block_revision INTEGER, observed_etag TEXT, slots TEXT NOT NULL, zone TEXT NOT NULL, expires_at INTEGER NOT NULL,
 applied_block TEXT
);
CREATE TRIGGER peg_calendar_connection_insert AFTER INSERT ON peg_calendar_connections BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_calendar_connection_update AFTER UPDATE ON peg_calendar_connections BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_calendar_block_insert AFTER INSERT ON peg_calendar_blocks BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_calendar_block_update AFTER UPDATE ON peg_calendar_blocks BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
