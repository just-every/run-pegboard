CREATE TABLE peg_status_subscriptions (
  subject_type TEXT NOT NULL CHECK(subject_type IN ('project','portfolio')),
  subject_id TEXT NOT NULL,
  operator_id TEXT NOT NULL,
  channels TEXT NOT NULL,
  enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(subject_type,subject_id,operator_id)
);
ALTER TABLE peg_status_drafts ADD COLUMN subscriptions TEXT;
