// The access review: every current grant with who gave it and how, the people, the requests and the audit, for the
// workspace's administrators, plus the granting paths that explain one person's standing on one object.
import { all, batch, bound, forbidden, notFound, now } from '../db'
import type { GrantRow, ProjectRow, TeamRow } from '../model'
import { auditRows } from '../authorization/audit'
import { projectEffective, teamEffective } from '../authorization/effective'
import { loadProject, loadTeam, objectStanding } from '../authorization/grants'
import { displayNames, workspaceRole, workspaceSettings, type Actor } from '../workspace/people'
import { requireAdministrator } from './settings'

const retire = async (db: D1Database, workspaceId: string) => {
  const days = (await workspaceSettings(db, workspaceId)).requestRetentionDays, before = now() - days * 86_400_000
  await batch(db, [bound(db, "DELETE FROM peg_inbox WHERE request_id IN (SELECT id FROM peg_access_requests WHERE workspace_id=? AND status<>'pending' AND COALESCE(decided_at,created_at)<?)", [workspaceId, before]),
    bound(db, "DELETE FROM peg_access_requests WHERE workspace_id=? AND status<>'pending' AND COALESCE(decided_at,created_at)<?", [workspaceId, before])])
}

export async function accessReview(db: D1Database, actor: Actor, workspaceId: string, filter: { action?: string; subjectId?: string } = {}) {
  await requireAdministrator(db, actor, workspaceId)
  await retire(db, workspaceId)
  const grants = await all<GrantRow>(db, 'SELECT * FROM peg_grants WHERE workspace_id=? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>?) ORDER BY created_at', workspaceId, now())
  const audit = await auditRows(db, workspaceId, filter)
  const teams = new Map((await all<TeamRow>(db, 'SELECT * FROM peg_teams WHERE workspace_id=?', workspaceId)).map(team => [team.id, team.name]))
  const projects = new Map((await all<ProjectRow>(db, 'SELECT * FROM peg_projects WHERE workspace_id=?', workspaceId)).map(project => [project.id, project.name]))
  const portfolios = new Map((await all<{id:string;name:string}>(db, 'SELECT id,name FROM peg_portfolios WHERE workspace_id=?', workspaceId)).map(row => [row.id,row.name]))
  const memberships = await all<{portfolio_id:string;operator_id:string;level:string;added_by:string;added_at:number;request_id:string|null}>(db, 'SELECT m.* FROM peg_portfolio_members m JOIN peg_portfolios p ON p.id=m.portfolio_id WHERE p.workspace_id=?', workspaceId)
  const people = await displayNames(db, [...memberships.flatMap(row => [row.operator_id,row.added_by]), ...grants.flatMap(grant => [grant.created_by, grant.grantee_id]), ...audit.flatMap(row => [row.actor_id ?? '', row.subject_id ?? ''])])
  const named = (id: string | null) => id ? people.get(id) ?? 'Former member' : 'System'
  const objectName = (type: string, id: string) => type === 'team' ? teams.get(id) ?? id : type === 'project' ? projects.get(id) ?? id : type === 'portfolio' ? portfolios.get(id) ?? id : id
  return {
    portfolioMemberships: memberships.map(row => ({ portfolioId: row.portfolio_id, portfolio: portfolios.get(row.portfolio_id) ?? row.portfolio_id, operatorId: row.operator_id, member: named(row.operator_id), level: row.level, by: named(row.added_by), at: row.added_at, requestId: row.request_id })),
    grants: grants.map(grant => ({ id: grant.id, objectType: grant.object_type, objectId: grant.object_id, object: objectName(grant.object_type, grant.object_id), grantee: grant.grantee_type === 'person' ? named(grant.grantee_id) : `Team ${teams.get(grant.grantee_id) ?? grant.grantee_id}`, granteeType: grant.grantee_type, granteeId: grant.grantee_id, level: grant.level, scope: grant.scope, source: grant.source, requestId: grant.request_id, by: named(grant.created_by), at: grant.created_at })),
    requests: (await all<{ id: string; status: string; requester_id: string; target_type: string; target_id: string; level: string; granted_level: string | null; decided_by: string | null; created_at: number; decided_at: number | null }>(db, 'SELECT id,status,requester_id,target_type,target_id,level,granted_level,decided_by,created_at,decided_at FROM peg_access_requests WHERE workspace_id=? ORDER BY created_at DESC LIMIT 100', workspaceId))
      .map(row => ({ ...row, requester: people.get(row.requester_id) ?? 'Former member' })),
    audit: audit.map(row => ({ id: row.id, at: row.at, actor: named(row.actor_id), action: row.action, targetType: row.target_type, targetId: row.target_id, target: row.target_type && row.target_id ? objectName(row.target_type, row.target_id) : null, subject: row.subject_id ? named(row.subject_id) : null, detail: row.detail })),
  }
}

/** Why a person holds what they hold on an object: each path, its level and what it grants. Only the object's Admin sees it. */
export async function explainStanding(db: D1Database, actor: Actor, type: 'team' | 'project', id: string, operatorId: string) {
  const standing = await objectStanding(db, actor, type, id)
  if (!standing.effective.capabilities.has('manage_shares') && !standing.effective.capabilities.has('manage_settings')) throw forbidden('manage_shares')
  const subject = { id: operatorId, email: '', displayName: '', baseRole: 'member' } as Actor
  const role = await workspaceRole(db, operatorId, standing.workspaceId)
  if (!role) throw notFound()
  const effective = type === 'team' ? await teamEffective(db, subject, (await loadTeam(db, id))!) : await projectEffective(db, subject, (await loadProject(db, id))!)
  return { operatorId, role, level: effective.level, capabilities: [...effective.capabilities], paths: effective.paths.map(path => ({ via: path.via, level: path.level, grantId: path.grantId ?? null, scope: path.scope ?? 'full' })) }
}
