import {definitions as projectFields} from '../fields/definitions'
import {fieldReadable} from '../workspace/projects'
import {workActions,type WorkAction} from '../bundles/action-config'
import {projectScope} from '../conversion/context'
import {all,bound,conflict,first,invalid,newId,notFound,now} from '../db'
import {digest,guarded,revision} from '../decisions/revision'
import {ruleAdministrator,text,dateOnly} from '../templates/rule-definition'
import {workspaceRole,type Actor} from '../workspace/people'
import {openTask} from '../tasks/access'
import {dayNumber,dayString,isWorkingDay} from '../schedule/calendar'
export interface Definition {trigger:'status'|'section'|'form';status:string;sectionId:string;ownerId:string;priority:string;source:'task_due'|'task_start'|'fixed'|'custom';fixedDate:string;sourceField:string;fieldVersion:number|null;offset:number;unit:'days'|'business_days'|'weeks'|'months';actions:WorkAction[];targetScope:string|null}
export interface Rule {id:string;project_id:string;name:string;version:number;definition:string;enabled:number;activation_id:string|null;activated_by:string|null;created_at:number}
export interface Run {id:string;rule_id:string;task_id:string;version:number;definition:string;activation_id:string|null;activated_by:string|null;source:string;status:string;outcome:string|null;computed:string|null;operation_id:string|null;created_at:number}
export function definition(input:Record<string,any>):Definition {
 const actions=input.actions??[...(input.complete==='yes'?[{kind:'complete'}]:[]),...['comment','collaborator','project','subtask','tag'].filter(kind=>input['action:'+kind]).map(kind=>({kind,value:input['action:'+kind]}))]
 const d={sourceField:input.sourceField??'',fieldVersion:null,actions:workActions(actions),targetScope:null,trigger:input.trigger??'status',status:input.status??'doing',sectionId:input.sectionId??'',ownerId:input.ownerId??'',priority:input.priority??'normal',source:input.source??'task_due',fixedDate:input.fixedDate??'',offset:Number(input.offset??0),unit:input.unit??'days'}
 if(!['status','section','form'].includes(d.trigger)||!['todo','doing','done'].includes(d.status)||!['low','normal','high','urgent'].includes(d.priority)||!['task_due','task_start','fixed','custom'].includes(d.source)||!['days','business_days','weeks','months'].includes(d.unit)||!Number.isSafeInteger(d.offset)||Math.abs(d.offset)>3660)throw invalid('rule_definition')
 for(const key of ['ownerId','sectionId','sourceField'] as const)if(typeof d[key]!=='string'||d[key].length>100)throw invalid('rule_definition')
 if(d.trigger==='section'&&!d.sectionId)throw invalid('rule_section')
 if(d.source==='fixed')dateOnly(d.fixedDate)
 return d as Definition
}
export function compute(d:Definition,source:{startDate:string|null;dueDate:string|null;customDate?:string|null}){
 const value=d.source==='fixed'?d.fixedDate:d.source==='task_start'?source.startDate:d.source==='custom'?source.customDate:source.dueDate
 if(!value)return null
 if(value.length!==10)throw conflict('source_time_requires_review')
 let day=dayNumber(dateOnly(value))
 if(d.unit==='days'||d.unit==='weeks')day+=d.offset*(d.unit==='weeks'?7:1)
 else if(d.unit==='months'){const base=new Date(day*86400000),target=new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth()+d.offset,1)),last=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();target.setUTCDate(Math.min(base.getUTCDate(),last));day=dayNumber(target.toISOString().slice(0,10))}
 else {let left=Math.abs(d.offset);while(left){day+=d.offset<0?-1:1;if(isWorkingDay(day))left--}}
 return dayString(day)
}
export async function loadRule(db:D1Database,actor:Actor,id:string){const rule=await first<Rule>(db,'SELECT * FROM peg_local_rules WHERE id=?',id);if(!rule)throw notFound();await ruleAdministrator(db,actor,rule.project_id);return rule}
export async function validateRule(db:D1Database,actor:Actor,projectId:string,d:Definition){
 const {project,effective}=await ruleAdministrator(db,actor,projectId)
 if(d.source==='custom'){const field=(await projectFields(db,projectId)).find(f=>f.key===d.sourceField);if(!field||field.type!=='date'||!fieldReadable(field,effective))throw invalid('rule_source_field');if(d.fieldVersion&&d.fieldVersion!==field.version)throw conflict('source_field_changed');d.fieldVersion=field.version}
 if(d.ownerId&&!(await workspaceRole(db,d.ownerId,project.workspace_id)))throw invalid('rule_owner')
 const target=d.actions.find(a=>a.kind==='project')
 if(target){const destination=await ruleAdministrator(db,actor,target.value!);const scope=await projectScope(db,destination.project);if(d.targetScope&&d.targetScope!==scope)throw conflict('target_scope_changed');d.targetScope=scope}
 if(d.trigger==='section'&&!await first(db,'SELECT 1 FROM peg_sections WHERE id=? AND project_id=?',d.sectionId,projectId))throw invalid('rule_section')
}
export async function saveRule(db:D1Database,actor:Actor,projectId:string,input:Record<string,any>,id?:string){
 const rev=await revision(db),d=definition(input);await validateRule(db,actor,projectId,d)
 const name=text(input.name,'rule_name'),existing=id?await loadRule(db,actor,id):null
 if(existing&&(existing.project_id!==projectId||Number(input.version)!==existing.version))throw conflict('rule_changed')
 const ruleId=id??newId('localrule')
 await guarded(db,rev,[existing?bound(db,'UPDATE peg_local_rules SET name=?,definition=?,version=version+1,enabled=0,activation_id=NULL,activated_by=NULL WHERE id=?',[name,JSON.stringify(d),ruleId]):bound(db,'INSERT INTO peg_local_rules(id,project_id,name,definition,created_at) VALUES(?,?,?,?,?)',[ruleId,projectId,name,JSON.stringify(d),now()])])
 return {id:ruleId}
}
export async function rulePreview(db:D1Database,actor:Actor,id:string,input:Record<string,any>){
 const rev=await revision(db),rule=await loadRule(db,actor,id),config=JSON.parse(rule.definition) as Definition
 await validateRule(db,actor,rule.project_id,config)
 const sample={startDate:input.sampleDate?dateOnly(input.sampleDate):null,dueDate:input.sampleDate?dateOnly(input.sampleDate):null,customDate:input.sampleDate?dateOnly(input.sampleDate):null}
 return {rule,config,computedDate:compute(config,sample),token:await digest(['local-rule',actor.id,rev,rule]),policy:'Date-only values in US Eastern time; US federal observed holidays and weekends excluded for business days. Missing source dates are visible no-ops. Weeks are seven calendar days; months clamp to the last valid day. No time shift at DST. Dependencies require separate schedule review. No outbound actions or approval decisions.'}
}
export async function activateRule(db:D1Database,actor:Actor,id:string,input:Record<string,any>){
 const rev=await revision(db),preview=await rulePreview(db,actor,id,{})
 if(input.token!==preview.token)throw conflict('rule_review_changed')
 const activation=newId('localactivation'),r=preview.rule
 await guarded(db,rev,[bound(db,'INSERT INTO peg_local_rule_activations VALUES(?,?,?,?,?,?)',[activation,id,r.version,r.definition,actor.id,now()]),bound(db,'UPDATE peg_local_rules SET enabled=1,activation_id=?,activated_by=? WHERE id=?',[activation,actor.id,id])])
 return {id,activationId:activation}
}
export async function rulesView(db:D1Database,actor:Actor,projectId:string){
 const {project,effective}=await ruleAdministrator(db,actor,projectId)
 const runs=await all<Run>(db,'SELECT j.* FROM peg_local_rule_runs j JOIN peg_local_rules r ON r.id=j.rule_id WHERE r.project_id=? ORDER BY j.created_at DESC,j.id LIMIT 100',projectId),visible:Run[]=[]
 for(const run of runs){try{await openTask(db,actor,run.task_id);visible.push(run)}catch(error){if(!(error&&typeof error==='object'&&'status' in error&&[403,404].includes(Number(error.status))))throw error}}
 return {project,rules:(await all<Rule>(db,'SELECT * FROM peg_local_rules WHERE project_id=? ORDER BY created_at',projectId)).map(r=>({...r,config:JSON.parse(r.definition) as Definition})),runs:visible.map(r=>({...r,source:JSON.parse(r.source),computed:r.computed?JSON.parse(r.computed):null}))}
}

export async function deactivateRule(db:D1Database,actor:Actor,id:string){
 const rev=await revision(db);await loadRule(db,actor,id)
 await guarded(db,rev,[bound(db,'UPDATE peg_local_rules SET enabled=0,activation_id=NULL,activated_by=NULL WHERE id=?',[id])]);return {id}
}
