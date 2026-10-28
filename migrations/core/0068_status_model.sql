-- The generated draft is private; this receipt never grants publication authority.
CREATE TABLE peg_status_model_drafts (
 draft_id TEXT PRIMARY KEY REFERENCES peg_status_drafts(id), version INTEGER NOT NULL,
 model TEXT NOT NULL, processor TEXT NOT NULL, assertions TEXT NOT NULL, usage TEXT NOT NULL,
 requested_by TEXT NOT NULL, created_at INTEGER NOT NULL
);
