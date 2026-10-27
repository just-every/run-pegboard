-- Draft content is reviewed separately from immutable human publication decisions.
CREATE TABLE peg_status_drafts (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, subject_type TEXT NOT NULL CHECK(subject_type IN ('project','portfolio')),
 subject_id TEXT NOT NULL, version INTEGER NOT NULL, content TEXT NOT NULL, sources TEXT NOT NULL, recipients TEXT NOT NULL,
 corrects_id TEXT, created_by TEXT NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE peg_status_revisions (
 id TEXT PRIMARY KEY REFERENCES peg_status_updates(id), draft_id TEXT NOT NULL, draft_version INTEGER NOT NULL,
 content TEXT NOT NULL, sources TEXT NOT NULL, recipients TEXT NOT NULL, corrects_id TEXT, reviewed_by TEXT NOT NULL,
 review_token TEXT NOT NULL, UNIQUE(draft_id,draft_version)
);
CREATE TRIGGER peg_status_revision_immutable BEFORE UPDATE ON peg_status_revisions BEGIN SELECT RAISE(ABORT,'immutable_status_revision'); END;
CREATE TRIGGER peg_status_revision_retained BEFORE DELETE ON peg_status_revisions BEGIN SELECT RAISE(ABORT,'immutable_status_revision'); END;
CREATE TABLE peg_status_review_guards (id TEXT PRIMARY KEY, valid INTEGER NOT NULL CHECK(valid=1));
CREATE TABLE peg_status_receipts (
 revision_id TEXT NOT NULL REFERENCES peg_status_revisions(id), recipient_id TEXT NOT NULL, channel TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('available','blocked','revoked')), reason TEXT, created_at INTEGER NOT NULL,
 PRIMARY KEY(revision_id,recipient_id,channel)
);
CREATE TABLE peg_status_comments (
 id TEXT PRIMARY KEY, revision_id TEXT NOT NULL REFERENCES peg_status_revisions(id), parent_id TEXT REFERENCES peg_status_comments(id),
 author_id TEXT NOT NULL, body TEXT NOT NULL, internal_only INTEGER NOT NULL CHECK(internal_only IN (0,1)),
 created_at INTEGER NOT NULL, edited_at INTEGER, deleted_at INTEGER
);
CREATE INDEX peg_status_comments_revision ON peg_status_comments(revision_id,created_at);
