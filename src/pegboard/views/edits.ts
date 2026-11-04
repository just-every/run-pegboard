import { conflict, invalid, notFound } from '../db'
import { revision } from '../decisions/revision'
import { openTask } from '../tasks/access'
import { setSection, updateTask, type TaskPatch } from '../tasks/tasks'
import { need, openProject } from '../workspace/projects'
import type { Actor } from '../workspace/people'
import { taskRevision } from './rows'
import { loadView, viewContext } from './store'
import { moveInput, planChange } from '../schedule/plan'
import { applyChange } from '../schedule/changes'
import { digest } from '../decisions/revision'

export async function editViewTask(db: D1Database, actor: Actor, id: string, input: Record<string, any>, move = false) {
  const fence = await revision(db)
  if (typeof input.projectId !== 'string') throw invalid('project')
  await validateViewWrite(db, actor, id, input)
  await openProject(db, actor, input.projectId)
  const { task, access } = await openTask(db, actor, id), context = access.contexts.get(input.projectId)
  if (!context) throw notFound()
  need(context, 'edit')
  if (input.revision !== await taskRevision(db, task)) throw conflict('task_revision_changed')
  if (move) {
    if (typeof input.sectionId !== 'string') throw invalid('section')
    await setSection(db, actor, task.id, input.projectId, input.sectionId, fence)
  } else {
    const patch: TaskPatch = {}
    if (input.title !== undefined) patch.title = input.title
    if (input.status !== undefined) patch.status = input.status
    if (!Object.keys(patch).length || Object.keys(input).some(key => !['projectId', 'revision', 'title', 'status', 'viewId', 'viewRevision', '_next'].includes(key))) throw invalid('view_task_edit')
    await updateTask(db, actor, task.id, patch, fence)
  }
  return { id: task.id, revision: await taskRevision(db, (await openTask(db, actor, task.id)).task) }
}

export async function validateViewWrite(db: D1Database, actor: Actor, id: string, input: Record<string, any>) {
  if (!input.viewId) return
  const saved = await loadView(db, input.viewId), context = await viewContext(db, actor, saved)
  if (Number(input.viewRevision) !== saved.revision) throw conflict('view_revision_changed')
  if (!context.projects.some(entry => entry.project.id === input.projectId)) throw notFound()
  const { access } = await openTask(db, actor, id)
  if (!access.contexts.has(input.projectId)) throw notFound()
  const source = await openTask(db, context.owner, id)
  if (!source.access.contexts.has(input.projectId)) throw notFound()
}
export async function viewDateChange(db: D1Database, actor: Actor, id: string, input: Record<string, any>, apply = false) {
  const fence = await revision(db)
  if (!input.viewId || typeof input.projectId !== 'string') throw invalid('view_context')
  await validateViewWrite(db, actor, id, input)
  const moves = moveInput(input.moves)
  if (moves.length !== 1 || moves[0].taskId !== id) throw invalid('view_task_edit')
  const { all, ...plan } = await planChange(db, actor, moves)
  // Bind the exact schedule preview to the current view selection and the authority snapshot.
  const stamp = await digest([input.viewId, input.viewRevision, input.projectId, plan.stamp, fence])
  if (!apply) return { ...plan, stamp }
  if (input.revision !== stamp) throw conflict('stale_plan')
  return applyChange(db, actor, { moves, revision: plan.stamp }, fence)
}
