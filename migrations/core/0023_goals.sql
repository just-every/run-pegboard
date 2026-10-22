CREATE TABLE peg_goals (
 id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,scope TEXT NOT NULL CHECK(scope IN ('company','team','personal')),team_id TEXT,
 owner_id TEXT NOT NULL,created_by TEXT NOT NULL,title TEXT NOT NULL,kind TEXT NOT NULL CHECK(kind IN ('objective','key_result')),
 period_start TEXT NOT NULL,period_end TEXT NOT NULL,mode TEXT NOT NULL CHECK(mode IN ('manual','work','numeric')),
 unit TEXT NOT NULL,baseline REAL NOT NULL,target REAL NOT NULL,manual_percent REAL NOT NULL DEFAULT 0,
 override_percent REAL,stale_after_seconds INTEGER NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL
);
CREATE TABLE peg_goal_links (goal_id TEXT NOT NULL,source_type TEXT NOT NULL CHECK(source_type IN ('task','project','goal')),source_id TEXT NOT NULL,weight REAL NOT NULL CHECK(weight>0),PRIMARY KEY(goal_id,source_type,source_id));
CREATE TABLE peg_goal_events (goal_id TEXT NOT NULL,event_key TEXT NOT NULL,value REAL NOT NULL,observed_at INTEGER NOT NULL,received_at INTEGER NOT NULL,actor_id TEXT NOT NULL,PRIMARY KEY(goal_id,event_key));
CREATE TABLE peg_goal_checkins (id TEXT PRIMARY KEY,goal_id TEXT NOT NULL,actor_id TEXT NOT NULL,at INTEGER NOT NULL,note TEXT NOT NULL,detail TEXT NOT NULL);
CREATE TRIGGER peg_goal_event_immutable BEFORE UPDATE ON peg_goal_events BEGIN SELECT RAISE(ABORT,'immutable_numeric_event'); END;
CREATE TRIGGER peg_goal_checkin_immutable BEFORE UPDATE ON peg_goal_checkins BEGIN SELECT RAISE(ABORT,'immutable_goal_checkin'); END;
CREATE TRIGGER peg_goal_revision_insert AFTER INSERT ON peg_goals BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_goal_revision_update AFTER UPDATE ON peg_goals BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_goal_link_revision_insert AFTER INSERT ON peg_goal_links BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_goal_link_revision_delete AFTER DELETE ON peg_goal_links BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_goal_link_revision_update AFTER UPDATE ON peg_goal_links BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_goal_event_revision AFTER INSERT ON peg_goal_events BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
