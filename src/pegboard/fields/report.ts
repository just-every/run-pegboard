import { all, notFound } from '../db'
import { openProject, fieldReadable } from '../workspace/projects'
import { openTask } from '../tasks/access'
import type { Actor } from '../workspace/people'
import { definitions, projectTaskIds } from './definitions'
import { taskFields } from './values'
import { tagFilter } from '../tags/tags'
export async function fieldReport(
  db: D1Database,
  actor: Actor,
  projectId: string,
  tagId?: string,
) {
  const { project, effective } = await openProject(db, actor, projectId)
  const filter = tagId
    ? new Set((await tagFilter(db, actor, tagId)).tasks.map((t) => t.id))
    : null
  const rows = []
  for (const row of await projectTaskIds(db, projectId)) {
    if (filter && !filter.has(row.task_id)) continue
    const opened = await openTask(db, actor, row.task_id).catch(() => null)
    if (!opened) continue
    rows.push({
      id: opened.task.id,
      title: opened.task.title,
      fields: await taskFields(db, actor, row.task_id, projectId),
    })
  }
  return {
    project: { id: project.id, name: project.name },
    fields: (await definitions(db, projectId))
      .filter((f) => fieldReadable(f, effective))
      .map((f) => ({
        id: f.id,
        key: f.key,
        label: f.label,
        type: f.type,
        units: f.units,
      })),
    rows,
  }
}
