import {all,bound,conflict,first,invalid,newId,now} from '../db'
import {digest,guarded,revision} from '../decisions/revision'
import {rootOf,activeGrants} from '../authorization/effective'
import {openTask,require as taskNeed} from '../tasks/access'
import {openProject,need} from '../workspace/projects'
import {prepareTask} from '../tasks/tasks'
import {historyStatement,reopenGuard} from '../tasks/history'
import {displayNames,type Actor} from '../workspace/people'
import {conversionGraph,conversionIds} from './graph'
import {conversionPerson,projectHomes,projectScope} from './context'
import {conversionStatements,conversionView,operationReplay,type ConversionEffect,type ConversionRepair} from './operations'
import {reconcileConversion} from './reconciliation'
import type {ProjectRow,TaskRow} from '../model'

export interface ProjectConversionInput {kind:'task_to_project'|'project_to_task';sourceId:string;targetProjectId?:string;name?:string;taskIds?:string[];retainIds?:string[];visibility?:string;token?:string}
async function sourceRepairs(db:D1Database,projectId:string){
 const repairs:ConversionRepair[]=[]
 for(const [kind,query] of [
  ['section','SELECT id FROM peg_sections WHERE project_id=? ORDER BY id'],
  ['field','SELECT field_id AS id FROM peg_project_fields WHERE project_id=? ORDER BY field_id'],
  ['template_rule','SELECT id FROM peg_template_rules WHERE project_id=? ORDER BY id'],
  ['bundle','SELECT bundle_id AS id FROM peg_bundle_adoptions WHERE project_id=? ORDER BY bundle_id'],
  ['report',"SELECT bundle_id||':'||item_key AS id FROM peg_bundle_items WHERE project_id=? AND kind='view' ORDER BY bundle_id,item_key"],
  ['bundle_item',"SELECT bundle_id||':'||item_key AS id FROM peg_bundle_items WHERE project_id=? AND kind<>'view' ORDER BY bundle_id,item_key"],
  ['webhook','SELECT id FROM peg_webhooks WHERE project_id=? ORDER BY id'],
  ['recurrence',"SELECT r.id FROM peg_recurrences r JOIN peg_work_templates t ON t.id=r.template_id WHERE t.source_type='project' AND t.source_id=? ORDER BY r.id"],
 ] as const)for(const row of await all<{id:string}>(db,query,projectId))repairs.push({kind,sourceId:row.id,projectId})
 return repairs.map(repair=>({...repair,title:repair.kind,inert:true as const,repairPath:`/app/projects/${projectId}/settings`}))
}
async function exactHomes(db:D1Database,actor:Actor,task:TaskRow,workspace:string){
 const root=await rootOf(db,task),homes=await projectHomes(db,root.id)
 if(!homes.length)throw conflict('conversion_personal_scope')
 for(const home of homes){const opened=await openProject(db,actor,home.project_id);if(opened.project.workspace_id!==workspace)throw conflict('conversion_scope');need(opened.effective,'manage_settings')}
 return homes
}
export async function previewProjectConversion(db:D1Database,actor:Actor,workspace:string,input:ProjectConversionInput){
 const rev=await revision(db);await conversionPerson(db,actor,workspace)
 if(!['task_to_project','project_to_task'].includes(input.kind))throw invalid('conversion_kind')
 let project:ProjectRow,source:{type:'task'|'project';id:string;title:string},tasks:TaskRow[],roots:TaskRow[],homes:Awaited<ReturnType<typeof projectHomes>>,sourceTask:TaskRow|null=null
 if(input.kind==='task_to_project'){
  const opened=await openTask(db,actor,input.sourceId);taskNeed(opened.access,'edit');sourceTask=opened.task
  if(sourceTask.workspace_id!==workspace)throw conflict('conversion_scope')
  homes=await exactHomes(db,actor,sourceTask,workspace)
  project=(await openProject(db,actor,homes[0].project_id)).project
  tasks=await conversionGraph(db,actor,workspace,[sourceTask.id]);roots=tasks.filter(t=>t.parent_id===sourceTask!.id)
  if(sourceTask.parent_id)throw conflict('conversion_root_required')
  if(input.targetProjectId)throw invalid('conversion_creates_project')
  if(input.taskIds!==undefined||input.retainIds!==undefined)throw invalid('conversion_entire_subtree')
  source={type:'task',id:sourceTask.id,title:sourceTask.title}
 }else{
  const opened=await openProject(db,actor,input.sourceId);need(opened.effective,'manage_settings');project=opened.project
  if(project.workspace_id!==workspace)throw conflict('conversion_scope')
  roots=await all<TaskRow>(db,'SELECT t.* FROM peg_tasks t JOIN peg_task_projects p ON p.task_id=t.id WHERE p.project_id=? AND t.parent_id IS NULL ORDER BY t.id',project.id)
  tasks=await conversionGraph(db,actor,workspace,roots.map(t=>t.id));homes=[]
  source={type:'project',id:project.id,title:project.name}
 }
 const targetProjectId=input.kind==='project_to_task'?input.targetProjectId??project.id:null
 const targetProject=targetProjectId?(await openProject(db,actor,targetProjectId)).project:null
 if(targetProject){const opened=await openProject(db,actor,targetProject.id);need(opened.effective,'manage_settings');if(await projectScope(db,targetProject)!==await projectScope(db,project))throw conflict('conversion_incompatible_scope')}
 const visibility=input.visibility??project.visibility
 if(visibility!==project.visibility)throw conflict('conversion_visibility_must_preserve_scope')
 const name=String(input.name??source.title).trim();if(!name||name.length>(input.kind==='task_to_project'?120:300))throw invalid('conversion_name')
 const selected=input.kind==='project_to_task'?(input.taskIds===undefined?roots.map(t=>t.id).sort():conversionIds(input.taskIds)):roots.map(t=>t.id).sort(),retained=input.kind==='project_to_task'?conversionIds(input.retainIds):[]
 if(input.kind==='project_to_task'&&(new Set([...selected,...retained]).size!==roots.length||roots.some(t=>!selected.includes(t.id)&&!retained.includes(t.id))||selected.some(id=>retained.includes(id))))throw invalid('conversion_mapping_required')
 const contextIds=new Set<string>(homes.map(home=>home.project_id));contextIds.add(project.id);if(targetProject)contextIds.add(targetProject.id)
 for(const task of tasks){
  const originalHomes=await exactHomes(db,actor,task,workspace)
  for(const home of originalHomes)contextIds.add(home.project_id)
  if(input.kind==='project_to_task'&&selected.includes(task.id)&&(originalHomes.length!==1||originalHomes[0].project_id!==project.id))throw conflict('conversion_incompatible_task_scope')
 }
 const mapping=tasks.map(task=>({taskId:task.id,title:task.title,action:task.id===sourceTask?.id?'source_record':input.kind==='task_to_project'?'project_work':retained.some(id=>id===task.id||ancestorOf(tasks,id,task.id))?'retained_link':'subtask'}))
 const reconciliation=await reconcileConversion(db,actor,tasks.map(t=>t.id)),repairs=await sourceRepairs(db,project.id),names=await displayNames(db,tasks.map(t=>t.owner_id))
 const capacity=[...new Set(tasks.map(t=>t.owner_id))].map(ownerId=>({ownerId,owner:names.get(ownerId)??'Former member',hours:tasks.filter(t=>t.owner_id===ownerId&&t.status!=='done').reduce((n,t)=>n+t.estimate_hours,0),addedHours:0}))
 const memberships=[]
 for(const projectId of [...contextIds].sort()){
  const context=(await openProject(db,actor,projectId)).project
  memberships.push({projectId,project:context.name,who:'Project owner and workspace administrators',level:'Admin',scope:'Project scope',capabilities:null,expiresAt:null})
  if(context.visibility!=='private')memberships.push({projectId,project:context.name,who:context.visibility==='workspace'?'Current workspace members':'Current project team members',level:context.visibility==='workspace'?context.workspace_level:context.team_level,scope:'Project scope',capabilities:null,expiresAt:null})
  for(const grant of await activeGrants(db,'project',projectId)){
   const person=grant.grantee_type==='person'?(await displayNames(db,[grant.grantee_id])).get(grant.grantee_id):(await first<{name:string}>(db,'SELECT name FROM peg_teams WHERE id=?',grant.grantee_id))?.name
   memberships.push({projectId,project:context.name,who:person??'Former member',level:grant.level,scope:grant.scope==='assignee'?'Assigned work only':grant.scope==='approve'?'Approval only':'Project scope',capabilities:grant.scopes,expiresAt:grant.expires_at})
  }
 }
 const options={kind:input.kind,sourceId:source.id,targetProjectId,taskIds:selected,retainIds:retained,visibility,name}
 const payload={kind:input.kind,source,target:{type:input.kind==='task_to_project'?'project':'task',title:name,projectId:targetProjectId},options,tasks,mapping,reconciliation,repairs,capacity,memberships,visibility:{before:project.visibility,after:visibility,note:'The same owner, native grant restrictions and expiry are retained. Historical files keep their original project context.'},contextIds:[...contextIds].sort(),project,homes,selected}
 return {...payload,rev,token:await digest([actor.id,rev,payload])}
}
function ancestorOf(tasks:TaskRow[],root:string,id:string){let current=tasks.find(t=>t.id===id);for(let depth=0;current?.parent_id&&depth<50;depth++){if(current.parent_id===root)return true;current=tasks.find(t=>t.id===current!.parent_id)}return false}
export async function applyProjectConversion(db:D1Database,actor:Actor,workspace:string,input:ProjectConversionInput){
 const replay=await operationReplay(db,actor,workspace,input);if(replay)return replay
 const preview=await previewProjectConversion(db,actor,workspace,input)
 if(input.token!==preview.token)throw conflict('conversion_preview_changed')
 const id=newId('conversion'),at=now(),effects:ConversionEffect[]=[],statements:D1PreparedStatement[]=[],project=preview.project
 let targetId:string,targetType:'task'|'project'
 if(input.kind==='task_to_project'){
  targetType='project';targetId=newId('prj')
  const task=preview.tasks.find(t=>t.id===preview.source.id)!
  statements.push(bound(db,'INSERT INTO peg_projects(id,workspace_id,name,description,owner_id,team_id,visibility,team_level,workspace_level,start_date,due_date,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',[targetId,workspace,preview.options.name,task.description,project.owner_id,project.team_id,project.visibility,project.team_level,project.workspace_level,task.start_date,task.due_date,actor.id,at]))
  const origin=await first<{template_id:string;source_id:string}>(db,"SELECT template_id,source_id FROM peg_template_origins WHERE object_type='project' AND object_id=?",project.id)
  if(origin)statements.push(bound(db,"INSERT INTO peg_template_origins VALUES('project',?,?,?)",[targetId,origin.template_id,origin.source_id]))
  for(const grant of await activeGrants(db,'project',project.id)){
   const grantId=newId('grant')
   statements.push(bound(db,"INSERT INTO peg_grants(id,workspace_id,object_type,object_id,grantee_type,grantee_id,level,scope,scopes,source,created_by,created_at,expires_at) VALUES(?,?,'project',?,?,?,?,?,?,'direct',?,?,?)",[grantId,workspace,targetId,grant.grantee_type,grant.grantee_id,grant.level,grant.scope,grant.scopes,actor.id,at,grant.expires_at]))
   if(origin&&await first(db,'SELECT 1 FROM peg_recurring_grants WHERE grant_id=?',grant.id))statements.push(bound(db,'INSERT INTO peg_recurring_grants VALUES(?)',[grantId]))
  }
  for(const field of await all<{key:string;field_id:string}>(db,'SELECT key,field_id FROM peg_project_fields WHERE project_id=? ORDER BY key',project.id))statements.push(bound(db,'INSERT INTO peg_project_fields VALUES(?,?,?)',[targetId,field.key,field.field_id]))
  for(const child of preview.tasks.filter(t=>t.parent_id===task.id)){
   effects.push({kind:'task_structure',taskId:child.id,before:{parentId:task.id,kind:child.kind},after:{parentId:null,kind:child.kind==='subtask'?'task':child.kind}})
   statements.push(bound(db,'UPDATE peg_tasks SET parent_id=NULL,kind=? WHERE id=?',[child.kind==='subtask'?'task':child.kind,child.id]))
   for(const home of [...preview.homes.map(h=>({...h,task_id:child.id,added_by:actor.id,added_at:at})),{task_id:child.id,project_id:targetId,section_id:null,fields:'{}',position:0,added_by:actor.id,added_at:at}]){
    const existing=await first<any>(db,'SELECT * FROM peg_task_projects WHERE task_id=? AND project_id=?',child.id,home.project_id)
    if(existing)throw conflict('conversion_detached_placement')
    effects.push({kind:'placement',taskId:child.id,projectId:home.project_id,before:null,after:home})
    statements.push(bound(db,'INSERT INTO peg_task_projects VALUES(?,?,?,?,?,?,?)',[child.id,home.project_id,home.section_id,home.fields,home.position,actor.id,at]))
   }
  }
 }else{
  targetType='task'
  const prepared=await prepareTask(db,actor,{workspaceId:workspace,projectId:preview.options.targetProjectId!,title:preview.options.name,description:project.description,ownerId:project.owner_id,startDate:project.start_date,dueDate:project.due_date,status:'todo'},{queueRules:false})
  targetId=prepared.id;statements.push(...prepared.statements)
  if(preview.options.targetProjectId!==project.id)statements.push(bound(db,'INSERT INTO peg_task_projects(task_id,project_id,position,added_by,added_at) VALUES(?,?,0,?,?)',[targetId,project.id,actor.id,at]))
  for(const task of preview.tasks.filter(t=>preview.selected.includes(t.id))){
   const placement=(await projectHomes(db,task.id))[0];effects.push({kind:'placement',taskId:task.id,projectId:project.id,before:placement,after:null});statements.push(bound(db,'DELETE FROM peg_task_projects WHERE task_id=? AND project_id=?',[task.id,project.id]));
   effects.push({kind:'task_structure',taskId:task.id,before:{parentId:task.parent_id,kind:task.kind},after:{parentId:targetId,kind:'subtask'}});statements.push(bound(db,"UPDATE peg_tasks SET parent_id=?,kind='subtask' WHERE id=?",[targetId,task.id]))}
  statements.push(bound(db,'UPDATE peg_webhooks SET revoked_at=COALESCE(revoked_at,?) WHERE project_id=?',[at,project.id]),bound(db,'UPDATE peg_template_rules SET enabled=0,activation_id=NULL WHERE project_id=?',[project.id]),bound(db,'UPDATE peg_bundle_adoptions SET enabled=0 WHERE project_id=?',[project.id]),bound(db,"UPDATE peg_recurrences SET active=0,held=1 WHERE template_id IN(SELECT id FROM peg_work_templates WHERE source_type='project' AND source_id=?)",[project.id]))
 }
 // Structural changes reopen task sign-off with the exact actor. Historical proof decisions remain on their original version.
 for(const task of preview.tasks){statements.unshift(reopenGuard(db,task.id,actor.id,'conversion'));statements.push(bound(db,"UPDATE peg_tasks SET status='todo',completed_at=NULL,updated_at=? WHERE id=? AND status='done' AND EXISTS(SELECT 1 FROM peg_approval_tasks WHERE task_id=?)",[at,task.id,task.id]),historyStatement(db,task.id,null,actor.id,'converted',{conversionId:id,kind:input.kind}))}
 const options={...preview.options,mapping:preview.mapping.map(({taskId,action})=>({taskId,action}))}
 statements.push(...conversionStatements(db,actor,workspace,{id,kind:input.kind,sourceType:preview.source.type,sourceId:preview.source.id,targetType,targetId,token:preview.token,options,reconciliation:{digest:preview.reconciliation.digest},effects,links:[...preview.tasks.map(task=>({type:'task' as const,id:task.id,relation:'work'})),...preview.contextIds.map(id=>({type:'project' as const,id,relation:'context'}))],repairs:preview.repairs}))
 try{await guarded(db,preview.rev,statements)}catch(error){const replay=await operationReplay(db,actor,workspace,input);if(replay)return replay;throw error}
 return conversionView(db,actor,id)
}
