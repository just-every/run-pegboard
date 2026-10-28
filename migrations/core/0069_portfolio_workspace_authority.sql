-- Workspace eligibility is part of portfolio authority, even when the role is later restored.
-- Use the shared monotonic epoch so ancestor revisions cannot be hidden by a descendant.
CREATE TRIGGER peg_portfolio_workspace_authority_update AFTER UPDATE OF role ON peg_workspace_members
WHEN OLD.role<>NEW.role BEGIN
 UPDATE peg_epoch SET value=value+1 WHERE id=1;
 UPDATE peg_portfolios SET access_rev=(SELECT value FROM peg_epoch WHERE id=1)
 WHERE workspace_id=NEW.workspace_id AND (owner_id=NEW.operator_id OR id IN (
  SELECT portfolio_id FROM peg_portfolio_members WHERE operator_id=NEW.operator_id AND level='admin'
 ));
END;
