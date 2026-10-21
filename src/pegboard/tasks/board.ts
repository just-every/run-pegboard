import {evaluate,taskFields} from '../fields/values'
import { settings, localDay, dayNumber, taskGroup, dueOrder, applyRules } from './personal'
// A project as its people see it: sections hung in order, each with the tasks they may read; plus the rollup and the export.
import { all, first, forbidden, invalid, notFound } from '../db'
import type { FieldRow, SectionRow, TaskRow } from '../model'
import { taskAccess } from '../authorization/effective'
import { rank, type Level } from '../authorization/levels'
import { currentRef } from '../references/refs'
import { fieldLibrary, fieldReadable, listSections, openProject } from '../workspace/projects'
import { displayNames, workspaceSettings, type Actor } from '../workspace/people'

interface Placed extends TaskRow { project_id: string; section_id: string | null; fields: string }
/** The tasks of a project that this person may read: private-to-guest and assignee-scoped tasks drop out here. */
async function readableTasks(db: D1Database, actor: Actor, projectId: string): Promise<Placed[]> {
  // The project's own tasks and, under each, the subtasks that hang wherever it does.
  const rows = await all<Placed>(db, `WITH RECURSIVE tree(id,project_id,section_id,fields,position) AS (
      SELECT task_id,project_id,section_id,fields,position FROM peg_task_projects WHERE project_id=?
      UNION ALL SELECT t.id,tree.project_id,tree.section_id,'{}',tree.position FROM peg_tasks t JOIN tree ON t.parent_id=tree.id)
    SELECT t.*,tree.project_id,tree.section_id,tree.fields FROM tree JOIN peg_tasks t ON t.id=tree.id ORDER BY tree.position,t.created_at`, projectId)
  const out: Placed[] = []
  for (const row of rows) if ((await taskAccess(db, actor, row)).capabilities.has('read')) out.push(row)
  return out
}

export async function board(db: D1Database, actor: Actor, projectId: string) {
  const { project, effective } = await openProject(db, actor, projectId)
  const tasks = await readableTasks(db, actor, projectId)
  const names = await displayNames(db, [project.owner_id, ...tasks.map(task => task.owner_id)])
  const subtasks = new Map<string, { done: number; total: number }>()
  for (const task of tasks) if (task.parent_id) { const n = subtasks.get(task.parent_id) ?? { done: 0, total: 0 }; n.total++; if (task.status === 'done') n.done++; subtasks.set(task.parent_id, n) }
  const sections = await listSections(db, projectId)
  const card = async (task: Placed) => ({ id: task.id, ref: await currentRef(db, task.id), title: task.title, status: task.status, kind: task.kind, parentId: task.parent_id, priority: task.priority, dueDate: task.due_date, owner: names.get(task.owner_id) ?? 'Former member', subtasks: subtasks.get(task.id) ?? null })
  const column = async (section: SectionRow | null) => ({ section: section ? { id: section.id, name: section.name, mapsTo: section.maps_to } : null, tasks: await Promise.all(tasks.filter(task => (task.section_id ?? null) === (section?.id ?? null) && !task.parent_id).map(card)) })
  const library = (await fieldLibrary(db, projectId)).filter(field => fieldReadable(field, effective))
  return {
    project: { id: project.id, name: project.name, description: project.description, owner: { id: project.owner_id, name: names.get(project.owner_id) ?? 'Former member' }, visibility: project.visibility, teamId: project.team_id, teamLevel: project.team_level, workspaceLevel: project.workspace_level, prefix: project.prefix, status: project.status, startDate: project.start_date, dueDate: project.due_date },
    level: effective.level, capabilities: [...effective.capabilities], paths: effective.paths.map(path => ({ via: path.via, level: path.level, scope: path.scope ?? 'full' })),
    fields: library.map(field => ({ id:field.id,units:field.units,config:effective.capabilities.has('manage_fields')?field.config:'{}',version:field.version, key: field.key, label: field.label, type: field.type, visibility: effective.capabilities.has('manage_fields') ? field.visibility : undefined })),
    columns: await Promise.all([...sections, ...(tasks.some(task => !task.section_id) ? [null] : [])].map(column)),
    counts: { tasks: tasks.length, done: tasks.filter(task => task.status === 'done').length },
  }
}

