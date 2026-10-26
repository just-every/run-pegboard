import {all,bound,conflict,invalid,newId,now} from '../db'
import {digest,guarded,revision} from '../decisions/revision'
import type {Actor} from '../workspace/people'
import {getTemplate} from './definitions'
import {templatePreview} from './instantiation'
import {computedDate,loadTemplateRule,ruleAdministrator,ruleDefinition,ruleEvent,ruleInput,text,type TemplateRule,type TemplateRuleDefinition,type TemplateRuleRun} from './rule-definition'

export async function templateRuleView(db:D1Database,actor:Actor,projectId:string){
 const {project}=await ruleAdministrator(db,actor,projectId)
 const rules=await all<TemplateRule>(db,'SELECT * FROM peg_template_rules WHERE project_id=? ORDER BY created_at,id',projectId)
 const runs=await all<TemplateRuleRun>(db,'SELECT j.* FROM peg_template_rule_runs j JOIN peg_template_rules r ON r.id=j.rule_id WHERE r.project_id=? ORDER BY j.created_at DESC,j.id LIMIT 200',projectId)
 const activations=await all<{id:string;rule_id:string;definition_version:number;template_version:number;activated_by:string;activated_at:number}>(db,'SELECT a.* FROM peg_template_rule_activations a JOIN peg_template_rules r ON r.id=a.rule_id WHERE r.project_id=? ORDER BY a.activated_at DESC',projectId)
 const events=await all<{id:string;rule_id:string;run_id:string|null;actor_id:string|null;action:string;at:number}>(db,'SELECT e.* FROM peg_template_rule_events e JOIN peg_template_rules r ON r.id=e.rule_id WHERE r.project_id=? ORDER BY e.at DESC,e.id LIMIT 200',projectId)
 return {project,rules:rules.map(r=>({...r,config:JSON.parse(r.definition) as TemplateRuleDefinition})),runs:runs.map(r=>({...r,config:JSON.parse(r.definition) as TemplateRuleDefinition,activatedBy:activations.find(a=>a.id===r.activation_id)?.activated_by??null,source:JSON.parse(r.source) as {startDate:string|null;dueDate:string|null;taskVersion:number},result:r.result?JSON.parse(r.result) as {projectId:string;taskIds:string[]}:null})),activations,events}
}
async function validatePinnedTemplate(db:D1Database,actor:Actor,workspace:string,definition:TemplateRuleDefinition){
 const template=await getTemplate(db,actor,workspace,definition.templateId,definition.templateVersion)
 if(template.headVersion!==definition.templateVersion)throw conflict('template_version_changed')
 return template
}
export async function createTemplateRule(db:D1Database,actor:Actor,projectId:string,input:Record<string,any>){
 const rev=await revision(db),{project}=await ruleAdministrator(db,actor,projectId),definition=ruleDefinition(input)
 await validatePinnedTemplate(db,actor,project.workspace_id,definition)
 // Preview validates every role and all generated assignments before a draft is retained.
 const sample=definition.date.source==='fixed'?definition.date.value:input.sampleSourceDate
 if(sample)await templatePreview(db,actor,project.workspace_id,ruleInput({project_id:projectId} as TemplateRule,definition,computedDate(definition,sample)!))
 const id=newId('templaterule'),at=now(),encoded=JSON.stringify(definition),name=text(input.name,'rule_name')
 await guarded(db,rev,[bound(db,'INSERT INTO peg_template_rules VALUES(?,?,?,?,?,?,0,NULL,?,?)',[id,project.workspace_id,projectId,name,1,encoded,actor.id,at]),bound(db,'INSERT INTO peg_template_rule_versions VALUES(?,1,?,?,?)',[id,encoded,actor.id,at]),ruleEvent(db,id,'created',actor.id)])
 return {id,version:1}
}
export async function updateTemplateRule(db:D1Database,actor:Actor,id:string,input:Record<string,any>){
 const rev=await revision(db),rule=await loadTemplateRule(db,actor,id)
 if(Number(input.ruleVersion)!==rule.version)throw conflict('rule_version_changed')
 const definition=ruleDefinition(input);await validatePinnedTemplate(db,actor,rule.workspace_id,definition)
 const encoded=JSON.stringify(definition),version=rule.version+1,at=now()
 await guarded(db,rev,[bound(db,'UPDATE peg_template_rules SET name=?,version=?,definition=?,enabled=0,activation_id=NULL WHERE id=?',[text(input.name,'rule_name'),version,encoded,id]),bound(db,'INSERT INTO peg_template_rule_versions VALUES(?,?,?,?,?)',[id,version,encoded,actor.id,at]),bound(db,"UPDATE peg_template_rule_runs SET status='pending',outcome='definition_changed' WHERE rule_id=? AND status='queued'",[id]),ruleEvent(db,id,'definition_changed_review_required',actor.id)])
 return {id,version}
}
const selectedRunIds=(input:Record<string,any>)=>{
 const values=input.runIds??input['runIds[]']??[],ids=Array.isArray(values)?values:[values]
 if(ids.length>100||ids.some(id=>typeof id!=='string'||!id))throw invalid('rule_review_runs')
 return [...new Set(ids as string[])].sort()
}
export async function previewTemplateRule(db:D1Database,actor:Actor,id:string,input:Record<string,any>={}){
 const rev=await revision(db),rule=await loadTemplateRule(db,actor,id),definition=JSON.parse(rule.definition) as TemplateRuleDefinition
 await validatePinnedTemplate(db,actor,rule.workspace_id,definition)
 const runIds=selectedRunIds(input),selectedRuns=[]
 const pending=await all<TemplateRuleRun>(db,"SELECT * FROM peg_template_rule_runs WHERE rule_id=? AND status='pending'",id)
 for(const runId of runIds){
  const run=pending.find(row=>row.id===runId);if(!run)throw conflict('rule_review_runs_changed')
  const source=JSON.parse(run.source) as {startDate:string|null;dueDate:string|null;taskVersion:number}
  const startDate=computedDate(definition,definition.date.source==='task_start'?source.startDate:source.dueDate)
  const proposed=startDate?await templatePreview(db,actor,rule.workspace_id,ruleInput(rule,definition,startDate)):null
  if(proposed?.missingRoles.length)throw conflict('template_roles_unresolved')
  selectedRuns.push({id:run.id,taskId:run.task_id,fromDefinitionVersion:run.definition_version,previousDefinition:run.definition,previousActivation:run.activation_id,source,startDate,preview:proposed})
 }
 const sampleSourceDate=definition.date.source==='fixed'?null:input.sampleSourceDate??(definition.date.source==='task_start'?selectedRuns[0]?.source.startDate:selectedRuns[0]?.source.dueDate)
 const startDate=computedDate(definition,sampleSourceDate??null)
 if(!startDate)throw conflict('rule_preview_source_date_required')
 const preview=await templatePreview(db,actor,rule.workspace_id,ruleInput(rule,definition,startDate))
 if(preview.missingRoles.length)throw conflict('template_roles_unresolved')
 const token=await digest({actor:actor.id,rule:id,version:rule.version,definition:rule.definition,rev,sampleSourceDate,selectedRuns,preview:preview.token})
 return {ruleId:id,ruleVersion:rule.version,definition,projectId:rule.project_id,startDate,sampleSourceDate,selectedRuns,token,preview,policy:{trigger:'New tasks created in this project',scope:'Generated work stays in this project; no audience is copied',dates:'Date-only calendar days; template-relative dates use the template calendar',missingDate:'No work is created; the run records a missing source date',recursion:'Template-generated tasks do not trigger template rules',approval:'Only this deterministic mapping is authorized; AI-selected templates or values require exact human review'}}
}
export async function activateTemplateRule(db:D1Database,actor:Actor,id:string,input:Record<string,any>){
 const rev=await revision(db),review=await previewTemplateRule(db,actor,id,input)
 if(input.token!==review.token)throw conflict('rule_preview_required')
 const rule=await loadTemplateRule(db,actor,id),activationId=newId('ruleactivation'),at=now()
 const selected=review.selectedRuns.map(run=>bound(db,"UPDATE peg_template_rule_runs SET status='queued',definition_version=?,definition=?,activation_id=?,exact_review_activation_id=?,outcome=NULL,review_history=json_insert(review_history,'$[#]',json_object('definitionVersion',definition_version,'definition',definition,'activationId',activation_id,'reviewedBy',?,'reviewedAt',?,'toVersion',?)) WHERE id=? AND status='pending'",[rule.version,rule.definition,activationId,activationId,actor.id,at,rule.version,run.id]))
 await guarded(db,rev,[
  bound(db,'INSERT INTO peg_template_rule_activations VALUES(?,?,?,?,?,?,?,?)',[activationId,id,rule.version,rule.definition,review.definition.templateVersion,actor.id,at,review.token]),
  bound(db,'UPDATE peg_template_rules SET enabled=1,activation_id=? WHERE id=?',[activationId,id]),...selected,
  bound(db,"UPDATE peg_template_rule_runs SET status='queued',activation_id=?,outcome=NULL WHERE rule_id=? AND definition_version=? AND definition=? AND status='pending'",[activationId,id,rule.version,rule.definition]),
  ...review.selectedRuns.map(run=>ruleEvent(db,id,'pending_run_mapping_reviewed',actor.id,run.id)),ruleEvent(db,id,'activated',actor.id)
 ])
 return {id,activationId,version:rule.version}
}
export async function deactivateTemplateRule(db:D1Database,actor:Actor,id:string){
 const rev=await revision(db),rule=await loadTemplateRule(db,actor,id)
 await guarded(db,rev,[bound(db,'UPDATE peg_template_rules SET enabled=0,activation_id=NULL WHERE id=?',[id]),bound(db,"UPDATE peg_template_rule_runs SET status='pending',outcome='activation_required' WHERE rule_id=? AND status='queued'",[id]),ruleEvent(db,id,'deactivated',actor.id)])
 return {id:rule.id}
}
