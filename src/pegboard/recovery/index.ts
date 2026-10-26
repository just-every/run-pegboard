import {missingDependencyRepairs} from './repairs'
import {historyStatement} from '../tasks/history'
import { recoveryChoices } from './choices'
import { all, bound, conflict, first, invalid, now, PegError } from '../db'
import { digest, guarded, revision } from '../decisions/revision'
import { permanentEvent } from '../audit/search'
import type { Actor } from '../workspace/people'
import { recoverySubject } from './authority'
import { recoveryDependencies } from './dependencies'
import type { RecoveryType } from './visibility'
export { isRecoveryHidden, type RecoveryType } from './visibility'

interface RecoveryRow {object_type:RecoveryType;object_id:string;workspace_id:string;actor_id:string;removed_at:number;restored_at:number|null;restored_by:string|null}
interface RecoveryInput {type?:unknown;id?:unknown;action?:unknown;token?:unknown;repair?:unknown}
function parse(input:RecoveryInput) {
  if(!['project','task','proof_version','attachment'].includes(String(input.type)))throw invalid('recovery_type')
  const type=input.type as RecoveryType,id=String(input.id??''),action=String(input.action??'')
  if(!id||id.length>100)throw invalid('recovery_id')
  if(!(action==='restore'||action===(type==='project'?'archive':'trash')))throw invalid('recovery_action')
  return {type,id,action}
}

export async function recoveryList(db:D1Database,actor:Actor,workspace:string) {
  const rows=await all<RecoveryRow>(db,'SELECT * FROM peg_recovery WHERE workspace_id=? AND restored_at IS NULL ORDER BY removed_at DESC,object_id',workspace)
  const records=[]
  for(const row of rows){
    try{
      const subject=await recoverySubject(db,actor,workspace,row.object_type,row.object_id)
      records.push({...row,label:subject.label,canRestore:subject.canChange})
    }catch(error){if(!(error instanceof PegError&&[403,404].includes(error.status)))throw error}
  }
  const retention=await first<{days:number|null}>(db,"SELECT days FROM peg_retention_classes WHERE workspace_id=? AND class='trash'",workspace)
  return {choices:await recoveryChoices(db,actor,workspace),records,retentionDays:retention?.days??null,retentionClass:'trash',expiry:'Retention eligibility does not automatically erase retained work.'}
}

export async function recoveryPreview(db:D1Database,actor:Actor,workspace:string,input:RecoveryInput) {
  const rev=await revision(db),{type,id,action}=parse(input)
  const subject=await recoverySubject(db,actor,workspace,type,id,true)
  const existing=await first<RecoveryRow>(db,'SELECT * FROM peg_recovery WHERE object_type=? AND object_id=?',type,id)
  const removed=!!existing&&existing.restored_at===null
  if(action==='restore'&&!removed)throw conflict('recovery_not_removed')
  if(action!=='restore'&&removed)throw conflict('recovery_already_removed')
  const conflicts=action==='restore'?await recoveryDependencies(db,type,id,subject.task):[]
  if(input.repair!==undefined&&input.repair!==''&&input.repair!=='detach_missing_dependencies')throw invalid('recovery_repair')
  const availableRepairs=action==='restore'&&type==='task'?await missingDependencyRepairs(db,id):[]
  const repairs=input.repair==='detach_missing_dependencies'?availableRepairs:[]
  const remaining=repairs.length?conflicts.filter(c=>c!=='missing_dependency'):conflicts
  const plan={type,id,action,label:subject.label,conflicts:remaining,availableRepairs:availableRepairs.length,repairs,repair:repairs.length?'detach_missing_dependencies':'',canApply:remaining.length===0,
    preserves:'Retained graph links, later edits and independent human decisions remain in place.',
    externalLimits:'Recovery does not recall an outside message or recreate erased content.'}
  return {...plan,rev,token:await digest([workspace,actor.id,rev,existing,plan])}
}

export async function setRecovery(db:D1Database,actor:Actor,workspace:string,input:RecoveryInput) {
  const preview=await recoveryPreview(db,actor,workspace,input)
  if(input.token!==preview.token)throw conflict('recovery_review_changed')
  if(!preview.canApply)throw conflict('recovery_dependencies_unavailable')
  const at=now(),restoring=preview.action==='restore'
  const statement=restoring?
    bound(db,'UPDATE peg_recovery SET restored_at=?,restored_by=? WHERE object_type=? AND object_id=? AND restored_at IS NULL',[at,actor.id,preview.type,preview.id]):
    bound(db,`INSERT INTO peg_recovery(object_type,object_id,workspace_id,actor_id,removed_at,restored_at,restored_by) VALUES(?,?,?,?,?,NULL,NULL)
      ON CONFLICT(object_type,object_id) DO UPDATE SET actor_id=excluded.actor_id,removed_at=excluded.removed_at,restored_at=NULL,restored_by=NULL`,[preview.type,preview.id,workspace,actor.id,at])
  const subject=await recoverySubject(db,actor,workspace,preview.type,preview.id,true)
  const repairs=preview.repairs.map(row=>bound(db,'DELETE FROM peg_dependencies WHERE id=?',[row.id]))
  if(repairs.length)repairs.push(historyStatement(db,preview.id,null,actor.id,'recovery.links_repaired',{count:repairs.length}))
  await guarded(db,preview.rev,[...repairs,statement,permanentEvent(db,{workspace:subject.personal?null:workspace,actor:actor.id,action:'recovery.'+preview.action,type:preview.type,id:preview.id})])
  return {type:preview.type,id:preview.id,action:preview.action,repaired:preview.repairs.length,at}
}
