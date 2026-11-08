-- Retain personal routing definitions without resuming source automation.
ALTER TABLE peg_personal_rules ADD COLUMN restored_inactive INTEGER NOT NULL DEFAULT 0 CHECK(restored_inactive IN (0,1));
