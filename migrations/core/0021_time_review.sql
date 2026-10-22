ALTER TABLE peg_time_entries ADD COLUMN withdrawn_at INTEGER;
ALTER TABLE peg_time_entries ADD COLUMN withdrawn_by TEXT;
CREATE TABLE peg_time_authority_guards (id TEXT PRIMARY KEY, not_after INTEGER);
CREATE TRIGGER peg_time_authority_expiry BEFORE INSERT ON peg_time_authority_guards
WHEN NEW.not_after IS NOT NULL AND NEW.not_after <= CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)
BEGIN SELECT RAISE(ABORT,'expired_time_authority'); END;
CREATE TRIGGER peg_time_withdrawal_locked BEFORE UPDATE ON peg_time_entries WHEN OLD.withdrawn_at IS NOT NULL
BEGIN SELECT RAISE(ABORT,'timesheet_locked'); END;
