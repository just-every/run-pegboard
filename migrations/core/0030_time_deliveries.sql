-- Reviewed time delivery: one durable row per approved entry and receiver account. A row is claimed (sending) before
-- its provider request, so a lost response stays visible as uncertain and is read back before anything is resent.
CREATE TABLE peg_time_deliveries (
 service TEXT NOT NULL CHECK(service IN ('harvest','quickbooks-time')),account TEXT NOT NULL,entry_id TEXT NOT NULL,sheet_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('entry','correction')),target_entry_id TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('sending','uncertain','acknowledged','rejected')),provider_id INTEGER,
 seconds INTEGER NOT NULL,provider_seconds REAL,request TEXT NOT NULL,status_code INTEGER,reason TEXT,
 attempts INTEGER NOT NULL DEFAULT 1,actor_id TEXT NOT NULL,updated_at INTEGER NOT NULL,
 PRIMARY KEY(service,account,entry_id)
);
CREATE INDEX peg_time_delivery_target ON peg_time_deliveries(service,account,target_entry_id);
CREATE TABLE peg_time_delivery_history (
 id INTEGER PRIMARY KEY AUTOINCREMENT,service TEXT NOT NULL,account TEXT NOT NULL,entry_id TEXT NOT NULL,sheet_id TEXT NOT NULL,
 actor_id TEXT NOT NULL,at INTEGER NOT NULL,state TEXT NOT NULL,provider_id INTEGER,provider_seconds REAL,status_code INTEGER,reason TEXT
);
CREATE TRIGGER peg_time_delivery_acknowledged BEFORE UPDATE ON peg_time_deliveries WHEN OLD.state='acknowledged'
BEGIN SELECT RAISE(ABORT,'time_delivery_acknowledged'); END;
CREATE TRIGGER peg_time_delivery_kept BEFORE DELETE ON peg_time_deliveries BEGIN SELECT RAISE(ABORT,'time_delivery_history_is_preserved'); END;
CREATE TRIGGER peg_time_delivery_history_kept BEFORE UPDATE ON peg_time_delivery_history BEGIN SELECT RAISE(ABORT,'time_delivery_history_is_preserved'); END;
CREATE TRIGGER peg_time_delivery_history_undeleted BEFORE DELETE ON peg_time_delivery_history BEGIN SELECT RAISE(ABORT,'time_delivery_history_is_preserved'); END;