/** Counts and estimated effort across projects; a task hung in several of them counts once. A field aggregate is one project's, and only a readable field. */
export async function rollup(db: D1Database, actor: Actor, projectIds: string[], fieldKey?: string) {
  if (!projectIds.length || projectIds.length > 50) throw invalid('projects')
  const seen = new Map<string, Placed>(), projects: { id: string; tasks: number }[] = []
  let library: FieldRow[] = []
  for (const id of projectIds) {
    const { effective } = await openProject(db, actor, id)
    const tasks = await readableTasks(db, actor, id)
    projects.push({ id, tasks: tasks.length })
    for (const task of tasks) if (!seen.has(task.id)) seen.set(task.id, task)
    if (fieldKey) {
      if (projectIds.length !== 1) throw invalid('field_needs_one_project')
      const field = (await fieldLibrary(db, id)).find(entry => entry.key === fieldKey)
      if (!field || !fieldReadable(field, effective) || !['number','currency','formula','rollup'].includes(field.type)) throw notFound()
      library = [field]
    }
  }
  const tasks = [...seen.values()]
  const byStatus = { todo: 0, doing: 0, done: 0 }
  for (const task of tasks) byStatus[task.status]++
  const result: Record<string, unknown> = { projects, tasks: tasks.length, byStatus, estimateHours: tasks.reduce((sum, task) => sum + task.estimate_hours, 0) }
  if(fieldKey){let sum=0;const errors: {id:string;error:string}[]=[];for(const task of tasks){const r=await evaluate(db,actor,task.id,projectIds[0],fieldKey);if(r.error||typeof r.value!=='number')errors.push({id:task.id,error:r.error??'NON_NUMERIC_INPUT'});else sum+=r.value}result.field={id:library[0].id,key:fieldKey,sum:errors.length?null:sum,errors}}

  return result
}

const csvCell = (value: unknown) => {
  let text = value === null || value === undefined ? '' : String(value)
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
/** The tasks a person may read as rows: the same filters as every other door, at or above the workspace's export level. */
export async function exportRows(db: D1Database, actor: Actor, workspaceId: string, projectId?: string) {
  const settings = await workspaceSettings(db, workspaceId)
  const ids = projectId ? [projectId] : (await all<{ id: string }>(db, 'SELECT id FROM peg_projects WHERE workspace_id=? ORDER BY name', workspaceId)).map(row => row.id)
  const rows: Record<string, unknown>[] = [], seen = new Set<string>()
  let allowed = 0
  for (const id of ids) {
    const project = await first<{ id: string; name: string }>(db, 'SELECT id,name FROM peg_projects WHERE id=?', id)
    if (!project) throw notFound()
    const { effective } = await openProject(db, actor, id).catch(error => { if (projectId) throw error; return { effective: null } })
    if (!effective) continue
    if (!effective.capabilities.has('export') || rank(effective.level as Level) < rank(settings.exportMinLevel)) { if (projectId) throw forbidden('export'); continue }
    allowed++
    const library = (await fieldLibrary(db, id)).filter(field => fieldReadable(field, effective))
    const names = new Map<string, string>()
    for (const task of await readableTasks(db, actor, id)) {
      if (seen.has(task.id) && !projectId) continue
      seen.add(task.id)
      const owner = names.get(task.owner_id) ?? (await displayNames(db, [task.owner_id])).get(task.owner_id) ?? 'Former member'
      names.set(task.owner_id, owner)
      const computed=await taskFields(db,actor,task.id,id)
      rows.push({ ref: await currentRef(db, task.id), id: task.id, project: project.name, title: task.title, status: task.status, priority: task.priority, start: task.start_date, due: task.due_date, owner, estimate_hours: task.estimate_hours, ...(effective.role !== 'guest' ? { internal_notes: task.internal_notes } : {}), ...Object.fromEntries(computed.map(field => [field.label, field.error??(Array.isArray(field.value)?field.value.join('; '):field.value??'')])) })
    }
  }
  if (!projectId) {
    const personal = await all<TaskRow>(db, 'SELECT * FROM peg_tasks t WHERE workspace_id=? AND owner_id=? AND NOT EXISTS (SELECT 1 FROM peg_task_projects WHERE task_id=t.id)', workspaceId, actor.id)
    for (const task of personal) {
      const access=await taskAccess(db,actor,task)
      // A shared subtask has no placement of its own; that never makes it personal work.
      if(!access.personal||!access.capabilities.has('read'))continue
      rows.push({ ref: null, id: task.id, project: '', title: task.title, status: task.status, priority: task.priority, start: task.start_date, due: task.due_date, owner: actor.displayName, estimate_hours: task.estimate_hours })
    }
  }
  return rows
}
export function toCsv(rows: Record<string, unknown>[]) {
  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))]
  return [columns.map(csvCell).join(','), ...rows.map(row => columns.map(column => csvCell(row[column])).join(','))].join('\n') + '\n'
}

