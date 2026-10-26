import {all,bound,conflict,first,forbidden,invalid,newId,now} from '../db'
import {digest,guarded,revision} from '../decisions/revision'
import {workspaceRole,displayNames,type Actor} from '../workspace/people'
import {getTemplate,templateMember} from './definitions'
import {openProject,need} from '../workspace/projects'
import {openTask} from '../tasks/access'
import {addWorking,dayNumber,dayString,workspaceZone} from '../schedule/calendar'
import {historyStatement} from '../tasks/history'
import {auditStatement} from '../authorization/audit'
import {fieldVersionStatement} from '../revisions/field-store'
import type {TemplateInput} from './types'
export function readTemplateInput(input:Record<string,any>):TemplateInput {
 let roles=input.roles
 if(typeof roles==='string'){try{roles=JSON.parse(roles)}catch{throw invalid('template_roles')}}
 if(!roles||typeof roles!=='object'||Array.isArray(roles))throw invalid('template_roles')
 return {templateId:String(input.templateId??''),version:Number(input.version),startDate:String(input.startDate??''),name:String(input.name??'').trim(),roles:Object.fromEntries(Object.entries(roles).sort(([a],[b])=>a.localeCompare(b))) as Record<string,string|null>,keepUnassigned:input.keepUnassigned===true||input.keepUnassigned==='on'||input.keepUnassigned==='true',...(input.targetProjectId?{targetProjectId:String(input.targetProjectId)}:{}),...(input.token?{token:String(input.token)}:{})}
}
export async function templatePreview(db:D1Database,actor:Actor,workspace:string,raw:TemplateInput|Record<string,any>){
 const rev=await revision(db),input=readTemplateInput(raw),role=await templateMember(db,actor,workspace),view=await getTemplate(db,actor,workspace,input.templateId,input.version)
 if(!Number.isInteger(input.version)||input.version<1||!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate)||!Number.isFinite(dayNumber(input.startDate))||dayString(dayNumber(input.startDate))!==input.startDate)throw invalid('template_start_date')
 if(!input.name.trim()||input.name.length>120)throw invalid('name');input.name=input.name.trim()
 let target=null
 if(input.targetProjectId){const opened=await openProject(db,actor,input.targetProjectId);if(opened.project.workspace_id!==workspace)throw invalid('workspace');need(opened.effective,role==='agent'?'edit':'manage_templates');target=opened.project}
 else if(!['owner','admin','manager','member','agent'].includes(role))throw forbidden('create_project')
 const missingRoles:string[]=[],unassignedRoles:string[]=[],roleMap:Record<string,string|null>={}
 for(const key of view.definition.roles){
  const selected=input.roles[key]
  if(selected===undefined||selected===null&&!input.keepUnassigned){missingRoles.push(key);roleMap[key]=null;continue}
  if(selected===null){unassignedRoles.push(key);roleMap[key]=null;continue}
  if(typeof selected!=='string'||!selected)throw invalid('template_role_member')
  const member=await workspaceRole(db,selected,workspace);if(!member||['guest','agent','analyst'].includes(member))throw invalid('template_role_member')
  roleMap[key]=selected
 }
 for(const key of Object.keys(input.roles))if(!view.definition.roles.includes(key))throw invalid('unknown_template_role')
 const names=await displayNames(db,Object.values(roleMap).filter((v):v is string=>v!==null)),unreachableOwners:string[]=[]
 for(const id of new Set(Object.values(roleMap).filter((v):v is string=>v!==null))){
  if(target){const person={...actor,id};try{await openProject(db,person,target.id)}catch{unreachableOwners.push(id)}}else if(id!==actor.id&&!['owner','admin'].includes((await workspaceRole(db,id,workspace))??''))unreachableOwners.push(id)
 }
 const configurationConflicts:{kind:string;key:string;reason:string}[]=[]
 if(target){for(const field of view.definition.fields){const existing=await first<{type:string;label:string;visibility:string;config:string}>(db,'SELECT d.* FROM peg_project_fields p JOIN peg_field_definitions d ON d.id=p.field_id WHERE p.project_id=? AND p.key=?',target.id,field.key);if(existing&&(existing.type!==field.type||existing.label!==field.label||existing.visibility!=='everyone'||existing.config!==JSON.stringify(field.options?{options:field.options}:{})))configurationConflicts.push({kind:'field',key:field.key,reason:'Existing field definition differs; it will not be overwritten.'})}for(const phase of view.definition.phases){const section=await first<{maps_to:string|null}>(db,'SELECT maps_to FROM peg_sections WHERE project_id=? AND name=? ORDER BY position,id',target.id,phase);if(section?.maps_to&&section.maps_to!=='todo')configurationConflicts.push({kind:'phase',key:phase,reason:'Existing phase maps to another task status.'})}}
 const tasks=view.definition.tasks.map(t=>({...t,startDate:dayString(addWorking(dayNumber(input.startDate),t.start)),dueDate:dayString(addWorking(dayNumber(input.startDate),t.due)),ownerId:roleMap[t.role],owner:roleMap[t.role]?names.get(roleMap[t.role]!)??'Member':'Unassigned',approvalState:t.approval?'pending':null}))
 const from=tasks.map(t=>t.startDate).sort()[0],through=tasks.map(t=>t.dueDate).sort().at(-1)!,capacity=[]
 for(const id of new Set(tasks.map(t=>t.ownerId))){
  const assigned=tasks.filter(t=>t.ownerId===id);let visibleExistingHours=0
  if(id)for(const row of await all<{id:string;estimate_hours:number}>(db,"SELECT id,estimate_hours FROM peg_tasks WHERE workspace_id=? AND owner_id=? AND status!='done' AND COALESCE(due_date,?)>=? AND COALESCE(start_date,?)<=?",workspace,id,through,from,from,through)){
   try{await openTask(db,actor,row.id);visibleExistingHours+=row.estimate_hours}catch(error){if((error as {status?:number}).status!==404)throw error}
  }
  capacity.push({ownerId:id,owner:id?names.get(id)??'Member':'Unassigned',addedHours:assigned.reduce((n,t)=>n+t.hours,0),visibleExistingHours,availableHours:null,from,through,notice:'Capacity is not configured. Existing hours include only work you can read.'})
 }
 const plan={templateId:view.template.id,version:view.version,headVersion:view.headVersion,name:input.name,startDate:input.startDate,targetProjectId:input.targetProjectId??null,kind:view.definition.kind,description:view.definition.description,phases:view.definition.phases,fields:view.definition.fields,dependencies:view.definition.dependencies,rules:view.definition.rules.map(r=>({...r,active:false})),roles:roleMap,keepUnassigned:input.keepUnassigned??false,missingRoles,unassignedRoles,unreachableOwners,configurationConflicts,tasks,capacity,visibility:target?.visibility??'private',timezone:workspaceZone}
 return {...plan,rev,token:await digest([actor.id,workspace,rev,plan]),notice:'New projects are private. Assignment grants no access. Rules stay inactive. Comments, files, secrets, client guests and prior decisions are not copied.'}
}
export async function applyTemplate(db:D1Database,actor:Actor,workspace:string,raw:TemplateInput|Record<string,any>,internalRule?:{id:string}){
 const input=readTemplateInput(raw),role=await templateMember(db,actor,workspace);if(role==='agent')throw forbidden('human_template_review')
 const requestKey=input.token??'',prior=await first<{result:string;input:string}>(db,'SELECT result,input FROM peg_template_applications WHERE workspace_id=? AND actor_id=? AND request_key=?',workspace,actor.id,requestKey)
 if(prior){if(JSON.stringify({...input,token:undefined})!==JSON.stringify({...readTemplateInput(JSON.parse(prior.input)),token:undefined}))throw conflict('template_preview_changed');const result=JSON.parse(prior.result),opened=await openProject(db,actor,result.projectId);if(!internalRule)need(opened.effective,'manage_templates');return result as {projectId:string;taskIds:string[];applicationId:string}}
 const view=await templatePreview(db,actor,workspace,input)
 if(view.missingRoles.length)throw invalid('template_roles_unresolved')
 if(view.configurationConflicts.length)throw conflict('template_configuration_conflict')
 if(!internalRule&&requestKey!==view.token)throw conflict('template_preview_changed')
 const ruleGuard=internalRule?await (await import('./rule-execution')).assertTemplateRuleExecution(db,actor,internalRule.id,requestKey,input):null
 const projectId=input.targetProjectId??newId('prj'),applicationId=newId('application'),at=now(),statements:D1PreparedStatement[]=[...(ruleGuard?.statements??[])]
 if(!input.targetProjectId)statements.push(bound(db,'INSERT INTO peg_projects(id,workspace_id,name,description,owner_id,visibility,start_date,due_date,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',[projectId,workspace,view.name,view.description,actor.id,'private',view.startDate,view.tasks.map(t=>t.dueDate).sort().at(-1)!,actor.id,at]))
 const sections=new Map<string,string>(),fields=new Map<string,string>(),tasks=new Map(view.tasks.map(t=>[t.key,newId('tsk')]))
 const position=(await first<{n:number}>(db,'SELECT COALESCE(MAX(position),-1)+1 n FROM peg_sections WHERE project_id=?',projectId))!.n
 for(const [i,phase] of view.phases.entries()){const existing=await first<{id:string}>(db,'SELECT id FROM peg_sections WHERE project_id=? AND name=? ORDER BY position,id',projectId,phase);const id=existing?.id??newId('sec');sections.set(phase,id);if(!existing)statements.push(bound(db,'INSERT INTO peg_sections VALUES(?,?,?,?,?)',[id,projectId,phase,position+i,'todo']))}
 for(const field of view.fields){
  const existing=await first<{id:string;type:string;label:string;config:string;visibility:string}>(db,'SELECT d.* FROM peg_project_fields f JOIN peg_field_definitions d ON d.id=f.field_id WHERE f.project_id=? AND f.key=?',projectId,field.key)
  const config=JSON.stringify(field.options?{options:field.options}:{})
  if(existing){if(existing.type!==field.type||existing.label!==field.label||existing.visibility!=='everyone'||existing.config!==config)throw conflict('template_field_key_exists');fields.set(field.key,existing.id);continue}
  const id=newId('fld');fields.set(field.key,id)
  statements.push(bound(db,'INSERT INTO peg_field_definitions(id,workspace_id,authority_project,key,label,type,visibility,config) VALUES(?,?,?,?,?,?,?,?)',[id,workspace,projectId,field.key,field.label,field.type,'everyone',JSON.stringify(field.options?{options:field.options}:{})]),bound(db,'INSERT INTO peg_project_fields VALUES(?,?,?)',[projectId,field.key,id]),fieldVersionStatement(db,id,actor.id))
 }
 const target=input.targetProjectId?(await openProject(db,actor,projectId)).project:null
 const counter=target?.prefix?await first<{next_number:number}>(db,'SELECT next_number FROM peg_ref_prefixes WHERE prefix=?',target.prefix):null
 if(counter&&target?.prefix)statements.push(bound(db,'UPDATE peg_ref_prefixes SET next_number=next_number+? WHERE prefix=?',[view.tasks.length,target.prefix]))
 for(const [i,task] of view.tasks.entries()){
  const id=tasks.get(task.key)!
  statements.push(bound(db,'INSERT INTO peg_tasks(id,workspace_id,title,kind,parent_id,start_date,due_date,owner_id,creator_id,estimate_hours,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',[id,workspace,task.title,task.parent?'subtask':task.kind??'task',task.parent?tasks.get(task.parent)!:null,task.startDate,task.dueDate,task.ownerId??'',actor.id,task.hours,at,at]))
  if(!task.parent)statements.push(bound(db,'INSERT INTO peg_task_projects(task_id,project_id,section_id,position,added_by,added_at) VALUES(?,?,?,?,?,?)',[id,projectId,sections.get(task.phase)!,i,actor.id,at]))
  if(task.approval)statements.push(bound(db,'INSERT INTO peg_approval_tasks VALUES(?,?,?)',[id,actor.id,at]))
  for(const [key,value] of Object.entries(task.fields))statements.push(bound(db,'INSERT INTO peg_field_values VALUES(?,?,?)',[id,fields.get(key)!,JSON.stringify(value)]))
  if(counter&&target?.prefix)statements.push(bound(db,'INSERT INTO peg_task_refs VALUES(?,?,1,?)',[`${target.prefix}-${counter.next_number+i}`,id,at]))
  statements.push(historyStatement(db,id,null,actor.id,'created',{templateId:input.templateId,version:input.version,applicationId,taskKey:task.key}),bound(db,'INSERT INTO peg_template_task_origins VALUES(?,?,?,?)',[applicationId,task.key,id,JSON.stringify({title:task.title,ownerId:task.ownerId??'',startDate:task.startDate,dueDate:task.dueDate,hours:task.hours,fields:task.fields,phase:task.phase,parent:task.parent??null,kind:task.kind??'task',approval:!!task.approval})]))
  if(internalRule)statements.push(bound(db,'INSERT INTO peg_template_rule_generated_tasks VALUES(?,?)',[id,requestKey.slice('template-rule:'.length)]))
 }
 for(const edge of view.dependencies)statements.push(bound(db,'INSERT INTO peg_dependencies VALUES(?,?,?,?,?,?,?,?)',[newId('dep'),workspace,tasks.get(edge.predecessor)!,tasks.get(edge.successor)!,edge.type,edge.lag,actor.id,at]))
 for(const rule of view.rules)statements.push(bound(db,'INSERT INTO peg_template_staged_rules VALUES(?,?,?,?,?,0)',[newId('stagedrule'),applicationId,projectId,rule.key,JSON.stringify(rule)]))
 const result={applicationId,projectId,taskIds:[...tasks.values()]}
 statements.push(bound(db,'INSERT INTO peg_template_applications VALUES(?,?,?,?,?,?,?,?,?,?)',[applicationId,input.templateId,input.version,projectId,workspace,actor.id,requestKey,JSON.stringify({...input,token:undefined}),JSON.stringify(result),at]),auditStatement(db,{workspaceId:workspace,actorId:actor.id,action:'template.applied',targetType:'project',targetId:projectId,detail:{applicationId,templateId:input.templateId,version:input.version,ruleId:internalRule?.id??null}}))
 try{await guarded(db,view.rev,statements)}catch(error){const done=await first<{result:string}>(db,'SELECT result FROM peg_template_applications WHERE workspace_id=? AND actor_id=? AND request_key=?',workspace,actor.id,requestKey);if(done)return JSON.parse(done.result) as typeof result;if(/template_rule_activation_changed/.test(String(error)))throw conflict('template_rule_activation_changed');throw error}
 return result
}
