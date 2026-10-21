// Projects: settings, sections, the field library, sharing with a preview, and the discovery of what a person can open.
import { all, batch, bound, conflict, first, forbidden, invalid, newId, notFound, now } from '../db'
import type { FieldRow, ProjectRow, SectionRow } from '../model'
import { auditStatement, bumpEpoch } from '../authorization/audit'
import { projectEffective, teamsOf, type Effective } from '../authorization/effective'
import { loadProject, loadTeam } from '../authorization/grants'
import { isAdministrator, rank, type Level } from '../authorization/levels'
import { workspaceRole, workspaceSettings, type Actor } from './people'

const sharedLevels = ['viewer', 'commenter', 'editor']
const visibilities = ['private', 'team', 'workspace']
const text = (value: unknown, max: number, code: string) => { if (typeof value !== 'string' || !value.trim() || value.length > max) throw invalid(code); return value.trim() }
const date = (value: unknown, code: string) => { if (value === null || value === undefined || value === '') return null; if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) throw invalid(code); return value }

/** A project the person can read, or not found: refusals never say whether it exists. */
export async function openProject(db: D1Database, actor: Actor, id: string): Promise<{ project: ProjectRow; effective: Effective }> {
  const project = await loadProject(db, id)
  if (!project) throw notFound()
  const effective = await projectEffective(db, actor, project)
  if (!effective.capabilities.has('read')) throw notFound()
  return { project, effective }
}
export function need(effective: Effective, capability: Parameters<Effective['capabilities']['has']>[0]) {
  if (!effective.capabilities.has(capability)) throw forbidden(capability)
}

