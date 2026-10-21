// The effective capability of a person on a team, a project or a task: the union of every current grant path,
// each path capped by what that kind of person may hold. Every read and write door asks here, never the UI.
import { all, first, now, placeholders, type Param } from '../db'
import type { GrantRow, ProjectRow, TaskRow, TeamRow } from '../model'
import { administers, workspaceRole, type Actor } from '../workspace/people'
import { capabilitiesOf, capabilityNames, isAdministrator, label, maxLevel, rank, roleCeiling, sharesWithWorkspace, type Capability, type Level, type WorkspaceRole } from './levels'

export interface Path { via: string; level: Level; capabilities: Capability[]; source: 'role' | 'owner' | 'direct' | 'team' | 'default' | 'task'; grantId?: string; scope?: GrantRow['scope'] }
export interface Effective { role: WorkspaceRole | null; level: Level | null; capabilities: Set<Capability>; paths: Path[] }
const none = (role: WorkspaceRole | null): Effective => ({ role, level: null, capabilities: new Set(), paths: [] })

const cap = (level: Level, ceiling: Level): Level => rank(level) > rank(ceiling) ? ceiling : level
function pathCapabilities(level: Level, grant?: GrantRow): Capability[] {
  let caps = capabilitiesOf(level)
  if (grant?.scope === 'approve') caps = [...new Set<Capability>(['read', 'approve'])]
  if (grant?.scopes) { const only = new Set(grant.scopes.split(',').filter(name => capabilityNames.includes(name))); caps = caps.filter(name => only.has(name)) }
  return caps
}
function finish(role: WorkspaceRole | null, paths: Path[]): Effective {
  const ceiling = role ? roleCeiling[role] : 'viewer'
  const capped = paths.map(path => rank(path.level) > rank(ceiling) ? { ...path, level: ceiling, capabilities: path.capabilities.filter(name => capabilitiesOf(ceiling).includes(name) || name === 'approve') } : path)
  const live = capped.filter(path => path.scope !== 'assignee')
  const capabilitiesSet = new Set<Capability>(live.flatMap(path => path.capabilities))
  return { role, level: live.reduce<Level | null>((best, path) => maxLevel(best, path.level), null), capabilities: capabilitiesSet, paths: capped }
}

export async function rootOf(db: D1Database, task: TaskRow): Promise<TaskRow> {
  let current = task
  for (let depth = 0; current.parent_id && depth < 50; depth++) {
    const parent = await first<TaskRow>(db, 'SELECT * FROM peg_tasks WHERE id=?', current.parent_id)
    if (!parent) break
    current = parent
  }
  return current
}

export const activeGrants = (db: D1Database, objectType: GrantRow['object_type'], objectId: string, granteeType?: GrantRow['grantee_type'], granteeIds?: string[]) =>
  all<GrantRow>(db, `SELECT * FROM peg_grants WHERE object_type=? AND object_id=? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>?)${granteeType ? ` AND grantee_type=? AND grantee_id IN (${placeholders(granteeIds ?? [])})` : ''}`,
    objectType, objectId, now(), ...(granteeType ? [granteeType, ...(granteeIds ?? [])] as Param[] : []))

/** The teams a person belongs to: their current person grants on teams. */
export async function teamsOf(db: D1Database, operatorId: string): Promise<GrantRow[]> {
  return all<GrantRow>(db, "SELECT * FROM peg_grants WHERE object_type='team' AND grantee_type='person' AND grantee_id=? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>?)", operatorId, now())
}

export async function teamEffective(db: D1Database, actor: Actor, team: TeamRow): Promise<Effective> {
  const role = await workspaceRole(db, actor.id, team.workspace_id)
  if (!role) return none(null)
  const paths: Path[] = []
  if (isAdministrator(role)) paths.push({ via: 'Workspace administrator', level: 'admin', capabilities: capabilitiesOf('admin'), source: 'role' })
  for (const grant of await activeGrants(db, 'team', team.id, 'person', [actor.id]))
    paths.push({ via: grant.source === 'join' ? 'Joined the team' : grant.source === 'request' ? 'Approved access request' : 'Team membership', level: grant.level, capabilities: pathCapabilities(grant.level, grant), source: 'direct', grantId: grant.id, scope: grant.scope })
  return finish(role, paths)
}

