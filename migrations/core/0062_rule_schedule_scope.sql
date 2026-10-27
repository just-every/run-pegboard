-- Preserve queued triggers and immutable run references while adding a durable review state.
PRAGMA defer_foreign_keys=ON;
CREATE TABLE peg_bundle_jobs_next(id TEXT PRIMARY KEY,bundle_id TEXT NOT NULL,project_id TEXT NOT NULL,item_key TEXT NOT NULL,task_id TEXT NOT NULL,epoch INTEGER NOT NULL,config TEXT NOT NULL,actor_id TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('queued','applied','cancelled','pending')),created_at INTEGER NOT NULL,finished_at INTEGER,definition_version INTEGER,outcome_reason TEXT);
INSERT INTO peg_bundle_jobs_next SELECT id,bundle_id,project_id,item_key,task_id,epoch,config,actor_id,status,created_at,finished_at,definition_version,outcome_reason FROM peg_bundle_jobs;
DROP TABLE peg_bundle_jobs;
ALTER TABLE peg_bundle_jobs_next RENAME TO peg_bundle_jobs;
CREATE TRIGGER peg_departure_peg_bundle_jobs_insert AFTER INSERT ON peg_bundle_jobs BEGIN UPDATE peg_departure_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_departure_peg_bundle_jobs_update AFTER UPDATE ON peg_bundle_jobs BEGIN UPDATE peg_departure_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_departure_peg_bundle_jobs_delete AFTER DELETE ON peg_bundle_jobs BEGIN UPDATE peg_departure_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_rule_job_revision AFTER UPDATE ON peg_bundle_jobs BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
