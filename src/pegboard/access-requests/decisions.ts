// The one public decision door: preview the exact requester, scope and grant, then approve or deny. Authority, expiry,
// the requester's standing and the policy previewed are all rechecked inside the write itself; a stale, replayed or
// unauthorised decision changes nothing.
import { all, batch, bound, conflict, first, forbidden, invalid, newId, notFound, now } from '../db'
import type { RequestRow } from '../model'
import { epoch } from '../authorization/audit'
import { taskAccess } from '../authorization/effective'
import { isLevel, levels, rank, type Level } from '../authorization/levels'
import { loadProject } from '../authorization/grants'
import { operatorRow, type Actor } from '../workspace/people'
import { authorityOver, loadTarget, policyRevOf, workspaceOf, type Authority, type Target } from './authority'
import { expireDue } from './requests'

const stamp = async (text: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].slice(0, 12).map(byte => byte.toString(16).padStart(2, '0')).join('')

async function standing(db: D1Database, actor: Actor, requestId: string): Promise<{ request: RequestRow; target: Target; authority: Authority }> {
  const request = await first<RequestRow>(db, 'SELECT * FROM peg_access_requests WHERE id=?', requestId)
  const target = request ? await loadTarget(db, request.target_type, request.target_id) : null
  const authority = request && target ? await authorityOver(db, actor.id, target, request.requester_id) : null
  // Whether the request exists is the business of those who may decide it.
  if (!request || !target || !authority) throw notFound()
  return { request, target, authority }
}
const revisionOf = async (db: D1Database, request: RequestRow, target: Target) => stamp(JSON.stringify([request.id, request.status, request.level, request.policy_rev, await policyRevOf(db, target), request.requester_version]))

export async function previewRequest(db: D1Database, actor: Actor, requestId: string) {
  await expireDue(db)
  const { request, target, authority } = await standing(db, actor, requestId)
  const requester = await operatorRow(db, request.requester_id)
  // Names of private work go only to deciders who may read it; a fallback decider gets the minimum.
  let name: string | null = null, readable = false
  if (target.type === 'team') { name = target.row.name; readable = authority.via !== 'fallback' }
  else if (target.type === 'project') { name = target.row.name; readable = authority.via !== 'fallback' }
  else { const access = await taskAccess(db, actor, target.row); readable = access.capabilities.has('read'); name = readable ? target.row.title : null }
  const projects = target.type === 'task' ? await all<{ id: string; name: string }>(db, 'SELECT p.id,p.name FROM peg_task_projects tp JOIN peg_projects p ON p.id=tp.project_id WHERE tp.task_id=?', target.row.id) : []
  return {
    id: request.id, status: request.status, targetType: request.target_type, targetId: request.target_id, targetName: readable ? name : null, level: request.level, message: request.message,
    requester: authority.via === 'fallback' ? { id: requester?.id, name: requester?.display_name } : { id: requester?.id, name: requester?.display_name, email: requester?.email },
    requesterActive: requester?.status === 'active', createdAt: request.created_at, expiresAt: request.expires_at, via: authority.via,
    grantable: levels.filter(level => rank(level) <= rank(authority.ceiling)),
    // A task request proposes only the narrow task grant; a broader project grant is a separate, explicit choice.
    scopes: target.type === 'task' ? [{ scope: 'task', label: 'This task only' }, ...(readable && authority.ceiling !== 'viewer' ? projects.map(project => ({ scope: `project:${project.id}`, label: `Whole project: ${project.name}` })) : [])] : [{ scope: request.target_type, label: request.target_type === 'team' ? 'Team membership' : 'This project' }],
    revision: await revisionOf(db, request, target),
  }
}

export async function pendingFor(db: D1Database, actor: Actor) {
  await expireDue(db)
  const rows = await all<{ request_id: string; kind: string }>(db, `SELECT i.request_id,i.kind FROM peg_inbox i JOIN peg_access_requests r ON r.id=i.request_id WHERE i.operator_id=? AND i.kind IN ('request','fallback') AND r.status='pending' GROUP BY i.request_id ORDER BY MAX(i.created_at) DESC`, actor.id)
  const out = []
  for (const row of rows) { try { out.push(await previewRequest(db, actor, row.request_id)) } catch { /* authority since revoked: it no longer lists */ } }
  return out
}
export async function decisionNotices(db: D1Database, actor: Actor) {
  return all<{ request_id: string; created_at: number }>(db, "SELECT request_id,created_at FROM peg_inbox WHERE operator_id=? AND kind='decision' ORDER BY created_at DESC LIMIT 50", actor.id)
}

