-- Discussion preferences are personal and never confer access to a revision.
CREATE TABLE peg_status_discussion_preferences (
 revision_id TEXT NOT NULL REFERENCES peg_status_revisions(id), operator_id TEXT NOT NULL,
 following INTEGER NOT NULL DEFAULT 1 CHECK(following IN (0,1)), muted INTEGER NOT NULL DEFAULT 0 CHECK(muted IN (0,1)),
 PRIMARY KEY(revision_id,operator_id)
);
CREATE TABLE peg_status_discussion_notices (
 comment_id TEXT NOT NULL REFERENCES peg_status_comments(id), recipient_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('comment','mention')),
 created_at INTEGER NOT NULL, PRIMARY KEY(comment_id,recipient_id)
);
