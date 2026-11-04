import { all, bound, conflict, first, forbidden, invalid, newId, notFound, now } from '../db'
import { digest, guarded, revision } from '../decisions/revision'
import { getTemplate, listTemplates } from '../templates/definitions'
import { templatePreview } from '../templates/instantiation'
import { openTask, require } from '../tasks/access'
import { prepareTask, updateTask } from '../tasks/tasks'
import { historyStatement } from '../tasks/history'
import { permanentEvent } from '../audit/search'
import { administer, formRow, published, type Definition } from './forms'
import type { Submission } from './submissions'
import type { Actor } from '../workspace/people'

export interface TemplatePin { id:string; version:number }
export async function permittedIntakeTemplate(db:D1Database,actor:Actor,workspace:string,pin:TemplatePin) {
 const view=await getTemplate(db,actor,workspace,pin.id,pin.version),d=view.definition
 // This door applies only nested plain work; it never silently drops other configuration.
 if(d.kind!=='task'||d.fields.length||d.dependencies.length||d.rules.length||d.tasks.length>30||d.tasks.some(t=>t.approval||t.kind==='milestone'||Object.keys(t.fields).length))throw invalid('intake_template_unsupported')
 return view
}
export async function mappingContext(db:D1Database,actor:Actor,id:string) {
 const submission=await first<Submission & {answers:string|null;template_pin:string|null}>(db,'SELECT * FROM peg_intake_submissions WHERE id=?',id)
 if(!submission)throw notFound()
 const row=await formRow(db,submission.form_id),{project}=await administer(db,actor,row.project_id)
 if(actor.apiScope)throw forbidden('human_intake_template')
 const opened=await openTask(db,actor,submission.task_id);require(opened.access,'edit')
 const {actor:publisher}=await published(db,row)
 if(submission.source_actor==='public_intake'||!submission.answers||!submission.template_pin||submission.form_version!==row.version)throw conflict('intake_template_review_unavailable')
 const pin=JSON.parse(submission.template_pin) as TemplatePin
 if(JSON.stringify((JSON.parse(row.definition) as Definition).template)!==JSON.stringify(pin))throw conflict('intake_template_changed')
 await permittedIntakeTemplate(db,publisher,project.workspace_id,pin)
 const template=await permittedIntakeTemplate(db,actor,project.workspace_id,pin)
 const application=await first<{id:string;state:string;actor_id:string;created_at:number}>(db,'SELECT id,state,actor_id,created_at FROM peg_intake_template_applications WHERE submission_id=?',id)
 return {submission,row,project,task:opened.task,pin,template,application}
}
export async function intakeTemplatePreview(db:D1Database,actor:Actor,id:string,input:Record<string,any>) {
 const rev=await revision(db),context=await mappingContext(db,actor,id),{submission,project,task,pin}=context
 // Existing graph or schedule constraints require their own reviewed doors.
 if(task.parent_id||task.kind!=='task'||task.status==='done'||await first(db,`SELECT 1 FROM peg_tasks WHERE parent_id=? UNION SELECT 1 FROM peg_dependencies WHERE predecessor_id=? OR successor_id=? UNION SELECT 1 FROM peg_approval_tasks WHERE task_id=? UNION SELECT 1 FROM peg_calendar_blocks WHERE task_id=? UNION SELECT 1 FROM peg_task_projects WHERE task_id=? AND project_id<>?`,task.id,task.id,task.id,task.id,task.id,task.id,project.id))throw conflict('intake_template_existing_configuration')
 const preview=await templatePreview(db,actor,project.workspace_id,{templateId:pin.id,version:pin.version,startDate:input.startDate,name:task.title,roles:input.roles,keepUnassigned:false,targetProjectId:project.id})
 if(preview.missingRoles.length||preview.unreachableOwners.length||preview.configurationConflicts.length)throw invalid('intake_template_roles')
 const root=preview.tasks.find(t=>!t.parent)!
 const plan={submissionId:id,taskId:task.id,projectId:project.id,templateId:pin.id,version:pin.version,headVersion:context.template.headVersion,templateName:context.template.template.name,answers:JSON.parse(submission.answers!),title:task.title,description:task.description,submittedAt:submission.submitted_at,deadline:submission.deadline,triagedAt:submission.triaged_at,roles:preview.roles,startDate:preview.startDate,rootKey:root.key,before:{ownerId:task.owner_id,startDate:task.start_date,dueDate:task.due_date,hours:task.estimate_hours},tasks:preview.tasks.map(t=>({...t,title:t.parent?t.title:task.title,existingTaskId:t.parent?null:task.id})),capacity:preview.capacity}
 return {...plan,rev,token:await digest([actor.id,rev,plan])}
}
export async function applyIntakeTemplate(db:D1Database,actor:Actor,id:string,input:Record<string,any>) {
 const context=await mappingContext(db,actor,id),{task,project,pin}=context
 let roles=input.roles;try{if(typeof roles==='string')roles=JSON.parse(roles)}catch{throw invalid('template_roles')}
 const inputHash=await digest([input.startDate,roles&&Object.fromEntries(Object.entries(roles).sort(([a],[b])=>a.localeCompare(b)))])
 if(!(input.confirm===true||input.confirm==='on'))throw conflict('intake_template_confirmation')
 const prior=await first<{id:string;actor_id:string;token:string;state:string;result:string;input_hash:string}>(db,'SELECT * FROM peg_intake_template_applications WHERE submission_id=?',id)
 if(prior){
  if(prior.actor_id!==actor.id||prior.token!==input.token||prior.state!=='applied'||prior.input_hash!==inputHash)throw conflict('intake_template_already_applied')
  const result=JSON.parse(prior.result) as {applicationId:string;taskId:string;taskIds:string[]}
  for(const taskId of result.taskIds){const opened=await openTask(db,actor,taskId);require(opened.access,'edit')}
  return {...result,replayed:true}
 }
 const view=await intakeTemplatePreview(db,actor,id,input)
 if(input.token!==view.token)throw conflict('intake_template_review_changed')
 const applicationId=newId('mapping'),at=now(),ids=new Map(view.tasks.map(t=>[t.key,t.parent?newId('tsk'):task.id])),statements:D1PreparedStatement[]=[]
 // Prepare every child through the ordinary task checks against the existing root.
 // A deeper parent is substituted only after its validated ancestor is prepared.
 const remaining=view.tasks.filter(t=>t.parent)
 while(remaining.length){
  const index=remaining.findIndex(t=>t.parent===view.rootKey||!remaining.some(p=>p.key===t.parent));if(index<0)throw invalid('intake_template_parent')
  const child=remaining.splice(index,1)[0],prepared=await prepareTask(db,actor,{parentId:task.id,projectId:project.id,title:child.title,ownerId:child.ownerId!,startDate:child.startDate,dueDate:child.dueDate,estimateHours:child.hours},{queueRules:false,pendingParentId:ids.get(child.parent!)!})
  ids.set(child.key,prepared.id)
  // The prepared parent is from this exact reviewed tree.
  statements.push(...prepared.statements)
 }
 const result={applicationId,taskId:task.id,taskIds:[...ids.values()]}
 statements.push(bound(db,'INSERT INTO peg_intake_template_applications(id,submission_id,project_id,template_id,template_version,actor_id,token,result,state,created_at,input_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?)',[applicationId,id,project.id,pin.id,pin.version,actor.id,view.token,JSON.stringify(result),'applied',at,inputHash]))
 for(const node of view.tasks)statements.push(bound(db,'INSERT INTO peg_intake_template_tasks(application_id,task_key,task_id,owner_id,before_owner,start_date,due_date) VALUES(?,?,?,?,?,?,?)',[applicationId,node.key,ids.get(node.key)!,node.ownerId,node.parent?null:task.owner_id,node.startDate,node.dueDate]))
 statements.push(historyStatement(db,task.id,project.id,actor.id,'intake.template_applied',{applicationId,templateId:pin.id,version:pin.version,submissionId:id}),permanentEvent(db,{workspace:project.workspace_id,actor:actor.id,action:'intake.template_applied',type:'task',id:task.id,metadata:{operationId:applicationId,sourceId:id,templateId:pin.id,version:pin.version,count:ids.size,scopeDigest:view.token}}))
 const root=view.tasks.find(t=>!t.parent)!
 try{await updateTask(db,actor,task.id,{ownerId:root.ownerId!,startDate:root.startDate,dueDate:root.dueDate,estimateHours:root.hours},view.rev,statements)}catch(error){
  const saved=await first<{actor_id:string;token:string;result:string;state:string}>(db,'SELECT * FROM peg_intake_template_applications WHERE submission_id=?',id)
  if(saved?.actor_id===actor.id&&saved.token===input.token&&saved.state==='applied'){await mappingContext(db,actor,id);return {...JSON.parse(saved.result),replayed:true}}
  throw error
 }
 return {...result,replayed:false}
}

