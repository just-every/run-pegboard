-- PEG-001: the persistent work graph. Workspaces, teams, projects, sections, tasks and the one history each task keeps.
-- A task is one row; peg_task_projects is its multi-homing. Operators are Base's people (oa_operators).
CREATE TABLE peg_workspaces (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, settings TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL
);
-- Who belongs to a workspace and as what. Base owners and admins are implicit administrators of every workspace;
-- everyone else needs a row (member, manager, analyst, guest or agent).
CREATE TABLE peg_workspace_members (
  workspace_id TEXT NOT NULL, operator_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('manager','member','analyst','guest','agent')),
  created_by TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(workspace_id, operator_id)
);
CREATE TABLE peg_teams (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
  privacy TEXT NOT NULL CHECK(privacy IN ('public','request','private')),
  default_level TEXT NOT NULL DEFAULT 'viewer' CHECK(default_level IN ('viewer','commenter','editor')),
  fallback_id TEXT, policy_rev INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX peg_teams_workspace ON peg_teams(workspace_id);
CREATE TABLE peg_projects (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
  owner_id TEXT NOT NULL, team_id TEXT,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','team','workspace')),
  team_level TEXT NOT NULL DEFAULT 'viewer' CHECK(team_level IN ('viewer','commenter','editor')),
  workspace_level TEXT NOT NULL DEFAULT 'viewer' CHECK(workspace_level IN ('viewer','commenter','editor')),
  status TEXT NOT NULL DEFAULT 'active', start_date TEXT, due_date TEXT, prefix TEXT,
  policy_rev INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX peg_projects_workspace ON peg_projects(workspace_id);
-- A section is a project's own column; maps_to ties it to the task's one status (the workflow mapping).
CREATE TABLE peg_sections (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL, position INTEGER NOT NULL,
  maps_to TEXT CHECK(maps_to IN ('todo','doing','done'))
);
CREATE INDEX peg_sections_project ON peg_sections(project_id, position);
-- A project's field library: values live per task and project, readable by the audience the field names.
CREATE TABLE peg_project_fields (
  project_id TEXT NOT NULL, key TEXT NOT NULL, label TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('text','number')),
  visibility TEXT NOT NULL DEFAULT 'everyone' CHECK(visibility IN ('everyone','internal','editors','admins')),
  PRIMARY KEY(project_id, key)
);
CREATE TABLE peg_tasks (
  id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'task' CHECK(kind IN ('task','subtask','milestone')), parent_id TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo','doing','done')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high','urgent')),
  start_date TEXT, due_date TEXT, owner_id TEXT NOT NULL, creator_id TEXT NOT NULL,
  estimate_hours REAL NOT NULL DEFAULT 0, internal_only INTEGER NOT NULL DEFAULT 0, internal_notes TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, completed_at INTEGER
);
CREATE INDEX peg_tasks_parent ON peg_tasks(parent_id);
CREATE INDEX peg_tasks_owner ON peg_tasks(owner_id);
CREATE TABLE peg_task_collaborators (task_id TEXT NOT NULL, operator_id TEXT NOT NULL, PRIMARY KEY(task_id, operator_id));
CREATE TABLE peg_task_projects (
  task_id TEXT NOT NULL, project_id TEXT NOT NULL, section_id TEXT, fields TEXT NOT NULL DEFAULT '{}',
  position INTEGER NOT NULL DEFAULT 0, added_by TEXT NOT NULL, added_at INTEGER NOT NULL, PRIMARY KEY(task_id, project_id)
);
CREATE INDEX peg_task_projects_project ON peg_task_projects(project_id, section_id, position);
-- References: every prefix and every reference ever issued stays reserved, so an old one keeps resolving to its task.
CREATE TABLE peg_ref_prefixes (
  prefix TEXT PRIMARY KEY, project_id TEXT NOT NULL, next_number INTEGER NOT NULL DEFAULT 1, retired_to TEXT
);
CREATE TABLE peg_task_refs (
  ref TEXT PRIMARY KEY, task_id TEXT NOT NULL, current INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL
);
CREATE INDEX peg_task_refs_task ON peg_task_refs(task_id);
-- One history per task. project_id names the project an entry belongs to, or null for the task's own shared record.
CREATE TABLE peg_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL, project_id TEXT, at INTEGER NOT NULL,
  actor_id TEXT NOT NULL, kind TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX peg_history_task ON peg_history(task_id, id);
CREATE TABLE peg_comments (
  id TEXT PRIMARY KEY, task_id TEXT NOT NULL, project_id TEXT, author_id TEXT NOT NULL, body TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX peg_comments_task ON peg_comments(task_id, created_at);
-- Files attach through a project (readable by that project's audience) or, for a personal task, to its owner alone.
CREATE TABLE peg_attachments (
  id TEXT PRIMARY KEY, task_id TEXT NOT NULL, project_id TEXT, name TEXT NOT NULL, content_type TEXT NOT NULL,
  size INTEGER NOT NULL, data BLOB NOT NULL, created_by TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX peg_attachments_task ON peg_attachments(task_id);
