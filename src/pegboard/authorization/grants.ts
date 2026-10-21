// Grants: direct, team and join paths to a team, project or task, administered by people who hold the authority to
// delegate that level. Revocation and the last-owner rule live here so no door can skip them.
import { all, bound, batch, conflict, first, forbidden, invalid, newId, notFound, now, PegError } from '../db'
import type { GrantRow, ProjectRow, TaskRow, TeamRow } from '../model'
import { administers, operatorRow, workspaceRole, workspaceSettings, type Actor } from '../workspace/people'
import { auditStatement, bumpEpoch } from './audit'
import { canDelegate, projectEffective, taskAccess, teamEffective, type Effective } from './effective'
import { capabilityNames, isLevel, rank, type Level } from './levels'

export type ObjectType = GrantRow['object_type']
export interface GrantInput { objectType: ObjectType; objectId: string; granteeType: 'person' | 'team'; granteeId: string; level: Level; scope?: GrantRow['scope']; scopes?: string[]; expiresAt?: number | null }

export const loadTeam = (db: D1Database, id: string) => first<TeamRow>(db, 'SELECT * FROM peg_teams WHERE id=?', id)
export const loadProject = (db: D1Database, id: string) => first<ProjectRow>(db, 'SELECT * FROM peg_projects WHERE id=?', id)
export const loadTask = (db: D1Database, id: string) => first<TaskRow>(db, 'SELECT * FROM peg_tasks WHERE id=?', id)

/** The object a grant would sit on and the actor's standing on it; unknown or unreadable objects are simply not found. */
export async function objectStanding(db: D1Database, actor: Actor, type: ObjectType, id: string): Promise<{ workspaceId: string; effective: Effective; team?: TeamRow; project?: ProjectRow; task?: TaskRow }> {
  if (type === 'team') {
    const team = await loadTeam(db, id)
    if (!team) throw notFound()
    const effective = await teamEffective(db, actor, team)
    if (!effective.capabilities.has('read')) throw notFound()
    return { workspaceId: team.workspace_id, effective, team }
  }
  if (type === 'project') {
    const project = await loadProject(db, id)
    if (!project) throw notFound()
    const effective = await projectEffective(db, actor, project)
    if (!effective.capabilities.has('read')) throw notFound()
    return { workspaceId: project.workspace_id, effective, project }
  }
  const task = await loadTask(db, id)
  if (!task) throw notFound()
  const access = await taskAccess(db, actor, task)
  if (!access.capabilities.has('read') || access.personal) throw notFound()
  return { workspaceId: task.workspace_id, effective: { role: access.role, level: access.level, capabilities: access.capabilities, paths: [] }, task }
}

function validate(input: GrantInput) {
  if (!isLevel(input.level)) throw invalid('level')
  if (input.scope && !['full', 'approve', 'assignee'].includes(input.scope)) throw invalid('scope')
  if (input.scopes?.some(name => !capabilityNames.includes(name))) throw invalid('scopes')
  if (input.objectType === 'task' && input.granteeType !== 'person') throw invalid('grantee')
  if (input.objectType === 'team' && input.granteeType !== 'person') throw invalid('grantee')
}

/** Who may be granted: an active person of the workspace, or a team of it. Agents never hold Admin. */
async function checkGrantee(db: D1Database, workspaceId: string, input: GrantInput) {
  if (input.granteeType === 'team') {
    const team = await loadTeam(db, input.granteeId)
    if (!team || team.workspace_id !== workspaceId) throw invalid('grantee')
    return
  }
  const role = await workspaceRole(db, input.granteeId, workspaceId)
  if (!role) throw invalid('grantee')
  if (role === 'guest' && !(await workspaceSettings(db, workspaceId)).guestsAllowed) throw invalid('guests_not_allowed')
  if (role === 'agent' && input.level === 'admin') throw invalid('agent_cannot_admin')
}

