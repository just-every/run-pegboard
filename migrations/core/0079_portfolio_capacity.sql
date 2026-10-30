-- Human review only: no standing model, provider or scheduling authority.
CREATE TABLE peg_capacity_commitments (
 task_id TEXT PRIMARY KEY REFERENCES peg_tasks(id) ON DELETE CASCADE,
 skills TEXT NOT NULL DEFAULT '', locked INTEGER NOT NULL DEFAULT 0 CHECK(locked IN (0,1))
);
CREATE TABLE peg_capacity_applications (
 id TEXT PRIMARY KEY, portfolio_id TEXT NOT NULL REFERENCES peg_portfolios(id) ON DELETE CASCADE,
 task_id TEXT NOT NULL REFERENCES peg_tasks(id) ON DELETE CASCADE, actor_id TEXT NOT NULL,
 review_key TEXT NOT NULL UNIQUE, from_id TEXT NOT NULL, to_id TEXT NOT NULL,
 before_allocations TEXT NOT NULL, after_allocations TEXT NOT NULL,
 owner_epoch INTEGER NOT NULL, allocation_epoch INTEGER NOT NULL,
 applied_at INTEGER NOT NULL, undone_at INTEGER
);
CREATE TRIGGER peg_capacity_review_peg_capacity_commitments_insert AFTER INSERT ON peg_capacity_commitments BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_capacity_review_peg_capacity_commitments_update AFTER UPDATE ON peg_capacity_commitments BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_capacity_review_peg_capacity_commitments_delete AFTER DELETE ON peg_capacity_commitments BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_capacity_review_peg_portfolios_insert AFTER INSERT ON peg_portfolios BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_capacity_review_peg_portfolios_update AFTER UPDATE ON peg_portfolios BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_capacity_review_peg_portfolios_delete AFTER DELETE ON peg_portfolios BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_capacity_review_peg_portfolio_projects_insert AFTER INSERT ON peg_portfolio_projects BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_capacity_review_peg_portfolio_projects_update AFTER UPDATE ON peg_portfolio_projects BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_capacity_review_peg_portfolio_projects_delete AFTER DELETE ON peg_portfolio_projects BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_capacity_review_peg_portfolio_members_insert AFTER INSERT ON peg_portfolio_members BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_capacity_review_peg_portfolio_members_update AFTER UPDATE ON peg_portfolio_members BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_capacity_review_peg_portfolio_members_delete AFTER DELETE ON peg_portfolio_members BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_capacity_allocation_epoch_insert AFTER INSERT ON peg_effort_allocations BEGIN
 INSERT INTO peg_rule_mutation_generations VALUES(NEW.task_id,'capacity_allocations',1) ON CONFLICT(task_id,kind) DO UPDATE SET generation=generation+1;
END;
CREATE TRIGGER peg_capacity_allocation_epoch_update AFTER UPDATE ON peg_effort_allocations BEGIN
 INSERT INTO peg_rule_mutation_generations VALUES(NEW.task_id,'capacity_allocations',1) ON CONFLICT(task_id,kind) DO UPDATE SET generation=generation+1;
END;
CREATE TRIGGER peg_capacity_allocation_epoch_delete AFTER DELETE ON peg_effort_allocations BEGIN
 INSERT INTO peg_rule_mutation_generations VALUES(OLD.task_id,'capacity_allocations',1) ON CONFLICT(task_id,kind) DO UPDATE SET generation=generation+1;
END;
CREATE TRIGGER peg_capacity_store_peg_capacity_commitments_insert AFTER INSERT ON peg_capacity_commitments BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_capacity_store_peg_capacity_commitments_update AFTER UPDATE ON peg_capacity_commitments BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_capacity_store_peg_capacity_commitments_delete AFTER DELETE ON peg_capacity_commitments BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_capacity_store_peg_capacity_applications_insert AFTER INSERT ON peg_capacity_applications BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_capacity_store_peg_capacity_applications_update AFTER UPDATE ON peg_capacity_applications BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_capacity_store_peg_capacity_applications_delete AFTER DELETE ON peg_capacity_applications BEGIN UPDATE peg_data_revision SET value=value+1 WHERE id=1; END;
