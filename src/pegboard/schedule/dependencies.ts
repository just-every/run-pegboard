// Dependency links between tasks, in any project of the workspace. Adding one needs edit rights on the dependant and the
// right to read the predecessor; a cycle is refused whole, and the refusal never names a task the person cannot read.
import { all, batch, bound, conflict, first, invalid, newId, now } from '../db'
import { auditStatement } from '../authorization/audit'
import { historyStatement } from '../tasks/history'
import { openTask, require } from '../tasks/access'
import { currentRef } from '../references/refs'
import type { Actor } from '../workspace/people'
import { cycleThrough, dependencyTypes, type DependencyType, type Edge } from './graph'

interface Row { id: string; workspace_id: string; predecessor_id: string; successor_id: string; type: DependencyType; lag_days: number; created_by: string; created_at: number }
export const toEdge = (row: Row): Edge => ({ id: row.id, predecessor: row.predecessor_id, successor: row.successor_id, type: row.type, lag: row.lag_days })
export const edgesAmong = async (db: D1Database, workspaceId: string, ids: string[]): Promise<Edge[]> => {
  if (!ids.length) return []
  const marks = ids.map(() => '?').join(',')
  return (await all<Row>(db, `SELECT * FROM peg_dependencies WHERE workspace_id=? AND predecessor_id IN (${marks}) AND successor_id IN (${marks})`, workspaceId, ...ids, ...ids)).map(toEdge)
}

export async function addDependency(db: D1Database, actor: Actor, input: { predecessor: string; successor: string; type?: string; lag?: number }) {
  const type = (input.type ?? 'fs') as DependencyType
  if (!dependencyTypes.includes(type)) throw invalid('dependency_type')
  const lag = Number(input.lag ?? 0)
  if (!Number.isInteger(lag) || Math.abs(lag) > 365) throw invalid('lag')
  const successor = await openTask(db, actor, input.successor), predecessor = await openTask(db, actor, input.predecessor)
  require(successor.access, 'edit')
  if (successor.task.id === predecessor.task.id) throw invalid('dependency_self')
  if (successor.task.workspace_id !== predecessor.task.workspace_id || successor.access.personal || predecessor.access.personal) throw invalid('dependency_task')
  const workspaceId = successor.task.workspace_id
  if (await first(db, 'SELECT 1 FROM peg_dependencies WHERE predecessor_id=? AND successor_id=?', predecessor.task.id, successor.task.id)) throw conflict('dependency_exists')
  const every = (await all<Row>(db, 'SELECT * FROM peg_dependencies WHERE workspace_id=?', workspaceId)).map(toEdge)
  if (cycleThrough(every, { predecessor: predecessor.task.id, successor: successor.task.id })) throw conflict('dependency_cycle')
  const id = newId('dep'), at = now()
  await batch(db, [
    bound(db, 'INSERT INTO peg_dependencies(id,workspace_id,predecessor_id,successor_id,type,lag_days,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)', [id, workspaceId, predecessor.task.id, successor.task.id, type, lag, actor.id, at]),
    historyStatement(db, successor.task.id, null, actor.id, 'dependency.added', { predecessor: predecessor.task.id, type, lag }),
    auditStatement(db, { workspaceId, actorId: actor.id, action: 'dependency.added', targetType: 'task', targetId: successor.task.id, detail: { predecessor: predecessor.task.id, type, lag } }),
  ])
  return { id, predecessor: predecessor.task.id, successor: successor.task.id, type, lag }
}

export async function removeDependency(db: D1Database, actor: Actor, id: string) {
  const row = await first<Row>(db, 'SELECT * FROM peg_dependencies WHERE id=?', id)
  if (!row) throw conflict('dependency_missing')
  const successor = await openTask(db, actor, row.successor_id)
  require(successor.access, 'edit')
  await batch(db, [
    bound(db, 'DELETE FROM peg_dependencies WHERE id=?', [id]),
    historyStatement(db, row.successor_id, null, actor.id, 'dependency.removed', { predecessor: row.predecessor_id, type: row.type }),
    auditStatement(db, { workspaceId: row.workspace_id, actorId: actor.id, action: 'dependency.removed', targetType: 'task', targetId: row.successor_id, detail: { predecessor: row.predecessor_id } }),
  ])
  return { id }
}

/** The links of one task that the person may read at both ends. */
export async function dependenciesOf(db: D1Database, actor: Actor, taskId: string) {
  const { task } = await openTask(db, actor, taskId)
  const rows = await all<Row>(db, 'SELECT * FROM peg_dependencies WHERE predecessor_id=? OR successor_id=?', task.id, task.id), out = []
  for (const row of rows) {
    const other = row.predecessor_id === task.id ? row.successor_id : row.predecessor_id
    const opened = await openTask(db, actor, other).catch(() => null)
    if (!opened) continue
    out.push({ id: row.id, direction: row.predecessor_id === task.id ? 'successor' : 'predecessor', type: row.type, lag: row.lag_days, task: { id: opened.task.id, ref: await currentRef(db, opened.task.id), title: opened.task.title, status: opened.task.status, start: opened.task.start_date, due: opened.task.due_date } })
  }
  return out
}
