-- Installation-bound credentials never travel in an archive.
CREATE TABLE peg_status_model_connections (
 workspace_id TEXT PRIMARY KEY, model TEXT NOT NULL, sealed_key TEXT NOT NULL,
 configured_by TEXT NOT NULL, enabled INTEGER NOT NULL CHECK(enabled IN (0,1)), version INTEGER NOT NULL
);