export async function mappingErasureScope(db:D1Database,person:string) {
 return all<{id:string;submission_id:string;project_id:string;actor:number}>(db,`SELECT a.id,a.submission_id,a.project_id,a.actor_id=? actor FROM peg_intake_template_applications a WHERE a.actor_id=? OR EXISTS(SELECT 1 FROM peg_intake_template_tasks t WHERE t.application_id=a.id AND (t.owner_id=? OR t.before_owner=?)) ORDER BY a.id`,person,person,person,person)
}
export function mappingErasureStatements(db:D1Database,person:string,scope:Awaited<ReturnType<typeof mappingErasureScope>>) {
 return scope.flatMap(row=>[bound(db,"UPDATE peg_intake_template_applications SET actor_id=CASE WHEN actor_id=? THEN 'erased' ELSE actor_id END,state='inactive' WHERE id=?",[person,row.id]),bound(db,'UPDATE peg_intake_template_tasks SET owner_id=CASE WHEN owner_id=? THEN NULL ELSE owner_id END,before_owner=CASE WHEN before_owner=? THEN NULL ELSE before_owner END WHERE application_id=?',[person,person,row.id])])
}

export async function intakeTemplateChoices(db:D1Database,actor:Actor,workspace:string) {
 const choices=[]
 for(const item of await listTemplates(db,actor,workspace)){
  try{await permittedIntakeTemplate(db,actor,workspace,{id:item.template.id,version:item.version});choices.push({value:JSON.stringify({id:item.template.id,version:item.version}),label:item.template.name+' · version '+item.version})}catch(error){if((error as {code?:string}).code!=='intake_template_unsupported')throw error}
 }
 return choices
}
