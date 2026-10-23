import { createPortability } from '@runeditrun/rer/modules/portability'
import policy from '../portability/policy.mjs'
import { all, bound, conflict, first, invalid, newId, now, placeholders, type Param } from '../db'
import type { Actor } from '../workspace/people'
import { digest } from '../decisions/revision'
import { permanentEvent } from '../audit/search'
import { deletion, selectKeys, type Selection } from './erasure'
import { activeHolds, commitData, dataGuard, dataRevision, externalLimits, requireOwner, retentionClasses } from './settings'

export async function expiryPlan(db:D1Database,actor:Actor,workspace:string,input:Record<string,any>,proposedDays?:number) {
  await requireOwner(db,actor,workspace)
  if(!retentionClasses.includes(input.class))throw invalid('retention_class')
  const revision=await dataRevision(db),setting=await first<{days:number|null}>(db,'SELECT days FROM peg_retention_classes WHERE workspace_id=? AND class=?',workspace,input.class)
  const days=proposedDays??setting?.days
  if(!days)throw conflict('retention_not_configured')
  // The cutoff is frozen by the review. A later run never silently expands the selected records.
  const cutoff=input.cutoff===undefined?now()-days*86400000:Number(input.cutoff)
  if(!Number.isSafeInteger(cutoff)||cutoff>now()-days*86400000)throw invalid('retention_cutoff')
  const holds=await activeHolds(db,workspace),selections:Selection[]=[];let held=0
  const candidates:Array<{table:string;where:string;args:Param[];taskColumn?:string}>=[]
  if(input.class==='product_history')candidates.push({table:'peg_history',where:'at<=? AND task_id IN(SELECT id FROM peg_tasks WHERE workspace_id=?)',args:[cutoff,workspace],taskColumn:'task_id'})
  if(input.class==='attachments_proofs')candidates.push({table:'peg_attachments',where:'created_at<=? AND task_id IN(SELECT id FROM peg_tasks WHERE workspace_id=?)',args:[cutoff,workspace],taskColumn:'task_id'})
  if(input.class==='provider_logs')candidates.push({table:'peg_time_delivery_history',where:'at<=? AND sheet_id IN(SELECT id FROM peg_timesheets WHERE workspace_id=?)',args:[cutoff,workspace]})
  // Transient authority is installation-scoped; never mix it with retained work history.
  if(input.class==='transient_credentials_sessions'){
    const expired=await all<{id:string}>(db,'SELECT id FROM oa_sessions WHERE expires_at<=? OR revoked_at IS NOT NULL',cutoff)
    const ids=expired.map(r=>r.id)
    for(const table of ['oa_provider_session_pins','oa_provider_sessions'])candidates.push({table,where:`session_id IN (${placeholders(ids)})`,args:ids})
    candidates.push({table:'oa_sessions',where:`id IN (${placeholders(ids)})`,args:ids})
    candidates.push({table:'oa_tokens',where:'expires_at<=? AND id NOT IN(SELECT source_token_id FROM oa_sessions WHERE source_token_id IS NOT NULL)',args:[cutoff]})
  }
  for(const c of candidates){
    const selection=await selectKeys(db,c.table,c.where,c.args)
    const eligible:Selection={table:c.table,keys:[]}
    for(const key of selection.keys){
      let blocked=holds.some(h=>h.target_type==='workspace')
      if(c.taskColumn){
        const row=await first<{task_id:string;project_id?:string;actor_id?:string;created_by?:string}>(db,`SELECT * FROM ${c.table} WHERE ${Object.keys(key).map(k=>k+' IS ?').join(' AND ')}`,...Object.values(key))
        if(row){const projects=await all<{project_id:string}>(db,'SELECT project_id FROM peg_task_projects WHERE task_id=?',row.task_id)
          blocked ||=holds.some(h=>h.target_type==='task'&&h.target_id===row.task_id||h.target_type==='attachment'&&h.target_id===key.id||h.target_type==='project'&&projects.some(p=>p.project_id===h.target_id)||h.target_type==='person'&&[row.actor_id,row.created_by].includes(h.target_id))}
      }else if(c.table==='peg_time_delivery_history'&&holds.length)blocked=true
      if(blocked)held++;else eligible.keys.push(key)
    }
    if(eligible.keys.length)selections.push(eligible)
  }
  const supported=['product_history','attachments_proofs','provider_logs','transient_credentials_sessions'].includes(input.class)
  const plan={class:input.class as string,cutoff,selections,counts:Object.fromEntries(selections.map(s=>[s.table,s.keys.length])),held,supported,
    limits:supported?'Only the named current stores are included. No external deletion has been confirmed.':'This retention class is published, but its product storage door is not implemented. No expiry or processor cleanup is claimed.'}
  return {...plan,revision,token:await digest([workspace,actor.id,revision,plan])}
}
export async function expire(db:D1Database,actor:Actor,workspace:string,input:Record<string,any>) {
  const plan=await expiryPlan(db,actor,workspace,input)
  if(input.token!==plan.token||!(input.confirm===true||input.confirm==='yes'))throw conflict('expiry_review_required')
  if(!plan.supported)throw conflict('retention_store_not_implemented')
  const at=now(),id=newId('expiry'),service=await createPortability({db,policy}),deadline=Math.min(at+300000,...(await activeHolds(db,workspace)).map(h=>h.expires_at))
  const statements=[dataGuard(db,actor,plan.revision,deadline),...await service.invalidateTransfersStatements()]
  for(const selected of plan.selections){for(const key of selected.keys)statements.push(...await service.erasureStatements(selected.table,key));statements.push(...deletion(db,selected))}
  if(plan.selections.length)statements.push(...await service.redactionStatements())
  statements.push(bound(db,'INSERT INTO peg_data_receipts VALUES(?,?,?,?,?,?,?,?,?,?)',[id,workspace,actor.id,'retention',plan.class,at,plan.held?'partial':'complete',JSON.stringify(plan.counts),JSON.stringify({held:plan.held}),externalLimits]),permanentEvent(db,{workspace,actor:actor.id,action:'retention.expired',type:'retention',id,result:plan.held?'retained':'success'}))
  await commitData(db,statements)
  return {id,counts:plan.counts,held:plan.held,externalLimits}
}
