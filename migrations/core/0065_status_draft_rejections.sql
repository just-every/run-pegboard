-- Rejecting a draft never retracts or edits a published human decision.
CREATE TABLE peg_status_draft_rejections (
 draft_id TEXT NOT NULL REFERENCES peg_status_drafts(id), version INTEGER NOT NULL,
 rejected_by TEXT NOT NULL, reason TEXT NOT NULL, created_at INTEGER NOT NULL,
 PRIMARY KEY(draft_id,version)
);