/** A person's own list: their personal tasks, and the shared tasks assigned to them that they may still read. */
export async function myTasks(db: D1Database, actor: Actor, on?: string) {
  const prefs=await settings(db,actor), day=on??localDay(Date.now(),prefs.timezone); dayNumber(day)
  const rows = await all<TaskRow>(db, `SELECT t.* FROM peg_tasks t WHERE (t.owner_id=? OR EXISTS (SELECT 1 FROM peg_task_collaborators c WHERE c.task_id=t.id AND c.operator_id=?)) AND t.status<>'done' ORDER BY COALESCE(t.due_date,'9999'), t.created_at`, actor.id, actor.id)
  const out = []
  for (const task of rows) {
    const access = await taskAccess(db, actor, task)
    if (!access.capabilities.has('read')) continue
    const projects = await all<{ id: string; name: string }>(db, 'SELECT p.id,p.name FROM peg_task_projects tp JOIN peg_projects p ON p.id=tp.project_id WHERE tp.task_id=?', task.id)
    let layout=await first<{section_id:string|null;position:number;today:number}>(db,'SELECT * FROM peg_personal_layout WHERE operator_id=? AND task_id=?',actor.id,task.id)
    const group=taskGroup(task.due_date,!!layout?.today,day,prefs.timezone)
    // A calendar preview never moves work. Only the live local day runs the person's saved rules.
    if(!on && access.personal) { await applyRules(db,actor,task,group,day);layout=await first(db,'SELECT * FROM peg_personal_layout WHERE operator_id=? AND task_id=?',actor.id,task.id) }
    out.push({ group, sectionId:layout?.section_id??null, position:layout?.position??0, today:!!layout?.today, createdAt:task.created_at, id: task.id, ref: await currentRef(db, task.id), title: task.title, status: task.status, priority: task.priority, dueDate: task.due_date, personal: access.personal, projects: projects.filter(project => access.contexts.has(project.id)) })
  }
  const groupOrder=['Overdue','Today','Upcoming','Later'], priority=['urgent','high','normal','low']
  const sectionRows=await all<{id:string;position:number}>(db,'SELECT id,position FROM peg_personal_sections WHERE operator_id=?',actor.id)
  const ranks=new Map(sectionRows.map(x=>[x.id,x.position]))
  return out.sort((a,b)=> (prefs.sort==='manual' ? (ranks.get(a.sectionId??'')??1e9)-(ranks.get(b.sectionId??'')??1e9)||a.position-b.position : groupOrder.indexOf(a.group)-groupOrder.indexOf(b.group)|| (dueOrder(a.dueDate,prefs.timezone)-dueOrder(b.dueDate,prefs.timezone)||0)||priority.indexOf(a.priority)-priority.indexOf(b.priority)) || a.createdAt-b.createdAt || a.id.localeCompare(b.id))
}
