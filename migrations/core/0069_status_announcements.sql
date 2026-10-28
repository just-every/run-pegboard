CREATE TABLE peg_announcements (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, subject_type TEXT NOT NULL CHECK(subject_type IN ('project','team')),
 subject_id TEXT NOT NULL, parent_id TEXT REFERENCES peg_announcements(id), author_id TEXT NOT NULL,
 body TEXT NOT NULL, internal_only INTEGER NOT NULL CHECK(internal_only IN (0,1)), created_at INTEGER NOT NULL
);
CREATE INDEX peg_announcements_subject ON peg_announcements(subject_type,subject_id,created_at);
