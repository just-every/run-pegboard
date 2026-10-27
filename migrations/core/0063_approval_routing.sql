CREATE TABLE peg_approval_routes (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('proof','task')), subject_id TEXT NOT NULL,
 task_id TEXT NOT NULL, version TEXT NOT NULL, mode TEXT NOT NULL CHECK(mode IN ('ordered','parallel')),
 stages TEXT NOT NULL, due_at INTEGER, reminder_at INTEGER, created_by TEXT NOT NULL, created_at INTEGER NOT NULL,
 withdrawn_at INTEGER
);
CREATE TABLE peg_approval_votes (
 id TEXT PRIMARY KEY, route_id TEXT NOT NULL REFERENCES peg_approval_routes(id) ON DELETE CASCADE,
 version TEXT NOT NULL, stage INTEGER NOT NULL, actor_id TEXT NOT NULL, action TEXT NOT NULL,
 reason TEXT NOT NULL, at INTEGER NOT NULL, UNIQUE(route_id,version,actor_id)
);
CREATE TABLE peg_approval_links (
 id TEXT PRIMARY KEY, route_id TEXT NOT NULL REFERENCES peg_approval_routes(id) ON DELETE CASCADE,
 recipient_id TEXT NOT NULL, version TEXT NOT NULL, expires_at INTEGER NOT NULL, revoked_at INTEGER,
 UNIQUE(route_id,recipient_id,version)
);
CREATE TABLE peg_approval_reminders (
 link_id TEXT PRIMARY KEY REFERENCES peg_approval_links(id) ON DELETE CASCADE, state TEXT NOT NULL, sent_at INTEGER
);
