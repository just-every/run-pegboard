-- Capacity records contain working availability and effort, never HR reasons or provider credentials.
CREATE TABLE peg_capacity_profiles (
 workspace_id TEXT NOT NULL REFERENCES peg_workspaces(id) ON DELETE CASCADE,
 person_id TEXT NOT NULL REFERENCES oa_operators(id) ON DELETE CASCADE,
 zone TEXT NOT NULL, week TEXT NOT NULL, skills TEXT NOT NULL DEFAULT '',
 PRIMARY KEY(workspace_id,person_id)
);
ALTER TABLE peg_time_off ADD COLUMN source TEXT NOT NULL DEFAULT 'self';
ALTER TABLE peg_time_off ADD COLUMN source_id TEXT;
ALTER TABLE peg_time_off ADD COLUMN delegate_id TEXT;
CREATE TABLE peg_availability_history (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES peg_workspaces(id) ON DELETE CASCADE,
 person_id TEXT NOT NULL REFERENCES oa_operators(id) ON DELETE CASCADE,
 leave_id TEXT NOT NULL, actor_id TEXT NOT NULL, action TEXT NOT NULL,
 start_date TEXT NOT NULL, end_date TEXT NOT NULL, at INTEGER NOT NULL
);
CREATE TABLE peg_capacity_feeds (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES peg_workspaces(id) ON DELETE CASCADE,
 service TEXT NOT NULL, origin TEXT NOT NULL, account TEXT NOT NULL,
 mapping TEXT NOT NULL, fetched_at INTEGER, active INTEGER NOT NULL DEFAULT 1,
 issuer_id TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE peg_effort_mappings (
 task_id TEXT PRIMARY KEY REFERENCES peg_tasks(id) ON DELETE CASCADE,
 source TEXT NOT NULL, source_item TEXT NOT NULL, source_mode TEXT NOT NULL,
 mode TEXT NOT NULL, changed_semantics INTEGER NOT NULL, reviewed_by TEXT NOT NULL,
 reviewed_at INTEGER NOT NULL
);
CREATE TABLE peg_effort_allocations (
 task_id TEXT NOT NULL REFERENCES peg_tasks(id) ON DELETE CASCADE,
 person_id TEXT NOT NULL REFERENCES oa_operators(id) ON DELETE CASCADE,
 source_person TEXT NOT NULL, hours REAL NOT NULL CHECK(hours>=0),
 PRIMARY KEY(task_id,person_id)
);
CREATE TABLE peg_resource_plans (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES peg_workspaces(id) ON DELETE CASCADE,
 role TEXT NOT NULL, person_id TEXT REFERENCES oa_operators(id) ON DELETE CASCADE,
 hours REAL NOT NULL CHECK(hours>=0), start_date TEXT NOT NULL, end_date TEXT NOT NULL,
 created_by TEXT NOT NULL
);
CREATE TRIGGER peg_capacity_profile_insert AFTER INSERT ON peg_capacity_profiles BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_capacity_profile_update AFTER UPDATE ON peg_capacity_profiles BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_capacity_profile_delete AFTER DELETE ON peg_capacity_profiles BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_capacity_feed_insert AFTER INSERT ON peg_capacity_feeds BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_capacity_feed_update AFTER UPDATE ON peg_capacity_feeds BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_effort_insert AFTER INSERT ON peg_effort_allocations BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_effort_update AFTER UPDATE ON peg_effort_allocations BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
CREATE TRIGGER peg_effort_delete AFTER DELETE ON peg_effort_allocations BEGIN UPDATE peg_personal_revision SET value=value+1 WHERE id=1; END;
