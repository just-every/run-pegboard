import {bundleQueueStatements} from '../bundles/queue'
import {setValues} from '../fields/values'
// Tasks: one record each, hung in any number of projects, with one history and one reference.
import { all, batch, bound, conflict, first, forbidden, invalid, newId, notFound, now, type Param } from '../db'
import type { FieldRow, ProjectRow, SectionRow, TaskProjectRow, TaskRow } from '../model'
import { auditStatement } from '../authorization/audit'
import { projectEffective, type Effective } from '../authorization/effective'
import { rank } from '../authorization/levels'
import { loadProject } from '../authorization/grants'
import { issueRef, setPrefix } from '../references/refs'
import { fieldReadable, need, openProject } from '../workspace/projects'
import { displayNames, workspaceRole, type Actor } from '../workspace/people'
import { openTask, require } from './access'
import { historyStatement, reopenGuard } from './history'

const statuses = ['todo', 'doing', 'done'], priorities = ['low', 'normal', 'high', 'urgent'], kinds = ['task', 'subtask', 'milestone', 'approval']
const title = (value: unknown) => { if (typeof value !== 'string' || !value.trim() || value.length > 300) throw invalid('title'); return value.trim() }
const date = (value: unknown, code: string) => { if (value === null || value === undefined || value === '') return null; if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value.length===10?value+'T00:00:00Z':value).toISOString().slice(0,10)!==value.slice(0,10)) throw invalid(code); return value }
const hours = (value: unknown) => { const n = Number(value ?? 0); if (!Number.isFinite(n) || n < 0 || n > 100000) throw invalid('estimate_hours'); return n }

export interface TaskInput { title: string; description?: string; workspaceId?: string; projectId?: string; sectionId?: string; parentId?: string; kind?: string; ownerId?: string; status?: string; priority?: string; startDate?: string | null; dueDate?: string | null; estimateHours?: number; internalOnly?: boolean; internalNotes?: string }

async function sectionFor(db: D1Database, projectId: string, sectionId?: string | null): Promise<SectionRow | null> {
  if (sectionId) {
    const section = await first<SectionRow>(db, 'SELECT * FROM peg_sections WHERE id=? AND project_id=?', sectionId, projectId)
    if (!section) throw invalid('section')
    return section
  }
  return first<SectionRow>(db, 'SELECT * FROM peg_sections WHERE project_id=? ORDER BY position LIMIT 1', projectId)
}
const nextPosition = async (db: D1Database, projectId: string, sectionId: string | null) => (await first<{ n: number }>(db, 'SELECT COALESCE(MAX(position),0)+1 n FROM peg_task_projects WHERE project_id=? AND COALESCE(section_id,\'\')=COALESCE(?,\'\')', projectId, sectionId))!.n

