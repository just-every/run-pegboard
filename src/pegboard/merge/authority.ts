import {all,first,forbidden,conflict,notFound} from '../db'
import {openTask} from '../tasks/access'
import {activeGrants,taskAccess} from '../authorization/effective'
import {projectHomes,projectScope,conversionPerson} from '../conversion/context'
import {openProject} from '../workspace/projects'
import type {TaskRow} from '../model'
import type {Actor} from '../workspace/people'

export async function mergeTask(db:D1Database,actor:Actor,workspace:string,id:string,retained=false){
 await conversionPerson(db,actor,workspace)
 const task=retained?await first<TaskRow>(db,'SELECT * FROM peg_tasks WHERE id=?',id):(await openTask(db,actor,id)).task
 if(!task||task.workspace_id!==workspace||await first(db,"SELECT 1 FROM peg_data_erased_objects WHERE object_type='task' AND object_id=?",task.id))throw notFound()
 const access=await taskAccess(db,actor,task,retained)
 if(!access.capabilities.has('read'))throw notFound()
 const homes=await projectHomes(db,task.id)
 if(!access.capabilities.has('edit')||homes.some(h=>!access.contexts.get(h.project_id)?.capabilities.has('edit')))throw forbidden('merge_scope')
 return {task,access,homes}
}
export async function mergePair(db:D1Database,actor:Actor,workspace:string,sourceId:string,survivorId:string,retained=false){
 const source=await mergeTask(db,actor,workspace,sourceId,retained),survivor=await mergeTask(db,actor,workspace,survivorId)
 if(source.task.id===survivor.task.id)throw conflict('merge_distinct_tasks')
 const tasks=[source.task,survivor.task]
 if(tasks.some(t=>t.kind!=='task'||t.parent_id)||await first(db,'SELECT 1 FROM peg_tasks WHERE parent_id IN (?,?)',source.task.id,survivor.task.id)||await first(db,'SELECT 1 FROM peg_approval_tasks WHERE task_id IN (?,?)',source.task.id,survivor.task.id)||await first(db,'SELECT 1 FROM peg_proofs WHERE task_id IN (?,?)',source.task.id,survivor.task.id))throw conflict('ordinary_tasks_required')
 // Equal current counts are insufficient: retain the complete granting policy.
 if(source.access.personal||survivor.access.personal){if(!source.access.personal||!survivor.access.personal||source.task.owner_id!==survivor.task.owner_id)throw conflict('merge_visibility_change')}
 else{
  const scopes=[]
  for(const home of [...source.homes,...survivor.homes]){
   const {project}=await openProject(db,actor,home.project_id)
   scopes.push(await projectScope(db,project))
   if((await activeGrants(db,'project',home.project_id)).some(g=>g.scope==='assignee'))throw conflict('merge_assignment_scope')
  }
  if(new Set(scopes).size!==1)throw conflict('merge_visibility_change')
 }
 const grants=async(id:string)=>(await activeGrants(db,'task',id)).map(g=>JSON.stringify([g.grantee_type,g.grantee_id,g.level,g.scope,g.scopes,g.expires_at])).sort()
 if(source.task.internal_only!==survivor.task.internal_only||JSON.stringify(await grants(source.task.id))!==JSON.stringify(await grants(survivor.task.id)))throw conflict('merge_visibility_change')
 return {source,survivor}
}
