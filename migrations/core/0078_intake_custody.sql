-- Intake changes invalidate reviewed custody decisions just like other product stores.
CREATE TRIGGER peg_intake_data_form_insert AFTER INSERT ON peg_intake_forms BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_intake_data_form_update AFTER UPDATE ON peg_intake_forms BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_intake_data_form_delete AFTER DELETE ON peg_intake_forms BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_intake_data_submission_insert AFTER INSERT ON peg_intake_submissions BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_intake_data_submission_update AFTER UPDATE ON peg_intake_submissions BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_intake_data_submission_delete AFTER DELETE ON peg_intake_submissions BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
