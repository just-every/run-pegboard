import { all, conflict, forbidden, notFound } from '../db'
import type { TaskProjectRow, TaskRow } from '../model'
import { taskAccess } from '../authorization/effective'
import { openTask, require } from '../tasks/access'
import { need, openProject } from '../workspace/projects'
import { workspaceRole, type Actor } from '../workspace/people'

export interface HierarchyInput { kind: 'promote' | 'demote'; sourceId: string; targetProjectId?: string; parentId?: string; token?: string }

// Walk the actual chain, rather than relying on rootOf's bounded read traversal.
export function ancestry(tasks: Map<string, TaskRow>, id: string): TaskRow[] {
  const chain: TaskRow[] = [], seen = new Set<string>()
  let current: string | null = id
  while (current) {
    if (seen.has(current)) throw conflict('conversion_hierarchy_cycle')
    seen.add(current)
    const row = tasks.get(current)
    if (!row) throw conflict('conversion_parent_unavailable')
    chain.push(row)
    if (chain.length > 50) throw conflict('conversion_hierarchy_depth')
    current = row.parent_id
  }
  return chain
}

export function descendants(tasks: Map<string, TaskRow>, id: string): TaskRow[] {
  const children = new Map<string, TaskRow[]>()
  for (const row of tasks.values()) if (row.parent_id) children.set(row.parent_id, [...(children.get(row.parent_id) ?? []), row])
  const result: TaskRow[] = [], seen = new Set<string>(), pending = [id]
  while (pending.length) {
    const next = pending.pop()!
    if (seen.has(next)) throw conflict('conversion_hierarchy_cycle')
    seen.add(next)
    const row = tasks.get(next)
    if (!row) throw conflict('conversion_parent_unavailable')
    ancestry(tasks, row.id)
    result.push(row)
    pending.push(...(children.get(next) ?? []).map(row => row.id))
  }
  return result.sort((a, b) => a.id.localeCompare(b.id))
}

export async function hierarchyGraph(db: D1Database, actor: Actor, workspace: string, input: HierarchyInput) {
  const opened = await openTask(db, actor, input.sourceId)
  require(opened.access, 'edit')
  if (opened.task.workspace_id !== workspace) throw notFound()
  if (await workspaceRole(db, actor.id, workspace) === 'agent') throw forbidden('human_conversion_review')
  const tasks = new Map((await all<TaskRow>(db, 'SELECT * FROM peg_tasks WHERE workspace_id=? ORDER BY id', workspace)).map(row => [row.id, row]))
  const source = opened.task, oldChain = ancestry(tasks, source.id), work = descendants(tasks, source.id)
  let parent: TaskRow | null = null, nextChain: TaskRow[] = []
  if (input.kind === 'promote') {
    if (!source.parent_id) throw conflict('conversion_subtask_required')
    if (input.parentId) throw conflict('conversion_parent_unexpected')
  } else {
    if (source.parent_id) throw conflict('conversion_root_task_required')
    if (!input.parentId) throw conflict('conversion_parent_required')
    const target = await openTask(db, actor, input.parentId)
    require(target.access, 'edit')
    if (target.task.workspace_id !== workspace) throw notFound()
    parent = target.task
    nextChain = ancestry(tasks, parent.id)
    if (work.some(row => row.id === parent!.id)) throw conflict('conversion_hierarchy_cycle')
    if (input.targetProjectId) throw conflict('conversion_project_unexpected')
  }
  const proposed = new Map(tasks)
  proposed.set(source.id, { ...source, parent_id: parent?.id ?? null, kind: input.kind === 'demote' ? 'subtask' : 'task' })
  for (const row of work) ancestry(proposed, row.id)
  const beforeHomes = await all<TaskProjectRow>(db, 'SELECT * FROM peg_task_projects WHERE task_id=? ORDER BY project_id', oldChain.at(-1)!.id)
  const afterHomes = input.kind === 'promote' ? [...beforeHomes] : await all<TaskProjectRow>(db, 'SELECT * FROM peg_task_projects WHERE task_id=? ORDER BY project_id', nextChain.at(-1)!.id)
  if (input.targetProjectId && !afterHomes.some(row => row.project_id === input.targetProjectId)) {
    const { project, effective } = await openProject(db, actor, input.targetProjectId)
    need(effective, 'edit')
    if (project.workspace_id !== workspace) throw notFound()
    // Placement values are assigned at execution; the preview describes the exact home.
    afterHomes.push({ task_id: source.id, project_id: project.id, section_id: null, fields: '{}', position: 0, added_by: actor.id, added_at: 0 })
  }
  afterHomes.sort((a, b) => a.project_id.localeCompare(b.project_id))
  const affected = new Map([...work, ...oldChain, ...nextChain].map(row => [row.id, row]))
  if (parent) for (const row of descendants(tasks, nextChain.at(-1)!.id)) affected.set(row.id, row)
  // Native scope follows the root. Every affected record and every original home must remain editable.
  for (const row of affected.values()) {
    const access = await taskAccess(db, actor, row)
    if (!access.capabilities.has('read')) throw forbidden('conversion_affected_scope')
    require(access, 'edit')
    const root = ancestry(tasks, row.id).at(-1)!
    for (const home of await all<TaskProjectRow>(db, 'SELECT * FROM peg_task_projects WHERE task_id=?', root.id)) {
      const { effective } = await openProject(db, actor, home.project_id)
      need(effective, 'edit')
    }
  }
  for (const home of afterHomes) need((await openProject(db, actor, home.project_id)).effective, 'edit')
  return { source, parent, work, affected: [...affected.values()].sort((a, b) => a.id.localeCompare(b.id)), oldChain, nextChain, beforeHomes, afterHomes }
}

export type HierarchyGraph = Awaited<ReturnType<typeof hierarchyGraph>>
