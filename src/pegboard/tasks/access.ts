// Opening a task as a person: the one place an id or a reference becomes a task they may use, or "not found".
import { first, forbidden, notFound } from '../db'
import type { TaskRow } from '../model'
import { taskAccess, type TaskAccess } from '../authorization/effective'
import { loadTask } from '../authorization/grants'
import type { Capability } from '../authorization/levels'
import { resolveTaskId } from '../references/refs'
import type { Actor } from '../workspace/people'

export async function openTask(db: D1Database, actor: Actor, idOrRef: string): Promise<{ task: TaskRow; access: TaskAccess }> {
  const id = await resolveTaskId(db, idOrRef)
  const task = id ? await loadTask(db, id) : null
  if (!task) throw notFound()
  const access = await taskAccess(db, actor, task)
  if (!access.capabilities.has('read')) throw notFound()
  return { task, access }
}
export function require(access: TaskAccess, capability: Capability) {
  if (!access.capabilities.has(capability)) throw forbidden(capability)
}
export const isCollaborator = async (db: D1Database, taskId: string, operatorId: string) => !!(await first(db, 'SELECT 1 FROM peg_task_collaborators WHERE task_id=? AND operator_id=?', taskId, operatorId))
