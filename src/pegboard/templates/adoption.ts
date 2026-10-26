import {all,bound,conflict,first,forbidden,invalid,newId,notFound,now} from '../db'
import {digest,guarded} from '../decisions/revision'
import {getTemplate} from './definitions'
import {templatePreview,readTemplateInput} from './instantiation'
import {openProject,need} from '../workspace/projects'
import {openTask} from '../tasks/access'
import {historyStatement,reopenGuard} from '../tasks/history'
import {fieldVersionStatement} from '../revisions/field-store'
import type {Actor} from '../workspace/people'
import type {TaskRow} from '../model'
export interface Application {id:string;template_id:string;version:number;project_id:string;workspace_id:string;actor_id:string;input:string;result:string;created_at:number}
export async function listTemplateApplications(db:D1Database,actor:Actor,projectId:string){const {effective}=await openProject(db,actor,projectId);need(effective,'manage_templates');return (await all<Application>(db,'SELECT * FROM peg_template_applications WHERE project_id=? ORDER BY created_at DESC,id',projectId)).map(a=>({...a,input:JSON.parse(a.input),result:JSON.parse(a.result)}))}
export async function loadApplication(db:D1Database,actor:Actor,id:string){const a=await first<Application>(db,'SELECT * FROM peg_template_applications WHERE id=?',id);if(!a)throw notFound();const {effective}=await openProject(db,actor,a.project_id);need(effective,'manage_templates');if(effective.role==='agent')throw forbidden('human_template_review');return a}
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
interface TaskBase {title:string;ownerId:string;startDate:string;dueDate:string;hours:number;phase:string;parent:string|null;kind:string;approval:boolean;fields:Record<string,string|number|boolean>}
interface AdoptionRow {key:string;taskId:string|null;state:string;base:any;current:Record<string,any>|null;next:TaskBase|null;changes:{field:string;before:unknown;after:unknown;state:string}[]}
export async function adoptionPreview(db:D1Database,actor:Actor,id:string,input:Record<string,any>){
 const application=await loadApplication(db,actor,id),original=JSON.parse(application.input),nextInput=readTemplateInput({...original,...input,templateId:application.template_id,version:Number(input.version),targetProjectId:application.project_id})
 const definition=(await getTemplate(db,actor,application.workspace_id,application.template_id,nextInput.version)).definition
 nextInput.roles=Object.fromEntries(Object.entries(nextInput.roles).filter(([key])=>definition.roles.includes(key)))
 const plan=await templatePreview(db,actor,application.workspace_id,nextInput)
 delete nextInput.token
 const origins=await all<{task_key:string;task_id:string;base:string}>(db,'SELECT * FROM peg_template_task_origins WHERE application_id=? ORDER BY task_key',id),rows:AdoptionRow[]=[]
 for(const next of plan.tasks){
  const origin=origins.find(o=>o.task_key===next.key),base=origin?JSON.parse(origin.base):null,changes: {field:string;before:unknown;after:unknown;state:string}[]=[]
  const desired={title:next.title,ownerId:next.ownerId??'',startDate:next.startDate,dueDate:next.dueDate,hours:next.hours,phase:next.phase,parent:next.parent??null,kind:next.kind??'task',approval:!!next.approval,fields:next.fields}
  let state='added',current:Record<string,any>|null=null
  if(origin){
   const {task}=await openTask(db,actor,origin.task_id)
   const section=await first<{name:string}>(db,'SELECT s.name FROM peg_task_projects p JOIN peg_sections s ON s.id=p.section_id WHERE p.task_id=? AND p.project_id=?',task.id,application.project_id)
   const values:Record<string,unknown>={};for(const field of plan.fields){const v=await first<{value:string}>(db,'SELECT v.value FROM peg_field_values v JOIN peg_project_fields f ON f.field_id=v.field_id WHERE v.task_id=? AND f.project_id=? AND f.key=?',task.id,application.project_id,field.key);if(v)values[field.key]=JSON.parse(v.value)}
   current={title:task.title,ownerId:task.owner_id,startDate:task.start_date,dueDate:task.due_date,hours:task.estimate_hours,phase:section?.name??base.phase,parent:origins.find(o=>o.task_id===task.parent_id)?.task_key??null,kind:task.kind,approval:!!await first(db,'SELECT 1 FROM peg_approval_tasks WHERE task_id=?',task.id),fields:values}
   for(const key of ['title','ownerId','startDate','dueDate','hours','phase','parent','kind','approval'])if(!equal(base[key],desired[key as keyof typeof desired]))changes.push({field:key,before:current[key],after:desired[key as keyof typeof desired],state:!equal(current[key],base[key])?'preserved':key==='parent'||key==='kind'?'incompatible':key==='approval'&&base.approval?'preserved':'compatible'})
   for(const key of new Set([...Object.keys(base.fields??{}),...Object.keys(next.fields)]))if(!equal(base.fields?.[key],next.fields[key]))changes.push({field:`field:${key}`,before:values[key]??null,after:next.fields[key]??null,state:equal(values[key],base.fields?.[key])?'compatible':'preserved'})
   state=changes.some(c=>c.state==='compatible')?'compatible':changes.some(c=>c.state==='preserved')?'preserved':changes.some(c=>c.state==='incompatible')?'incompatible':'unchanged'
  }
  rows.push({key:next.key,taskId:origin?.task_id??null,state,base,current,next:desired,changes})
 }
 for(const origin of origins.filter(o=>!plan.tasks.some(t=>t.key===o.task_key)))rows.push({key:origin.task_key,taskId:origin.task_id,state:'retained',base:JSON.parse(origin.base),current:null,next:null,changes:[]})
 const fields=[]
 for(const f of plan.fields){const existing=await first<{id:string;label:string;type:string;config:string;visibility:string}>(db,'SELECT d.* FROM peg_project_fields f JOIN peg_field_definitions d ON d.id=f.field_id WHERE f.project_id=? AND f.key=?',application.project_id,f.key);fields.push({...f,id:existing?.id??null,state:!existing?'added':existing.type===f.type&&existing.label===f.label&&existing.visibility==='everyone'&&existing.config===JSON.stringify(f.options?{options:f.options}:{})?'unchanged':'preserved'})}
 const selections=Array.isArray(input.keys)?input.keys.map(String):input.keys?[String(input.keys)]:rows.filter(r=>['compatible','added'].includes(r.state)).map(r=>r.key)
 if(selections.some(k=>!rows.some(r=>r.key===k)))throw invalid('template_adoption_selection')
 const preview={applicationId:id,projectId:application.project_id,templateId:application.template_id,version:plan.version,rows,fields,dependencies:plan.dependencies,rules:plan.rules,keys:[...new Set<string>(selections)],missingRoles:plan.missingRoles,unreachableOwners:plan.unreachableOwners,capacity:plan.capacity,input:nextInput}
 return {...preview,rev:plan.rev,token:await digest([actor.id,plan.rev,preview]),notice:'Only selected compatible task changes apply. Later human edits and removed work are retained. Existing field definitions and dependency edits stay in place. Rules remain inactive; approvals require new human decisions.'}
}
export async function adoptTemplate(db:D1Database,actor:Actor,id:string,input:Record<string,any>){
 const view=await adoptionPreview(db,actor,id,input);if(input.token!==view.token)throw conflict('template_adoption_changed');if(view.missingRoles.length)throw invalid('template_roles_unresolved');if(!view.keys.length)throw invalid('template_adoption_selection')
 const application=await loadApplication(db,actor,id),template=await getTemplate(db,actor,application.workspace_id,application.template_id,view.version),at=now(),statements:D1PreparedStatement[]=[],sections=new Map<string,string>(),fieldIds=new Map<string,string>(),taskIds=new Map(view.rows.filter(r=>r.taskId).map(r=>[r.key,r.taskId!]))
 for(const row of view.rows.filter(r=>view.keys.includes(r.key)&&r.state==='added'))taskIds.set(row.key,newId('tsk'))
 for(const [i,phase] of template.definition.phases.entries()){
  const section=await first<{id:string}>(db,'SELECT id FROM peg_sections WHERE project_id=? AND name=? ORDER BY position,id',view.projectId,phase),sectionId=section?.id??newId('sec');sections.set(phase,sectionId)
  if(!section)statements.push(bound(db,'INSERT INTO peg_sections VALUES(?,?,?,?,?)',[sectionId,view.projectId,phase,1000+i,'todo']))
 }
 for(const f of view.fields){
  if(f.state==='preserved')continue
  const fieldId=f.id??newId('fld');fieldIds.set(f.key,fieldId)
  if(!f.id)statements.push(bound(db,'INSERT INTO peg_field_definitions(id,workspace_id,authority_project,key,label,type,visibility,config) VALUES(?,?,?,?,?,?,?,?)',[fieldId,application.workspace_id,view.projectId,f.key,f.label,f.type,'everyone',JSON.stringify(f.options?{options:f.options}:{})]),bound(db,'INSERT INTO peg_project_fields VALUES(?,?,?)',[view.projectId,f.key,fieldId]),fieldVersionStatement(db,fieldId,actor.id))
 }
 const added=view.rows.filter(r=>view.keys.includes(r.key)&&r.state==='added'),project=(await openProject(db,actor,view.projectId)).project,counter=project.prefix?await first<{next_number:number}>(db,'SELECT next_number FROM peg_ref_prefixes WHERE prefix=?',project.prefix):null
 if(counter&&project.prefix){statements.push(bound(db,'UPDATE peg_ref_prefixes SET next_number=next_number+? WHERE prefix=?',[added.length,project.prefix]));for(const [i,row] of added.entries())statements.push(bound(db,'INSERT INTO peg_task_refs VALUES(?,?,1,?)',[`${project.prefix}-${counter.next_number+i}`,taskIds.get(row.key)!,at]))}
 for(const row of view.rows.filter(r=>view.keys.includes(r.key))){
  if(!row.next||!['compatible','added'].includes(row.state))continue
  const next=row.next,taskId=taskIds.get(row.key)!,base={...row.base,fields:{...(row.base?.fields??{})}}
  if(row.state==='added'){
   if(next.parent&&!taskIds.has(next.parent))throw invalid('template_parent_selection_required')
   const source=template.definition.tasks.find(t=>t.key===row.key)!,startDate=dayFrom(view.input.startDate,source.start),dueDate=dayFrom(view.input.startDate,source.due)
   statements.push(bound(db,'INSERT INTO peg_tasks(id,workspace_id,title,kind,parent_id,start_date,due_date,owner_id,creator_id,estimate_hours,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',[taskId,application.workspace_id,next.title,next.parent?'subtask':next.kind,next.parent?taskIds.get(next.parent)!:null,startDate,dueDate,next.ownerId,actor.id,next.hours,at,at]))
   if(!next.parent)statements.push(bound(db,'INSERT INTO peg_task_projects(task_id,project_id,section_id,position,added_by,added_at) VALUES(?,?,?,?,?,?)',[taskId,view.projectId,sections.get(next.phase)!,1000,actor.id,at]))
   if(next.approval)statements.push(bound(db,'INSERT INTO peg_approval_tasks VALUES(?,?,?)',[taskId,actor.id,at]))
   for(const [key,value] of Object.entries(next.fields))if(fieldIds.has(key))statements.push(bound(db,'INSERT INTO peg_field_values VALUES(?,?,?)',[taskId,fieldIds.get(key)!,JSON.stringify(value)]))
   statements.push(bound(db,'INSERT INTO peg_template_task_origins VALUES(?,?,?,?)',[id,row.key,taskId,JSON.stringify(next)]),historyStatement(db,taskId,null,actor.id,'created',{templateId:application.template_id,version:view.version,applicationId:id,taskKey:row.key}));continue
  }
  const columns:Record<string,string>={title:'title',ownerId:'owner_id',startDate:'start_date',dueDate:'due_date',hours:'estimate_hours'}
  for(const c of row.changes.filter(c=>c.state==='compatible')){
   if(c.field.startsWith('field:')){const key=c.field.slice(6),fieldId=fieldIds.get(key);if(!fieldId)continue;statements.push(reopenGuard(db,taskId,actor.id,'template_adoption'),bound(db,'INSERT INTO peg_field_values VALUES(?,?,?) ON CONFLICT(task_id,field_id) DO UPDATE SET value=excluded.value',[taskId,fieldId,JSON.stringify(c.after)]));base.fields[key]=c.after}
   else if(columns[c.field]){statements.push(reopenGuard(db,taskId,actor.id,'template_adoption'),bound(db,`UPDATE peg_tasks SET ${columns[c.field]}=?,updated_at=? WHERE id=?`,[c.after as string|number|null,at,taskId]));base[c.field]=c.after}
   else if(c.field==='phase'){statements.push(reopenGuard(db,taskId,actor.id,'template_adoption'),bound(db,'UPDATE peg_task_projects SET section_id=? WHERE task_id=? AND project_id=?',[sections.get(String(c.after))!,taskId,view.projectId]));base.phase=c.after}
   else if(c.field==='approval'&&c.after===true){statements.push(bound(db,'INSERT OR IGNORE INTO peg_approval_tasks VALUES(?,?,?)',[taskId,actor.id,at]),reopenGuard(db,taskId,actor.id,'template_required_approval'),bound(db,"UPDATE peg_tasks SET status='todo',completed_at=NULL,updated_at=? WHERE id=?",[at,taskId]));base.approval=true}
  }
  statements.push(bound(db,'UPDATE peg_template_task_origins SET base=? WHERE application_id=? AND task_key=?',[JSON.stringify(base),id,row.key]),historyStatement(db,taskId,null,actor.id,'template.adopted',{applicationId:id,version:view.version,changes:row.changes.filter(c=>c.state==='compatible').map(c=>c.field)}))
 }
 // New edges are added only when both endpoint tasks were explicitly selected. Existing edges are never overwritten.
 for(const edge of view.dependencies)if(view.keys.includes(edge.predecessor)&&view.keys.includes(edge.successor)&&taskIds.has(edge.predecessor)&&taskIds.has(edge.successor)){
  const predecessor=taskIds.get(edge.predecessor)!,successor=taskIds.get(edge.successor)!
  if(!await first(db,'SELECT 1 FROM peg_dependencies WHERE predecessor_id=? AND successor_id=?',predecessor,successor))statements.push(bound(db,'INSERT INTO peg_dependencies VALUES(?,?,?,?,?,?,?,?)',[newId('dep'),application.workspace_id,predecessor,successor,edge.type,edge.lag,actor.id,at]))
 }
 for(const rule of view.rules)if(!await first(db,'SELECT 1 FROM peg_template_staged_rules WHERE application_id=? AND rule_key=?',id,rule.key))statements.push(bound(db,'INSERT INTO peg_template_staged_rules VALUES(?,?,?,?,?,0)',[newId('stagedrule'),id,view.projectId,rule.key,JSON.stringify(rule)]))
 statements.push(bound(db,'UPDATE peg_template_applications SET version=?,input=? WHERE id=?',[view.version,JSON.stringify(view.input),id]),bound(db,'INSERT INTO peg_template_adoption_history VALUES(?,?,?,?,?,?)',[newId('adoption'),id,view.version,actor.id,JSON.stringify(view.keys),at]))
 await guarded(db,view.rev,statements);return {applicationId:id,projectId:view.projectId,version:view.version,taskIds:[...taskIds.values()]}
}
import {addWorking,dayNumber,dayString} from '../schedule/calendar'
const dayFrom=(start:string,offset:number)=>dayString(addWorking(dayNumber(start),offset))
