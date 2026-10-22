// The admin console's workspace settings and people: invitation policy, sharing, exports, retention, memberships.
import { all, batch, bound, conflict, first, forbidden, invalid, notFound, now, PegError } from '../db'
import { auditStatement, bumpEpoch } from '../authorization/audit'
import { revokeAllFor } from '../authorization/grants'
import { isAdministrator, levels, memberRoles, type WorkspaceRole } from '../authorization/levels'
import { defaultSettings, operatorRow, settingBounds, workspaceRole, workspaceSettings, type Actor, type WorkspaceSettings } from '../workspace/people'

export async function requireAdministrator(db: D1Database, actor: Actor, workspaceId: string): Promise<WorkspaceRole> {
  const role = await workspaceRole(db, actor.id, workspaceId)
  if (!role) throw notFound()
  if (!isAdministrator(role)) throw forbidden('administer')
  return role
}

export async function updateSettings(db: D1Database, actor: Actor, workspaceId: string, patch: Record<string, unknown>): Promise<WorkspaceSettings> {
  await requireAdministrator(db, actor, workspaceId)
  const current = await workspaceSettings(db, workspaceId), next: Record<string, unknown> = { ...current }
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in defaultSettings)) throw invalid('setting')
    if (key === 'invitePolicy' && !['owner', 'admin'].includes(value as string)) throw invalid(key)
    if (key === 'exportMinLevel' && !levels.includes(value as never)) throw invalid(key)
    if (['workspaceSharing', 'guestsAllowed', 'integrationsEnabled'].includes(key) && typeof value !== 'boolean') throw invalid(key)
    if (key in settingBounds) { const [low, high] = settingBounds[key as keyof typeof settingBounds]; if (!Number.isInteger(value) || (value as number) < low || (value as number) > high) throw invalid(key) }
    next[key] = value
  }
  await batch(db, [bound(db, 'UPDATE peg_workspaces SET settings=? WHERE id=?', [JSON.stringify(next), workspaceId]),
    auditStatement(db, { workspaceId, actorId: actor.id, action: 'settings.changed', targetType: 'workspace', targetId: workspaceId, detail: { changed: Object.keys(patch), from: Object.fromEntries(Object.keys(patch).map(key => [key, (current as unknown as Record<string, unknown>)[key]])), to: patch } }), bumpEpoch(db)])
  return next as unknown as WorkspaceSettings
}

export async function listPeople(db: D1Database, actor: Actor, workspaceId: string) {
  await requireAdministrator(db, actor, workspaceId)
  const rows = await all<{ id: string; email: string; display_name: string; base_role: string; status: string; role: string | null }>(db,
    `SELECT o.id,o.email,o.display_name,o.role base_role,o.status,m.role FROM oa_operators o LEFT JOIN peg_workspace_members m ON m.operator_id=o.id AND m.workspace_id=? WHERE o.role IN ('owner','admin') OR m.operator_id IS NOT NULL ORDER BY o.display_name`, workspaceId)
  return rows.map(row => ({ id: row.id, email: row.email, name: row.display_name, status: row.status, role: row.base_role === 'owner' || row.base_role === 'admin' ? row.base_role : row.role as WorkspaceRole }))
}

type Invite = (input: { email: string; displayName: string; role: 'member' }) => Promise<unknown>
/** Invite someone into the workspace in a role. Base sends the one-time sign-in link; the person holds nothing until a grant says so. */
export async function addPerson(db: D1Database, actor: Actor, workspaceId: string, input: { email?: unknown; displayName?: unknown; role?: unknown }, invite: Invite) {
  const role = await requireAdministrator(db, actor, workspaceId)
  const settings = await workspaceSettings(db, workspaceId)
  if (settings.invitePolicy === 'owner' && role !== 'owner') throw forbidden('invite')
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw invalid('email')
  const kind = (input.role ?? 'member') as string
  if (!(memberRoles as readonly string[]).includes(kind)) throw invalid('role')
  if (kind === 'guest' && !settings.guestsAllowed) throw forbidden('guests_not_allowed')
  const existing = await first<{ id: string }>(db, 'SELECT id FROM oa_operators WHERE email=?', email)
  if (!existing) {
    const displayName = typeof input.displayName === 'string' && input.displayName.trim() ? input.displayName.trim() : email.split('@')[0]
    try { await invite({ email, displayName, role: 'member' }) } catch (error) { throw translate(error) }
  }
  const person = (await first<{ id: string }>(db, 'SELECT id FROM oa_operators WHERE email=?', email))!
  await keepGoalOwner(db,person.id,{workspace:workspaceId,role:kind})
  await batch(db, [bound(db, 'INSERT INTO peg_workspace_members(workspace_id,operator_id,role,created_by,created_at) VALUES (?,?,?,?,?) ON CONFLICT(workspace_id,operator_id) DO UPDATE SET role=excluded.role', [workspaceId, person.id, kind, actor.id, now()]),
    auditStatement(db, { workspaceId, actorId: actor.id, action: 'person.added', targetType: 'workspace', targetId: workspaceId, subjectId: person.id, detail: { role: kind, invited: !existing } }), bumpEpoch(db)])
  return { id: person.id, email, role: kind, invited: !existing }
}

