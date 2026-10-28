-- Workspace eligibility is part of portfolio authority, even when the Admin membership is retained.
-- Advance the same revision as portfolio sharing so restoring a role cannot revive an old preview.
CREATE TRIGGER peg_portfolio_workspace_authority AFTER UPDATE OF role ON peg_workspace_members
WHEN OLD.role<>NEW.role BEGIN
 UPDATE peg_epoch SET value=value+1 WHERE id=1;
 UPDATE peg_portfolios SET access_rev=(SELECT value FROM peg_epoch WHERE id=1)
 WHERE workspace_id=NEW.workspace_id AND (
  owner_id=NEW.operator_id OR id IN (
   SELECT portfolio_id FROM peg_portfolio_members WHERE operator_id=NEW.operator_id AND level='admin'
  )
 );
END;
