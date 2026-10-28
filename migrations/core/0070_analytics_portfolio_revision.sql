-- Portfolio membership and names participate in the same snapshot watermark as work.
CREATE TRIGGER peg_analytics_portfolio_insert AFTER INSERT ON peg_portfolios BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_analytics_portfolio_update AFTER UPDATE ON peg_portfolios BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_analytics_portfolio_delete AFTER DELETE ON peg_portfolios BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_analytics_portfolio_project_insert AFTER INSERT ON peg_portfolio_projects BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_analytics_portfolio_project_update AFTER UPDATE ON peg_portfolio_projects BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_analytics_portfolio_project_delete AFTER DELETE ON peg_portfolio_projects BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
