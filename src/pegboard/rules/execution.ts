import {localRuleEvent} from '../audit/search'
import {historyStatement} from '../tasks/history'
import {evaluate} from '../fields/values'
import {prepareWorkActions} from '../bundles/work-actions'
import {projectScope} from '../conversion/context'
import {taskAccess} from '../authorization/effective'
import {all,bound,first,newId,now,PegError,conflict} from '../db'
import {guarded,revision} from '../decisions/revision'
import {ruleAdministrator} from '../templates/rule-definition'
import {openTask} from '../tasks/access'
import {type Actor} from '../workspace/people'
import {bulkPreview,prepareBulkEffects} from '../recovery/bulk'
import {compute,validateRule,type Definition,type Rule,type Run} from './definitions'
/** These statements commit with the triggering task mutation, so restart cannot lose the event. */
export async function localRuleQueue(db:D1Database,taskId:string,trigger:'status'|'section'|'form',actorId:string,projectId?:string,created=false){
 const rules=created?await all<Rule>(db,'SELECT * FROM peg_local_rules WHERE project_id=?',projectId!):await all<Rule>(db,'SELECT r.* FROM peg_local_rules r JOIN peg_task_projects p ON p.project_id=r.project_id WHERE p.task_id=?'+(projectId?' AND r.project_id=?':''),taskId,...(projectId?[projectId]:[])),event=newId('localevent')
 return rules.filter(r=>JSON.parse(r.definition).trigger===trigger).flatMap(r=>{
 const d=JSON.parse(r.definition) as Definition,runId=newId('localrun')
 return [bound(db,`INSERT OR IGNORE INTO peg_local_rule_runs(id,rule_id,event_id,task_id,version,definition,activation_id,activated_by,source,status,created_at)
 SELECT ?,?,?,?,?,?,?,?,json_object('status',t.status,'startDate',t.start_date,'dueDate',t.due_date,'taskVersion',t.updated_at,'ownerId',t.owner_id,'creatorId',t.creator_id,'customDate',(SELECT json_extract(v.value,'$') FROM peg_field_values v JOIN peg_project_fields f ON f.field_id=v.field_id WHERE v.task_id=t.id AND f.key=? AND f.project_id=?),'triggerActorId',?,'triggerActorRole',COALESCE((SELECT role FROM peg_workspace_members WHERE operator_id=? AND workspace_id=t.workspace_id),'unknown'),'sectionId',p.section_id),?,?
 FROM peg_tasks t JOIN peg_task_projects p ON p.task_id=t.id WHERE t.id=? AND p.project_id=? AND ${trigger==='status'?'t.status=?':trigger==='section'?'p.section_id=?':'?=1'}`,[runId,r.id,event,taskId,r.version,r.definition,r.activation_id,r.activated_by,d.sourceField,r.project_id,actorId,actorId,r.enabled?'queued':'pending',now(),taskId,r.project_id,trigger==='status'?d.status:trigger==='section'?d.sectionId:1]),localRuleEvent(db,{projectId:r.project_id,actor:actorId,action:r.enabled?'rule.run_queued':'rule.run_blocked',ruleId:r.id,version:r.version,activationId:r.activation_id,runId,eventId:event,taskId,triggerActorId:actorId,activatedById:r.activated_by,result:r.enabled?'queued':'blocked',...(r.enabled?{}:{outcome:'inactive'})})]
 })
}
export async function processLocalRules(db:D1Database,projectId:string){
 const runs=await all<Run>(db,"SELECT j.* FROM peg_local_rule_runs j JOIN peg_local_rules r ON r.id=j.rule_id WHERE r.project_id=? AND j.status='queued' ORDER BY j.created_at,j.id LIMIT 100",projectId)
 for(const run of runs){
 const rev=await revision(db),source=JSON.parse(run.source)
 const receipt=(action:string,result:string,outcome:string,operationId?:string|null,workCount?:number)=>localRuleEvent(db,{projectId,actor:run.activated_by,action,ruleId:run.rule_id,version:run.version,activationId:run.activation_id,runId:run.id,taskId:run.task_id,triggerActorId:source.triggerActorId,activatedById:run.activated_by,result,outcome,operationId,workCount})
 try{
 const rule=await first<Rule>(db,'SELECT * FROM peg_local_rules WHERE id=?',run.rule_id)
 if(!rule||!rule.enabled||rule.version!==run.version||rule.definition!==run.definition||rule.activation_id!==run.activation_id)throw conflict('activation_changed')
 const person=await first<{id:string;email:string;display_name:string;role:Actor['baseRole'];status:string}>(db,'SELECT * FROM oa_operators WHERE id=?',run.activated_by)
 if(person?.status!=='active')throw conflict('activating_admin_unavailable')
 const actor:Actor={id:person.id,email:person.email,displayName:person.display_name,baseRole:person.role},{project}=await ruleAdministrator(db,actor,projectId),opened=await openTask(db,actor,run.task_id)
 if(!opened.access.contexts.has(projectId))throw conflict('activation_scope_changed')
 const d=JSON.parse(run.definition) as Definition
 await validateRule(db,actor,projectId,d)
 const target=d.actions.find(a=>a.kind==='project')
 if(target&&d.targetScope!==await projectScope(db,project))throw conflict('share_review_required')
 const collaborator=d.actions.find(a=>a.kind==='collaborator')
 if(collaborator&&!(await taskAccess(db,{...actor,id:collaborator.value!},opened.task)).capabilities.has('edit'))throw conflict('collaborator_existing_access')
 if(source.triggerActorRole==='agent'||await first(db,'SELECT 1 FROM peg_rule_agent_sources WHERE task_id=?',run.task_id))throw conflict('ai_source_requires_exact_review')
 if(d.source==='custom'){const current=await evaluate(db,actor,run.task_id,projectId,d.sourceField);if(current.error||current.value!==source.customDate)throw conflict('source_changed')}
 // Values remain bound to the triggering revision; later edits require another trigger.
 if(opened.task.updated_at!==source.taskVersion||opened.task.due_date!==source.dueDate||opened.task.start_date!==source.startDate)throw conflict('source_changed')
 const dueDate=compute(d,source)
 if(!dueDate){await guarded(db,rev,[bound(db,"UPDATE peg_local_rule_runs SET status='noop',outcome='source_date_missing',finished_at=? WHERE id=? AND status='queued'",[now(),run.id]),receipt('rule.run_noop','noop','source_date_missing')]);continue}
 const patch={dueDate,priority:d.priority,...(d.ownerId?{ownerId:d.ownerId}:{})},preview=await bulkPreview(db,actor,project.workspace_id,{taskIds:[run.task_id],patch})
 if(preview.conflicts.length)throw conflict('dependency_cascade_requires_review')
 const work=await prepareWorkActions(db,actor,opened.task,projectId,d.actions)
 const created=work.effects.filter(effect=>effect.kind==='subtask').map(effect=>({id:effect.targetId,dueDate,ownerId:d.ownerId||opened.task.owner_id}))
 for(const child of created)work.statements.push(bound(db,'UPDATE peg_tasks SET due_date=?,owner_id=?,updated_at=? WHERE id=?',[child.dueDate,child.ownerId,now(),child.id]),historyStatement(db,child.id,projectId,actor.id,'local.rule_created_dates',{dueDate:child.dueDate,ownerId:child.ownerId}))
 const prepared=preview.canApply||work.effects.length?await prepareBulkEffects(db,actor,project.workspace_id,preview,'local.rule_applied',work.effects.length?[run.task_id]:[]):null
 await guarded(db,rev,[...(prepared?.statements??[]),...work.statements,...(prepared?work.record(prepared.result.id):[]),bound(db,"UPDATE peg_local_rule_runs SET status='applied',computed=?,operation_id=?,work_count=?,outcome='applied',finished_at=? WHERE id=? AND status='queued'",[JSON.stringify({...patch,actions:d.actions,createdWork:created}),prepared?.result.id??null,work.effects.length,now(),run.id]),receipt('rule.run_applied','applied','applied',prepared?.result.id,work.effects.length)])
 }catch(error){
 if(!(error instanceof PegError&&[400,403,404,409].includes(error.status)))throw error
 if(error.code==='review_changed')continue
 const current=await first<{status:string}>(db,'SELECT status FROM peg_local_rule_runs WHERE id=?',run.id)
 if(current?.status!=='queued')continue
 const reason=['activation_changed','activating_admin_unavailable','source_changed','source_date_missing','source_time_requires_review','ai_source_requires_exact_review','dependency_cascade_requires_review','approval_decision_required','share_review_required','target_scope_changed','source_field_changed','collaborator_existing_access'].includes(error.code)?error.code:'activation_scope_changed'
 await guarded(db,rev,[bound(db,"UPDATE peg_local_rule_runs SET status='pending',outcome=?,finished_at=? WHERE id=? AND status='queued'",[reason,now(),run.id]),receipt('rule.run_blocked','blocked',reason)])
 }
 }
 return {processed:runs.length}
}
