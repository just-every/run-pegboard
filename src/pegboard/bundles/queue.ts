import {PegError,all,batch,bound,first,newId,now} from '../db'
import {guarded,revision} from '../decisions/revision'
import {openProject} from '../workspace/projects'
import {openTask} from '../tasks/access'
import {workspaceRole,type Actor} from '../workspace/people'
import {historyStatement,reopenGuard} from '../tasks/history'
import type {Component} from './definitions'
export async function bundleQueueStatements(db:D1Database,projectId:string|null,taskId:string){
 if(!projectId)return []
 const rules=await all<{bundle_id:string;item_key:string;config:string;epoch:number;activated_by:string}>(db,"SELECT i.*,a.epoch,a.activated_by FROM peg_bundle_items i JOIN peg_bundle_adoptions a ON a.bundle_id=i.bundle_id AND a.project_id=i.project_id WHERE i.project_id=? AND i.kind='rule' AND a.enabled=1",projectId)
 return rules.map(r=>bound(db,"INSERT INTO peg_bundle_jobs VALUES(?,?,?,?,?,?,?,?,'queued',?,NULL)",[newId('bundlejob'),r.bundle_id,projectId,r.item_key,taskId,r.epoch,r.config,r.activated_by,now()]))
}
export async function processBundleJobs(db:D1Database,bundleId?:string){
 const jobs=await all<{id:string;bundle_id:string;project_id:string;item_key:string;task_id:string;epoch:number;config:string;actor_id:string}>(db,"SELECT * FROM peg_bundle_jobs WHERE status='queued'"+(bundleId?' AND bundle_id=?':'')+' ORDER BY created_at,id LIMIT 100',...(bundleId?[bundleId]:[])),result={applied:0,cancelled:0}
 for(const job of jobs){
  const rev=await revision(db),current=await first<{enabled:number;epoch:number;config:string}>(db,'SELECT a.enabled,a.epoch,i.config FROM peg_bundle_adoptions a JOIN peg_bundle_items i ON i.bundle_id=a.bundle_id AND i.project_id=a.project_id WHERE a.bundle_id=? AND a.project_id=? AND i.item_key=?',job.bundle_id,job.project_id,job.item_key)
  let actor:Actor|null=null,task=null
  const person=await first<{id:string;email:string;display_name:string;role:Actor['baseRole'];status:string}>(db,'SELECT * FROM oa_operators WHERE id=?',job.actor_id)
  if(person?.status==='active'){
   actor={id:person.id,email:person.email,displayName:person.display_name,baseRole:person.role}
   try{const p=await openProject(db,actor,job.project_id),opened=await openTask(db,actor,job.task_id);if(p.effective.capabilities.has('manage_rules')&&opened.access.capabilities.has('edit')&&opened.access.contexts.has(job.project_id)&&await workspaceRole(db,actor.id,p.project.workspace_id)!=='agent')task=opened.task}catch(error){if(!(error instanceof PegError&&[403,404].includes(error.status)))throw error}
  }
  if(!current?.enabled||current.epoch!==job.epoch||current.config!==job.config||!actor||!task){await batch(db,[bound(db,"UPDATE peg_bundle_jobs SET status='cancelled',finished_at=? WHERE id=? AND status='queued'",[now(),job.id])]);result.cancelled++;continue}
  const config=JSON.parse(job.config) as Component,at=now(),approval=await first(db,'SELECT 1 FROM peg_approval_tasks WHERE task_id=?',task.id),reopen=approval&&task.status==='done'&&task.priority!==config.priority
  await guarded(db,rev,[reopenGuard(db,task.id,actor.id,'bundle_rule'),bound(db,'UPDATE peg_tasks SET priority=?,status=?,completed_at=?,updated_at=? WHERE id=?',[config.priority!,reopen?'todo':task.status,reopen?null:task.completed_at,at,task.id]),historyStatement(db,task.id,job.project_id,actor.id,'bundle.rule_applied',{bundleId:job.bundle_id,key:job.item_key,jobId:job.id,priority:config.priority}),bound(db,"UPDATE peg_bundle_jobs SET status='applied',finished_at=? WHERE id=? AND status='queued'",[at,job.id])]);result.applied++
 }
 return result
}
