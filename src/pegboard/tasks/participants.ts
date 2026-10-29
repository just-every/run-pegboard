// A guest may choose only people who currently participate in a project they share.
import { all, forbidden } from '../db'
import { projectEffective, rootOf, taskAccess, type TaskAccess } from '../authorization/effective'
import { loadProject } from '../authorization/grants'
import { openProject, need } from '../workspace/projects'
import { displayNames, workspaceRole, type Actor } from '../workspace/people'

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

export async function mentionParticipants(db:D1Database,actor:Actor,task:import('../model').TaskRow,access:TaskAccess) {
 const via=await commentProject(db,task,access)
 const published=new Set(via?(await participants(db,via,task.workspace_id)).map(p=>p.value):[actor.id])
 const ids=[task.owner_id,...(await all<{operator_id:string}>(db,'SELECT operator_id FROM peg_task_collaborators WHERE task_id=? ORDER BY operator_id',task.id)).map(p=>p.operator_id)]
 const names=await displayNames(db,ids)
 const visible=[]
 for(const id of [...new Set(ids)])if(published.has(id)&&(await taskAccess(db,{...actor,id,baseRole:'member',apiScope:undefined},task)).capabilities.has('read'))visible.push({value:id,label:names.get(id)??'Former member'})
 return visible
}

export async function commentProject(db:D1Database,task:import('../model').TaskRow,access:TaskAccess) {
 const homes=await all<{project_id:string}>(db,'SELECT project_id FROM peg_task_projects WHERE task_id=? ORDER BY added_at,project_id',(await rootOf(db,task)).id)
 return homes.find(p=>access.contexts.get(p.project_id)?.capabilities.has('comment'))?.project_id??null
}
