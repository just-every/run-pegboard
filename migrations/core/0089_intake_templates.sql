-- Exact human application keeps the existing request identity and its triage clock.
ALTER TABLE peg_intake_submissions ADD COLUMN answers TEXT;
ALTER TABLE peg_intake_submissions ADD COLUMN template_pin TEXT;
CREATE TABLE peg_intake_template_applications (
 id TEXT PRIMARY KEY, submission_id TEXT NOT NULL UNIQUE, project_id TEXT NOT NULL,
 template_id TEXT NOT NULL, template_version INTEGER NOT NULL, actor_id TEXT NOT NULL,
 token TEXT NOT NULL, result TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('applied','inactive')), created_at INTEGER NOT NULL, input_hash TEXT NOT NULL
);
CREATE TABLE peg_intake_template_tasks (
 application_id TEXT NOT NULL, task_key TEXT NOT NULL, task_id TEXT NOT NULL,
 owner_id TEXT, before_owner TEXT, start_date TEXT, due_date TEXT,
 PRIMARY KEY(application_id,task_key)
);
-- Erasing one generated task retains an inactive application witness: no replay can recreate it.
CREATE TRIGGER peg_intake_mapping_task_erased AFTER DELETE ON peg_tasks BEGIN
 UPDATE peg_intake_template_applications SET state='inactive' WHERE id IN(SELECT application_id FROM peg_intake_template_tasks WHERE task_id=OLD.id);
 DELETE FROM peg_intake_template_tasks WHERE task_id=OLD.id;
END;
CREATE TRIGGER peg_intake_mapping_peg_intake_submissions_insert AFTER INSERT ON peg_intake_submissions BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_intake_mapping_peg_intake_submissions_update AFTER UPDATE ON peg_intake_submissions BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_intake_mapping_peg_intake_submissions_delete AFTER DELETE ON peg_intake_submissions BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_intake_mapping_peg_intake_template_applications_insert AFTER INSERT ON peg_intake_template_applications BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_intake_mapping_peg_intake_template_applications_update AFTER UPDATE ON peg_intake_template_applications BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_intake_mapping_peg_intake_template_applications_delete AFTER DELETE ON peg_intake_template_applications BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_intake_mapping_peg_intake_template_tasks_insert AFTER INSERT ON peg_intake_template_tasks BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_intake_mapping_peg_intake_template_tasks_update AFTER UPDATE ON peg_intake_template_tasks BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_intake_mapping_peg_intake_template_tasks_delete AFTER DELETE ON peg_intake_template_tasks BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