/** Ordinary account changes never silently abandon owned goals or disclose their titles/counts. */
async function keepGoalOwner(db:D1Database,id:string,change:{workspace?:string;role?:string;status?:string;baseRole?:string;remove?:boolean}) {
  const goals=await all<{scope:string;workspace_id:string}>(db,'SELECT scope,workspace_id FROM peg_goals WHERE owner_id=?',id)
  if(!goals.length)return
  const operator=await operatorRow(db,id)
  for(const goal of goals){
    if(change.status&&change.status!=='active')throw conflict('goal_owner_transfer_required')
    const baseRole=change.baseRole??operator?.role
    if(baseRole==='owner'||baseRole==='admin')continue
    let role=(await first<{role:string}>(db,'SELECT role FROM peg_workspace_members WHERE workspace_id=? AND operator_id=?',goal.workspace_id,id))?.role
    if(change.workspace===goal.workspace_id)role=change.remove?undefined:change.role??role
    if(!role||!['manager','member',...(goal.scope==='personal'?['analyst']:[])].includes(role))throw conflict('goal_owner_transfer_required')
  }
}
export async function setPersonRole(db: D1Database, actor: Actor, workspaceId: string, operatorId: string, kind: unknown) {
  await requireAdministrator(db, actor, workspaceId)
  if (!(memberRoles as readonly string[]).includes(kind as string)) throw invalid('role')
  const operator = await operatorRow(db, operatorId)
  if (!operator || operator.role !== 'member') throw conflict('base_role')
  await keepGoalOwner(db,operatorId,{workspace:workspaceId,role:kind as string})
  const before = await first<{ role: string }>(db, 'SELECT role FROM peg_workspace_members WHERE workspace_id=? AND operator_id=?', workspaceId, operatorId)
  if (!before) throw notFound()
  await batch(db, [bound(db, 'UPDATE peg_workspace_members SET role=? WHERE workspace_id=? AND operator_id=?', [kind as string, workspaceId, operatorId]),
    auditStatement(db, { workspaceId, actorId: actor.id, action: 'person.role_changed', targetType: 'workspace', targetId: workspaceId, subjectId: operatorId, detail: { from: before.role, to: kind } }), bumpEpoch(db)])
  return { id: operatorId, role: kind }
}

export async function removePerson(db: D1Database, actor: Actor, workspaceId: string, operatorId: string) {
  await requireAdministrator(db, actor, workspaceId)
  if (!(await first(db, 'SELECT 1 FROM peg_workspace_members WHERE workspace_id=? AND operator_id=?', workspaceId, operatorId))) throw notFound()
  const owns = await first(db, 'SELECT 1 FROM peg_projects WHERE workspace_id=? AND owner_id=?', workspaceId, operatorId)
  if (owns) throw conflict('last_owner')
  await keepGoalOwner(db,operatorId,{workspace:workspaceId,remove:true})
  await revokeAllFor(db, actor, workspaceId, operatorId)
  await batch(db, [bound(db, 'DELETE FROM peg_workspace_members WHERE workspace_id=? AND operator_id=?', [workspaceId, operatorId]),
    auditStatement(db, { workspaceId, actorId: actor.id, action: 'person.removed', targetType: 'workspace', targetId: workspaceId, subjectId: operatorId }), bumpEpoch(db)])
}

/** Base's account changes (role, active or not) run through Base's own policy and its last-owner guard; Pegboard adds the audit row and the new epoch. */
export async function changeBaseAccount(db: D1Database, actor: Actor, workspaceId: string, operatorId: string, change: { role?: string; status?: string }, apply: () => Promise<unknown>) {
  await requireAdministrator(db, actor, workspaceId)
  await keepGoalOwner(db,operatorId,{status:change.status,baseRole:change.role})
  try { await apply() } catch (error) { throw translate(error) }
  await batch(db, [auditStatement(db, { workspaceId, actorId: actor.id, action: change.status ? 'person.status_changed' : 'person.base_role_changed', targetType: 'workspace', targetId: workspaceId, subjectId: operatorId, detail: change }), bumpEpoch(db)])
}

export function translate(error: unknown): unknown {
  // Base's own account refusals (its policy and last-owner guard) keep their status and code.
  if (error instanceof Error && error.name === 'AuthError') { const { code, status } = error as Error & { code: string; status: number }; return new PegError(status, code) }
  if (error instanceof Error && /goal_owner_transfer_required/.test(error.message)) return new PegError(409, 'goal_owner_transfer_required')
  if (error instanceof Error && /last_owner/.test(error.message)) return new PegError(409, 'last_owner')
  return error
}
