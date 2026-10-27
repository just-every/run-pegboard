import {all,bound,conflict,first,forbidden,notFound,now} from '../db'
import {rootOf} from '../authorization/effective'
import {digest,guarded,revision} from '../decisions/revision'
import {permanentEvent} from '../audit/search'
import {openProject,need} from '../workspace/projects'
import {openTask,require} from '../tasks/access'
import type {Actor} from '../workspace/people'
import {workspaceRole} from '../workspace/people'
import {planChange} from '../schedule/plan'
import {bulkPreview,prepareBulkEffects,type BulkInput} from '../recovery/bulk'
import {loadBundle,type Component} from './definitions'
import {prepareRuleScheduleEffects} from './schedule-effects'
import {prepareWorkActions} from './work-actions'
interface PendingJob {id:string;bundle_id:string;project_id:string;item_key:string;task_id:string;epoch:number;config:string;actor_id:string;definition_version:number;status:string;outcome_reason:string|null}

async function prepare(db:D1Database,actor:Actor,bundleId:string,jobId:string){
 const rev=await revision(db),bundle=await loadBundle(db,actor,bundleId)
 const job=await first<PendingJob>(db,'SELECT * FROM peg_bundle_jobs WHERE id=? AND bundle_id=?',jobId,bundleId)
 if(!job)throw notFound()
 if(job.status!=='pending'||!['rule_schedule_pending','rule_schedule_impossible'].includes(job.outcome_reason??''))throw conflict('rule_schedule_not_pending')
 const current=await first<{enabled:number;epoch:number;config:string;base:string;version:number}>(db,'SELECT a.enabled,a.epoch,i.config,i.base,i.version FROM peg_bundle_adoptions a JOIN peg_bundle_items i ON i.bundle_id=a.bundle_id AND i.project_id=a.project_id WHERE a.bundle_id=? AND a.project_id=? AND i.item_key=?',bundleId,job.project_id,job.item_key)
 const head=await first<{components:string}>(db,'SELECT components FROM peg_bundle_versions WHERE bundle_id=? ORDER BY version DESC LIMIT 1',bundleId)
 if(!current?.enabled||current.epoch!==job.epoch||current.config!==job.config||current.version!==job.definition_version||!head||JSON.stringify(JSON.parse(head.components)[job.item_key])!==current.base)throw conflict('activation_changed')
 const person=await first<{id:string;email:string;display_name:string;role:Actor['baseRole'];status:string}>(db,'SELECT * FROM oa_operators WHERE id=?',job.actor_id)
 if(person?.status!=='active')throw conflict('activating_admin_unavailable')
 const activating:Actor={id:person.id,email:person.email,displayName:person.display_name,baseRole:person.role}
 const originalProject=await openProject(db,activating,job.project_id),originalTask=await openTask(db,activating,job.task_id)
 need(originalProject.effective,'manage_rules');require(originalTask.access,'edit')
 if(!originalTask.access.contexts.has(job.project_id)||await workspaceRole(db,activating.id,bundle.workspace_id)==='agent')throw forbidden('activation_scope_changed')
 const opened=await openTask(db,actor,job.task_id),config=JSON.parse(job.config) as Component,patch:BulkInput['patch']={priority:config.priority}
 for(const key of ['ownerId','startDate','dueDate'] as const)if(config[key]!==undefined)patch[key]=config[key]
 const plan=await planChange(db,actor,[{taskId:job.task_id,...(patch.startDate!==undefined?{start:patch.startDate}:{}),...(patch.dueDate!==undefined?{due:patch.dueDate}:{})}])
 if(!plan.editable||plan.waits)throw forbidden('rule_schedule_scope')
 if(plan.blocked)throw conflict(plan.blocked)
 const projects=new Set([job.project_id])
 for(const id of new Set([job.task_id,...plan.all.map(row=>row.id)])){
  const task=await openTask(db,actor,id)
  const homes=await all<{project_id:string}>(db,'SELECT project_id FROM peg_task_projects WHERE task_id=?',(await rootOf(db,task.task)).id)
  for(const home of homes)projects.add(home.project_id)
 }
 // This widened scope belongs to this exact human decision only. Standing activation is unchanged.
 const schedule=await prepareRuleScheduleEffects(db,actor,bundle.workspace_id,job.project_id,job.task_id,patch,[...projects])
 const effects=await bulkPreview(db,actor,bundle.workspace_id,{taskIds:[job.task_id],patch},schedule)
 if(effects.conflicts.length)throw conflict(effects.conflicts[0].reason)
 const work=await prepareWorkActions(db,actor,opened.task,job.project_id,config.actions)
 const {all:_,...publicPlan}=plan
 const publicPreview={id:job.id,bundleId,version:job.definition_version,activatingAdmin:person.display_name,task:{id:opened.task.id,title:opened.task.title},plan:publicPlan,effects:effects.tasks,actions:config.actions??[],standingScope:[job.project_id,...(config.dependencyProjectIds??[])],approval:'This decision applies only this run. The activated rule scope stays unchanged.'}
 return {job,bundle,rev,effects,work,publicPreview,token:await digest([actor.id,rev,job,publicPreview])}
}
export async function pendingRuleSchedulePreview(db:D1Database,actor:Actor,bundleId:string,jobId:string){
 const prepared=await prepare(db,actor,bundleId,jobId)
 return {...prepared.publicPreview,token:prepared.token}
}
export async function approvePendingRuleSchedule(db:D1Database,actor:Actor,bundleId:string,jobId:string,input:Record<string,unknown>){
 const prepared=await prepare(db,actor,bundleId,jobId)
 if(input.token!==prepared.token)throw conflict('rule_schedule_review_changed')
 const {job,bundle,rev,effects,work}=prepared
 const operation=await prepareBulkEffects(db,actor,bundle.workspace_id,effects,'bundle.rule_approved',work.effects.length?[job.task_id]:[])
 await guarded(db,rev,[...operation.statements,...work.statements,...work.record(operation.result.id),
  bound(db,'INSERT INTO peg_rule_effect_runs VALUES(?,?,?,?,?,?,?,?)',[job.id,operation.result.id,job.task_id,job.project_id,job.definition_version,job.epoch,job.actor_id,work.effects.length]),
  bound(db,"UPDATE peg_bundle_jobs SET status='applied',finished_at=?,outcome_reason='recorded_effects_after_review' WHERE id=? AND status='pending'",[now(),job.id]),
  permanentEvent(db,{workspace:bundle.workspace_id,actor:actor.id,action:'rule.schedule_approved',type:'task',id:job.task_id,metadata:{runId:job.id,operationId:operation.result.id,activation:job.epoch,activatingAdmin:job.actor_id}})])
 return {status:'applied' as const,id:job.id,operationId:operation.result.id}
}
