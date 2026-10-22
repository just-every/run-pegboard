CREATE TABLE peg_goal_sources (id TEXT PRIMARY KEY, goal_id TEXT NOT NULL, owner_id TEXT NOT NULL, name TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('csv','api')), token_hash TEXT, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, revoked_at INTEGER);
ALTER TABLE peg_goal_events ADD COLUMN source_id TEXT;
CREATE TRIGGER peg_goal_source_insert AFTER INSERT ON peg_goal_sources BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_goal_source_update AFTER UPDATE ON peg_goal_sources BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
