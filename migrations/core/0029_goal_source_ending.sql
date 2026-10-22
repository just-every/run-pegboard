-- A numeric source ends for good: revocation, expiry or a change of accountable owner. Ownership loss is enforced where
-- the owner changes, whichever door changes it, and an ended source never resumes.
ALTER TABLE peg_goal_sources ADD COLUMN ended_at INTEGER;
ALTER TABLE peg_goal_sources ADD COLUMN ended_cause TEXT CHECK(ended_cause IN ('revoked','ownership_changed'));
UPDATE peg_goal_sources SET ended_at=revoked_at,ended_cause='revoked' WHERE revoked_at IS NOT NULL;
UPDATE peg_goal_sources SET ended_at=CAST(strftime('%s','now') AS INTEGER)*1000,ended_cause='ownership_changed' WHERE ended_at IS NULL AND owner_id<>(SELECT owner_id FROM peg_goals WHERE id=peg_goal_sources.goal_id);
ALTER TABLE peg_goal_sources DROP COLUMN revoked_at;
CREATE TRIGGER peg_goal_owner_ends_sources AFTER UPDATE OF owner_id ON peg_goals WHEN OLD.owner_id<>NEW.owner_id
BEGIN UPDATE peg_goal_sources SET ended_at=CAST(strftime('%s','now') AS INTEGER)*1000,ended_cause='ownership_changed' WHERE goal_id=NEW.id AND ended_at IS NULL; END;

-- An observation's identity is (goal, source, key): a person's key can never collide with, replay or poison a source's.
-- Source events carry the source as their recorder, never the person who authorized it.
CREATE TABLE peg_goal_events_next (goal_id TEXT NOT NULL,source_id TEXT NOT NULL DEFAULT '',event_key TEXT NOT NULL,value REAL NOT NULL,observed_at INTEGER NOT NULL,received_at INTEGER NOT NULL,actor_id TEXT NOT NULL,PRIMARY KEY(goal_id,source_id,event_key));
INSERT INTO peg_goal_events_next SELECT goal_id,COALESCE(source_id,''),CASE WHEN source_id IS NOT NULL AND substr(event_key,1,length(source_id)+1)=source_id||':' THEN substr(event_key,length(source_id)+2) ELSE event_key END,value,observed_at,received_at,COALESCE(source_id,actor_id) FROM peg_goal_events;
DROP TABLE peg_goal_events;
ALTER TABLE peg_goal_events_next RENAME TO peg_goal_events;
CREATE TRIGGER peg_goal_event_immutable BEFORE UPDATE ON peg_goal_events BEGIN SELECT RAISE(ABORT,'immutable_numeric_event'); END;
CREATE TRIGGER peg_goal_event_revision AFTER INSERT ON peg_goal_events BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
