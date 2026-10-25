-- PEG-013 portfolios and the PEG-004 dependency graph they read slack from.
-- A dependency joins two tasks of one workspace (cross-project links included); lag is in working days and a negative lag is a lead.
CREATE TABLE peg_dependencies (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, predecessor_id TEXT NOT NULL, successor_id TEXT NOT NULL,
 type TEXT NOT NULL CHECK(type IN ('fs','ss','ff','sf')), lag_days INTEGER NOT NULL DEFAULT 0 CHECK(lag_days BETWEEN -365 AND 365),
 created_by TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE(predecessor_id,successor_id), CHECK(predecessor_id<>successor_id)
);
CREATE INDEX peg_dependencies_successor ON peg_dependencies(successor_id);
-- A portfolio nests under one parent; its projects hang in it without gaining any reader. Members read what they may already read.
CREATE TABLE peg_portfolios (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, parent_id TEXT REFERENCES peg_portfolios(id), name TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '', owner_id TEXT NOT NULL, created_by TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX peg_portfolios_parent ON peg_portfolios(parent_id);
CREATE TABLE peg_portfolio_members (
 portfolio_id TEXT NOT NULL, operator_id TEXT NOT NULL, level TEXT NOT NULL CHECK(level IN ('viewer','admin')),
 added_by TEXT NOT NULL, added_at INTEGER NOT NULL, PRIMARY KEY(portfolio_id,operator_id)
);
CREATE TABLE peg_portfolio_projects (
 portfolio_id TEXT NOT NULL, project_id TEXT NOT NULL, added_by TEXT NOT NULL, added_at INTEGER NOT NULL, PRIMARY KEY(portfolio_id,project_id)
);
-- The risk policy is versioned: every change is a new row and the rollup names the version it used.
CREATE TABLE peg_portfolio_policies (
 portfolio_id TEXT NOT NULL, version INTEGER NOT NULL, policy TEXT NOT NULL, changed_by TEXT NOT NULL, changed_at INTEGER NOT NULL, PRIMARY KEY(portfolio_id,version)
);
CREATE TABLE peg_portfolio_filters (
 id TEXT PRIMARY KEY, portfolio_id TEXT NOT NULL, name TEXT NOT NULL, filter TEXT NOT NULL, created_by TEXT NOT NULL, created_at INTEGER NOT NULL
);
-- A published status is a person's statement of health at a time; it is never edited and never inferred.
CREATE TABLE peg_status_updates (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, subject_type TEXT NOT NULL CHECK(subject_type IN ('project','portfolio')), subject_id TEXT NOT NULL,
 health TEXT NOT NULL CHECK(health IN ('on_track','at_risk','off_track')), summary TEXT NOT NULL, author_id TEXT NOT NULL, published_at INTEGER NOT NULL
);
CREATE INDEX peg_status_updates_subject ON peg_status_updates(subject_type,subject_id,published_at);
CREATE TRIGGER peg_status_update_immutable BEFORE UPDATE ON peg_status_updates BEGIN SELECT RAISE(ABORT,'immutable_status_update'); END;
