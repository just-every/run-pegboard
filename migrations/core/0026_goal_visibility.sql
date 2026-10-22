ALTER TABLE peg_goals ADD COLUMN visibility TEXT NOT NULL DEFAULT 'restricted' CHECK(visibility IN ('default','restricted'));
CREATE TABLE peg_goal_audience (goal_id TEXT NOT NULL, grantee_type TEXT NOT NULL CHECK(grantee_type IN ('person','team')), grantee_id TEXT NOT NULL, editor INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(goal_id,grantee_type,grantee_id));
CREATE TRIGGER peg_goal_audience_insert AFTER INSERT ON peg_goal_audience BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_goal_audience_update AFTER UPDATE ON peg_goal_audience BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_goal_audience_delete AFTER DELETE ON peg_goal_audience BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_goal_checkin_revision AFTER INSERT ON peg_goal_checkins BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;

-- The goal's owner remains an active internal human, including across native account doors.
CREATE TRIGGER peg_goal_valid_owner_insert BEFORE INSERT ON peg_goals
WHEN NOT EXISTS (SELECT 1 FROM oa_operators o LEFT JOIN peg_workspace_members m ON m.operator_id=o.id AND m.workspace_id=NEW.workspace_id WHERE o.id=NEW.owner_id AND o.status='active' AND (o.role IN ('owner','admin') OR m.role IN ('manager','member') OR NEW.scope='personal' AND m.role='analyst'))
BEGIN SELECT RAISE(ABORT,'goal_owner_transfer_required'); END;
CREATE TRIGGER peg_goal_valid_owner_update BEFORE UPDATE OF owner_id,scope ON peg_goals
WHEN NOT EXISTS (SELECT 1 FROM oa_operators o LEFT JOIN peg_workspace_members m ON m.operator_id=o.id AND m.workspace_id=NEW.workspace_id WHERE o.id=NEW.owner_id AND o.status='active' AND (o.role IN ('owner','admin') OR m.role IN ('manager','member') OR NEW.scope='personal' AND m.role='analyst'))
BEGIN SELECT RAISE(ABORT,'goal_owner_transfer_required'); END;
CREATE TRIGGER peg_goal_operator_owner_guard BEFORE UPDATE OF status,role ON oa_operators
WHEN EXISTS (SELECT 1 FROM peg_goals g LEFT JOIN peg_workspace_members m ON m.operator_id=NEW.id AND m.workspace_id=g.workspace_id WHERE g.owner_id=NEW.id AND (NEW.status<>'active' OR NOT(NEW.role IN ('owner','admin') OR COALESCE(m.role,'') IN ('manager','member') OR g.scope='personal' AND m.role='analyst')))
BEGIN SELECT RAISE(ABORT,'goal_owner_transfer_required'); END;
CREATE TRIGGER peg_goal_member_owner_guard BEFORE UPDATE OF role ON peg_workspace_members
WHEN EXISTS (SELECT 1 FROM peg_goals g JOIN oa_operators o ON o.id=NEW.operator_id WHERE g.owner_id=NEW.operator_id AND g.workspace_id=NEW.workspace_id AND o.role NOT IN ('owner','admin') AND NOT(NEW.role IN ('manager','member') OR g.scope='personal' AND NEW.role='analyst'))
BEGIN SELECT RAISE(ABORT,'goal_owner_transfer_required'); END;
CREATE TRIGGER peg_goal_member_owner_delete BEFORE DELETE ON peg_workspace_members
WHEN EXISTS (SELECT 1 FROM peg_goals g JOIN oa_operators o ON o.id=OLD.operator_id WHERE g.owner_id=OLD.operator_id AND g.workspace_id=OLD.workspace_id AND o.role NOT IN ('owner','admin'))
BEGIN SELECT RAISE(ABORT,'goal_owner_transfer_required'); END;
