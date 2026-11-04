import { all, bound, conflict, first, forbidden, invalid, newId, notFound, now } from '../db'
import { guarded, revision, type Revision } from '../decisions/revision'
import { fieldLibrary, fieldReadable, need, openProject } from '../workspace/projects'
import { displayNames, operatorRow, type Actor } from '../workspace/people'
import { scopedTasks } from './rows'
import { columnSet, parseConfig, projectSelection, pruneConfig, type ViewConfig } from './config'
import { defaultTable, openViewScope, scopeId, scopeKey, scopeProjects, viewTable } from './scope'

export interface SavedView { id: string; project_id?: string; team_id?: string; owner_id: string; name: string; config: string; shared: number; revision: number; created_at: number; updated_at: number }
interface DefaultRow { subject_id: string; view_id: string | null; updated_by: string; revision: number }
/** Rebuild the whole snapshot after a concurrent write, including current permission checks. */
export async function stableRead<T>(db: D1Database, read: (fence: Revision) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const fence = await revision(db), result = await read(fence)
    if ((await revision(db)).value === fence.value && (fence.until === null || fence.until > now())) return result
  }
  throw conflict('view_changed')
}
export async function ownerActor(db: D1Database, ownerId: string): Promise<Actor> {
  const owner = await operatorRow(db, ownerId)
  if (!owner || owner.status !== 'active') throw notFound()
  return { id: owner.id, displayName: owner.display_name, email: '', baseRole: owner.role as Actor['baseRole'] }
}
/** Both current actors must still read the source project. Sharing stores no data grant. */
export async function viewContext(db: D1Database, actor: Actor, row: SavedView) {
  if (row.owner_id !== actor.id && !row.shared) throw notFound()
  const id = scopeId(row), reader = await openViewScope(db, actor, id)
  const owner = row.owner_id === actor.id ? actor : await ownerActor(db, row.owner_id)
  await openViewScope(db, owner, id)
  const stored = JSON.parse(row.config) as ViewConfig
  const projects = []
  for (const project of await scopeProjects(db, actor, id)) {
    if (reader.scope === 'team' && !stored.projectIds?.includes(project.id)) continue
    const source = await openProject(db, owner, project.id).catch(error => { if (error?.status === 404) return null; throw error })
    if (!source || (reader.scope === 'team' && source.project.team_id !== id)) continue
    const recipient = await openProject(db, actor, project.id)
    const fields = (await fieldLibrary(db, project.id)).filter(field => fieldReadable(field, recipient.effective) && fieldReadable(field, source.effective))
    projects.push({ ...recipient, fields })
  }
  const fields = [...new Map(projects.flatMap(project => project.fields).map(field => [field.id, field])).values()]
  const allowed = columnSet(fields)
  if (reader.scope === 'team') allowed.add('membership')
  const config = { ...stored, ...(reader.scope === 'team' ? { projectIds: projects.map(entry => entry.project.id) } : {}) }
  return { ...reader, owner, projects, fields, allowed, config }
}
export async function loadView(db: D1Database, id: string) {
  const row = await first<SavedView>(db, 'SELECT * FROM peg_work_views WHERE id=?', id) ?? await first<SavedView>(db, 'SELECT * FROM peg_team_work_views WHERE id=?', id)
  if (!row) throw notFound()
  return row
}
export const presentView = (row: SavedView, config: ViewConfig, actor: Actor) => ({ id: row.id, projectId: scopeId(row), scope: row.team_id ? 'team' as const : 'project' as const, ownerId: row.owner_id,
  name: row.name, ...config, shared: !!row.shared, revision: row.revision, canEdit: row.owner_id === actor.id })
