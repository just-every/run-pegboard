import { all, bound, conflict, first, forbidden, invalid, newId, notFound, now } from '../db'
import { guarded, revision, type Revision } from '../decisions/revision'
import { fieldLibrary, fieldReadable, need, openProject } from '../workspace/projects'
import { operatorRow, type Actor } from '../workspace/people'
import { readableTasks } from '../tasks/board'
import { columnSet, parseConfig, pruneConfig, type ViewConfig } from './config'

export interface SavedView { id: string; project_id: string; owner_id: string; name: string; config: string; shared: number; revision: number; created_at: number; updated_at: number }
interface DefaultRow { subject_id: string; view_id: string | null; updated_by: string; revision: number }
export async function stableRead(db: D1Database, fence: Revision) {
  if ((await revision(db)).value !== fence.value || fence.until !== null && fence.until <= now()) throw conflict('view_changed')
}
export async function ownerActor(db: D1Database, ownerId: string): Promise<Actor> {
  const owner = await operatorRow(db, ownerId)
  if (!owner || owner.status !== 'active') throw notFound()
  return { id: owner.id, displayName: owner.display_name, email: '', baseRole: owner.role as Actor['baseRole'] }
}
/** Both current actors must still read the source project. Sharing stores no data grant. */
export async function viewContext(db: D1Database, actor: Actor, row: SavedView) {
  if (row.owner_id !== actor.id && !row.shared) throw notFound()
  const reader = await openProject(db, actor, row.project_id)
  const owner = row.owner_id === actor.id ? actor : await ownerActor(db, row.owner_id)
  const source = row.owner_id === actor.id ? reader : await openProject(db, owner, row.project_id)
  const fields = (await fieldLibrary(db, row.project_id)).filter(field => fieldReadable(field, reader.effective) && fieldReadable(field, source.effective))
  return { ...reader, owner, fields, allowed: columnSet(fields), config: JSON.parse(row.config) as ViewConfig }
}
export async function loadView(db: D1Database, id: string) {
  const row = await first<SavedView>(db, 'SELECT * FROM peg_work_views WHERE id=?', id)
  if (!row) throw notFound()
  return row
}
export const presentView = (row: SavedView, config: ViewConfig, actor: Actor) => ({ id: row.id, projectId: row.project_id, ownerId: row.owner_id,
  name: row.name, ...config, shared: !!row.shared, revision: row.revision, canEdit: row.owner_id === actor.id })
