-- Feedback identities remain pinned to retained bytes; annotation never grants approval.
CREATE TABLE peg_proof_feedback (
 id TEXT PRIMARY KEY, proof_id TEXT NOT NULL, version_id TEXT NOT NULL, attachment_id TEXT NOT NULL,
 digest TEXT NOT NULL, page INTEGER NOT NULL CHECK(page>0), x REAL NOT NULL CHECK(x>=0 AND x<=1), y REAL NOT NULL CHECK(y>=0 AND y<=1),
 author_id TEXT NOT NULL, body TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('open','resolved')),
 revision INTEGER NOT NULL, operation_key TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 UNIQUE(author_id,operation_key)
);
CREATE TABLE peg_proof_feedback_history (
 id TEXT PRIMARY KEY, feedback_id TEXT NOT NULL, proof_id TEXT NOT NULL, version_id TEXT NOT NULL,
 actor_id TEXT NOT NULL, body TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN ('open','resolved')),
 revision INTEGER NOT NULL, at INTEGER NOT NULL, UNIQUE(feedback_id,revision)
);
CREATE TABLE peg_data_erasing_feedback (feedback_id TEXT PRIMARY KEY);
CREATE TRIGGER peg_feedback_identity BEFORE UPDATE ON peg_proof_feedback
WHEN NEW.id<>OLD.id OR NEW.proof_id<>OLD.proof_id OR NEW.version_id<>OLD.version_id OR NEW.attachment_id<>OLD.attachment_id OR NEW.digest<>OLD.digest OR NEW.page<>OLD.page OR NEW.x<>OLD.x OR NEW.y<>OLD.y OR NEW.author_id<>OLD.author_id OR NEW.operation_key<>OLD.operation_key OR NEW.created_at<>OLD.created_at OR NEW.revision<>OLD.revision+1
BEGIN SELECT RAISE(ABORT,'immutable_feedback_identity'); END;
CREATE TRIGGER peg_feedback_source BEFORE INSERT ON peg_proof_feedback
WHEN NOT EXISTS(SELECT 1 FROM peg_proof_versions v WHERE v.id=NEW.version_id AND v.proof_id=NEW.proof_id AND v.attachment_id=NEW.attachment_id AND v.digest=NEW.digest)
 OR EXISTS(SELECT 1 FROM peg_erased_people WHERE operator_id=NEW.author_id)
BEGIN SELECT RAISE(ABORT,'erased_object'); END;
CREATE TRIGGER peg_feedback_erased_update BEFORE UPDATE ON peg_proof_feedback
WHEN EXISTS(SELECT 1 FROM peg_erased_people WHERE operator_id=NEW.author_id)
BEGIN SELECT RAISE(ABORT,'erased_object'); END;
CREATE TRIGGER peg_feedback_history_immutable BEFORE UPDATE ON peg_proof_feedback_history BEGIN SELECT RAISE(ABORT,'feedback_history_append_only'); END;
CREATE TRIGGER peg_proof_feedback_reviewed_delete BEFORE DELETE ON peg_proof_feedback WHEN NOT EXISTS(SELECT 1 FROM peg_data_erasing_proofs WHERE proof_id=OLD.proof_id) AND NOT EXISTS(SELECT 1 FROM peg_data_erasing_feedback WHERE feedback_id=OLD.id) BEGIN SELECT RAISE(ABORT,'reviewed_feedback_erasure_required'); END;
CREATE TRIGGER peg_proof_feedback_data_insert AFTER INSERT ON peg_proof_feedback BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_proof_feedback_personal_insert AFTER INSERT ON peg_proof_feedback BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_proof_feedback_data_update AFTER UPDATE ON peg_proof_feedback BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_proof_feedback_personal_update AFTER UPDATE ON peg_proof_feedback BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_proof_feedback_data_delete AFTER DELETE ON peg_proof_feedback BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_proof_feedback_personal_delete AFTER DELETE ON peg_proof_feedback BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_proof_feedback_history_reviewed_delete BEFORE DELETE ON peg_proof_feedback_history WHEN NOT EXISTS(SELECT 1 FROM peg_data_erasing_proofs WHERE proof_id=OLD.proof_id) AND NOT EXISTS(SELECT 1 FROM peg_data_erasing_feedback WHERE feedback_id=OLD.feedback_id) BEGIN SELECT RAISE(ABORT,'reviewed_feedback_erasure_required'); END;
CREATE TRIGGER peg_proof_feedback_history_data_insert AFTER INSERT ON peg_proof_feedback_history BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_proof_feedback_history_personal_insert AFTER INSERT ON peg_proof_feedback_history BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_proof_feedback_history_data_update AFTER UPDATE ON peg_proof_feedback_history BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_proof_feedback_history_personal_update AFTER UPDATE ON peg_proof_feedback_history BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_proof_feedback_history_data_delete AFTER DELETE ON peg_proof_feedback_history BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_proof_feedback_history_personal_delete AFTER DELETE ON peg_proof_feedback_history BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
