// Executing a reviewed change set. A human editor's confirmation of the exact previewed set (a drag released after the
// preview, or Apply) executes every shift together, once, attributed to them, with no second sign-off. A set that reaches
// work outside the editor's grant, or that an agent proposed, waits for a person who may edit all of it. Nothing is applied
// in part, and a plan whose revision no longer matches is refused.
import { all, batch, bound, conflict, first, forbidden, invalid, newId, notFound, now } from '../db'
import { auditStatement } from '../authorization/audit'
import { taskAccess } from '../authorization/effective'
import { isAdministrator } from '../authorization/levels'
import { guarded, revision } from '../decisions/revision'
import { historyStatement } from '../tasks/history'
import { workspaceRole, type Actor } from '../workspace/people'
import type { TaskRow } from '../model'
import { moveInput, planChange, type Move, type Plan } from './plan'

interface SetRow { id: string; workspace_id: string; initiator_id: string; initiator_kind: 'human' | 'agent'; approver_id: string | null; status: 'pending' | 'applied' | 'undone' | 'rejected'; moves: string; stamp: string; created_at: number; decided_by: string | null; decided_at: number | null; undone_by: string | null; undone_at: number | null }
interface Change { task_id: string; from_start: string | null; from_due: string | null; to_start: string | null; to_due: string | null }

