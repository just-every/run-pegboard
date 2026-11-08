import { all } from '../db'
import { digest } from '../decisions/revision'
import { rootOf, taskAccess } from '../authorization/effective'
import { evaluate } from '../fields/values'
import type { FieldRow, SectionRow, TaskRow } from '../model'
import { readableTasks, type Placed } from '../tasks/board'
import { displayNames, type Actor } from '../workspace/people'
import { dayString, readStamp } from '../schedule/calendar'
import type { ViewConfig } from './config'

/** Placements and custom values can change without touching updated_at. */
export async function taskRevision(db: D1Database, task: TaskRow) {
  const [homes, values] = await Promise.all([
    all(db, 'SELECT project_id,section_id,fields,position FROM peg_task_projects WHERE task_id=? ORDER BY project_id', (await rootOf(db, task)).id),
    all(db, 'SELECT field_id,value FROM peg_field_values WHERE task_id=? ORDER BY field_id', task.id),
  ])
  return digest([task.id, task.updated_at, task.title, task.status, task.owner_id, task.priority, task.start_date, task.due_date,
    task.estimate_hours, task.description, task.internal_only, task.internal_notes, homes, values])
}
export async function scopedTasks(db: D1Database, actor: Actor, owner: Actor, projectId: string) {
  const seen = new Set<string>(), result: Placed[] = []
  for (const task of await readableTasks(db, actor, projectId)) {
    if (seen.has(task.id)) continue
    seen.add(task.id)
    if (!(await taskAccess(db, actor, task)).contexts.has(projectId)) continue
    if (actor.id !== owner.id && !(await taskAccess(db, owner, task)).contexts.has(projectId)) continue
    result.push(task)
  }
  return result
}
export function filteredTasks(tasks: Placed[], config: ViewConfig, zone: string) {
  return tasks.filter(task => {
    const filter = config.filters, due = task.due_date ? dayString(readStamp(task.due_date, zone).day) : null
    return (!filter.status.length || filter.status.includes(task.status)) && (!filter.ownerIds.length || filter.ownerIds.includes(task.owner_id))
      && (!filter.dueFrom || due !== null && due >= filter.dueFrom) && (!filter.dueTo || due !== null && due <= filter.dueTo)
  })
}
export async function canonicalRows(db: D1Database, actor: Actor, owner: Actor, projectId: string, tasks: Placed[], fields: FieldRow[], sections: SectionRow[]) {
  const names = await displayNames(db, tasks.map(task => task.owner_id)), sectionById = new Map(sections.map(section => [section.id, section]))
  const rows = []
  for (const task of tasks) {
    const context = (await taskAccess(db, actor, task)).contexts.get(projectId)
    const section = task.section_id ? sectionById.get(task.section_id) : undefined
    const values = []
    for (const field of fields) {
      const result = await evaluate(db, actor, task.id, projectId, field.key)
      const source = actor.id === owner.id ? result : await evaluate(db, owner, task.id, projectId, field.key)
      const safe = source.error ? { value: null, error: 'INPUT_UNAVAILABLE' } : result
      values.push({ id: field.id, key: field.key, label: field.label, type: field.type, units: field.units, ...safe })
    }
    rows.push({ id: task.id, title: task.title, kind: task.kind, parentId: task.parent_id, status: task.status,
      owner: { id: task.owner_id, name: names.get(task.owner_id) ?? 'Former member' }, dueDate: task.due_date, startDate: task.start_date,
      dueDateKind: task.due_date === null ? null : task.due_date.length === 10 ? 'date' : 'instant',
      startDateKind: task.start_date === null ? null : task.start_date.length === 10 ? 'date' : 'instant', estimate: task.estimate_hours,
      section: section ? { id: section.id, name: section.name, mapsTo: section.maps_to } : null,
      revision: await taskRevision(db, task), canEdit: !!context?.capabilities.has('edit'), fields: values })
  }
  return rows
}
export type WorkRow = Awaited<ReturnType<typeof canonicalRows>>[number]
export function columnValue(row: WorkRow, column: string): unknown {
  if (column.startsWith('field:')) { const field = row.fields.find(field => field.id === column.slice(6)); return field?.error ?? field?.value ?? null }
  if (column === 'owner') return row.owner.name
  if (column === 'section') return row.section?.name ?? null
  return row[column as keyof WorkRow]
}
export function sortRows(rows: WorkRow[], config: ViewConfig) {
  return rows.sort((a, b) => {
    for (const sort of config.sort) {
      const x = columnValue(a, sort.column), y = columnValue(b, sort.column)
      if (x === y) continue
      if (x === null || x === undefined) return 1
      if (y === null || y === undefined) return -1
      const order = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
      if (order) return sort.direction === 'desc' ? -order : order
    }
    return 0
  })
}
