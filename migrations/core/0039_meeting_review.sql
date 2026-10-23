CREATE TABLE peg_meetings (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, created_by TEXT NOT NULL,
 service TEXT NOT NULL CHECK(service IN ('zoom','meet','teams')),
 source_id TEXT NOT NULL, digest TEXT NOT NULL, segments TEXT NOT NULL,
 created_at INTEGER NOT NULL, revoked_at INTEGER,
 UNIQUE(created_by,service,source_id)
);
CREATE TABLE peg_meeting_proposals (
 id TEXT PRIMARY KEY, meeting_id TEXT NOT NULL REFERENCES peg_meetings(id) ON DELETE CASCADE,
 segment_index INTEGER NOT NULL, title TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('task','decision','followup')),
 owner_id TEXT, due_date TEXT, date_resolved INTEGER NOT NULL DEFAULT 0,
 version INTEGER NOT NULL DEFAULT 1, task_id TEXT
);
CREATE TABLE peg_meeting_adoptions (
 proposal_id TEXT PRIMARY KEY REFERENCES peg_meeting_proposals(id),
 task_id TEXT NOT NULL, version INTEGER NOT NULL, actor_id TEXT NOT NULL
);
CREATE TABLE peg_meeting_guards(value INTEGER NOT NULL CHECK(value=1));
