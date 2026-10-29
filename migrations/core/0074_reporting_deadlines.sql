-- Deadline history starts here; an older event has unknown deadline semantics.
ALTER TABLE peg_report_events ADD COLUMN due TEXT;
ALTER TABLE peg_report_events ADD COLUMN due_known INTEGER NOT NULL DEFAULT 0;
CREATE TRIGGER peg_report_event_deadline AFTER INSERT ON peg_report_events BEGIN
 UPDATE peg_report_events SET due=(SELECT due_date FROM peg_tasks WHERE id=NEW.task_id),due_known=1 WHERE seq=NEW.seq;
END;
CREATE TRIGGER peg_report_deadline AFTER UPDATE OF due_date ON peg_tasks WHEN NEW.due_date IS NOT OLD.due_date BEGIN
 INSERT INTO peg_report_events(task_id,at,kind,status,effort,projects)
 SELECT NEW.id,CAST((julianday('now')-2440587.5)*86400000 AS INTEGER),'deadline',NEW.status,NEW.estimate_hours,
 COALESCE((SELECT projects FROM peg_report_events WHERE task_id=NEW.id ORDER BY seq DESC LIMIT 1),'[]');
END;
