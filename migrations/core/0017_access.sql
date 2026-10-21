-- PEG-020: grants, the access audit and the PEG-083 request lifecycle.
-- A team's membership is a person grant on the team; a project shared with a team is a team grant on the project.
CREATE TABLE peg_grants (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL,
  object_type TEXT NOT NULL CHECK(object_type IN ('team','project','task')), object_id TEXT NOT NULL,
  grantee_type TEXT NOT NULL CHECK(grantee_type IN ('person','team')), grantee_id TEXT NOT NULL,
  level TEXT NOT NULL CHECK(level IN ('viewer','commenter','editor','admin')),
  scope TEXT NOT NULL DEFAULT 'full' CHECK(scope IN ('full','approve','assignee')), scopes TEXT,
  source TEXT NOT NULL CHECK(source IN ('direct','join','request')), request_id TEXT,
  created_by TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER, revoked_at INTEGER, revoked_by TEXT
);
CREATE INDEX peg_grants_object ON peg_grants(object_type, object_id);
CREATE INDEX peg_grants_grantee ON peg_grants(grantee_type, grantee_id);
CREATE TABLE peg_approvers (object_type TEXT NOT NULL, object_id TEXT NOT NULL, operator_id TEXT NOT NULL, PRIMARY KEY(object_type, object_id, operator_id));
-- Every authority change recorded once: who, what, to whom, the levels and the reason.
CREATE TABLE peg_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT, workspace_id TEXT, at INTEGER NOT NULL, actor_id TEXT, action TEXT NOT NULL,
  target_type TEXT, target_id TEXT, subject_id TEXT, detail TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX peg_audit_workspace ON peg_audit(workspace_id, id);
-- Bumped by every authority change; a decision re-reads it inside its own write.
CREATE TABLE peg_epoch (id INTEGER PRIMARY KEY CHECK(id=1), value INTEGER NOT NULL);
INSERT INTO peg_epoch VALUES (1, 1);
CREATE TABLE peg_access_requests (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, requester_id TEXT NOT NULL, requester_version INTEGER NOT NULL,
  target_type TEXT NOT NULL CHECK(target_type IN ('team','project','task')), target_id TEXT NOT NULL,
  level TEXT NOT NULL CHECK(level IN ('viewer','commenter','editor','admin')), message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK(status IN ('pending','approved','denied','expired','stale')),
  policy_rev INTEGER NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL,
  decided_by TEXT, decided_at INTEGER, decision_reason TEXT, granted_level TEXT, grant_id TEXT, duplicates INTEGER NOT NULL DEFAULT 0
);
-- One pending request per requester and target, however many submissions race.
CREATE UNIQUE INDEX peg_access_requests_active ON peg_access_requests(requester_id, target_type, target_id) WHERE status='pending';
CREATE INDEX peg_access_requests_target ON peg_access_requests(target_type, target_id);
-- The inbox: a delivery to one person, with the minimum a fallback recipient may know.
CREATE TABLE peg_inbox (
  id TEXT PRIMARY KEY, operator_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('request','fallback','decision')),
  request_id TEXT NOT NULL, created_at INTEGER NOT NULL, read_at INTEGER
);
CREATE INDEX peg_inbox_operator ON peg_inbox(operator_id, created_at);
CREATE TABLE peg_webhooks (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, project_id TEXT, url TEXT NOT NULL, events TEXT NOT NULL, secret_hash TEXT NOT NULL,
  created_by TEXT NOT NULL, created_at INTEGER NOT NULL, revoked_at INTEGER
);
