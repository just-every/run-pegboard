// A guest may choose only people who currently participate in a project they share.
import { all, forbidden } from '../db'
import { projectEffective, type TaskAccess } from '../authorization/effective'
import { loadProject } from '../authorization/grants'
import { openProject, need } from '../workspace/projects'
import { workspaceRole, type Actor } from '../workspace/people'

export async function projectParticipants(db: D1Database, actor: Actor, projectId: string) {
  const { project, effective } = await openProject(db, actor, projectId)
  need(effective, 'edit')
  return participants(db, project.id, project.workspace_id)
}
async function participants(db: D1Database, projectId: string, workspaceId: string) {
  const project = (await loadProject(db, projectId))!
  const result: { value: string; label: string }[] = []
  for (const row of await all<{ id: string; display_name: string }>(db, "SELECT id,display_name FROM oa_operators WHERE status='active' ORDER BY display_name,id")) {
    if (!await workspaceRole(db, row.id, workspaceId)) continue
    const effective = await projectEffective(db, { id: row.id, email: '', displayName: row.display_name, baseRole: 'member' }, project)
    if (effective.paths.some(path => path.source !== 'role' && path.capabilities.includes('read')))
      result.push({ value: row.id, label: row.display_name })
  }
  return result
}
export async function taskParticipants(db: D1Database, actor: Actor, access: TaskAccess) {
  const choices = new Map<string, { value: string; label: string }>()
  for (const [id, standing] of access.contexts) {
    if (!standing.capabilities.has('edit')) continue
    const project = await loadProject(db, id)
    if (project) for (const person of await participants(db, id, project.workspace_id)) choices.set(person.value, person)
  }
  return [...choices.values()]
}
export async function requireGuestParticipant(db: D1Database, actor: Actor, role: string | null, ids: string[], projectId?: string, access?: TaskAccess) {
  if (role !== 'guest' || !ids.length) return
  const allowed = new Set((projectId ? await projectParticipants(db, actor, projectId) : access ? await taskParticipants(db, actor, access) : []).map(person => person.value))
  if (ids.some(id => !allowed.has(id))) throw forbidden('shared_project_participant')
}
