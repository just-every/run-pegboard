import {all,bound,now} from '../db'
import {digest} from '../decisions/revision'
import {permanentEvent} from './search'
import {auditMetadata} from './metadata'

// Component keys can be user text. Only a digest becomes a permanent rule identity.
export const bundleRuleIdentity=(bundle:string,key:string)=>digest(['bundle-rule',bundle,key])
export interface BundleAuditRun {id:string;bundle_id:string;project_id:string;item_key:string;task_id:string;epoch:number;actor_id:string;definition_version:number|null}
export async function bundleRunEvent(db:D1Database,job:BundleAuditRun,action:string,result:string,outcome:string,actor=job.actor_id,operationId?:string|null){
 const ruleId=await bundleRuleIdentity(job.bundle_id,job.item_key),activationId=await digest(['bundle-activation',ruleId,job.project_id,job.epoch])
 const metadata=auditMetadata({kind:'bundle',ruleId,bundleId:job.bundle_id,projectId:job.project_id,version:job.definition_version,activationEpoch:job.epoch,activationId,runId:job.id,taskId:job.task_id,activatedById:job.actor_id,operationId,outcome})
 return bound(db,`INSERT INTO peg_permanent_audit(workspace_id,at,actor_id,action,target_type,target_id,result,detail)
 SELECT p.workspace_id,?,CASE WHEN ?='bundle_rule.run_queued' THEN t.creator_id ELSE ? END,?,?,?,?,json_patch(?,json_object('triggerActorId',t.creator_id,'workCount',COALESCE((SELECT work_count FROM peg_rule_effect_runs WHERE run_id=?),0))) FROM peg_projects p LEFT JOIN peg_tasks t ON t.id=? WHERE p.id=? AND EXISTS(SELECT 1 FROM peg_bundle_jobs WHERE id=?)`,[now(),action,actor,action,'rule',ruleId,result,JSON.stringify(metadata),job.id,job.task_id,job.project_id,job.id])
}
export async function bundleConfigurationEvents(db:D1Database,bundleId:string,projectId:string,actor:string,action:string,itemKey?:string){
 const rows=await all<{item_key:string;version:number;epoch:number;activated_by:string}>(db,`SELECT i.item_key,i.version,a.epoch,a.activated_by FROM peg_bundle_items i JOIN peg_bundle_adoptions a ON a.bundle_id=i.bundle_id AND a.project_id=i.project_id WHERE i.bundle_id=? AND i.project_id=? AND i.kind='rule'${itemKey?' AND i.item_key=?':''}`,bundleId,projectId,...(itemKey?[itemKey]:[]))
 const events=[]
 for(const row of rows){const ruleId=await bundleRuleIdentity(bundleId,row.item_key);events.push(permanentEvent(db,{workspace:(await db.prepare('SELECT workspace_id FROM peg_projects WHERE id=?').bind(projectId).first<{workspace_id:string}>())!.workspace_id,actor,action,type:'rule',id:ruleId,metadata:{kind:'bundle',ruleId,bundleId,projectId,version:row.version,activationEpoch:row.epoch,activationId:await digest(['bundle-activation',ruleId,projectId,row.epoch]),activatedById:row.activated_by}}))}
 return events
}
export async function renewedBundleEvents(db:D1Database,bundleId:string,projectId:string,actor:string){
 const rows=await all<{item_key:string;epoch:number}>(db,"SELECT i.item_key,a.epoch FROM peg_bundle_items i JOIN peg_bundle_adoptions a ON a.bundle_id=i.bundle_id AND a.project_id=i.project_id WHERE i.bundle_id=? AND i.project_id=? AND i.kind='rule'",bundleId,projectId)
 return Promise.all(rows.map(row=>bundleActivationEvent(db,bundleId,projectId,row.item_key,actor,row.epoch+1)))
}
export async function cancelledBundleEvents(db:D1Database,bundleId:string,projectId:string,actor:string,outcome:string){
 const jobs=await all<BundleAuditRun>(db,"SELECT * FROM peg_bundle_jobs WHERE bundle_id=? AND project_id=? AND status='queued'",bundleId,projectId)
 return Promise.all(jobs.map(job=>bundleRunEvent(db,job,'bundle_rule.run_blocked','blocked',outcome,actor)))
}

export async function bundleActivationEvent(db:D1Database,bundleId:string,projectId:string,key:string,actor:string,epoch:number){
 const ruleId=await bundleRuleIdentity(bundleId,key),activationId=await digest(['bundle-activation',ruleId,projectId,epoch])
 return bound(db,`INSERT INTO peg_permanent_audit(workspace_id,at,actor_id,action,target_type,target_id,result,detail)
 SELECT p.workspace_id,?,?,CASE WHEN a.enabled=1 THEN 'bundle_rule.activated' ELSE 'bundle_rule.reviewed' END,'rule',?,'success',
 json_object('kind','bundle','ruleId',?,'bundleId',?,'projectId',?,'version',i.version,'activationEpoch',a.epoch,'activationId',?,'activatedById',a.activated_by)
 FROM peg_bundle_items i JOIN peg_bundle_adoptions a ON a.bundle_id=i.bundle_id AND a.project_id=i.project_id JOIN peg_projects p ON p.id=i.project_id
 WHERE i.bundle_id=? AND i.project_id=? AND i.item_key=? AND i.kind='rule'`,[now(),actor,ruleId,ruleId,bundleId,projectId,activationId,bundleId,projectId,key])
}