export function safeDefinitions(fields: Awaited<ReturnType<typeof fieldLibrary>>) {
  return fields.map(field => ({ id: field.id, key: field.key, label: field.label, type: field.type, units: field.units, version: field.version,
    options: ['single', 'multi'].includes(field.type) ? JSON.parse(field.config).options ?? [] : [] }))
}
export function availableColumns(fields: Awaited<ReturnType<typeof fieldLibrary>>) {
  return [...['title', 'status', 'owner', 'dueDate', 'startDate', 'estimate', 'section'].map(id => ({ id, label: ({ dueDate: 'Due date', startDate: 'Start date', estimate: 'Estimate hours' } as Record<string, string>)[id] ?? id[0].toUpperCase() + id.slice(1) })),
    ...fields.map(field => ({ id: `field:${field.id}`, label: field.label }))]
}
export async function listWorkViews(db: D1Database, actor: Actor, projectId: string, compact = false, contexts?: Map<string, Awaited<ReturnType<typeof viewContext>>>) {
  return stableRead(db, async fence => {
    const { project, effective, scope } = await openViewScope(db, actor, projectId)
    contexts?.clear()
    const projects = compact ? [] : await scopeProjects(db, actor, projectId)
    const fields = [], owners = new Set<string>()
    for (const project of projects) {
      const opened = await openProject(db, actor, project.id)
      fields.push(...(await fieldLibrary(db, project.id)).filter(field => fieldReadable(field, opened.effective)))
      for (const task of await scopedTasks(db, actor, actor, project.id)) owners.add(task.owner_id)
    }
    const uniqueFields = [...new Map(fields.map(field => [field.id, field])).values()]
    const rows = await all<SavedView>(db, `SELECT * FROM ${viewTable(projectId)} WHERE ${scopeKey(projectId)}=? AND (owner_id=? OR shared=1) ORDER BY name,id`, projectId, actor.id)
    const views = []
    for (const row of rows) {
      const context = await viewContext(db, actor, row).catch(error => { if (error?.status === 404) return null; throw error })
      if (context) {
        contexts?.set(row.id, context)
        const permittedOwners = compact && row.owner_id !== actor.id && context.config.filters.ownerIds.length ? new Set<string>() : owners
        if (compact && row.owner_id !== actor.id && context.config.filters.ownerIds.length) {
          for (const entry of context.projects) for (const task of await scopedTasks(db, actor, context.owner, entry.project.id)) permittedOwners.add(task.owner_id)
        }
        views.push(presentView(row, pruneConfig(context.config, context.allowed, row.owner_id === actor.id ? undefined : permittedOwners), actor))
      }
    }
    const defaults = await all<DefaultRow>(db, `SELECT * FROM ${defaultTable(projectId)} WHERE ${scopeKey(projectId)}=? AND subject_id IN (?,?)`, projectId, actor.id, '')
    const personal = defaults.find(row => row.subject_id === actor.id), team = defaults.find(row => row.subject_id === '')
    let teamDefaultId: string | null = null
    if (team?.view_id && views.some(view => view.id === team.view_id && view.shared)) {
      const issuer = await ownerActor(db, team.updated_by).catch(() => null)
      const authority = issuer && await openViewScope(db, issuer, projectId).catch(() => null)
      if (authority?.effective.capabilities.has('manage_settings')) teamDefaultId = team.view_id
    }
    const names = await displayNames(db, [...owners])
    return { scope, projects: projects.map(project => ({ id: project.id, name: project.name })), project: { id: project.id, name: project.name }, owners: [...owners].map(id => ({ id, name: names.get(id) ?? 'Former member' })), views, fields: safeDefinitions(uniqueFields), availableColumns: [...availableColumns(uniqueFields), ...(scope === 'team' ? [{ id: 'membership', label: 'Project memberships (tasks repeat)' }] : [])],
      personalDefaultId: views.some(view => view.id === personal?.view_id) ? personal!.view_id : null,
      teamDefaultId, defaultsRevision: fence.value, canSetTeamDefault: effective.capabilities.has('manage_settings') }
  })
}
const nameOf = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim() || value.length > 120) throw invalid('view_name')
  return value.trim()
}
const sharedOf = (value: unknown) => {
  if (value === undefined) return 0
  if (typeof value !== 'boolean') throw invalid('view_shared')
  return value ? 1 : 0
}
export async function saveView(db: D1Database, actor: Actor, projectId: string, input: Record<string, any>, id?: string) {
  const fence = await revision(db), { effective, scope } = await openViewScope(db, actor, projectId)
  const old = id ? await loadView(db, id) : null
  if (old && (scopeId(old) !== projectId || old.owner_id !== actor.id)) throw notFound()
  if (old && Number(input.revision) !== old.revision) throw conflict('view_revision_changed')
  const projects = await scopeProjects(db, actor, projectId)
  const selected = scope === 'team' ? projectSelection(input.projectIds) : [projectId]
  if (scope === 'team' && (!selected.length || selected.some(id => !projects.some(project => project.id === id)))) throw notFound()
  const fields = []
  for (const id of selected) {
    const opened = await openProject(db, actor, id)
    fields.push(...(await fieldLibrary(db, id)).filter(field => fieldReadable(field, opened.effective)))
  }
  const allowed = columnSet(fields)
  if (scope === 'team') allowed.add('membership')
  const config = { ...parseConfig(input, allowed), ...(scope === 'team' ? { projectIds: selected } : {}) }, name = nameOf(input.name), shared = sharedOf(input.shared)
  const viewId = old?.id ?? newId('view'), at = now()
  await guarded(db, fence, [old
    ? bound(db, `UPDATE ${viewTable(projectId)} SET name=?,config=?,shared=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?`, [name, JSON.stringify(config), shared, at, viewId, old.revision])
    : bound(db, `INSERT INTO ${viewTable(projectId)}(id,${scopeKey(projectId)},owner_id,name,config,shared,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)`, [viewId, projectId, actor.id, name, JSON.stringify(config), shared, at, at])])
  return presentView(await loadView(db, viewId), config, actor)
}
export async function updateView(db: D1Database, actor: Actor, id: string, input: Record<string, any>) {
  return saveView(db, actor, (scopeId(await loadView(db, id))), input, id)
}
export async function deleteView(db: D1Database, actor: Actor, id: string, input: Record<string, any>) {
  const fence = await revision(db), row = await loadView(db, id)
  await openViewScope(db, actor, scopeId(row))
  if (row.owner_id !== actor.id) throw notFound()
  if (Number(input.revision) !== row.revision) throw conflict('view_revision_changed')
  await guarded(db, fence, [bound(db, `DELETE FROM ${viewTable(scopeId(row))} WHERE id=? AND revision=?`, [id, row.revision])])
  return { ok: true }
}
export async function setViewDefault(db: D1Database, actor: Actor, projectId: string, input: Record<string, any>) {
  const fence = await revision(db), { effective } = await openViewScope(db, actor, projectId)
  if (Number(input.revision) !== fence.value) throw conflict('view_revision_changed')
  if (!['personal', 'team'].includes(input.scope)) throw invalid('view_default_scope')
  if (input.scope === 'team') need(effective, 'manage_settings')
  const viewId = input.viewId === null || input.viewId === '' ? null : input.viewId
  if (viewId !== null) {
    if (typeof viewId !== 'string') throw invalid('view_default')
    const row = await loadView(db, viewId)
    if (scopeId(row) !== projectId) throw notFound()
    await viewContext(db, actor, row)
    if (input.scope === 'team' && !row.shared) throw forbidden('shared_view_required')
  }
  await guarded(db, fence, [bound(db, `INSERT INTO ${defaultTable(projectId)}(${scopeKey(projectId)},subject_id,view_id,updated_by) VALUES(?,?,?,?)
    ON CONFLICT(${scopeKey(projectId)},subject_id) DO UPDATE SET view_id=excluded.view_id,updated_by=excluded.updated_by,revision=${defaultTable(projectId)}.revision+1`, [projectId, input.scope === 'team' ? '' : actor.id, viewId, actor.id])])
  return listWorkViews(db, actor, projectId)
}
