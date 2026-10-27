-- Working hours belong to a workspace; personal leave stores only availability, never private reasons.
CREATE TABLE peg_working_calendars (
  workspace_id TEXT PRIMARY KEY REFERENCES peg_workspaces(id) ON DELETE CASCADE,
  zone TEXT NOT NULL, week TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE peg_time_off (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES peg_workspaces(id) ON DELETE CASCADE,
  operator_id TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX peg_time_off_person ON peg_time_off(workspace_id,operator_id,start_date);
-- Keep the availability revision after leave is removed, so an old preview cannot become current again.
CREATE TABLE peg_availability_revisions (
  workspace_id TEXT NOT NULL REFERENCES peg_workspaces(id) ON DELETE CASCADE,
  operator_id TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(workspace_id,operator_id)
);
-- Fence a calendar change racing the final schedule transaction, as well as changes between preview and Apply.
CREATE TRIGGER peg_calendar_revision_insert AFTER INSERT ON peg_working_calendars BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_calendar_revision_update AFTER UPDATE ON peg_working_calendars BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_calendar_revision_delete AFTER DELETE ON peg_working_calendars BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_leave_revision_insert AFTER INSERT ON peg_time_off BEGIN
  UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
  INSERT INTO peg_availability_revisions(workspace_id,operator_id) VALUES(NEW.workspace_id,NEW.operator_id)
    ON CONFLICT(workspace_id,operator_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER peg_leave_revision_update AFTER UPDATE ON peg_time_off BEGIN
  UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
  INSERT INTO peg_availability_revisions(workspace_id,operator_id) VALUES(NEW.workspace_id,NEW.operator_id)
    ON CONFLICT(workspace_id,operator_id) DO UPDATE SET revision=revision+1;
END;
CREATE TRIGGER peg_leave_revision_delete AFTER DELETE ON peg_time_off BEGIN
  UPDATE peg_personal_revision SET value=value+1 WHERE id=1;
  INSERT INTO peg_availability_revisions(workspace_id,operator_id) VALUES(OLD.workspace_id,OLD.operator_id)
    ON CONFLICT(workspace_id,operator_id) DO UPDATE SET revision=revision+1;
END;