const execute = (db: D1Database, plan: Plan, who: string, setId: string, extra: D1PreparedStatement[], status: 'applied', proposer: { id: string; kind: 'human' | 'agent'; approver: string | null; createdAt: number } | null, workspaceId: string) => {
  const at = now(), why = new Map(plan.shifts.map(s => [s.id, s]))
  return [
    ...(proposer ? [bound(db, 'INSERT INTO peg_schedule_sets(id,workspace_id,initiator_id,initiator_kind,approver_id,status,moves,stamp,created_at,decided_by,decided_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [setId, workspaceId, proposer.id, proposer.kind, proposer.approver, status, JSON.stringify(plan.moves), plan.stamp, proposer.createdAt, who, at])] : []),
    ...plan.all.flatMap(change => [
      bound(db, 'UPDATE peg_tasks SET start_date=?,due_date=?,updated_at=? WHERE id=?', [change.to.start, change.to.due, at, change.id]),
      ...(proposer ? [bound(db, 'INSERT INTO peg_schedule_changes(set_id,task_id,from_start,from_due,to_start,to_due) VALUES (?,?,?,?,?,?)', [setId, change.id, change.start, change.due, change.to.start, change.to.due])] : []),
      historyStatement(db, change.id, null, who, 'schedule.shifted', { setId, from: { start: change.start, due: change.due }, to: change.to, cause: plan.moves.some(m => m.taskId === change.id) ? 'edited' : 'dependency', predecessor: why.get(change.id)?.reason?.predecessor ?? null }),
    ]),
    auditStatement(db, { workspaceId, actorId: who, action: 'schedule.applied', targetType: 'schedule', targetId: setId, detail: { tasks: plan.all.length, initiator: proposer?.id } }),
    ...extra,
  ]
}
const workspaceOf = async (db: D1Database, plan: Plan) => (await first<TaskRow>(db, 'SELECT * FROM peg_tasks WHERE id=?', plan.moves[0].taskId))!.workspace_id

/** Confirm a previewed change set. `revision` is the preview's own; an approver is named for a set that must wait. */
export async function applyChange(db: D1Database, actor: Actor, input: { moves: unknown; revision: unknown; approverId?: unknown }) {
  const moves = moveInput(input.moves), rev = await revision(db), plan = await planChange(db, actor, moves)
  if (typeof input.revision !== 'string' || input.revision !== plan.stamp) throw conflict('stale_plan')
  if (!plan.editable) throw forbidden('edit')
  if (plan.blocked) throw conflict(plan.blocked)
  const workspaceId = await workspaceOf(db, plan), role = await workspaceRole(db, actor.id, workspaceId), kind = role === 'agent' ? 'agent' : 'human', setId = newId('sch'), at = now()
  if (kind === 'agent' || plan.waits) {
    let approver: string | null = null
    if (input.approverId) {
      approver = String(input.approverId)
      const approverRole = await workspaceRole(db, approver, workspaceId)
      if (!approverRole || ['agent', 'guest', 'analyst'].includes(approverRole)) throw invalid('approver')
    } else if (kind === 'agent') throw invalid('approver')
    await guarded(db, rev, [
      bound(db, 'INSERT INTO peg_schedule_sets(id,workspace_id,initiator_id,initiator_kind,approver_id,status,moves,stamp,created_at) VALUES (?,?,?,?,?,?,?,?,?)', [setId, workspaceId, actor.id, kind, approver, 'pending', JSON.stringify(plan.moves), plan.stamp, at]),
      ...plan.all.map(change => bound(db, 'INSERT INTO peg_schedule_changes(set_id,task_id,from_start,from_due,to_start,to_due) VALUES (?,?,?,?,?,?)', [setId, change.id, change.start, change.due, change.to.start, change.to.due])),
      auditStatement(db, { workspaceId, actorId: actor.id, action: 'schedule.proposed', targetType: 'schedule', targetId: setId, detail: { kind, approver } }),
    ])
    return { id: setId, status: 'pending' as const, approverId: approver, shifts: plan.shifts.length }
  }
  await guarded(db, rev, execute(db, plan, actor.id, setId, [], 'applied', { id: actor.id, kind: 'human', approver: null, createdAt: at }, workspaceId))
  return { id: setId, status: 'applied' as const, shifts: plan.all.length }
}

const load = async (db: D1Database, id: string) => { const row = await first<SetRow>(db, 'SELECT * FROM peg_schedule_sets WHERE id=?', id); if (!row) throw notFound(); return row }
/** A pending set is open to its named approver, or with none named to anyone who may edit all of it; never to an agent. */
async function approvalPlan(db: D1Database, actor: Actor, set: SetRow) {
  if (set.approver_id && set.approver_id !== actor.id) throw notFound()
  if (await workspaceRole(db, actor.id, set.workspace_id) === 'agent') throw forbidden('human_approver')
  const plan = await planChange(db, actor, JSON.parse(set.moves) as Move[]).catch(error => { if (error?.status === 404) throw notFound(); throw error })
  return plan
}
export async function pendingChange(db: D1Database, actor: Actor, id: string) {
  const set = await load(db, id)
  if (set.status !== 'pending') throw conflict('not_pending')
  const plan = await approvalPlan(db, actor, set)
  return { id: set.id, initiator: set.initiator_id, initiatorKind: set.initiator_kind, approverId: set.approver_id, revision: set.stamp, current: plan.stamp, stale: plan.stamp !== set.stamp, shifts: plan.shifts, canApprove: plan.editable && !plan.waits && !plan.blocked && plan.stamp === set.stamp }
}
export async function approveChange(db: D1Database, actor: Actor, id: string, input: { revision: unknown }) {
  const set = await load(db, id), rev = await revision(db)
  if (set.status !== 'pending') throw conflict('not_pending')
  const plan = await approvalPlan(db, actor, set)
  if (plan.stamp !== set.stamp || input.revision !== set.stamp) throw conflict('stale_plan')
  if (!plan.editable || plan.waits) throw forbidden('edit')
  if (plan.blocked) throw conflict(plan.blocked)
  const at = now()
  await guarded(db, rev, [...execute(db, plan, actor.id, set.id, [], 'applied', null, set.workspace_id), bound(db, "UPDATE peg_schedule_sets SET status='applied',decided_by=?,decided_at=? WHERE id=? AND status='pending'", [actor.id, at, set.id])])
  return { id: set.id, status: 'applied' as const, shifts: plan.all.length }
}
export async function rejectChange(db: D1Database, actor: Actor, id: string) {
  const set = await load(db, id)
  if (set.status !== 'pending') throw conflict('not_pending')
  if (set.initiator_id !== actor.id && set.approver_id !== actor.id && !(set.approver_id === null && isAdministrator(await workspaceRole(db, actor.id, set.workspace_id)))) throw notFound()
  await batch(db, [bound(db, "UPDATE peg_schedule_sets SET status='rejected',decided_by=?,decided_at=? WHERE id=? AND status='pending'", [actor.id, now(), id]), auditStatement(db, { workspaceId: set.workspace_id, actorId: actor.id, action: 'schedule.rejected', targetType: 'schedule', targetId: id })])
  return { id, status: 'rejected' as const }
}
/** The sets a person may decide: named to them, or open to any full editor, and still pending. */
export async function pendingSets(db: D1Database, actor: Actor, workspaceId: string) {
  const out = []
  for (const set of await all<SetRow>(db, "SELECT * FROM peg_schedule_sets WHERE workspace_id=? AND status='pending' ORDER BY created_at", workspaceId)) {
    if (set.approver_id && set.approver_id !== actor.id) continue
    try { const view = await pendingChange(db, actor, set.id); if (view.shifts.length) out.push(view) } catch { /* not theirs to decide */ }
  }
  return out
}

/** Undo restores the dates the set replaced, by the person who confirmed it or an administrator, only while every task is as the set left it. */
export async function undoChange(db: D1Database, actor: Actor, id: string) {
  const set = await load(db, id), rev = await revision(db)
  if (set.status !== 'applied') throw conflict('not_undoable')
  if (set.decided_by !== actor.id && !isAdministrator(await workspaceRole(db, actor.id, set.workspace_id))) throw notFound()
  const changes = await all<Change>(db, 'SELECT * FROM peg_schedule_changes WHERE set_id=?', id), at = now()
  for (const change of changes) {
    const task = await first<TaskRow>(db, 'SELECT * FROM peg_tasks WHERE id=?', change.task_id)
    if (!task || task.start_date !== change.to_start || task.due_date !== change.to_due) throw conflict('undo_conflict')
    const access = await taskAccess(db, actor, task)
    if (!access.capabilities.has('edit')) throw forbidden('edit')
  }
  await guarded(db, rev, [
    ...changes.flatMap(change => [bound(db, 'UPDATE peg_tasks SET start_date=?,due_date=?,updated_at=? WHERE id=?', [change.from_start, change.from_due, at, change.task_id]), historyStatement(db, change.task_id, null, actor.id, 'schedule.undone', { setId: id, restored: { start: change.from_start, due: change.from_due } })]),
    bound(db, "UPDATE peg_schedule_sets SET status='undone',undone_by=?,undone_at=? WHERE id=? AND status='applied'", [actor.id, at, id]),
    auditStatement(db, { workspaceId: set.workspace_id, actorId: actor.id, action: 'schedule.undone', targetType: 'schedule', targetId: id }),
  ])
  return { id, status: 'undone' as const }
}