export function safeDefinitions(fields: Awaited<ReturnType<typeof fieldLibrary>>) {
  return fields.map(field => ({ id: field.id, key: field.key, label: field.label, type: field.type, units: field.units, version: field.version,
    options: ['single', 'multi'].includes(field.type) ? JSON.parse(field.config).options ?? [] : [] }))
}
export function availableColumns(fields: Awaited<ReturnType<typeof fieldLibrary>>) {
  return [...['title', 'status', 'owner', 'dueDate', 'startDate', 'estimate', 'section'].map(id => ({ id, label: ({ dueDate: 'Due date', startDate: 'Start date', estimate: 'Estimate hours' } as Record<string, string>)[id] ?? id[0].toUpperCase() + id.slice(1) })),
    ...fields.map(field => ({ id: `field:${field.id}`, label: field.label }))]
}
export async function listWorkViews(db: D1Database, actor: Actor, projectId: string) {
  const fence = await revision(db), { project, effective } = await openProject(db, actor, projectId)
  const fields = (await fieldLibrary(db, projectId)).filter(field => fieldReadable(field, effective))
  const owners = new Set((await readableTasks(db, actor, projectId)).map(task => task.owner_id))
  const rows = await all<SavedView>(db, 'SELECT * FROM peg_work_views WHERE project_id=? AND (owner_id=? OR shared=1) ORDER BY name,id', projectId, actor.id)
  const views = []
  for (const row of rows) {
    const context = await viewContext(db, actor, row).catch(error => { if (error?.status === 404) return null; throw error })
    if (context) views.push(presentView(row, pruneConfig(context.config, context.allowed, row.owner_id === actor.id ? undefined : owners), actor))
  }
  const defaults = await all<DefaultRow>(db, 'SELECT * FROM peg_work_view_defaults WHERE project_id=? AND subject_id IN (?,?)', projectId, actor.id, '')
  const personal = defaults.find(row => row.subject_id === actor.id), team = defaults.find(row => row.subject_id === '')
  let teamDefaultId: string | null = null
  if (team?.view_id && views.some(view => view.id === team.view_id && view.shared)) {
    const issuer = await ownerActor(db, team.updated_by).catch(() => null)
    const authority = issuer && await openProject(db, issuer, projectId).catch(() => null)
    if (authority?.effective.capabilities.has('manage_settings')) teamDefaultId = team.view_id
  }
  await stableRead(db, fence)
  return { project: { id: project.id, name: project.name }, views, fields: safeDefinitions(fields), availableColumns: availableColumns(fields),
    personalDefaultId: views.some(view => view.id === personal?.view_id) ? personal!.view_id : null,
    teamDefaultId, defaultsRevision: fence.value, canSetTeamDefault: effective.capabilities.has('manage_settings') }
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
  const fence = await revision(db), { effective } = await openProject(db, actor, projectId)
  const old = id ? await loadView(db, id) : null
  if (old && (old.project_id !== projectId || old.owner_id !== actor.id)) throw notFound()
  if (old && Number(input.revision) !== old.revision) throw conflict('view_revision_changed')
  const fields = (await fieldLibrary(db, projectId)).filter(field => fieldReadable(field, effective))
  const config = parseConfig(input, columnSet(fields)), name = nameOf(input.name), shared = sharedOf(input.shared)
  const viewId = old?.id ?? newId('view'), at = now()
  await guarded(db, fence, [old
    ? bound(db, 'UPDATE peg_work_views SET name=?,config=?,shared=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?', [name, JSON.stringify(config), shared, at, viewId, old.revision])
    : bound(db, 'INSERT INTO peg_work_views(id,project_id,owner_id,name,config,shared,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)', [viewId, projectId, actor.id, name, JSON.stringify(config), shared, at, at])])
  return presentView(await loadView(db, viewId), config, actor)
}
export async function updateView(db: D1Database, actor: Actor, id: string, input: Record<string, any>) {
  return saveView(db, actor, (await loadView(db, id)).project_id, input, id)
}
export async function deleteView(db: D1Database, actor: Actor, id: string, input: Record<string, any>) {
  const fence = await revision(db), row = await loadView(db, id)
  await openProject(db, actor, row.project_id)
  if (row.owner_id !== actor.id) throw notFound()
  if (Number(input.revision) !== row.revision) throw conflict('view_revision_changed')
  await guarded(db, fence, [bound(db, 'DELETE FROM peg_work_views WHERE id=? AND revision=?', [id, row.revision])])
  return { ok: true }
}
export async function setViewDefault(db: D1Database, actor: Actor, projectId: string, input: Record<string, any>) {
  const fence = await revision(db), { effective } = await openProject(db, actor, projectId)
  if (Number(input.revision) !== fence.value) throw conflict('view_revision_changed')
  if (!['personal', 'team'].includes(input.scope)) throw invalid('view_default_scope')
  if (input.scope === 'team') need(effective, 'manage_settings')
  const viewId = input.viewId === null || input.viewId === '' ? null : input.viewId
  if (viewId !== null) {
    if (typeof viewId !== 'string') throw invalid('view_default')
    const row = await loadView(db, viewId)
    if (row.project_id !== projectId) throw notFound()
    await viewContext(db, actor, row)
    if (input.scope === 'team' && !row.shared) throw forbidden('shared_view_required')
  }
  await guarded(db, fence, [bound(db, `INSERT INTO peg_work_view_defaults(project_id,subject_id,view_id,updated_by) VALUES(?,?,?,?)
    ON CONFLICT(project_id,subject_id) DO UPDATE SET view_id=excluded.view_id,updated_by=excluded.updated_by,revision=peg_work_view_defaults.revision+1`, [projectId, input.scope === 'team' ? '' : actor.id, viewId, actor.id])])
  return listWorkViews(db, actor, projectId)
}
