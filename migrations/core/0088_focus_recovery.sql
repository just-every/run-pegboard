-- Human reviews confer no standing provider or model authority.
CREATE TABLE peg_focus_locks (
 block_id TEXT PRIMARY KEY REFERENCES peg_calendar_blocks(id) ON DELETE CASCADE,
 owner_id TEXT NOT NULL, locked INTEGER NOT NULL CHECK(locked IN (0,1)),
 start_at TEXT NOT NULL,end_at TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,reviewed_at INTEGER NOT NULL
);
CREATE TABLE peg_focus_reviews (
 id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,connection_id TEXT NOT NULL REFERENCES peg_calendar_connections(id) ON DELETE CASCADE,
 kind TEXT NOT NULL,state TEXT NOT NULL,body TEXT NOT NULL,stamp TEXT NOT NULL,expires_at INTEGER NOT NULL,
 selected INTEGER,source_id TEXT,cause TEXT,created_at INTEGER NOT NULL,applied_at INTEGER
);
CREATE TABLE peg_focus_subjects (
 review_id TEXT NOT NULL REFERENCES peg_focus_reviews(id) ON DELETE CASCADE,
 task_id TEXT NOT NULL REFERENCES peg_tasks(id) ON DELETE CASCADE,PRIMARY KEY(review_id,task_id)
);
CREATE TABLE peg_focus_operations (
 review_id TEXT NOT NULL REFERENCES peg_focus_reviews(id) ON DELETE CASCADE,
 block_id TEXT NOT NULL REFERENCES peg_calendar_blocks(id) ON DELETE CASCADE,
 task_id TEXT NOT NULL REFERENCES peg_tasks(id) ON DELETE CASCADE,
 state TEXT NOT NULL,event_etag TEXT,task_after TEXT,
 PRIMARY KEY(review_id,block_id)
);
CREATE TRIGGER peg_focus_operation_exclusive BEFORE INSERT ON peg_focus_operations WHEN EXISTS(
 SELECT 1 FROM peg_focus_operations o JOIN peg_focus_reviews r ON r.id=o.review_id
 WHERE o.block_id=NEW.block_id AND r.state IN ('applying','uncertain')
) BEGIN SELECT RAISE(ABORT,'stale_personal_preview'); END;
CREATE TRIGGER peg_focus_locks_custody_insert AFTER INSERT ON peg_focus_locks BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_focus_locks_custody_update AFTER UPDATE ON peg_focus_locks BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_focus_locks_custody_delete AFTER DELETE ON peg_focus_locks BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_focus_reviews_custody_insert AFTER INSERT ON peg_focus_reviews BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_focus_reviews_custody_update AFTER UPDATE ON peg_focus_reviews BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_focus_reviews_custody_delete AFTER DELETE ON peg_focus_reviews BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_focus_subjects_custody_insert AFTER INSERT ON peg_focus_subjects BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_focus_subjects_custody_update AFTER UPDATE ON peg_focus_subjects BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_focus_subjects_custody_delete AFTER DELETE ON peg_focus_subjects BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_focus_operations_custody_insert AFTER INSERT ON peg_focus_operations BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_focus_operations_custody_update AFTER UPDATE ON peg_focus_operations BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_focus_operations_custody_delete AFTER DELETE ON peg_focus_operations BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_focus_locks_review_insert AFTER INSERT ON peg_focus_locks BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_focus_locks_review_update AFTER UPDATE ON peg_focus_locks BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_focus_locks_review_delete AFTER DELETE ON peg_focus_locks BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;

CREATE TRIGGER peg_focus_locked_task_dates BEFORE UPDATE OF start_date,due_date ON peg_tasks
WHEN (OLD.start_date IS NOT NEW.start_date OR OLD.due_date IS NOT NEW.due_date)
 AND EXISTS(SELECT 1 FROM peg_calendar_blocks b JOIN peg_focus_locks l ON l.block_id=b.id WHERE b.task_id=OLD.id AND l.locked=1)
BEGIN SELECT RAISE(ABORT,'focus_locked'); END;
CREATE TRIGGER peg_focus_locked_block_update BEFORE UPDATE OF start_at,end_at,state ON peg_calendar_blocks
WHEN (OLD.start_at<>NEW.start_at OR OLD.end_at<>NEW.end_at OR NEW.state='cancelled')
 AND EXISTS(SELECT 1 FROM peg_focus_locks WHERE block_id=OLD.id AND locked=1)
BEGIN SELECT RAISE(ABORT,'focus_locked'); END;
CREATE TRIGGER peg_focus_locked_block_delete BEFORE DELETE ON peg_calendar_blocks
WHEN EXISTS(SELECT 1 FROM peg_focus_locks WHERE block_id=OLD.id AND locked=1)
BEGIN SELECT RAISE(ABORT,'focus_locked'); END;
CREATE TRIGGER peg_calendar_connections_focus_custody_insert AFTER INSERT ON peg_calendar_connections BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_calendar_connections_focus_custody_update AFTER UPDATE ON peg_calendar_connections BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_calendar_connections_focus_custody_delete AFTER DELETE ON peg_calendar_connections BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_calendar_blocks_focus_custody_insert AFTER INSERT ON peg_calendar_blocks BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_calendar_blocks_focus_custody_update AFTER UPDATE ON peg_calendar_blocks BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_calendar_blocks_focus_custody_delete AFTER DELETE ON peg_calendar_blocks BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_calendar_previews_focus_custody_insert AFTER INSERT ON peg_calendar_previews BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_calendar_previews_focus_custody_update AFTER UPDATE ON peg_calendar_previews BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_calendar_previews_focus_custody_delete AFTER DELETE ON peg_calendar_previews BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
