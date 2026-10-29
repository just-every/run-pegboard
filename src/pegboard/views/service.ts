import { invalid, notFound } from '../db'
import { fieldLibrary, fieldReadable, listSections, openProject } from '../workspace/projects'
import type { Actor } from '../workspace/people'
import { workspaceCalendar } from '../schedule/availability'
import { columnSet, initialConfig, modeOf, pruneConfig } from './config'
import { availableColumns, listWorkViews, loadView, presentView, safeDefinitions, stableRead, viewContext } from './store'
import { canonicalRows, columnValue, filteredTasks, scopedTasks, sortRows } from './rows'
import { projectWorkload } from './workload'

export interface WorkViewOptions { viewId?: string; mode?: string; status?: string; groupBy?: string; limit?: number | string; offset?: number | string; from?: string; days?: number | string }
const bounded = (input: number | string | undefined, fallback: number, max: number, min: number) => {
  const value = input === undefined ? fallback : Number(input)
  if (!Number.isInteger(value) || value < min || value > max) throw invalid('view_page')
  return value
}
/** Every poll is a new permission-checked replacement, never an old cached snapshot or delta. */
export async function workView(db: D1Database, actor: Actor, projectId: string, options: WorkViewOptions = {}) {
  return stableRead(db, async fence => {
    const { project, effective } = await openProject(db, actor, projectId)
    const catalogue = await listWorkViews(db, actor, projectId)
    const selected = options.viewId || catalogue.personalDefaultId || catalogue.teamDefaultId
    const saved = selected ? await loadView(db, selected) : null
    if (saved && saved.project_id !== projectId) throw notFound()
    const context = saved ? await viewContext(db, actor, saved) : null
    const owner = context?.owner ?? actor
    const fields = context?.fields ?? (await fieldLibrary(db, projectId)).filter(field => fieldReadable(field, effective))
    const allowed = columnSet(fields), original = context?.config ?? initialConfig()
    let config = pruneConfig(original, allowed)
    if (options.mode !== undefined) config = { ...config, mode: modeOf(options.mode) }
    if (options.status !== undefined) {
      if (!['all', 'todo', 'doing', 'done'].includes(options.status)) throw invalid('view_status')
      config = { ...config, filters: { ...config.filters, status: options.status === 'all' ? [] : [options.status] } }
    }
    if (options.groupBy !== undefined) config = { ...config, groupBy: allowed.has(options.groupBy) ? options.groupBy : null }
    const tasks = await scopedTasks(db, actor, owner, projectId), timezone = (await workspaceCalendar(db, project.workspace_id)).zone
    const filtered = filteredTasks(tasks, config, timezone), sections = await listSections(db, projectId)
    const rows = sortRows(await canonicalRows(db, actor, owner, projectId, filtered, fields, sections), config)
    const limit = bounded(options.limit, 200, 500, 1), offset = bounded(options.offset, 0, 100000, 0), page = rows.slice(offset, offset + limit)
    // Owner IDs from inaccessible rows are not part of a shared recipient's configuration.
    config = pruneConfig(config, allowed, owner.id === actor.id ? undefined : new Set(tasks.map(task => task.owner_id)))
    const groups = new Map<string, { key: string; label: string; taskIds: string[] }>()
    for (const row of page) {
      const value = config.groupBy ? columnValue(row, config.groupBy) : null, key = JSON.stringify(value)
      const group = groups.get(key) ?? { key, label: value === null ? 'Ungrouped' : String(value), taskIds: [] }
      group.taskIds.push(row.id); groups.set(key, group)
    }
    const workload = config.mode === 'workload' ? await projectWorkload(db, actor, project.workspace_id, filtered, options) : null
    return { project: { id: project.id, name: project.name, timezone, canEdit: effective.capabilities.has('edit') },
      config: saved ? presentView(saved, config, actor) : { id: null, name: 'Current view', revision: null, shared: false, canEdit: true, ...config },
      rows: page, fields: safeDefinitions(fields), availableColumns: availableColumns(fields),
      sections: sections.map(section => ({ id: section.id, name: section.name, mapsTo: section.maps_to })), groups: [...groups.values()],
      counts: { tasks: rows.length, done: rows.filter(row => row.status === 'done').length, estimate: rows.reduce((sum, row) => sum + row.estimate, 0) },
      pagination: { limit, offset, total: rows.length, nextOffset: offset + limit < rows.length ? offset + limit : null },
      revision: fence.value, views: catalogue.views, personalDefaultId: catalogue.personalDefaultId, teamDefaultId: catalogue.teamDefaultId,
      defaultsRevision: catalogue.defaultsRevision, canSetTeamDefault: catalogue.canSetTeamDefault, workload }
  })
}