export async function prepareTask(db: D1Database, actor: Actor, input: TaskInput) {
  const kind = input.kind ?? (input.parentId ? 'subtask' : 'task')
  if (!kinds.includes(kind)) throw invalid('kind')
  let projectId = input.projectId ?? null, workspaceId = input.workspaceId ?? 'ws_main', parent: TaskRow | null = null
  if (input.parentId) {
    const opened = await openTask(db, actor, input.parentId)
    require(opened.access, 'edit')
    parent = opened.task; workspaceId = parent.workspace_id
    if (!opened.access.personal && !projectId) projectId = [...opened.access.contexts].find(([, effective]) => effective.capabilities.has('edit'))?.[0] ?? null
    if (opened.access.personal && projectId) throw conflict('personal_task')
    if (!opened.access.personal && !projectId) throw forbidden('edit')
  }
  const id = newId('tsk'), at = now(), statements: D1PreparedStatement[] = []
  let status = input.status ?? 'todo'
  if (!statuses.includes(status) || !priorities.includes(input.priority ?? 'normal')) throw invalid('status')
  let owner = actor.id
  if (projectId) {
    const { project, effective } = await openProject(db, actor, projectId)
    need(effective, 'edit')
    workspaceId = project.workspace_id
    if (input.ownerId && input.ownerId !== actor.id) { if (!(await workspaceRole(db, input.ownerId, workspaceId))) throw invalid('owner'); owner = input.ownerId }
    const section = await sectionFor(db, projectId, parent ? null : input.sectionId)
    if (section?.maps_to && !input.status && !parent) status = section.maps_to
    const ref = await issueRef(db, project, id)
    // A subtask hangs wherever its parent does; only a root task is placed in a section of its own.
    if (!parent) statements.push(bound(db, 'INSERT INTO peg_task_projects(task_id,project_id,section_id,position,added_by,added_at) VALUES (?,?,?,?,?,?)', [id, projectId, section?.id ?? null, await nextPosition(db, projectId, section?.id ?? null), actor.id, at]))
    if (ref) statements.push(...ref.statements)
  } else {
    const role = await workspaceRole(db, actor.id, workspaceId)
    if (!role || role === 'agent') throw notFound()
    if (input.ownerId && input.ownerId !== actor.id) throw conflict('personal_task_owner')
  }
  if (kind === 'approval') {
    if (status === 'done') throw invalid('approval_decision_required')
    statements.push(bound(db,'INSERT INTO peg_approval_tasks VALUES(?,?,?)',[id,actor.id,at]))
  }
  statements.unshift(bound(db, `INSERT INTO peg_tasks(id,workspace_id,title,description,kind,parent_id,status,priority,start_date,due_date,owner_id,creator_id,estimate_hours,internal_only,internal_notes,created_at,updated_at,completed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, workspaceId, title(input.title), (input.description ?? '').slice(0, 20000), kind === 'approval' ? 'task' : kind, parent?.id ?? null, status, input.priority ?? 'normal', date(input.startDate, 'start_date'), date(input.dueDate, 'due_date'), owner, actor.id, hours(input.estimateHours), input.internalOnly ? 1 : 0, (input.internalNotes ?? '').slice(0, 20000), at, at, status === 'done' ? at : null]))
  statements.push(historyStatement(db, id, null, actor.id, 'created', { kind, parentId: parent?.id ?? null }),...await bundleQueueStatements(db,projectId,id))
  return { id, statements }
}

export async function createTask(db: D1Database, actor: Actor, input: TaskInput): Promise<TaskRow> {
  const {id,statements}=await prepareTask(db,actor,input)
  await batch(db,statements)
  return (await first<TaskRow>(db,'SELECT * FROM peg_tasks WHERE id=?',id))!
}

export interface TaskPatch { title?: string; description?: string; status?: string; priority?: string; startDate?: string | null; dueDate?: string | null; ownerId?: string; estimateHours?: number; internalOnly?: boolean; internalNotes?: string; collaborators?: string[] }
export async function updateTask(db: D1Database, actor: Actor, idOrRef: string, patch: TaskPatch): Promise<TaskRow> {
  const { task, access } = await openTask(db, actor, idOrRef)
  require(access, 'edit')
  const approval = await first(db,'SELECT 1 FROM peg_approval_tasks WHERE task_id=?',task.id)
  if(approval && patch.status === 'done') throw conflict('approval_decision_required')
  const next = { ...task }, changes: Record<string, { from: unknown; to: unknown }> = {}
  const set = <K extends keyof TaskRow>(key: K, value: TaskRow[K]) => { if (next[key] !== value) { changes[key] = { from: next[key], to: value }; next[key] = value } }
  if (patch.title !== undefined) set('title', title(patch.title))
  if (patch.description !== undefined) set('description', String(patch.description).slice(0, 20000))
  if (patch.status !== undefined) { if (!statuses.includes(patch.status)) throw invalid('status'); set('status', patch.status as TaskRow['status']) }
  if (patch.priority !== undefined) { if (!priorities.includes(patch.priority)) throw invalid('priority'); set('priority', patch.priority as TaskRow['priority']) }
  if (patch.startDate !== undefined) set('start_date', date(patch.startDate, 'start_date'))
  if (patch.dueDate !== undefined) set('due_date', date(patch.dueDate, 'due_date'))
  if (patch.estimateHours !== undefined) set('estimate_hours', hours(patch.estimateHours))
  if (patch.ownerId !== undefined) {
    if (access.personal ? patch.ownerId !== actor.id : !(await workspaceRole(db, patch.ownerId, task.workspace_id))) throw invalid('owner')
    set('owner_id', patch.ownerId)
  }
  if (patch.internalOnly !== undefined || patch.internalNotes !== undefined) {
    if (access.role === 'guest') throw forbidden('internal')
    if (patch.internalOnly !== undefined) set('internal_only', patch.internalOnly ? 1 : 0)
    if (patch.internalNotes !== undefined) set('internal_notes', String(patch.internalNotes).slice(0, 20000))
  }
  if (patch.collaborators?.length && access.personal) throw conflict('visibility_preview_required')
  if (patch.collaborators) for (const id of patch.collaborators) if (!(await workspaceRole(db, id, task.workspace_id))) throw invalid('collaborator')
  if (approval && Object.keys(changes).length && task.status === 'done') set('status','todo')
  const at = now(), statements: D1PreparedStatement[] = []
  if (next.status !== task.status) next.completed_at = next.status === 'done' ? at : null
  if (Object.keys(changes).length) {
    statements.push(reopenGuard(db,task.id,actor.id,'task_edit'),bound(db, 'UPDATE peg_tasks SET title=?,description=?,status=?,priority=?,start_date=?,due_date=?,owner_id=?,estimate_hours=?,internal_only=?,internal_notes=?,completed_at=?,updated_at=? WHERE id=?',
      [next.title, next.description, next.status, next.priority, next.start_date, next.due_date, next.owner_id, next.estimate_hours, next.internal_only, next.internal_notes, next.completed_at, at, task.id]))
    const shown = Object.fromEntries(Object.entries(changes).filter(([key]) => key !== 'internal_notes' && key !== 'internal_only'))
    const hidden = Object.keys(changes).some(key => key === 'internal_notes' || key === 'internal_only')
    if (Object.keys(shown).length) statements.push(historyStatement(db, task.id, null, actor.id, next.status !== task.status && Object.keys(shown).length === 1 ? 'status.changed' : 'updated', shown))
    if (hidden) statements.push(historyStatement(db, task.id, null, actor.id, 'internal.changed', {}))
  }
  if (patch.collaborators) statements.push(reopenGuard(db,task.id,actor.id,'collaborators',patch.collaborators.length?'1':'EXISTS(SELECT 1 FROM peg_task_collaborators WHERE task_id=t.id)'),bound(db, 'DELETE FROM peg_task_collaborators WHERE task_id=?', [task.id]), ...[...new Set(patch.collaborators)].map(id => bound(db, 'INSERT INTO peg_task_collaborators(task_id,operator_id) VALUES (?,?)', [task.id, id])), historyStatement(db, task.id, null, actor.id, 'collaborators.changed', { count: new Set(patch.collaborators).size }))
  if (statements.length) await batch(db, statements)
  return (await first<TaskRow>(db, 'SELECT * FROM peg_tasks WHERE id=?', task.id))!
}

/** Hang the task in another project. Edit rights on the task and on that project are both needed. */
export async function addToProject(db: D1Database, actor: Actor, idOrRef: string, input: { projectId: string; sectionId?: string }) {
  const { task, access } = await openTask(db, actor, idOrRef)
  require(access, 'edit')
  if (access.personal) throw conflict('personal_task')
  if (task.parent_id) throw conflict('subtask_follows_parent')
  const { project, effective } = await openProject(db, actor, input.projectId)
  need(effective, 'edit')
  if (project.workspace_id !== task.workspace_id) throw invalid('project')
  if (await first(db, 'SELECT 1 FROM peg_task_projects WHERE task_id=? AND project_id=?', task.id, project.id)) throw conflict('already_in_project')
  const section = await sectionFor(db, project.id, input.sectionId)
  await batch(db, [
    reopenGuard(db,task.id,actor.id,'project_membership'),
    bound(db, 'INSERT INTO peg_task_projects(task_id,project_id,section_id,position,added_by,added_at) VALUES (?,?,?,?,?,?)', [task.id, project.id, section?.id ?? null, await nextPosition(db, project.id, section?.id ?? null), actor.id, now()]),
    historyStatement(db, task.id, project.id, actor.id, 'project.added', { section: section?.name ?? null }),
  ])
  return { taskId: task.id, projectId: project.id }
}

/** Take the task out of one project and into another: the same record, its history and reference unchanged. */
export async function moveToProject(db: D1Database, actor: Actor, idOrRef: string, input: { from: string; to: string; sectionId?: string }) {
  const { task, access } = await openTask(db, actor, idOrRef)
  if (access.personal) throw conflict('personal_task')
  if (task.parent_id) throw conflict('subtask_follows_parent')
  const origin = access.contexts.get(input.from)
  if (!origin) throw notFound()
  need(origin, 'edit')
  const { project, effective } = await openProject(db, actor, input.to)
  need(effective, 'edit')
  if (input.from === input.to || await first(db, 'SELECT 1 FROM peg_task_projects WHERE task_id=? AND project_id=?', task.id, project.id)) throw conflict('already_in_project')
  const section = await sectionFor(db, project.id, input.sectionId)
  await batch(db, [
    reopenGuard(db,task.id,actor.id,'project_membership'),
    bound(db, 'DELETE FROM peg_task_projects WHERE task_id=? AND project_id=?', [task.id, input.from]),
    bound(db, 'INSERT INTO peg_task_projects(task_id,project_id,section_id,position,added_by,added_at) VALUES (?,?,?,?,?,?)', [task.id, project.id, section?.id ?? null, await nextPosition(db, project.id, section?.id ?? null), actor.id, now()]),
    historyStatement(db, task.id, input.from, actor.id, 'project.removed', { moved: true }),
    historyStatement(db, task.id, project.id, actor.id, 'project.added', { section: section?.name ?? null, movedFrom: input.from }),
  ])
  return { taskId: task.id, projectId: project.id }
}

export async function removeFromProject(db: D1Database, actor: Actor, idOrRef: string, projectId: string) {
  const { task, access } = await openTask(db, actor, idOrRef)
  const context = access.contexts.get(projectId)
  if (!context) throw notFound()
  need(context, 'edit')
  if (task.parent_id) throw conflict('subtask_follows_parent')
  if (access.contexts.size + 0 < 1 || (await first<{ n: number }>(db, 'SELECT COUNT(*) n FROM peg_task_projects WHERE task_id=?', task.id))!.n < 2) throw conflict('last_project')
  await batch(db, [reopenGuard(db,task.id,actor.id,'project_membership'),bound(db, 'DELETE FROM peg_task_projects WHERE task_id=? AND project_id=?', [task.id, projectId]), historyStatement(db, task.id, projectId, actor.id, 'project.removed', {})])
}

/** Move within a project: the section decides the one shared status when it maps to one. */
export async function setSection(db: D1Database, actor: Actor, idOrRef: string, projectId: string, sectionId: string) {
  const { task, access } = await openTask(db, actor, idOrRef)
  const context = access.contexts.get(projectId)
  if (!context) throw notFound()
  need(context, 'edit')
  if (task.parent_id) throw conflict('subtask_follows_parent')
  const section = await sectionFor(db, projectId, sectionId)
  const statements = [reopenGuard(db,task.id,actor.id,'project_membership'),bound(db, 'UPDATE peg_task_projects SET section_id=?,position=? WHERE task_id=? AND project_id=?', [section!.id, await nextPosition(db, projectId, section!.id), task.id, projectId]),
    historyStatement(db, task.id, projectId, actor.id, 'section.changed', { section: section!.name })]
  if (section!.maps_to && section!.maps_to !== task.status) statements.push(
    bound(db, 'UPDATE peg_tasks SET status=?,completed_at=?,updated_at=? WHERE id=?', [section!.maps_to, section!.maps_to === 'done' ? now() : null, now(), task.id]),
    historyStatement(db, task.id, null, actor.id, 'status.changed', { status: { from: task.status, to: section!.maps_to }, via: 'section' }))
  await batch(db, statements)
}

/** A project's own values on a task. Each field names who may read and who may write it. */
export const setProjectFields=setValues

export async function changePrefix(db: D1Database, actor: Actor, projectId: string, value: unknown) {
  const { project, effective } = await openProject(db, actor, projectId)
  need(effective, 'manage_settings')
  const { prefix, statements } = await setPrefix(db, project, value)
  await batch(db, [...statements, auditStatement(db, { workspaceId: project.workspace_id, actorId: actor.id, action: 'project.prefix_changed', targetType: 'project', targetId: project.id, detail: { from: project.prefix, to: prefix } })])
  return prefix
}
