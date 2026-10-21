// Teams: privacy, default join level, approvers and the discovery a person is allowed (PEG-083).
import { all, batch, bound, conflict, first, forbidden, invalid, newId, notFound, now, placeholders, type Param } from '../db'
import type { TeamRow } from '../model'
import { auditStatement, bumpEpoch } from '../authorization/audit'
import { teamEffective, teamsOf } from '../authorization/effective'
import { grantStatements, loadTeam } from '../authorization/grants'
import { isAdministrator, label, type Level } from '../authorization/levels'
import { workspaceRole, type Actor } from './people'

const privacies = ['public', 'request', 'private'] as const
const defaults = ['viewer', 'commenter', 'editor'] as const
const text = (value: unknown, max: number, code: string) => { if (typeof value !== 'string' || !value.trim() || value.length > max) throw invalid(code); return value.trim() }

export async function createTeam(db: D1Database, actor: Actor, input: { workspaceId: string; name: string; description?: string; privacy?: string; defaultLevel?: string }): Promise<TeamRow> {
  const role = await workspaceRole(db, actor.id, input.workspaceId)
  if (!role) throw notFound()
  if (!(isAdministrator(role) || role === 'manager')) throw forbidden('create_team')
  const privacy = input.privacy ?? 'private', defaultLevel = input.defaultLevel ?? 'viewer'
  if (!privacies.includes(privacy as never)) throw invalid('privacy')
  if (!defaults.includes(defaultLevel as never)) throw invalid('default_level')
  const id = newId('team'), at = now()
  const grant = grantStatements(db, actor.id, input.workspaceId, { objectType: 'team', objectId: id, granteeType: 'person', granteeId: actor.id, level: 'admin' }, { source: 'direct' })
  await batch(db, [
    bound(db, 'INSERT INTO peg_teams(id,workspace_id,name,description,privacy,default_level,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)', [id, input.workspaceId, text(input.name, 120, 'name'), (input.description ?? '').slice(0, 2000), privacy, defaultLevel, actor.id, at]),
    ...grant.statements,
    auditStatement(db, { workspaceId: input.workspaceId, actorId: actor.id, action: 'team.created', targetType: 'team', targetId: id, detail: { privacy, defaultLevel } }),
  ])
  return (await loadTeam(db, id))!
}

export interface TeamPatch { name?: string; description?: string; privacy?: string; defaultLevel?: string; fallbackId?: string | null; approvers?: string[] }
export async function updateTeam(db: D1Database, actor: Actor, id: string, patch: TeamPatch): Promise<TeamRow> {
  const team = await loadTeam(db, id)
  if (!team) throw notFound()
  const effective = await teamEffective(db, actor, team)
  if (!effective.capabilities.has('read')) throw notFound()
  if (!effective.capabilities.has('manage_settings')) throw forbidden('manage_settings')
  const next = { ...team }
  if (patch.name !== undefined) next.name = text(patch.name, 120, 'name')
  if (patch.description !== undefined) next.description = String(patch.description).slice(0, 2000)
  if (patch.privacy !== undefined) { if (!privacies.includes(patch.privacy as never)) throw invalid('privacy'); next.privacy = patch.privacy as TeamRow['privacy'] }
  if (patch.defaultLevel !== undefined) { if (!defaults.includes(patch.defaultLevel as never)) throw invalid('default_level'); next.default_level = patch.defaultLevel as TeamRow['default_level'] }
  if (patch.fallbackId !== undefined) {
    if (patch.fallbackId && !(await workspaceRole(db, patch.fallbackId, team.workspace_id))) throw invalid('fallback')
    next.fallback_id = patch.fallbackId
  }
  for (const approver of patch.approvers ?? []) if (!(await workspaceRole(db, approver, team.workspace_id))) throw invalid('approver')
  const policy = next.privacy !== team.privacy || next.default_level !== team.default_level
  const statements = [
    bound(db, 'UPDATE peg_teams SET name=?,description=?,privacy=?,default_level=?,fallback_id=?,policy_rev=policy_rev+? WHERE id=?', [next.name, next.description, next.privacy, next.default_level, next.fallback_id, policy ? 1 : 0, id]),
    auditStatement(db, { workspaceId: team.workspace_id, actorId: actor.id, action: 'team.updated', targetType: 'team', targetId: id, detail: { privacy: next.privacy, defaultLevel: next.default_level, fallbackId: next.fallback_id, approvers: patch.approvers, renamed: next.name !== team.name } }),
    bumpEpoch(db),
  ]
  if (patch.approvers) statements.splice(1, 0, bound(db, "DELETE FROM peg_approvers WHERE object_type='team' AND object_id=?", [id]), ...patch.approvers.map(approver => bound(db, "INSERT OR IGNORE INTO peg_approvers(object_type,object_id,operator_id) VALUES ('team',?,?)", [id, approver])))
  await batch(db, statements)
  return (await loadTeam(db, id))!
}