export async function projectEffective(db: D1Database, actor: Actor, project: ProjectRow): Promise<Effective> {
  const role = await workspaceRole(db, actor.id, project.workspace_id)
  if (!role) return none(null)
  const paths: Path[] = []
  if (isAdministrator(role)) paths.push({ via: 'Workspace administrator', level: 'admin', capabilities: capabilitiesOf('admin'), source: 'role' })
  if (project.owner_id === actor.id) paths.push({ via: 'Project owner', level: 'admin', capabilities: capabilitiesOf('admin'), source: 'owner' })
  for (const grant of await activeGrants(db, 'project', project.id, 'person', [actor.id]))
    paths.push({ via: grant.source === 'request' ? 'Approved access request' : 'Direct grant', level: grant.level, capabilities: pathCapabilities(grant.level, grant), source: 'direct', grantId: grant.id, scope: grant.scope })
  const teams = new Map((await teamsOf(db, actor.id)).map(grant => [grant.object_id, grant]))
  if (teams.size) for (const grant of await activeGrants(db, 'project', project.id, 'team', [...teams.keys()])) {
    const team = await first<{ name: string }>(db, 'SELECT name FROM peg_teams WHERE id=?', grant.grantee_id)
    paths.push({ via: `Team grant (${team?.name ?? 'team'})`, level: grant.level, capabilities: pathCapabilities(grant.level, grant), source: 'team', grantId: grant.id, scope: grant.scope })
  }
  if (project.visibility === 'team' && project.team_id && teams.has(project.team_id) && role !== 'agent')
    paths.push({ via: 'Team default', level: project.team_level, capabilities: capabilitiesOf(project.team_level), source: 'default' })
  if (project.visibility === 'workspace' && sharesWithWorkspace(role))
    paths.push({ via: 'Shared with workspace', level: project.workspace_level, capabilities: capabilitiesOf(project.workspace_level), source: 'default' })
  return finish(role, paths)
}

export interface TaskAccess {
  /** What the person may do to the task itself. */
  capabilities: Set<Capability>
  level: Level | null
  /** Each project the task hangs in that the person may read, with their standing there. */
  contexts: Map<string, Effective>
  personal: boolean
  role: WorkspaceRole | null
}
const noTask = (role: WorkspaceRole | null): TaskAccess => ({ capabilities: new Set(), level: null, contexts: new Map(), personal: false, role })

export async function taskAccess(db: D1Database, actor: Actor, task: TaskRow): Promise<TaskAccess> {
  const role = await workspaceRole(db, actor.id, task.workspace_id)
  if (!role) return noTask(null)
  // A subtask hangs wherever its root task hangs.
  const homes = await all<{ project_id: string }>(db, 'SELECT project_id FROM peg_task_projects WHERE task_id=?', (await rootOf(db, task)).id)
  // A task in no project is its owner's alone: no grant, role or administrative custody makes it browsable.
  if (!homes.length) {
    if (task.owner_id !== actor.id) return noTask(role)
    return { capabilities: new Set(capabilitiesOf('editor')), level: 'editor', contexts: new Map(), personal: true, role }
  }
  if (role === 'guest' && task.internal_only) return noTask(role)
  const assigned = task.owner_id === actor.id || !!(await first(db, 'SELECT 1 FROM peg_task_collaborators WHERE task_id=? AND operator_id=?', task.id, actor.id))
  const contexts = new Map<string, Effective>(), caps = new Set<Capability>()
  let level: Level | null = null
  for (const home of homes) {
    const project = await first<ProjectRow>(db, 'SELECT * FROM peg_projects WHERE id=?', home.project_id)
    if (!project) continue
    const effective = await projectEffective(db, actor, project)
    // An assignee-scoped grant reaches only the tasks its holder is assigned.
    const reach = assigned ? effective.paths.filter(path => path.scope === 'assignee') : []
    for (const path of reach) { for (const name of path.capabilities) effective.capabilities.add(name); effective.level = maxLevel(effective.level, path.level) }
    if (!effective.capabilities.has('read')) continue
    contexts.set(project.id, effective)
    for (const name of effective.capabilities) caps.add(name)
    level = maxLevel(level, effective.level)
  }
  for (const grant of await activeGrants(db, 'task', task.id, 'person', [actor.id])) {
    for (const name of pathCapabilities(cap(grant.level, roleCeiling[role]), grant)) caps.add(name)
    level = maxLevel(level, cap(grant.level, roleCeiling[role]))
  }
  if (!caps.has('read')) return noTask(role)
  return { capabilities: caps, level, contexts, personal: false, role }
}

/** Who may delegate a level on this object: Admin needs the Admin capability itself (or a workspace administrator). */
export const canDelegate = (effective: Effective, level: Level) => level === 'admin' ? effective.capabilities.has('delegate_admin') : effective.capabilities.has('manage_shares') || effective.capabilities.has('delegate_admin')
export { administers, label }
