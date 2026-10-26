import {permanentEvent} from '../audit/search'
import {prepareWorkActions} from './work-actions'
import {PegError,all,bound,first,newId,now} from '../db'
import {guarded,revision} from '../decisions/revision'
import {openProject} from '../workspace/projects'
import {openTask} from '../tasks/access'
import {workspaceRole,type Actor} from '../workspace/people'
import {bulkPreview,prepareBulkEffects,type BulkInput} from '../recovery/bulk'
import type {Component} from './definitions'
export async function bundleQueueStatements(db:D1Database,projectId:string|null,taskId:string){
 if(!projectId)return []
 const rules=await all<{bundle_id:string;item_key:string;config:string;version:number;epoch:number;activated_by:string}>(db,"SELECT i.*,a.epoch,a.activated_by FROM peg_bundle_items i JOIN peg_bundle_adoptions a ON a.bundle_id=i.bundle_id AND a.project_id=i.project_id WHERE i.project_id=? AND i.kind='rule' AND a.enabled=1",projectId)
 return rules.map(r=>bound(db,"INSERT INTO peg_bundle_jobs(id,bundle_id,project_id,item_key,task_id,epoch,config,actor_id,status,created_at,finished_at,definition_version) VALUES(?,?,?,?,?,?,?,?,'queued',?,NULL,?)",[newId('bundlejob'),r.bundle_id,projectId,r.item_key,taskId,r.epoch,r.config,r.activated_by,now(),r.version]))
}
export async function processBundleJobs(db:D1Database,bundleId?:string){
 const jobs=await all<{id:string;bundle_id:string;project_id:string;item_key:string;task_id:string;epoch:number;config:string;actor_id:string;definition_version:number|null}>(db,"SELECT * FROM peg_bundle_jobs WHERE status='queued'"+(bundleId?' AND bundle_id=?':'')+' ORDER BY created_at,id LIMIT 100',...(bundleId?[bundleId]:[])),result={applied:0,cancelled:0}
 for(const job of jobs){
  const rev=await revision(db),current=await first<{enabled:number;epoch:number;config:string;version:number}>(db,'SELECT a.enabled,a.epoch,i.config,i.version FROM peg_bundle_adoptions a JOIN peg_bundle_items i ON i.bundle_id=a.bundle_id AND i.project_id=a.project_id WHERE a.bundle_id=? AND a.project_id=? AND i.item_key=?',job.bundle_id,job.project_id,job.item_key)
  try{
   if(!current?.enabled||current.epoch!==job.epoch||current.config!==job.config||current.version!==job.definition_version)throw new PegError(409,'activation_changed')
   const person=await first<{id:string;email:string;display_name:string;role:Actor['baseRole'];status:string}>(db,'SELECT * FROM oa_operators WHERE id=?',job.actor_id)
   if(person?.status!=='active')throw new PegError(403,'activating_admin_unavailable')
   const actor:Actor={id:person.id,email:person.email,displayName:person.display_name,baseRole:person.role},project=await openProject(db,actor,job.project_id),opened=await openTask(db,actor,job.task_id)
   if(!project.effective.capabilities.has('manage_rules')||!opened.access.capabilities.has('edit')||!opened.access.contexts.has(job.project_id)||await workspaceRole(db,actor.id,project.project.workspace_id)==='agent')throw new PegError(403,'activation_scope_changed')
   const config=JSON.parse(job.config) as Component,patch:BulkInput['patch']={priority:config.priority}
   for(const key of ['ownerId','startDate','dueDate'] as const)if(config[key]!==undefined)patch[key]=config[key]
   const preview=await bulkPreview(db,actor,project.project.workspace_id,{taskIds:[job.task_id],patch})
   if(preview.conflicts.length)throw new PegError(409,preview.conflicts[0].reason)
   const work=await prepareWorkActions(db,actor,opened.task,job.project_id,config.actions)
   const prepared=preview.canApply||work.effects.length?await prepareBulkEffects(db,actor,project.project.workspace_id,preview,'bundle.rule_applied',work.effects.length?[job.task_id]:[]):null,at=now()
   await guarded(db,rev,[...(prepared?.statements??[]),...work.statements,...(prepared?work.record(prepared.result.id):[]),...(work.effects.length?[permanentEvent(db,{workspace:project.project.workspace_id,actor:actor.id,action:'rule.work_applied',type:'task',id:job.task_id,metadata:{id:job.id,count:work.effects.length}})]:[]),bound(db,'INSERT INTO peg_rule_effect_runs VALUES(?,?,?,?,?,?,?,?)',[job.id,prepared?.result.id??null,job.task_id,job.project_id,job.definition_version!,job.epoch,job.actor_id,work.effects.length]),bound(db,"UPDATE peg_bundle_jobs SET status='applied',finished_at=?,outcome_reason=? WHERE id=? AND status='queued'",[at,prepared?'recorded_effects':'no_changes',job.id])]);result.applied++
  }catch(error){
   if(!(error instanceof PegError&&[400,403,404,409].includes(error.status)))throw error
   // Concurrent processing must not relabel a run another worker already committed.
   if((await first<{status:string}>(db,'SELECT status FROM peg_bundle_jobs WHERE id=?',job.id))?.status!=='queued')continue
   if(error.code==='review_changed')throw error
   await guarded(db,rev,[bound(db,"UPDATE peg_bundle_jobs SET status='cancelled',finished_at=?,outcome_reason=? WHERE id=? AND status='queued'",[now(),error.code,job.id])]);result.cancelled++
  }
 }
 return result
}
