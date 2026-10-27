import {all, forbidden, notFound} from '../db'
import {openProject,need} from '../workspace/projects'
import {operatorRow,workspaceRole,type Actor} from '../workspace/people'
import {viewTask} from '../tasks/view'
import {projectEffective} from '../authorization/effective'

// Preview current guest authority through exactly the same reads as their own portal.
export async function guestPreview(db:D1Database,actor:Actor,projectId:string,recipientId:string){
  const {project,effective}=await openProject(db,actor,projectId)
  need(effective,'manage_shares')
  if(await workspaceRole(db,recipientId,project.workspace_id)!=='guest')throw notFound()
  const person=await operatorRow(db,recipientId)
  if(!person)throw notFound()
  const recipient:Actor={id:person.id,email:person.email,displayName:person.display_name,baseRole:'member'}
  const standing=await projectEffective(db,recipient,project)
  if(!standing.paths.some(path=>path.capabilities.includes('read')))throw forbidden('current_guest_share_required')
  const tasks=[]
  const candidates=await all<{id:string}>(db,`WITH RECURSIVE work(id,depth) AS (
    SELECT task_id,0 FROM peg_task_projects WHERE project_id=?
    UNION ALL SELECT t.id,w.depth+1 FROM peg_tasks t JOIN work w ON t.parent_id=w.id WHERE w.depth<50
  ) SELECT DISTINCT id FROM work`,projectId)
  for(const row of candidates){
    const task=await viewTask(db,recipient,row.id).catch(error=>{if(error.status===404)return null;throw error})
    if(task)tasks.push(task)
  }
  return {recipient:{id:person.id,name:person.display_name},project:{id:project.id,name:project.name},paths:standing.paths.map(path=>({level:path.level,scope:path.scope??'full'})),tasks}
}
