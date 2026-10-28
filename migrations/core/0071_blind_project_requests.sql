-- Private and invalid project names take the same durable intake path.
-- Intake is resolved only by the scheduler or an authorized project reviewer.
CREATE TABLE peg_project_request_intake (
  id TEXT PRIMARY KEY,
  requester_id TEXT NOT NULL,
  requester_version INTEGER NOT NULL,
  target_id TEXT NOT NULL,
  level TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX peg_project_request_intake_target ON peg_project_request_intake(target_id,created_at);
CREATE TRIGGER peg_data_revision_project_request_intake_insert AFTER INSERT ON peg_project_request_intake
BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_data_revision_project_request_intake_delete AFTER DELETE ON peg_project_request_intake
BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
