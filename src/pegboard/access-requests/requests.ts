// Access requests (PEG-083): a blind, deduplicated ask from an active member, delivered to the people who can decide it.
// Requests create no share and no invitation. A private no-project task is never a target.
import { all, batch, bound, first, forbidden, invalid, newId, now } from '../db'
import type { RequestRow } from '../model'
import { auditStatement } from '../authorization/audit'
import { projectEffective, taskAccess, teamEffective } from '../authorization/effective'
import { isLevel, rank, type Level } from '../authorization/levels'
import { workspaceRole, workspaceSettings, workspacesOf, operatorRow, type Actor } from '../workspace/people'
import { loadTarget, policyRevOf, recipients, targetTypeOf, workspaceOf } from './authority'
import { refPattern, resolveTaskId } from '../references/refs'
import { deliver, type Delivery } from './notify'

/** Answered identically for a target that does not exist, one that cannot be asked for and one just asked for. */
export const acknowledgment = { status: 'received', message: 'If this can be shared with you, the people who decide have been told.' } as const

export async function expireDue(db: D1Database): Promise<void> {
  const at = now()
  const due = await all<RequestRow>(db, "SELECT * FROM peg_access_requests WHERE status='pending' AND expires_at<=?", at)
  for (const request of due) await batch(db, [
    bound(db, "UPDATE peg_access_requests SET status='expired',decided_at=? WHERE id=? AND status='pending'", [at, request.id]),
    auditStatement(db, { workspaceId: request.workspace_id, actorId: null, action: 'request.expired', targetType: request.target_type, targetId: request.target_id, subjectId: request.requester_id, detail: { requestId: request.id, requestedLevel: request.level } }),
  ])
}

export async function submitRequest(db: D1Database, delivery: Delivery, actor: Actor, input: { targetId?: unknown; level?: unknown; message?: unknown }): Promise<typeof acknowledgment> {
  await expireDue(db)
  // Only an active, ordinary workspace member can ask. Everyone else is refused whatever they name.
  const roles = await Promise.all((await workspacesOf(db, actor)).map(id => workspaceRole(db, actor.id, id)))
  if (!roles.some(role => role && role !== 'guest' && role !== 'agent')) throw forbidden()
  const level = input.level === undefined || input.level === '' ? 'viewer' : input.level
  if (!isLevel(level)) throw invalid('level')
  const message = typeof input.message === 'string' ? input.message.trim().slice(0, 1000) : ''
  // A link may carry an id or a task reference (MKT-142); either names the same target.
  const named = typeof input.targetId === 'string' ? input.targetId.trim() : ''
  const targetId = refPattern.test(named.toUpperCase()) ? await resolveTaskId(db, named) ?? '' : named
  const type = targetTypeOf(targetId)
  if (!type) return acknowledgment
  const target = await loadTarget(db, type, targetId)
  if (!target) return acknowledgment
  const workspaceId = workspaceOf(target), role = await workspaceRole(db, actor.id, workspaceId)
  if (!role || role === 'guest' || role === 'agent') return acknowledgment
  // Never a private personal task; never something already held at the level asked.
  let held: Level | null = null, askable = true
  if (target.type === 'team') { held = (await teamEffective(db, actor, target.row)).level; askable = target.row.privacy !== 'public' }
  else if (target.type === 'project') held = (await projectEffective(db, actor, target.row)).level
  else {
    const access = await taskAccess(db, actor, target.row)
    const homes = await first<{ n: number }>(db, 'SELECT COUNT(*) n FROM peg_task_projects WHERE task_id=?', target.row.id)
    askable = homes!.n > 0 && level !== 'admin'
    held = access.level
  }
  if (!askable || rank(held) >= rank(level)) return acknowledgment
  const id = newId('req'), at = now(), operator = await operatorRow(db, actor.id)
  const expires = at + (await workspaceSettings(db, workspaceId)).requestExpiryDays * 86_400_000
  const policyRev = await policyRevOf(db, target)
  const [inserted] = await batch(db, [bound(db, `INSERT INTO peg_access_requests(id,workspace_id,requester_id,requester_version,target_type,target_id,level,message,status,policy_rev,expires_at,created_at)
    VALUES (?,?,?,?,?,?,?,?,'pending',?,?,?) ON CONFLICT(requester_id,target_type,target_id) WHERE status='pending' DO NOTHING`, [id, workspaceId, actor.id, operator!.version, target.type, target.row.id, level, message, policyRev, expires, at])])
  if (!inserted.meta.changes) {
    await batch(db, [bound(db, "UPDATE peg_access_requests SET duplicates=duplicates+1 WHERE requester_id=? AND target_type=? AND target_id=? AND status='pending'", [actor.id, target.type, target.row.id]),
      auditStatement(db, { workspaceId, actorId: actor.id, action: 'request.deduplicated', targetType: target.type, targetId: target.row.id, detail: { requestedLevel: level } })])
    return acknowledgment
  }
  const created = (await first<RequestRow>(db, 'SELECT * FROM peg_access_requests WHERE id=?', id))!
  await batch(db, [auditStatement(db, { workspaceId, actorId: actor.id, action: 'request.created', targetType: target.type, targetId: target.row.id, detail: { requestId: id, requestedLevel: level, message: message || undefined, expiresAt: expires } })])
  const to = await recipients(db, target, actor.id)
  await deliver(db, delivery, created, to.kind, to.ids)
  return acknowledgment
}

/** A person's own requests: what they asked, its state and the reason a denial gave. Names of the target are never included. */
export async function myRequests(db: D1Database, actor: Actor) {
  await expireDue(db)
  const rows = await all<RequestRow>(db, 'SELECT * FROM peg_access_requests WHERE requester_id=? ORDER BY created_at DESC LIMIT 100', actor.id)
  return rows.map(row => ({ id: row.id, targetType: row.target_type, targetId: row.target_id, level: row.level, status: row.status, message: row.message, createdAt: row.created_at, expiresAt: row.expires_at, decidedAt: row.decided_at, reason: row.decision_reason, grantedLevel: row.granted_level }))
}
