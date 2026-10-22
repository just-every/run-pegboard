ALTER TABLE peg_recurrences ADD COLUMN audience TEXT;
ALTER TABLE peg_recurrences ADD COLUMN held INTEGER NOT NULL DEFAULT 0;
ALTER TABLE peg_recurrences ADD COLUMN attempted_at INTEGER NOT NULL DEFAULT 0;
CREATE TABLE peg_occurrence_reviews (schedule_id TEXT NOT NULL, local_date TEXT NOT NULL, audience TEXT NOT NULL, unreachable TEXT NOT NULL, PRIMARY KEY(schedule_id,local_date));
CREATE TABLE peg_recurring_grants (grant_id TEXT PRIMARY KEY);
CREATE TRIGGER peg_occurrence_review_immutable BEFORE UPDATE ON peg_occurrence_reviews BEGIN SELECT RAISE(ABORT,'immutable_occurrence_review'); END;
