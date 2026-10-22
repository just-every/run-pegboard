ALTER TABLE peg_goals ADD COLUMN visibility TEXT NOT NULL DEFAULT 'restricted' CHECK(visibility IN ('default','restricted'));
CREATE TABLE peg_goal_audience (goal_id TEXT NOT NULL, grantee_type TEXT NOT NULL CHECK(grantee_type IN ('person','team')), grantee_id TEXT NOT NULL, editor INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(goal_id,grantee_type,grantee_id));
CREATE TRIGGER peg_goal_audience_insert AFTER INSERT ON peg_goal_audience BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_goal_audience_update AFTER UPDATE ON peg_goal_audience BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_goal_audience_delete AFTER DELETE ON peg_goal_audience BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_goal_checkin_revision AFTER INSERT ON peg_goal_checkins BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
