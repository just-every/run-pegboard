CREATE TABLE peg_timesheets (
 id TEXT PRIMARY KEY,operator_id TEXT NOT NULL,workspace_id TEXT NOT NULL,start_date TEXT NOT NULL,end_date TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','returned','submitted','approved')),version INTEGER NOT NULL DEFAULT 1,
 reason TEXT NOT NULL DEFAULT '',decided_by TEXT,decided_at INTEGER,created_at INTEGER NOT NULL
);
CREATE TABLE peg_time_entries (
 id TEXT PRIMARY KEY,sheet_id TEXT NOT NULL,person_id TEXT NOT NULL,task_id TEXT NOT NULL,project_id TEXT,work_date TEXT NOT NULL,
 seconds INTEGER,start_ms INTEGER,end_ms INTEGER,source TEXT NOT NULL CHECK(source IN ('manual','timer','adjustment')),
 timezone TEXT NOT NULL DEFAULT 'America/New_York',notes TEXT NOT NULL DEFAULT '',adjustment_of TEXT,operation_key TEXT NOT NULL,created_at INTEGER NOT NULL,
 UNIQUE(person_id,operation_key),CHECK(seconds IS NULL OR seconds=CAST(seconds AS INTEGER)),
 CHECK((source='timer' AND start_ms IS NOT NULL) OR (source<>'timer' AND seconds IS NOT NULL))
);
CREATE UNIQUE INDEX peg_time_running ON peg_time_entries(person_id) WHERE source='timer' AND end_ms IS NULL;
CREATE TABLE peg_time_history (id INTEGER PRIMARY KEY AUTOINCREMENT,sheet_id TEXT NOT NULL,actor_id TEXT NOT NULL,at INTEGER NOT NULL,action TEXT NOT NULL,detail TEXT NOT NULL);
CREATE TRIGGER peg_time_insert BEFORE INSERT ON peg_time_entries BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM peg_timesheets s WHERE s.id=NEW.sheet_id AND s.operator_id=NEW.person_id AND s.status IN ('draft','returned') AND NEW.work_date BETWEEN s.start_date AND s.end_date) THEN RAISE(ABORT,'timesheet_locked_or_date') END;
END;
CREATE TRIGGER peg_time_update BEFORE UPDATE ON peg_time_entries BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM peg_timesheets s WHERE s.id=OLD.sheet_id AND s.status IN ('draft','returned')) OR NEW.sheet_id<>OLD.sheet_id OR NEW.person_id<>OLD.person_id OR NEW.task_id<>OLD.task_id OR NEW.source<>OLD.source OR COALESCE(NEW.project_id,'')<>COALESCE(OLD.project_id,'') THEN RAISE(ABORT,'timesheet_locked') END;
END;
CREATE TRIGGER peg_time_delete BEFORE DELETE ON peg_time_entries BEGIN SELECT RAISE(ABORT,'time_history_is_preserved'); END;
CREATE TRIGGER peg_time_entry_added AFTER INSERT ON peg_time_entries BEGIN UPDATE peg_timesheets SET version=version+1 WHERE id=NEW.sheet_id; UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_time_entry_changed AFTER UPDATE ON peg_time_entries BEGIN UPDATE peg_timesheets SET version=version+1 WHERE id=NEW.sheet_id; UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_timesheet_changed AFTER UPDATE ON peg_timesheets BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_timesheet_locked BEFORE UPDATE ON peg_timesheets WHEN OLD.status='approved' BEGIN SELECT RAISE(ABORT,'approved_timesheet_is_locked'); END;
