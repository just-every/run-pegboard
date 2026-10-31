import { all, batch, bound, conflict, first, forbidden, invalid, newId, now } from '../db'
import { workspaceRole, type Actor } from '../workspace/people'
import { digest } from '../decisions/revision'
import { permanentEvent } from '../audit/search'

export const retentionClasses=['product_history','trash','attachments_proofs','import_originals','agent_prompts_outputs','provider_logs','transient_credentials_sessions'] as const
export const externalLimits='Already downloaded files and messages held by outside recipients cannot be recalled by Pegboard. Request deletion through those recipients’ systems; no external deletion is claimed without their receipt.'
export async function requireOwner(db:D1Database,actor:Actor,workspace:string) {
  if(await workspaceRole(db,actor.id,workspace)!=='owner')throw forbidden('owner_required')
  if(!await first(db,'SELECT 1 FROM peg_workspaces WHERE id=?',workspace))throw invalid('workspace')
}
export const dataRevision=async(db:D1Database)=>(await first<{value:number}>(db,'SELECT value FROM peg_data_revision WHERE id=1'))!.value
export const dataGuard=(db:D1Database,actor:Actor,revision:number,deadline:number)=>bound(db,'INSERT INTO peg_data_guards VALUES(?,?,?,?)',[newId('guard'),revision,actor.id,deadline])
export async function commitData(db:D1Database,statements:D1PreparedStatement[]) {
  try{return await batch(db,statements)}catch(error){if(/stale_data_preview|erased_object/.test(String(error)))throw conflict('stale_data_preview');throw error}
}
export async function holds(db:D1Database,workspace:string) {
  return all<{id:string;workspace_id:string;target_type:string;target_id:string;authority:string;expires_at:number;created_by:string;created_at:number;released_at:number|null}>(db,'SELECT * FROM peg_data_holds WHERE workspace_id=? ORDER BY created_at,id',workspace)
}
export async function activeHolds(db:D1Database,workspace:string) {return (await holds(db,workspace)).filter(h=>h.released_at===null&&h.expires_at>now())}
export async function dataSettings(db:D1Database,actor:Actor,workspace:string) {
  await requireOwner(db,actor,workspace)
  const rows=await all<{class:string;days:number|null}>(db,'SELECT class,days FROM peg_retention_classes WHERE workspace_id=?',workspace)
  const recordChoices=await all<{id:string;label:string;type:string}>(db,`SELECT id,name label,'project' type FROM peg_projects WHERE workspace_id=? UNION ALL SELECT id,title label,'task' type FROM peg_tasks WHERE workspace_id=? AND (owner_id=? OR EXISTS(SELECT 1 FROM peg_task_projects p WHERE p.task_id=peg_tasks.id)) UNION ALL SELECT a.id,a.name label,'attachment' type FROM peg_attachments a JOIN peg_tasks t ON t.id=a.task_id WHERE t.workspace_id=? AND (t.owner_id=? OR EXISTS(SELECT 1 FROM peg_task_projects p WHERE p.task_id=t.id)) UNION ALL SELECT p.id,'Proof on '||t.title label,'proof' type FROM peg_proofs p JOIN peg_tasks t ON t.id=p.task_id WHERE t.workspace_id=? UNION ALL SELECT o.id,o.display_name label,'person' type FROM oa_operators o WHERE o.role IN ('owner','admin') OR EXISTS(SELECT 1 FROM peg_workspace_members m WHERE m.operator_id=o.id AND m.workspace_id=?) ORDER BY type,label LIMIT 500`,workspace,workspace,actor.id,workspace,actor.id,workspace,workspace)
  return {recordChoices,processorDeletions:await all<{id:string;processor:string;subject_id:string;state:string;created_at:number}>(db,'SELECT id,processor,subject_id,state,created_at FROM peg_processor_deletions WHERE workspace_id=? ORDER BY created_at DESC',workspace),classes:retentionClasses.map(name=>({name,days:rows.find(r=>r.class===name)?.days??null})),holds:await holds(db,workspace),processors:await all(db,'SELECT processor,approved,training,sharing FROM peg_processor_policies WHERE workspace_id=?',workspace),receipts:await all(db,'SELECT r.*,s.scope intake_scope,s.revision intake_revision,s.scope_digest,s.applied intake_applied FROM peg_data_receipts r LEFT JOIN peg_intake_erasure_receipts s ON s.receipt_id=r.id WHERE r.workspace_id=? ORDER BY r.at DESC,r.id LIMIT 100',workspace),externalLimits,
    custody:'Current attachments, proof versions, task search and agent retrieval copies are stored in this installation’s database. R2 originals, derivatives and incomplete upload parts are not implemented; their cleanup is not claimed.',
    identityLimits:'Person erasure currently anonymizes the inactive profile and permanent-audit presentation. Version-fenced local authentication material and legacy access activity remain retained; the receipt is partial.',
    defaultPolicy:'Keep data until an owner explicitly reviews expiry or erasure. Active holds prevent removal. Processors are denied until explicitly approved; no training or sharing is enabled by default.'}
}
export async function retentionPreview(db:D1Database,actor:Actor,workspace:string,input:Record<string,any>) {
  await requireOwner(db,actor,workspace)
  if(!retentionClasses.includes(input.class))throw invalid('retention_class')
  const days=input.days===null||input.days===''?null:Number(input.days)
  if(days!==null&&(!Number.isSafeInteger(days)||days<1||days>36500))throw invalid('retention_days')
  const revision=await dataRevision(db), current=await dataSettings(db,actor,workspace)
  const cutoff=days===null?null:Math.floor(now()/86400000)*86400000-days*86400000
  const impact=days===null?null:await (await import('./expiry')).expiryPlan(db,actor,workspace,{class:input.class,cutoff},days)
  const plan={impact:impact?{counts:impact.counts,held:impact.held,supported:impact.supported,cutoff}:null,class:input.class as string,days,previousDays:current.classes.find(r=>r.name===input.class)!.days,
    consequence:days===null?'Keep until explicit erasure.':`Records become eligible after ${days} days. Nothing is automatically deleted; review eligible records before running expiry.`,held:current.holds.filter(h=>h.released_at===null&&h.expires_at>now()).length}
  return {...plan,revision,token:await digest([workspace,actor.id,revision,plan])}
}
export async function setRetention(db:D1Database,actor:Actor,workspace:string,input:Record<string,any>) {
  const preview=await retentionPreview(db,actor,workspace,input)
  if(input.token!==preview.token||!(input.confirm===true||input.confirm==='yes'||input.confirm==='on'))throw conflict('retention_review_required')
  await commitData(db,[dataGuard(db,actor,preview.revision,now()+300000),bound(db,'INSERT INTO peg_retention_classes VALUES(?,?,?,?,?) ON CONFLICT(workspace_id,class) DO UPDATE SET days=excluded.days,updated_at=excluded.updated_at,updated_by=excluded.updated_by',[workspace,preview.class,preview.days,now(),actor.id]),permanentEvent(db,{workspace,actor:actor.id,action:'retention.policy_changed',type:'workspace',id:workspace})])
  return preview
}
export async function addHold(db:D1Database,actor:Actor,workspace:string,input:Record<string,any>) {
  await requireOwner(db,actor,workspace)
  if(!['workspace','project','task','attachment','proof','person'].includes(input.type))throw invalid('hold_scope')
  const id=String(input.id??''), authority=String(input.authority??'').trim(),expiresAt=typeof input.expiresAt==='number'?input.expiresAt:Date.parse(String(input.expiresAt??''))
  if(!authority||authority.length>500||!Number.isSafeInteger(expiresAt)||expiresAt<=now())throw invalid('hold_authority_and_expiry')
  const table={workspace:'peg_workspaces',project:'peg_projects',task:'peg_tasks',attachment:'peg_attachments',proof:'peg_proofs',person:'oa_operators'}[input.type as 'workspace']
  if(!await first(db,`SELECT 1 FROM ${table} WHERE id=?`,id))throw invalid('hold_scope')
  if(input.type==='workspace'&&id!==workspace)throw invalid('hold_scope')
  if(['project','task'].includes(input.type)&&!await first(db,`SELECT 1 FROM ${table} WHERE id=? AND workspace_id=?`,id,workspace))throw invalid('hold_scope')
  if(input.type==='proof'&&!await first(db,'SELECT 1 FROM peg_proofs p JOIN peg_tasks t ON t.id=p.task_id WHERE p.id=? AND t.workspace_id=?',id,workspace))throw invalid('hold_scope')
  if(input.type==='attachment'&&!await first(db,'SELECT 1 FROM peg_attachments a JOIN peg_tasks t ON t.id=a.task_id WHERE a.id=? AND t.workspace_id=?',id,workspace))throw invalid('hold_scope')
  const holdId=newId('hold')
  await commitData(db,[dataGuard(db,actor,await dataRevision(db),now()+300000),bound(db,'INSERT INTO peg_data_holds VALUES(?,?,?,?,?,?,?,?,NULL)',[holdId,workspace,input.type,id,authority,expiresAt,actor.id,now()]),permanentEvent(db,{workspace,actor:actor.id,action:'retention.hold_applied',type:input.type,id})])
  return {id:holdId}
}
export async function releaseHold(db:D1Database,actor:Actor,workspace:string,id:string,input:Record<string,any>) {
  await requireOwner(db,actor,workspace)
  if(!(input.confirm===true||input.confirm==='yes'||input.confirm==='on'))throw invalid('hold_release_confirmation')
  if(!await first(db,'SELECT 1 FROM peg_data_holds WHERE id=? AND workspace_id=?',id,workspace))throw invalid('hold')
  await commitData(db,[dataGuard(db,actor,await dataRevision(db),now()+300000),bound(db,'UPDATE peg_data_holds SET released_at=COALESCE(released_at,?) WHERE id=?',[now(),id]),permanentEvent(db,{workspace,actor:actor.id,action:'retention.hold_released',type:'hold',id})])
  return {id}
}
export async function setProcessor(db:D1Database,actor:Actor,workspace:string,input:Record<string,any>) {
  await requireOwner(db,actor,workspace)
  // The installed runtime currently has no agent processor; this policy registers an explicit owner decision only.
  const processor=String(input.processor??'').trim()
  if(!/^[a-z][a-z0-9.-]{1,99}$/.test(processor)||!(input.confirm===true||input.confirm==='yes'||input.confirm==='on'))throw invalid('processor_consent')
  const yes=(v:unknown)=>v===true||v==='on'
  const approved=yes(input.approved),sharing=yes(input.sharing),training=yes(input.training)
  if(!approved&&(sharing||training))throw invalid('processor_not_approved')
  await commitData(db,[dataGuard(db,actor,await dataRevision(db),now()+300000),bound(db,'INSERT INTO peg_processor_policies VALUES(?,?,?,?,?) ON CONFLICT(workspace_id,processor) DO UPDATE SET approved=excluded.approved,training=excluded.training,sharing=excluded.sharing',[workspace,processor,Number(approved),Number(training),Number(sharing)]),permanentEvent(db,{workspace,actor:actor.id,action:'retention.processor_consent',type:'workspace',id:workspace,metadata:{consent:true}})])
  return {processor,approved,sharing,training,outboundAction:'none'}
}
