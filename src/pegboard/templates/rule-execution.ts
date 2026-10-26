import {all,bound,conflict,first,newId,now,PegError} from '../db'
import {digest,guarded,revision} from '../decisions/revision'
import {openTask} from '../tasks/access'
import {workspaceRole,type Actor} from '../workspace/people'
import {getTemplate} from './definitions'
import {applyTemplate} from './instantiation'
import {computedDate,ruleAdministrator,ruleEvent,ruleInput,type TemplateRule,type TemplateRuleDefinition,type TemplateRuleRun} from './rule-definition'

/** Include these statements in the task creation transaction, after its task and project membership inserts. */
export async function templateRuleQueueStatements(db:D1Database,projectId:string|null,taskId:string){
 if(!projectId)return []
 const rules=await all<TemplateRule>(db,'SELECT * FROM peg_template_rules WHERE project_id=?',projectId)
 return rules.map(rule=>bound(db,`INSERT OR IGNORE INTO peg_template_rule_runs(id,rule_id,task_id,definition_version,definition,activation_id,status,source,outcome,created_at)
 SELECT ?,r.id,t.id,r.version,r.definition,r.activation_id,CASE WHEN r.enabled=1 THEN 'queued' ELSE 'pending' END,
 json_object('startDate',t.start_date,'dueDate',t.due_date,'taskVersion',t.updated_at,'creatorId',t.creator_id,'creatorRole',COALESCE((SELECT role FROM peg_workspace_members WHERE workspace_id=t.workspace_id AND operator_id=t.creator_id),'human')),CASE WHEN r.enabled=1 THEN NULL ELSE 'activation_required' END,?
 FROM peg_tasks t JOIN peg_template_rules r ON r.id=?
 WHERE t.id=? AND EXISTS(SELECT 1 FROM peg_task_projects WHERE task_id=t.id AND project_id=r.project_id)
 AND NOT EXISTS(SELECT 1 FROM peg_template_rule_generated_tasks WHERE task_id=t.id)`,[newId('templaterun'),now(),rule.id,taskId]))
}
async function activatingActor(db:D1Database,id:string):Promise<Actor>{
 const person=await first<{id:string;email:string;display_name:string;role:Actor['baseRole'];status:string}>(db,'SELECT id,email,display_name,role,status FROM oa_operators WHERE id=?',id)
 if(person?.status!=='active')throw conflict('activating_admin_unavailable')
 return {id:person.id,email:person.email,displayName:person.display_name,baseRole:person.role}
}
/** Called by the template service before its atomic batch; its statements belong in that same batch. */
export async function assertTemplateRuleExecution(db:D1Database,actor:Actor,id:string,token:string,input:Record<string,any>){
 if(!token.startsWith('template-rule:'))throw conflict('rule_run_required')
 const runId=token.slice('template-rule:'.length),run=await first<TemplateRuleRun>(db,'SELECT * FROM peg_template_rule_runs WHERE id=? AND rule_id=?',runId,id)
 const rule=await first<TemplateRule>(db,'SELECT * FROM peg_template_rules WHERE id=?',id)
 if(!run||!rule||!rule.enabled||!rule.activation_id||run.activation_id!==rule.activation_id||run.definition_version!==rule.version||run.definition!==rule.definition||!['queued','pending'].includes(run.status))throw conflict('activation_changed')
 const activation=await first<{activated_by:string;definition_version:number;definition:string}>(db,'SELECT * FROM peg_template_rule_activations WHERE id=?',rule.activation_id)
 if(!activation||activation.activated_by!==actor.id||activation.definition_version!==rule.version||activation.definition!==rule.definition)throw conflict('activation_changed')
 await ruleAdministrator(db,actor,rule.project_id)
 const opened=await openTask(db,actor,run.task_id)
 if(!opened.access.contexts.has(rule.project_id))throw conflict('activation_scope_changed')
 const definition=JSON.parse(rule.definition) as TemplateRuleDefinition
 const template=await getTemplate(db,actor,rule.workspace_id,definition.templateId,definition.templateVersion)
 if(template.headVersion!==definition.templateVersion)throw conflict('template_version_changed')
 const source=JSON.parse(run.source) as {startDate:string|null;dueDate:string|null;creatorRole?:string}
 if(definition.date.source!=='fixed'&&source.creatorRole==='agent'&&run.exact_review_activation_id!==rule.activation_id)throw conflict('ai_source_requires_exact_review')
 const startDate=computedDate(definition,definition.date.source==='task_start'?source.startDate:source.dueDate)
 if(!startDate)throw conflict('rule_source_date_missing')
 const expected=ruleInput(rule,definition,startDate,token)
 const actual={templateId:input.templateId,version:Number(input.version),startDate:input.startDate,name:input.name,roles:input.roles,keepUnassigned:input.keepUnassigned??false,targetProjectId:input.targetProjectId,token:input.token}
 // Role object key order is immaterial; every value must match the reviewed definition.
 actual.roles=Object.fromEntries(Object.entries(actual.roles??{}).sort(([a],[b])=>a.localeCompare(b)))
 expected.roles=Object.fromEntries(Object.entries(expected.roles).sort(([a],[b])=>a.localeCompare(b)))
 if(await digest(actual)!==await digest(expected))throw conflict('activation_mapping_changed')
 return {runId,statements:[bound(db,'INSERT INTO peg_template_rule_execution_guards VALUES(?,?,?,?,?,?)',[newId('ruleguard'),runId,id,actor.id,rule.activation_id,rule.version])]}
}
const safeReason=(error:PegError)=>['template_version_changed','activation_changed','activation_mapping_changed','rule_source_date_missing','activating_admin_unavailable','ai_source_requires_exact_review'].includes(error.code)?error.code:error.status===403||error.status===404?'activation_scope_changed':'mapping_review_required'
export async function processTemplateRuleRuns(db:D1Database,projectId?:string){
 const runs=await all<TemplateRuleRun>(db,"SELECT j.* FROM peg_template_rule_runs j JOIN peg_template_rules r ON r.id=j.rule_id WHERE j.status='queued'"+(projectId?' AND r.project_id=?':'')+' ORDER BY j.created_at,j.id LIMIT 100',...(projectId?[projectId]:[]))
 const result={applied:0,pending:0,noop:0}
 for(const run of runs){
  const processingRevision=await revision(db)
  try{
   const rule=await first<TemplateRule>(db,'SELECT * FROM peg_template_rules WHERE id=?',run.rule_id)
   if(!rule)continue
   // Reconcile a committed application before considering later definition changes.
   const completed=await first<{result:string}>(db,'SELECT result FROM peg_template_applications WHERE workspace_id=? AND request_key=?',rule.workspace_id,'template-rule:'+run.id)
   let applied:{projectId:string;taskIds:string[]}
   if(completed)applied=JSON.parse(completed.result)
   else{
    const activation=rule.activation_id?await first<{activated_by:string}>(db,'SELECT activated_by FROM peg_template_rule_activations WHERE id=?',rule.activation_id):null
    if(!activation)throw conflict('activation_changed')
    const actor=await activatingActor(db,activation.activated_by),definition=JSON.parse(run.definition) as TemplateRuleDefinition
    if(await workspaceRole(db,actor.id,rule.workspace_id)==='agent')throw conflict('activation_scope_changed')
    const source=JSON.parse(run.source) as {startDate:string|null;dueDate:string|null},startDate=computedDate(definition,definition.date.source==='task_start'?source.startDate:source.dueDate)
    if(!startDate){
     // Even a no-op is authorized and checked against the currently reviewed definition.
     await ruleAdministrator(db,actor,rule.project_id)
     const template=await getTemplate(db,actor,rule.workspace_id,definition.templateId,definition.templateVersion)
     if(template.headVersion!==definition.templateVersion)throw conflict('template_version_changed')
     if(!rule.enabled||rule.version!==run.definition_version||rule.definition!==run.definition||rule.activation_id!==run.activation_id)throw conflict('activation_changed')
     await guarded(db,processingRevision,[bound(db,"UPDATE peg_template_rule_runs SET status='noop',outcome='source_date_missing',finished_at=? WHERE id=? AND status='queued'",[now(),run.id]),ruleEvent(db,rule.id,'source_date_missing',actor.id,run.id)]);result.noop++;continue
    }
    const input=ruleInput(rule,definition,startDate,'template-rule:'+run.id)
    applied=await applyTemplate(db,actor,rule.workspace_id,input,{id:rule.id})
   }
   const rev=await revision(db)
   if((await first<{status:string}>(db,'SELECT status FROM peg_template_rule_runs WHERE id=?',run.id))?.status==='applied')continue
   await guarded(db,rev,[bound(db,"UPDATE peg_template_rule_runs SET status='applied',computed_start_date=?,result=?,outcome='applied',finished_at=? WHERE id=? AND status IN ('queued','pending')",[computedDate(JSON.parse(run.definition),JSON.parse(run.source)[JSON.parse(run.definition).date.source==='task_start'?'startDate':'dueDate']),JSON.stringify(applied),now(),run.id]),ruleEvent(db,run.rule_id,'applied',null,run.id)])
   result.applied++
  }catch(error){
   if(!(error instanceof PegError&&[400,403,404,409].includes(error.status)))throw error
   if(error.code==='review_changed')continue
   const rev=await revision(db),reason=safeReason(error)
   await guarded(db,rev,[bound(db,"UPDATE peg_template_rule_runs SET status='pending',outcome=? WHERE id=? AND status='queued'",[reason,run.id]),ruleEvent(db,run.rule_id,reason,null,run.id)])
   result.pending++
  }
 }
 return result
}
