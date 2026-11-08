-- Archived mappings remain inspectable but cannot be reused as provider operations.
ALTER TABLE peg_calendar_connections ADD COLUMN restored_inactive INTEGER NOT NULL DEFAULT 0 CHECK(restored_inactive IN (0,1));
ALTER TABLE peg_calendar_blocks ADD COLUMN restored_inactive INTEGER NOT NULL DEFAULT 0 CHECK(restored_inactive IN (0,1));
DROP INDEX peg_calendar_one_active;
CREATE UNIQUE INDEX peg_calendar_one_active ON peg_calendar_blocks(connection_id,task_id) WHERE state<>'cancelled' AND restored_inactive=0;
