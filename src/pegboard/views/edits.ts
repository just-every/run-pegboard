import { conflict, invalid, notFound } from '../db'
import { revision } from '../decisions/revision'
import { openTask } from '../tasks/access'
import { setSection, updateTask, type TaskPatch } from '../tasks/tasks'
import { need, openProject } from '../workspace/projects'
import type { Actor } from '../workspace/people'
import { taskRevision } from './rows'

export async function editViewTask(db: D1Database, actor: Actor, id: string, input: Record<string, any>, move = false) {
  const fence = await revision(db)
  if (typeof input.projectId !== 'string') throw invalid('project')
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
    if (!Object.keys(patch).length || Object.keys(input).some(key => !['projectId', 'revision', 'title', 'status', '_next'].includes(key))) throw invalid('view_task_edit')
    await updateTask(db, actor, task.id, patch, fence)
  }
  return { id: task.id, revision: await taskRevision(db, (await openTask(db, actor, task.id)).task) }
}