export async function createProject(db: D1Database, actor: Actor, input: { workspaceId: string; name: string; description?: string; teamId?: string | null; visibility?: string; teamLevel?: string; workspaceLevel?: string; startDate?: string; dueDate?: string }): Promise<ProjectRow> {
  const role = await workspaceRole(db, actor.id, input.workspaceId)
  if (!role) throw notFound()
  if (!(isAdministrator(role) || role === 'manager' || role === 'member')) throw forbidden('create_project')
  const visibility = input.visibility ?? 'private', teamLevel = input.teamLevel ?? 'viewer', workspaceLevel = input.workspaceLevel ?? 'viewer'
  if (!visibilities.includes(visibility) || !sharedLevels.includes(teamLevel) || !sharedLevels.includes(workspaceLevel)) throw invalid('visibility')
  if (input.teamId) { const team = await loadTeam(db, input.teamId); if (!team || team.workspace_id !== input.workspaceId || !(await teamsOf(db, actor.id)).some(grant => grant.object_id === team.id) && !isAdministrator(role)) throw invalid('team') }
  if (visibility === 'team' && !input.teamId) throw invalid('team')
  if (visibility === 'workspace' && !(await workspaceSettings(db, input.workspaceId)).workspaceSharing) throw forbidden('workspace_sharing')
  const id = newId('prj'), at = now()
  const sections: [string, string | null][] = [['To do', 'todo'], ['Doing', 'doing'], ['Done', 'done']]
  await batch(db, [
    bound(db, 'INSERT INTO peg_projects(id,workspace_id,name,description,owner_id,team_id,visibility,team_level,workspace_level,start_date,due_date,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [id, input.workspaceId, text(input.name, 120, 'name'), (input.description ?? '').slice(0, 4000), actor.id, input.teamId ?? null, visibility, teamLevel, workspaceLevel, date(input.startDate, 'start_date'), date(input.dueDate, 'due_date'), actor.id, at]),
    ...sections.map(([name, mapsTo], index) => bound(db, 'INSERT INTO peg_sections(id,project_id,name,position,maps_to) VALUES (?,?,?,?,?)', [newId('sec'), id, name, index, mapsTo])),
    auditStatement(db, { workspaceId: input.workspaceId, actorId: actor.id, action: 'project.created', targetType: 'project', targetId: id, detail: { visibility, teamId: input.teamId ?? null } }),
    bumpEpoch(db),
  ])
  return (await loadProject(db, id))!
}

export interface ProjectPatch { name?: string; description?: string; status?: string; startDate?: string | null; dueDate?: string | null; ownerId?: string; visibility?: string; teamId?: string | null; teamLevel?: string; workspaceLevel?: string; previewRevision?: string }

export interface SharePreview { revision: string; broadens: boolean; audience: { who: string; level: Level | null; count: number | null; note?: string }[] }
const stamp = async (text: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].slice(0, 12).map(byte => byte.toString(16).padStart(2, '0')).join('')

/** The audience a sharing change would create, by grant path, and the revision a broadening must be authorised against. */
export async function previewShare(db: D1Database, actor: Actor, id: string, proposed: ProjectPatch = {}): Promise<SharePreview> {
  const { project, effective } = await openProject(db, actor, id)
  need(effective, 'manage_shares')
  const next = { visibility: proposed.visibility ?? project.visibility, teamId: proposed.teamId === undefined ? project.team_id : proposed.teamId, teamLevel: proposed.teamLevel ?? project.team_level, workspaceLevel: proposed.workspaceLevel ?? project.workspace_level }
  if (!visibilities.includes(next.visibility) || !sharedLevels.includes(next.teamLevel) || !sharedLevels.includes(next.workspaceLevel)) throw invalid('visibility')
  const audience: SharePreview['audience'] = [{ who: 'The owner and people granted directly or through teams', level: 'admin', count: null }]
  if (next.visibility === 'team') {
    const team = next.teamId ? await loadTeam(db, next.teamId) : null
    if (!team || team.workspace_id !== project.workspace_id) throw invalid('team')
    const members = await first<{ n: number }>(db, "SELECT COUNT(*) n FROM peg_grants WHERE object_type='team' AND object_id=? AND grantee_type='person' AND revoked_at IS NULL", team.id)
    audience.push({ who: `Members of ${team.name}`, level: next.teamLevel as Level, count: members!.n })
  }
  if (next.visibility === 'workspace') {
    const members = await first<{ n: number }>(db, "SELECT COUNT(*) n FROM peg_workspace_members WHERE workspace_id=? AND role IN ('manager','member','analyst')", project.workspace_id)
    audience.push({ who: 'Everyone in the workspace', level: next.workspaceLevel as Level, count: members!.n, note: 'Guests and agents are not included' })
  }
  const order = (visibility: string, level: string) => (visibility === 'private' ? 0 : visibility === 'team' ? 10 : 20) + rank(level as Level)
  const before = order(project.visibility, project.visibility === 'team' ? project.team_level : project.workspace_level)
  const after = order(next.visibility, next.visibility === 'team' ? next.teamLevel : next.workspaceLevel)
  return { revision: await stamp(JSON.stringify([project.id, project.policy_rev, next, (next.teamId && (await loadTeam(db, next.teamId))?.policy_rev) ?? 0])), broadens: after > before, audience }
}

export async function updateProject(db: D1Database, actor: Actor, id: string, patch: ProjectPatch): Promise<ProjectRow> {
  const { project, effective } = await openProject(db, actor, id)
  const sharing = ['visibility', 'teamId', 'teamLevel', 'workspaceLevel'].some(key => (patch as Record<string, unknown>)[key] !== undefined)
  const settings = ['name', 'description', 'status', 'startDate', 'dueDate', 'ownerId'].some(key => (patch as Record<string, unknown>)[key] !== undefined)
  if (settings) need(effective, 'manage_settings')
  if (sharing) need(effective, 'manage_shares')
  const next = { ...project }
  if (patch.name !== undefined) next.name = text(patch.name, 120, 'name')
  if (patch.description !== undefined) next.description = String(patch.description).slice(0, 4000)
  if (patch.status !== undefined) next.status = text(patch.status, 40, 'status')
  if (patch.startDate !== undefined) next.start_date = date(patch.startDate, 'start_date')
  if (patch.dueDate !== undefined) next.due_date = date(patch.dueDate, 'due_date')
  if (patch.ownerId !== undefined) {
    const role = await workspaceRole(db, patch.ownerId, project.workspace_id)
    if (!role || role === 'guest' || role === 'agent' || role === 'analyst') throw invalid('owner')
    next.owner_id = patch.ownerId
  }
  if (sharing) {
    const preview = await previewShare(db, actor, id, patch)
    if (patch.visibility === 'workspace' && !(await workspaceSettings(db, project.workspace_id)).workspaceSharing) throw forbidden('workspace_sharing')
    // A broadened audience needs the preview's own revision: the share it showed is the share that applies.
    if (preview.broadens && patch.previewRevision !== preview.revision) throw conflict('share_preview_required')
    next.visibility = (patch.visibility ?? project.visibility) as ProjectRow['visibility']
    next.team_id = patch.teamId === undefined ? project.team_id : patch.teamId
    next.team_level = (patch.teamLevel ?? project.team_level) as ProjectRow['team_level']
    next.workspace_level = (patch.workspaceLevel ?? project.workspace_level) as ProjectRow['workspace_level']
  }
  await batch(db, [
    bound(db, 'UPDATE peg_projects SET name=?,description=?,status=?,start_date=?,due_date=?,owner_id=?,visibility=?,team_id=?,team_level=?,workspace_level=?,policy_rev=policy_rev+? WHERE id=?',
      [next.name, next.description, next.status, next.start_date, next.due_date, next.owner_id, next.visibility, next.team_id, next.team_level, next.workspace_level, sharing ? 1 : 0, id]),
    auditStatement(db, { workspaceId: project.workspace_id, actorId: actor.id, action: sharing ? 'project.sharing_changed' : 'project.updated', targetType: 'project', targetId: id,
      detail: sharing ? { from: { visibility: project.visibility, teamId: project.team_id, teamLevel: project.team_level, workspaceLevel: project.workspace_level }, to: { visibility: next.visibility, teamId: next.team_id, teamLevel: next.team_level, workspaceLevel: next.workspace_level } } : { ownerId: next.owner_id !== project.owner_id ? next.owner_id : undefined } }),
    bumpEpoch(db),
  ])
  return (await loadProject(db, id))!
}

export async function listSections(db: D1Database, projectId: string) {
  return all<SectionRow>(db, 'SELECT * FROM peg_sections WHERE project_id=? ORDER BY position', projectId)
}
export async function addSection(db: D1Database, actor: Actor, projectId: string, input: { name: string; mapsTo?: string | null }): Promise<SectionRow> {
  const { effective } = await openProject(db, actor, projectId)
  need(effective, 'edit')
  if (input.mapsTo) need(effective, 'manage_fields')
  if (input.mapsTo && !['todo', 'doing', 'done'].includes(input.mapsTo)) throw invalid('maps_to')
  const id = newId('sec'), position = (await first<{ n: number }>(db, 'SELECT COALESCE(MAX(position),-1)+1 n FROM peg_sections WHERE project_id=?', projectId))!.n
  await run3(db, bound(db, 'INSERT INTO peg_sections(id,project_id,name,position,maps_to) VALUES (?,?,?,?,?)', [id, projectId, text(input.name, 80, 'name'), position, input.mapsTo ?? null]))
  return (await first<SectionRow>(db, 'SELECT * FROM peg_sections WHERE id=?', id))!
}
/** The workflow mapping: which status a section stands for. Field and status definitions are an Admin's. */
export async function mapSection(db: D1Database, actor: Actor, sectionId: string, mapsTo: string | null): Promise<SectionRow> {
  const section = await first<SectionRow>(db, 'SELECT * FROM peg_sections WHERE id=?', sectionId)
  if (!section) throw notFound()
  const { effective } = await openProject(db, actor, section.project_id)
  need(effective, 'manage_fields')
  if (mapsTo !== null && !['todo', 'doing', 'done'].includes(mapsTo)) throw invalid('maps_to')
  const project = (await loadProject(db, section.project_id))!
  await batch(db, [bound(db, 'UPDATE peg_sections SET maps_to=? WHERE id=?', [mapsTo, sectionId]), auditStatement(db, { workspaceId: project.workspace_id, actorId: actor.id, action: 'project.workflow_mapped', targetType: 'project', targetId: project.id, detail: { section: section.name, mapsTo } })])
  return { ...section, maps_to: mapsTo as SectionRow['maps_to'] }
}
const run3 = (db: D1Database, statement: D1PreparedStatement) => batch(db, [statement])

export async function fieldLibrary(db: D1Database, projectId: string) { return all<FieldRow>(db, 'SELECT * FROM peg_project_fields WHERE project_id=? ORDER BY key', projectId) }
export async function addField(db: D1Database, actor: Actor, projectId: string, input: { key: string; label: string; type?: string; visibility?: string }): Promise<FieldRow> {
  const { project, effective } = await openProject(db, actor, projectId)
  need(effective, 'manage_fields')
  const key = text(input.key, 40, 'key')
  if (!/^[a-z][a-z0-9_]*$/.test(key)) throw invalid('key')
  const type = input.type ?? 'text', visibility = input.visibility ?? 'everyone'
  if (!['text', 'number'].includes(type) || !['everyone', 'internal', 'editors', 'admins'].includes(visibility)) throw invalid('field')
  if (await first(db, 'SELECT 1 FROM peg_project_fields WHERE project_id=? AND key=?', projectId, key)) throw conflict('field_exists')
  await batch(db, [bound(db, 'INSERT INTO peg_project_fields(project_id,key,label,type,visibility) VALUES (?,?,?,?,?)', [projectId, key, text(input.label, 80, 'label'), type, visibility]),
    auditStatement(db, { workspaceId: project.workspace_id, actorId: actor.id, action: 'project.field_defined', targetType: 'project', targetId: projectId, detail: { key, type, visibility } })])
  return (await first<FieldRow>(db, 'SELECT * FROM peg_project_fields WHERE project_id=? AND key=?', projectId, key))!
}
/** Whether a person at this standing may read a field: the field names its own audience. */
export function fieldReadable(field: Pick<FieldRow, 'visibility'>, effective: Effective): boolean {
  if (field.visibility === 'everyone') return true
  if (field.visibility === 'internal') return effective.role !== 'guest'
  if (field.visibility === 'editors') return effective.capabilities.has('edit')
  return effective.capabilities.has('manage_fields')
}

export interface ProjectListing { id: string; name: string; description: string; level: Level | null; visibility: ProjectRow['visibility']; ownerId: string }
/** Every project the person can open, and nothing else. */
export async function listProjects(db: D1Database, actor: Actor, workspaceId: string): Promise<ProjectListing[]> {
  const role = await workspaceRole(db, actor.id, workspaceId)
  if (!role) throw notFound()
  const rows = await all<ProjectRow>(db, 'SELECT * FROM peg_projects WHERE workspace_id=? ORDER BY name', workspaceId)
  const out: ProjectListing[] = []
  for (const project of rows) {
    const effective = await projectEffective(db, actor, project)
    if (effective.capabilities.has('read')) out.push({ id: project.id, name: project.name, description: project.description, level: effective.level, visibility: project.visibility, ownerId: project.owner_id })
  }
  return out
}