export interface Decision { decision?: unknown; level?: unknown; scope?: unknown; reason?: unknown; revision?: unknown }
export async function decideRequest(db: D1Database, actor: Actor, requestId: string, input: Decision) {
  await expireDue(db)
  const seen = await epoch(db)
  const { request, target, authority } = await standing(db, actor, requestId)
  if (request.status === 'expired') throw conflict('expired')
  if (request.status !== 'pending') throw conflict(request.status === 'stale' ? 'stale' : 'already_decided')
  if (input.decision !== 'approve' && input.decision !== 'deny') throw invalid('decision')
  const at = now(), workspaceId = workspaceOf(target)
  const requester = await operatorRow(db, request.requester_id)
  const policy = await policyRevOf(db, target)
  const audit = (action: string, detail: Record<string, unknown>) => bound(db,
    `INSERT INTO peg_audit(workspace_id,at,actor_id,action,target_type,target_id,subject_id,detail) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM peg_access_requests WHERE id=? AND status=? AND decided_by=? AND decided_at=?)`,
    [workspaceId, at, actor.id, action, request.target_type, request.target_id, request.requester_id, JSON.stringify(detail), request.id, action === 'request.approved' ? 'approved' : 'denied', actor.id, at])
  const notice = (status: string) => bound(db, `INSERT INTO peg_inbox(id,operator_id,kind,request_id,created_at) SELECT ?,?,'decision',?,? WHERE EXISTS (SELECT 1 FROM peg_access_requests WHERE id=? AND status=? AND decided_by=? AND decided_at=?)`, [newId('inb'), request.requester_id, request.id, at, request.id, status, actor.id, at])

  if (input.decision === 'deny') {
    const reason = typeof input.reason === 'string' ? input.reason.trim().slice(0, 280) : ''
    const [updated] = await batch(db, [bound(db, "UPDATE peg_access_requests SET status='denied',decided_by=?,decided_at=?,decision_reason=? WHERE id=? AND status='pending' AND expires_at>?", [actor.id, at, reason || null, request.id, at]),
      audit('request.denied', { requestId: request.id, requestedLevel: request.level, reason: reason || undefined }), notice('denied')])
    if (!updated.meta.changes) throw conflict('already_decided')
    return { status: 'denied' as const }
  }

  const level = input.level === undefined || input.level === '' ? request.level : input.level
  if (!isLevel(level)) throw invalid('level')
  if (rank(level) > rank(authority.ceiling)) throw forbidden(level === 'admin' ? 'delegate_admin' : 'delegate')
  if (input.revision !== await revisionOf(db, request, target)) throw conflict('stale_preview')
  // A request made against an older policy, or by someone no longer in the standing they asked from, is stale: it grants nothing.
  const stale = request.policy_rev !== policy || !requester || requester.status !== 'active' || requester.version !== request.requester_version
  if (stale) {
    await batch(db, [bound(db, "UPDATE peg_access_requests SET status='stale',decided_by=?,decided_at=? WHERE id=? AND status='pending'", [actor.id, at, request.id]),
      bound(db, `INSERT INTO peg_audit(workspace_id,at,actor_id,action,target_type,target_id,subject_id,detail) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM peg_access_requests WHERE id=? AND status='stale' AND decided_at=?)`,
        [workspaceId, at, actor.id, 'request.stale', request.target_type, request.target_id, request.requester_id, JSON.stringify({ requestId: request.id, requestedLevel: request.level }), request.id, at])])
    throw conflict('stale')
  }
  // Where the grant lands: the object asked for, or, for a task, its narrow task grant unless a project grant was chosen and delegable.
  let objectType: 'team' | 'project' | 'task' = request.target_type, objectId = request.target_id
  if (target.type === 'task') {
    const scope = typeof input.scope === 'string' ? input.scope : 'task'
    if (scope !== 'task') {
      const projectId = scope.startsWith('project:') ? scope.slice(8) : ''
      const project = projectId ? await loadProject(db, projectId) : null
      const homes = await first(db, 'SELECT 1 FROM peg_task_projects WHERE task_id=? AND project_id=?', target.row.id, projectId)
      if (!project || !homes || authority.via === 'fallback') throw invalid('scope')
      objectType = 'project'; objectId = projectId
    } else if (level === 'admin') throw invalid('task_level')
  }
  if (target.type !== 'task' && level === 'admin' && authority.ceiling !== 'admin') throw forbidden('delegate_admin')
  const grantId = newId('grt')
  const results = await batch(db, [
    bound(db, `UPDATE peg_access_requests SET status='approved',decided_by=?,decided_at=?,granted_level=?,grant_id=? WHERE id=? AND status='pending' AND expires_at>? AND policy_rev=?
      AND (SELECT value FROM peg_epoch WHERE id=1)=? AND (SELECT status FROM oa_operators WHERE id=?)='active' AND (SELECT version FROM oa_operators WHERE id=?)=requester_version AND (SELECT status FROM oa_operators WHERE id=?)='active'`,
      [actor.id, at, level, grantId, request.id, at, policy, seen, request.requester_id, request.requester_id, actor.id]),
    bound(db, `INSERT INTO peg_grants(id,workspace_id,object_type,object_id,grantee_type,grantee_id,level,scope,source,request_id,created_by,created_at)
      SELECT ?,?,?,?,'person',requester_id,?,'full','request',id,?,? FROM peg_access_requests WHERE id=? AND status='approved' AND grant_id=?`, [grantId, workspaceId, objectType, objectId, level, actor.id, at, request.id, grantId]),
    audit('request.approved', { requestId: request.id, requestedLevel: request.level, grantedLevel: level, grantId, grantObject: `${objectType}:${objectId}`, via: authority.via }),
    bound(db, `INSERT INTO peg_audit(workspace_id,at,actor_id,action,target_type,target_id,subject_id,detail) SELECT ?,?,?,'grant.created',?,?,?,? WHERE EXISTS (SELECT 1 FROM peg_grants WHERE id=?)`,
      [workspaceId, at, actor.id, objectType, objectId, request.requester_id, JSON.stringify({ grantId, grantee: `person:${request.requester_id}`, level, scope: 'full', source: 'request', requestId: request.id }), grantId]),
    notice('approved'),
    bound(db, 'UPDATE peg_epoch SET value=value+1 WHERE id=1 AND EXISTS (SELECT 1 FROM peg_grants WHERE id=?)', [grantId]),
  ])
  if (!results[0].meta.changes) {
    // Something moved between the check and the write: nothing was granted; the decider looks again.
    const current = await first<RequestRow>(db, 'SELECT status FROM peg_access_requests WHERE id=?', request.id) as Pick<RequestRow, 'status'> | null
    throw conflict(current?.status === 'pending' ? 'changed_try_again' : 'already_decided')
  }
  return { status: 'approved' as const, grantId, level }
}
