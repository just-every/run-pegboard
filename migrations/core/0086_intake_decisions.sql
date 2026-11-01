-- Human intake decisions are historical facts, never agent or restored execution authority.
CREATE TABLE peg_intake_decision_policies (
 project_id TEXT PRIMARY KEY, version INTEGER NOT NULL, enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
 approved_by TEXT, approver_version INTEGER, approved_at INTEGER NOT NULL
);
CREATE TABLE peg_intake_decisions (
 id TEXT PRIMARY KEY, submission_id TEXT NOT NULL UNIQUE, project_id TEXT NOT NULL, task_id TEXT NOT NULL,
 request_key TEXT NOT NULL, actor_id TEXT NOT NULL, actor_version INTEGER NOT NULL,
 policy_version INTEGER NOT NULL, disposition TEXT NOT NULL CHECK(disposition IN ('accepted','declined')),
 priority_before TEXT NOT NULL, priority_after TEXT NOT NULL, decided_at INTEGER NOT NULL,
 source_digest TEXT NOT NULL, task_digest TEXT NOT NULL, review_token TEXT NOT NULL,
 custody_inactive INTEGER NOT NULL DEFAULT 0 CHECK(custody_inactive IN (0,1))
);
CREATE TRIGGER peg_intake_decision_erased_insert BEFORE INSERT ON peg_intake_decisions
WHEN EXISTS(SELECT 1 FROM peg_erased_people WHERE operator_id=NEW.actor_id)
BEGIN SELECT RAISE(ABORT,'erased_object'); END;
CREATE TRIGGER peg_intake_decision_erased_update BEFORE UPDATE ON peg_intake_decisions
WHEN EXISTS(SELECT 1 FROM peg_erased_people WHERE operator_id=NEW.actor_id)
BEGIN SELECT RAISE(ABORT,'erased_object'); END;
CREATE TRIGGER peg_intake_policy_authority_changed AFTER UPDATE OF status,role,version ON oa_operators
BEGIN UPDATE peg_intake_decision_policies SET enabled=0 WHERE approved_by=NEW.id; END;
CREATE TRIGGER peg_decision_revision_peg_intake_decision_policies_insert AFTER INSERT ON peg_intake_decision_policies BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_decision_revision_peg_intake_decision_policies_update AFTER UPDATE ON peg_intake_decision_policies BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_decision_revision_peg_intake_decision_policies_delete AFTER DELETE ON peg_intake_decision_policies BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_decision_revision_peg_intake_decisions_insert AFTER INSERT ON peg_intake_decisions BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_decision_revision_peg_intake_decisions_update AFTER UPDATE ON peg_intake_decisions BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_decision_revision_peg_intake_decisions_delete AFTER DELETE ON peg_intake_decisions BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_decision_revision_peg_intake_submissions_insert AFTER INSERT ON peg_intake_submissions BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_decision_revision_peg_intake_submissions_update AFTER UPDATE ON peg_intake_submissions BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_decision_revision_peg_intake_submissions_delete AFTER DELETE ON peg_intake_submissions BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
