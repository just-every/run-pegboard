CREATE TABLE peg_saved_searches (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES peg_workspaces(id) ON DELETE CASCADE,
 owner_id TEXT NOT NULL REFERENCES oa_operators(id) ON DELETE CASCADE,
 name TEXT NOT NULL, filters TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE peg_bulk_selection_receipts (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES peg_workspaces(id) ON DELETE CASCADE,
 actor_id TEXT NOT NULL REFERENCES oa_operators(id) ON DELETE CASCADE,
 operation_id TEXT REFERENCES peg_bulk_operations(id), outcomes TEXT NOT NULL, created_at INTEGER NOT NULL
);
