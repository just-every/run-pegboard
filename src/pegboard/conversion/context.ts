import {all, first, forbidden, notFound} from '../db'
import {openTask,require as taskNeed} from '../tasks/access'
import {openProject,need} from '../workspace/projects'
import {activeGrants} from '../authorization/effective'
import {workspaceRole,type Actor} from '../workspace/people'
import type {ProjectRow} from '../model'

export async function conversionPerson(db:D1Database,actor:Actor,workspace:string){
 const role=await workspaceRole(db,actor.id,workspace)
 if(!role)throw notFound()
 if(role==='agent'||role==='guest'||role==='analyst')throw forbidden('human_conversion')
}
export async function objectAuthority(db:D1Database,actor:Actor,workspace:string,type:string,id:string,write=false,editor=false){
 if(type==='project'){
  const opened=await openProject(db,actor,id)
  if(opened.project.workspace_id!==workspace)throw notFound()
  if(write)need(opened.effective,editor?'edit':'manage_settings')
  return {type:'project' as const,id,title:opened.project.name}
 }
 const opened=await openTask(db,actor,id)
 if(opened.task.workspace_id!==workspace)throw notFound()
 if(write)taskNeed(opened.access,'edit')
 return {type:'task' as const,id:opened.task.id,title:opened.task.title}
}
// Policy identity includes grant restrictions and expiry: equal current reader counts are insufficient.
export async function projectScope(db:D1Database,project:ProjectRow){
 const occurrence=!!await first(db,"SELECT 1 FROM peg_template_origins WHERE object_type='project' AND object_id=?",project.id)
 const grants=(await Promise.all((await activeGrants(db,'project',project.id)).map(async g=>[g.grantee_type,g.grantee_id,g.level,g.scope,g.scopes,g.expires_at,occurrence&&!!await first(db,'SELECT 1 FROM peg_recurring_grants WHERE grant_id=?',g.id)]))).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))
 return JSON.stringify([project.workspace_id,project.owner_id,project.visibility,project.team_id,project.team_level,project.workspace_level,occurrence,grants])
}
export async function projectHomes(db:D1Database,taskId:string){return all<import('../model').TaskProjectRow>(db,'SELECT * FROM peg_task_projects WHERE task_id=? ORDER BY project_id',taskId)}
