import { activeGrants, projectEffective, taskAccess, teamsOf } from '../authorization/effective'
import { capabilitiesOf, type Capability } from '../authorization/levels'
import { all, conflict, first, placeholders } from '../db'
import type { GrantRow, ProjectRow, TaskRow } from '../model'
import type { Actor } from '../workspace/people'
import { workspaceRole } from '../workspace/people'
import type { HierarchyGraph } from './hierarchy-graph'
import { projectScope } from './context'

type Scope = Map<Capability, number>
const forever = Number.MAX_SAFE_INTEGER
const until = (grant?: GrantRow | null) => grant?.expires_at ?? forever
const merge = (scope: Scope, capabilities: Capability[], expires: number) => {
  for (const capability of capabilities) scope.set(capability, Math.max(scope.get(capability) ?? 0, expires))
}

/** Include capped, assignee-only, team and expiring paths. Equal head counts are not equal scope. */
async function scopeFor(db: D1Database, actor: Actor, task: TaskRow, projectIds: string[]): Promise<Scope> {
  const scope: Scope = new Map()
  const role = await workspaceRole(db, actor.id, task.workspace_id)
  if (!role || role === 'guest' && task.internal_only) return scope
  if (!projectIds.length) {
    if (task.owner_id === actor.id) merge(scope, capabilitiesOf('editor'), forever)
    return scope
  }
  const assigned = task.owner_id === actor.id || !!await first(db, 'SELECT 1 FROM peg_task_collaborators WHERE task_id=? AND operator_id=?', task.id, actor.id)
  const memberships = await teamsOf(db, actor.id)
  for (const id of projectIds) {
    const project = await first<ProjectRow>(db, 'SELECT * FROM peg_projects WHERE id=?', id)
    if (!project) throw conflict('conversion_context_unavailable')
    const effective = await projectEffective(db, actor, project), grants = await activeGrants(db, 'project', id)
    for (const path of effective.paths) {
      if (path.scope === 'assignee' && !assigned) continue
      const grant = grants.find(row => row.id === path.grantId)
      const throughTeam = path.source === 'team' || path.source === 'default' && project.visibility === 'team'
      if (throughTeam) {
        const teamId = path.source === 'team' ? grant?.grantee_id : project.team_id
        for (const membership of memberships.filter(row => row.object_id === teamId)) merge(scope, path.capabilities, Math.min(until(grant), until(membership)))
      } else merge(scope, path.capabilities, until(grant))
    }
  }
  // Native direct task grants remain unchanged; their capped capabilities come from taskAccess.
  const current = await taskAccess(db, actor, task)
  for (const grant of await activeGrants(db, 'task', task.id, 'person', [actor.id])) {
    let caps: Capability[] = grant.scope === 'approve' ? ['read', 'approve'] : capabilitiesOf(grant.level)
    if (grant.scopes) caps = caps.filter(capability => grant.scopes!.split(',').includes(capability))
    merge(scope, caps.filter(capability => current.capabilities.has(capability)), until(grant))
  }
  return scope
}

export async function hierarchyAudience(db: D1Database, actor: Actor, graph: HierarchyGraph) {
  const beforeIds = graph.beforeHomes.map(row => row.project_id), afterIds = graph.afterHomes.map(row => row.project_id)
  if (!beforeIds.length && afterIds.length) throw conflict('conversion_personal_share_required')
  // Original file, field, history and time contexts remain native, with their immutable project IDs.
  // Removing a home would strand those records even if the two projects happen to have equal audiences.
  if (beforeIds.some(id => !afterIds.includes(id))) throw conflict('conversion_original_context_required')
  const oldPolicies = new Set<string>()
  for (const id of beforeIds) {
    const project = await first<ProjectRow>(db, 'SELECT * FROM peg_projects WHERE id=?', id)
    if (!project) throw conflict('conversion_context_unavailable')
    oldPolicies.add(await projectScope(db, project))
  }
  // Matching today's people is insufficient when a different team or workspace default or
  // longer-lived grant could expose historical material after the conversion.
  for (const id of afterIds.filter(id => !beforeIds.includes(id))) {
    const project = await first<ProjectRow>(db, 'SELECT * FROM peg_projects WHERE id=?', id)
    if (!project || !oldPolicies.has(await projectScope(db, project))) throw conflict('conversion_audience_expansion')
  }
  const ids = graph.work.map(row => row.id), marks = placeholders(ids)
  const contexts = await all<{ project_id: string | null }>(db,
    `SELECT project_id FROM peg_attachments WHERE task_id IN (${marks}) UNION SELECT project_id FROM peg_time_entries WHERE task_id IN (${marks}) UNION SELECT project_id FROM peg_history WHERE task_id IN (${marks}) UNION SELECT project_id FROM peg_comments WHERE task_id IN (${marks})`, ...ids, ...ids, ...ids, ...ids)
  if (contexts.some(row => row.project_id !== null && !afterIds.includes(row.project_id))) throw conflict('conversion_original_context_required')
  const people = await all<{ id: string; display_name: string }>(db,
    "SELECT o.id,o.display_name FROM oa_operators o LEFT JOIN peg_workspace_members m ON m.operator_id=o.id AND m.workspace_id=? WHERE o.status='active' AND (o.role IN ('owner','admin') OR m.operator_id IS NOT NULL) ORDER BY o.id", graph.source.workspace_id)
  const before = [], after = []
  for (const task of graph.work) {
    for (const person of people) {
      const viewer = { ...actor, id: person.id }, oldScope = await scopeFor(db, viewer, task, beforeIds), nextScope = await scopeFor(db, viewer, task, afterIds)
      for (const [capability, expires] of nextScope) if ((oldScope.get(capability) ?? 0) < expires) throw conflict('conversion_audience_expansion')
      const row = (scope: Scope) => ({ taskId: task.id, personId: person.id, name: person.display_name, capabilities: [...scope.keys()].sort(), scopes: [...scope.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([capability, expires]) => ({ capability, expiresAt: expires === forever ? null : expires })) })
      if (oldScope.has('read')) before.push(row(oldScope))
      if (nextScope.has('read')) after.push(row(nextScope))
    }
  }
  return { before, after, expanded: false }
}