export interface TeamListing { id: string; name: string; description: string; privacy: TeamRow['privacy']; defaultLevel: TeamRow['default_level']; member: boolean; memberLevel: Level | null; action: 'open' | 'join' | 'request' | null }
/** Browse and search. Private teams appear only to their members; guests see only teams they belong to. */
export async function listTeams(db: D1Database, actor: Actor, workspaceId: string, query = ''): Promise<{ teams: TeamListing[]; count: number }> {
  const role = await workspaceRole(db, actor.id, workspaceId)
  if (!role) throw notFound()
  const mine = new Map((await teamsOf(db, actor.id)).map(grant => [grant.object_id, grant.level]))
  const rows = await all<TeamRow>(db, 'SELECT * FROM peg_teams WHERE workspace_id=? ORDER BY name', workspaceId)
  const needle = query.trim().toLowerCase()
  const teams = rows.flatMap<TeamListing>(team => {
    const member = mine.has(team.id), browsable = role !== 'guest' && role !== 'agent' && team.privacy !== 'private'
    if (!member && !browsable && !isAdministrator(role)) return []
    if (needle && !`${team.name} ${team.description}`.toLowerCase().includes(needle)) return []
    const action = member || isAdministrator(role) ? 'open' : team.privacy === 'public' ? 'join' : 'request'
    return [{ id: team.id, name: team.name, description: team.description, privacy: team.privacy, defaultLevel: team.default_level, member, memberLevel: mine.get(team.id) ?? null, action }]
  })
  return { teams, count: teams.length }
}

/** Public teams only; the member lands at the team's configured default, never Admin. */
export async function joinTeam(db: D1Database, actor: Actor, id: string): Promise<{ teamId: string; level: Level }> {
  const team = await loadTeam(db, id)
  const role = team ? await workspaceRole(db, actor.id, team.workspace_id) : null
  if (!team || !role || role === 'guest' || role === 'agent' || team.privacy === 'private') throw notFound()
  if (team.privacy === 'request') throw forbidden('request_to_join')
  if ((await teamsOf(db, actor.id)).some(grant => grant.object_id === id)) throw conflict('already_member')
  const level = team.default_level
  const { statements } = grantStatements(db, actor.id, team.workspace_id, { objectType: 'team', objectId: id, granteeType: 'person', granteeId: actor.id, level }, { source: 'join' })
  await batch(db, statements)
  return { teamId: id, level }
}

export async function teamMembers(db: D1Database, actor: Actor, id: string) {
  const team = await loadTeam(db, id)
  if (!team) throw notFound()
  const effective = await teamEffective(db, actor, team)
  if (!effective.capabilities.has('read')) throw notFound()
  const grants = await all<{ id: string; grantee_id: string; level: Level; source: string; display_name: string; email: string }>(db,
    `SELECT g.id,g.grantee_id,g.level,g.source,o.display_name,o.email FROM peg_grants g JOIN oa_operators o ON o.id=g.grantee_id
     WHERE g.object_type='team' AND g.object_id=? AND g.grantee_type='person' AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at>?) ORDER BY o.display_name`, id, now())
  return grants.map(grant => ({ grantId: grant.id, operatorId: grant.grantee_id, name: grant.display_name, level: grant.level, source: grant.source }))
}
