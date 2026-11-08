-- Reviewed redaction retains opaque replay witnesses and permanently fences old attribution.
ALTER TABLE peg_intake_forms ADD COLUMN erased_custody INTEGER NOT NULL DEFAULT 0 CHECK(erased_custody IN (0,1));
CREATE TABLE peg_intake_erasure_receipts (
 receipt_id TEXT PRIMARY KEY, revision INTEGER NOT NULL, scope_digest TEXT NOT NULL,
 scope TEXT NOT NULL, applied INTEGER NOT NULL CHECK(applied IN (0,1))
);
CREATE TRIGGER peg_intake_erasure_receipts_no_update BEFORE UPDATE ON peg_intake_erasure_receipts BEGIN SELECT RAISE(ABORT,'receipt_append_only'); END;
CREATE TRIGGER peg_intake_erasure_receipts_no_delete BEFORE DELETE ON peg_intake_erasure_receipts BEGIN SELECT RAISE(ABORT,'receipt_append_only'); END;
CREATE TRIGGER peg_intake_custody_publication BEFORE UPDATE ON peg_intake_forms
WHEN NEW.erased_custody=1 AND (NEW.published_version IS NOT NULL OR NEW.public_hash IS NOT NULL OR NEW.revoked_at IS NULL)
BEGIN SELECT RAISE(ABORT,'intake_custody_review_required'); END;
CREATE TRIGGER peg_intake_erased_form_insert BEFORE INSERT ON peg_intake_forms
WHEN EXISTS(SELECT 1 FROM peg_erased_people WHERE operator_id=NEW.created_by OR operator_id=NEW.publisher_id OR operator_id=json_extract(NEW.definition,'$.mapping.ownerId'))
BEGIN SELECT RAISE(ABORT,'erased_object'); END;
CREATE TRIGGER peg_intake_erased_form_update BEFORE UPDATE ON peg_intake_forms
WHEN EXISTS(SELECT 1 FROM peg_erased_people WHERE operator_id=NEW.created_by OR operator_id=NEW.publisher_id OR operator_id=json_extract(NEW.definition,'$.mapping.ownerId'))
BEGIN SELECT RAISE(ABORT,'erased_object'); END;
CREATE TRIGGER peg_intake_erased_submission_insert BEFORE INSERT ON peg_intake_submissions
WHEN EXISTS(SELECT 1 FROM peg_erased_people WHERE operator_id=NEW.source_actor OR operator_id=NEW.triaged_by)
BEGIN SELECT RAISE(ABORT,'erased_object'); END;
CREATE TRIGGER peg_intake_erased_submission_update BEFORE UPDATE ON peg_intake_submissions
WHEN EXISTS(SELECT 1 FROM peg_erased_people WHERE operator_id=NEW.source_actor OR operator_id=NEW.triaged_by)
BEGIN SELECT RAISE(ABORT,'erased_object'); END;
