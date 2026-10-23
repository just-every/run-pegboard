-- Native account doors and Pegboard's own account doors share the same revocation fence.
CREATE TRIGGER peg_native_authority_epoch AFTER UPDATE OF role,status ON oa_operators WHEN OLD.role<>NEW.role OR OLD.status<>NEW.status BEGIN UPDATE peg_epoch SET value=value+1 WHERE id=1; END;
