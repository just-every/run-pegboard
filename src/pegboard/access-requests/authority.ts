// Who may decide an access request and up to which level, and who is told. Always computed from current grants:
// a revoked approver or an inactive person has no authority, whatever once was delivered to them.
import { all, first } from '../db'
import type { GrantRow, ProjectRow, RequestRow, TaskRow, TeamRow } from '../model'
import { activeGrants, projectEffective, teamEffective } from '../authorization/effective'
import { loadProject, loadTask, loadTeam } from '../authorization/grants'
import { maxLevel, type Level } from '../authorization/levels'
import { workspaceRole, type Actor } from '../workspace/people'

export type Target = { type: 'team'; row: TeamRow } | { type: 'project'; row: ProjectRow } | { type: 'task'; row: TaskRow }
export async function loadTarget(db: D1Database, type: RequestRow['target_type'], id: string): Promise<Target | null> {
  if (type === 'team') { const row = await loadTeam(db, id); return row ? { type, row } : null }
  if (type === 'project') { const row = await loadProject(db, id); return row ? { type, row } : null }
  const row = await loadTask(db, id)
  return row ? { type, row } : null
}
export const targetTypeOf = (id: string): RequestRow['target_type'] | null => id.startsWith('team_') ? 'team' : id.startsWith('prj_') ? 'project' : id.startsWith('tsk_') ? 'task' : null
export const policyRevOf = async (db: D1Database, target: Target): Promise<number> => {
  if (target.type === 'team' || target.type === 'project') return target.row.policy_rev
  // A task's policy is its projects': any sharing change in one of them moves it.
  return (await first<{ n: number }>(db, 'SELECT COALESCE(SUM(p.policy_rev),0) n FROM peg_task_projects tp JOIN peg_projects p ON p.id=tp.project_id WHERE tp.task_id=?', target.row.id))!.n
}
export const workspaceOf = (target: Target) => target.row.workspace_id

const activeIn = async (db: D1Database, id: string, workspaceId: string) => (await workspaceRole(db, id, workspaceId)) !== null
const actorOf = (id: string) => ({ id, email: '', displayName: '', baseRole: 'member' }) as Actor

async function administrators(db: D1Database, workspaceId: string): Promise<string[]> {
  const rows = await all<{ id: string }>(db, "SELECT id FROM oa_operators WHERE role IN ('owner','admin') AND status='active' ORDER BY created_at")
  const out: string[] = []
  for (const row of rows) if (await activeIn(db, row.id, workspaceId)) out.push(row.id)
  return out
}
const teamAdmins = async (db: D1Database, team: TeamRow) => {
  const out = new Set<string>()
  for (const grant of await activeGrants(db, 'team', team.id)) if (grant.level === 'admin' && grant.grantee_type === 'person' && await activeIn(db, grant.grantee_id, team.workspace_id)) out.add(grant.grantee_id)
  return out
}
const approvers = async (db: D1Database, type: 'team' | 'project', id: string, workspaceId: string) => {
  const out = new Set<string>()
  for (const row of await all<{ operator_id: string }>(db, 'SELECT operator_id FROM peg_approvers WHERE object_type=? AND object_id=?', type, id)) if (await activeIn(db, row.operator_id, workspaceId)) out.add(row.operator_id)
  return out
}

async function projectPrimary(db: D1Database, project: ProjectRow): Promise<Set<string>> {
  const out = new Set<string>()
  if (await activeIn(db, project.owner_id, project.workspace_id)) out.add(project.owner_id)
  const grants: GrantRow[] = await activeGrants(db, 'project', project.id)
  for (const grant of grants) {
    if (grant.level !== 'admin' || grant.scope !== 'full') continue
    if (grant.grantee_type === 'person') { if (await activeIn(db, grant.grantee_id, project.workspace_id)) out.add(grant.grantee_id) }
    else { const team = await loadTeam(db, grant.grantee_id); if (team) for (const id of await teamAdmins(db, team)) out.add(id) }
  }
  return out
}
async function projectFallback(db: D1Database, project: ProjectRow): Promise<Set<string>> {
  const out = new Set<string>(), team = project.team_id ? await loadTeam(db, project.team_id) : null
  if (team) { for (const id of await teamAdmins(db, team)) out.add(id); if (team.fallback_id && await activeIn(db, team.fallback_id, team.workspace_id)) out.add(team.fallback_id) }
  for (const id of await administrators(db, project.workspace_id)) out.add(id)
  return out
}

/** The people a request is delivered to: the object's own approvers, or only when none remain, its configured fallback. */
export async function recipients(db: D1Database, target: Target, requesterId: string): Promise<{ kind: 'request' | 'fallback'; ids: string[] }> {
  let primary = new Set<string>(), fallback = new Set<string>()
  if (target.type === 'team') {
    primary = await approvers(db, 'team', target.row.id, target.row.workspace_id)
    if (!primary.size) primary = await teamAdmins(db, target.row)
    if (target.row.fallback_id && await activeIn(db, target.row.fallback_id, target.row.workspace_id)) fallback.add(target.row.fallback_id)
    for (const id of await administrators(db, target.row.workspace_id)) fallback.add(id)
  } else {
    const projects = target.type === 'project' ? [target.row] : (await all<{ project_id: string }>(db, 'SELECT project_id FROM peg_task_projects WHERE task_id=?', target.row.id)).map(row => row.project_id)
    for (const entry of projects) {
      const project = typeof entry === 'string' ? await loadProject(db, entry) : entry
      if (!project) continue
      for (const id of await projectPrimary(db, project)) primary.add(id)
      for (const id of await projectFallback(db, project)) fallback.add(id)
    }
  }
  primary.delete(requesterId); fallback.delete(requesterId)
  return primary.size ? { kind: 'request', ids: [...primary] } : { kind: 'fallback', ids: [...fallback] }
}

export interface Authority { ceiling: Level; via: 'administrator' | 'admin' | 'approver' | 'fallback' }
/** What this person may delegate on the target now, or null. Admin needs real Admin authority; approvers and fallbacks stop at Editor. */
export async function authorityOver(db: D1Database, actorId: string, target: Target, requesterId: string): Promise<Authority | null> {
  const workspaceId = workspaceOf(target)
  const role = await workspaceRole(db, actorId, workspaceId)
  if (!role || actorId === requesterId) return null
  const stub = actorOf(actorId)
  let best: Level | null = null
  const consider = (level: Level | null) => { best = maxLevel(best, level) }
  if (target.type === 'team') {
    if ((await teamEffective(db, stub, target.row)).capabilities.has('delegate_admin')) consider('admin')
    else if ((await approvers(db, 'team', target.row.id, workspaceId)).has(actorId)) consider('editor')
  } else {
    const projects = target.type === 'project' ? [target.row] : (await all<{ project_id: string }>(db, 'SELECT project_id FROM peg_task_projects WHERE task_id=?', target.row.id)).map(row => row.project_id)
    for (const entry of projects) {
      const project = typeof entry === 'string' ? await loadProject(db, entry) : entry
      if (project && (await projectEffective(db, stub, project)).capabilities.has('delegate_admin')) consider('admin')
    }
  }
  if (best) return { ceiling: best, via: role === 'owner' || role === 'admin' ? 'administrator' : (best === 'admin' ? 'admin' : 'approver') }
  const delivered = await recipients(db, target, requesterId)
  return delivered.kind === 'fallback' && delivered.ids.includes(actorId) ? { ceiling: 'editor', via: 'fallback' } : null
}
