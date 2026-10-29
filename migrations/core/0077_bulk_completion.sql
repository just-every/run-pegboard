-- A status undo restores the original completion instant, without inventing a new completion.
ALTER TABLE peg_bulk_status_effects ADD COLUMN before_completion INTEGER;
ALTER TABLE peg_bulk_status_effects ADD COLUMN after_completion INTEGER;