export const grantStatements = (db: D1Database, actorId: string, workspaceId: string, input: GrantInput, extra: { source: GrantRow['source']; requestId?: string; id?: string; at?: number }) => {
  const id = extra.id ?? newId('grt')
  return { id, statements: [
    bound(db, `INSERT INTO peg_grants(id,workspace_id,object_type,object_id,grantee_type,grantee_id,level,scope,scopes,source,request_id,created_by,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, workspaceId, input.objectType, input.objectId, input.granteeType, input.granteeId, input.level, input.scope ?? 'full', input.scopes?.length ? input.scopes.join(',') : null, extra.source, extra.requestId ?? null, actorId, extra.at ?? now(), input.expiresAt ?? null]),
    auditStatement(db, { workspaceId, actorId, action: 'grant.created', targetType: input.objectType, targetId: input.objectId, subjectId: input.granteeType === 'person' ? input.granteeId : undefined, detail: { grantId: id, grantee: `${input.granteeType}:${input.granteeId}`, level: input.level, scope: input.scope ?? 'full', source: extra.source, requestId: extra.requestId } }),
    bumpEpoch(db),
  ] }
}

export async function createGrant(db: D1Database, actor: Actor, input: GrantInput): Promise<GrantRow> {
  validate(input)
  const standing = await objectStanding(db, actor, input.objectType, input.objectId)
  if (input.objectType === 'task' ? !standing.effective.capabilities.has('manage_shares') : !canDelegate(standing.effective, input.level)) throw forbidden(input.level === 'admin' ? 'delegate_admin' : 'manage_shares')
  if (input.objectType === 'task' && input.level === 'admin') throw invalid('task_level')
  await checkGrantee(db, standing.workspaceId, input)
  const { id, statements } = grantStatements(db, actor.id, standing.workspaceId, input, { source: 'direct' })
  await batch(db, statements)
  return (await first<GrantRow>(db, 'SELECT * FROM peg_grants WHERE id=?', id))!
}

/** Whether revoking this grant would leave the team or project with nobody responsible. */
async function lastResponsible(db: D1Database, grant: GrantRow): Promise<boolean> {
  if (grant.level !== 'admin' || grant.grantee_type !== 'person' || grant.object_type === 'task') return false
  const others = await first<{ n: number }>(db, `SELECT COUNT(*) n FROM peg_grants g JOIN oa_operators o ON o.id=g.grantee_id AND o.status='active'
    WHERE g.object_type=? AND g.object_id=? AND g.level='admin' AND g.grantee_type='person' AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at>?) AND g.id<>?`, grant.object_type, grant.object_id, now(), grant.id)
  if (others!.n > 0) return false
  if (grant.object_type === 'project') { const project = await loadProject(db, grant.object_id); if (project && project.owner_id !== grant.grantee_id) return false }
  return true
}

export async function revokeGrant(db: D1Database, actor: Actor, grantId: string): Promise<GrantRow> {
  const grant = await first<GrantRow>(db, 'SELECT * FROM peg_grants WHERE id=? AND revoked_at IS NULL', grantId)
  if (!grant) throw notFound()
  const standing = await objectStanding(db, actor, grant.object_type, grant.object_id)
  if (!standing.effective.capabilities.has('manage_shares') && !(grant.grantee_type === 'person' && grant.grantee_id === actor.id && grant.source === 'join')) throw forbidden('manage_shares')
  if (!standing.effective.capabilities.has('delegate_admin') && grant.level === 'admin') throw forbidden('delegate_admin')
  if (await lastResponsible(db, grant)) throw conflict('last_owner')
  await batch(db, [
    bound(db, 'UPDATE peg_grants SET revoked_at=?, revoked_by=? WHERE id=? AND revoked_at IS NULL', [now(), actor.id, grantId]),
    auditStatement(db, { workspaceId: grant.workspace_id, actorId: actor.id, action: 'grant.revoked', targetType: grant.object_type, targetId: grant.object_id, subjectId: grant.grantee_type === 'person' ? grant.grantee_id : undefined, detail: { grantId, grantee: `${grant.grantee_type}:${grant.grantee_id}`, level: grant.level, source: grant.source } }),
    bumpEpoch(db),
  ])
  return { ...grant, revoked_at: now(), revoked_by: actor.id }
}

export const grantsOn = async (db: D1Database, actor: Actor, type: ObjectType, id: string) => {
  const standing = await objectStanding(db, actor, type, id)
  if (!standing.effective.capabilities.has('manage_shares') && !standing.effective.capabilities.has('manage_settings')) throw forbidden('manage_shares')
  return all<GrantRow>(db, 'SELECT * FROM peg_grants WHERE object_type=? AND object_id=? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>?) ORDER BY created_at', type, id, now())
}

/** Take back everything a person was granted in a workspace, as when they leave it. */
export async function revokeAllFor(db: D1Database, actor: Actor, workspaceId: string, operatorId: string) {
  const grants = await all<GrantRow>(db, "SELECT * FROM peg_grants WHERE workspace_id=? AND grantee_type='person' AND grantee_id=? AND revoked_at IS NULL", workspaceId, operatorId)
  for (const grant of grants) if (await lastResponsible(db, grant)) throw conflict('last_owner')
  const statements = grants.flatMap(grant => [bound(db, 'UPDATE peg_grants SET revoked_at=?, revoked_by=? WHERE id=?', [now(), actor.id, grant.id]),
    auditStatement(db, { workspaceId, actorId: actor.id, action: 'grant.revoked', targetType: grant.object_type, targetId: grant.object_id, subjectId: operatorId, detail: { grantId: grant.id, level: grant.level, reason: 'left_workspace' } })])
  if (statements.length) await batch(db, [...statements, bumpEpoch(db)])
}
export { operatorRow, administers, PegError, rank }
