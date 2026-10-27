import { routeFor,routeView } from '../approvals/routing'
import { isRecoveryHidden } from '../recovery/visibility'
// Real native records, authorized by the same current task grants as work itself. No provider or model is emulated.
import { all, bound, conflict, first, forbidden, invalid, newId, notFound, now } from '../db'
import { openTask, require as need } from '../tasks/access'
import { readAttachment } from '../tasks/view'
import { reopenGuard } from '../tasks/history'
import { digest, guarded, revision } from '../decisions/revision'
import { permanentEvent } from '../audit/search'
import { isAdministrator } from '../authorization/levels'
import { workspaceRole, type Actor } from '../workspace/people'

interface Proof {id:string;task_id:string;current_version:string|null;created_by:string;created_at:number}
interface Version {id:string;proof_id:string;attachment_id:string;version:number;digest:string;created_by:string;created_at:number}
const reopenWork=(db:D1Database,actor:Actor,task:string,cause:string)=>[reopenGuard(db,task,actor.id,cause),bound(db,"UPDATE peg_tasks SET status='todo',completed_at=NULL,updated_at=? WHERE id=? AND status='done' AND EXISTS(SELECT 1 FROM peg_approval_tasks WHERE task_id=?)",[now(),task,task])]
const text=(v:unknown,max:number,code:string)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw invalid(code);return v.trim()}
async function fileFor(db:D1Database,actor:Actor,task:string,attachment:unknown) {
  const id=String(attachment??'')
  if(!await first(db,'SELECT 1 FROM peg_attachments WHERE id=? AND task_id=?',id,task))throw notFound()
  const file=await readAttachment(db,actor,id)
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',file.bytes))].map(n=>n.toString(16).padStart(2,'0')).join('')
  return {id,digest:hash}
}
export async function createProof(db:D1Database,actor:Actor,taskId:string,input:Record<string,any>) {
  const rev=await revision(db),{task,access}=await openTask(db,actor,taskId);need(access,'edit')
  if(access.personal||access.role==='agent'||access.role==='guest')throw forbidden('internal_proof_authority')
  const file=await fileFor(db,actor,task.id,input.attachmentId),id=newId('proof'),version=newId('version'),at=now()
  if(await first(db,'SELECT 1 FROM peg_proof_versions WHERE attachment_id=?',file.id))throw conflict('attachment_already_versioned')
  await guarded(db,rev,[...reopenWork(db,actor,task.id,'proof_version'),bound(db,'INSERT INTO peg_proofs VALUES(?,?,?,?,?)',[id,task.id,version,actor.id,at]),bound(db,'INSERT INTO peg_proof_versions VALUES(?,?,?,?,?,?,?)',[version,id,file.id,1,file.digest,actor.id,at]),permanentEvent(db,{workspace:task.workspace_id,actor:actor.id,action:'proof.created',type:'proof',id})])
  return {id,versionId:version,digest:file.digest}
}
export async function proofView(db:D1Database,actor:Actor,id:string) {
  const proof=await first<Proof>(db,'SELECT * FROM peg_proofs WHERE id=?',id);if(!proof)throw notFound()
  const {task,access}=await openTask(db,actor,proof.task_id)
  const versions=await all<Version>(db,'SELECT * FROM peg_proof_versions WHERE proof_id=? ORDER BY version',id),visible:Version[]=[]
  for(const v of versions){if(await isRecoveryHidden(db,'proof_version',v.id))continue;const file=await first<{project_id:string|null;created_by:string}>(db,'SELECT project_id,created_by FROM peg_attachments WHERE id=?',v.attachment_id);if(file&&(file.project_id===null?task.owner_id===actor.id:access.contexts.has(file.project_id)))visible.push(v)}
  if(!visible.some(v=>v.id===proof.current_version))throw notFound()
  const allowed=new Set(visible.map(v=>v.id)),decisions=(await all<{id:string;version_id:string;actor_id:string;action:string;at:number;reason:string}>(db,'SELECT * FROM peg_proof_decisions WHERE proof_id=? ORDER BY at,id',id)).filter(d=>allowed.has(d.version_id))
  const latest=decisions.filter(d=>d.version_id===proof.current_version).at(-1)
  const route=await routeFor(db,'proof',id),routing=route?await routeView(db,actor,route.id):null
  return {proof,taskId:task.id,versions:visible,decisions,state:routing?({approved:'approve',rejected:'reject',changes_requested:'changes'}[routing.state]??'pending'):latest?.action??'pending',canEdit:access.capabilities.has('edit')&&access.role!=='agent'&&access.role!=='guest'}
}
export async function addProofVersion(db:D1Database,actor:Actor,id:string,input:Record<string,any>) {
  const rev=await revision(db),view=await proofView(db,actor,id);if(!view.canEdit)throw forbidden('proof_edit')
  if(input.currentVersion!==view.proof.current_version)throw conflict('stale_proof_version')
  const {task}=await openTask(db,actor,view.taskId),file=await fileFor(db,actor,task.id,input.attachmentId),version=newId('version')
  if(await first(db,'SELECT 1 FROM peg_proof_versions WHERE attachment_id=?',file.id))throw conflict('attachment_already_versioned')
  await guarded(db,rev,[...reopenWork(db,actor,task.id,'proof_version'),bound(db,'INSERT INTO peg_proof_versions VALUES(?,?,?,?,?,?,?)',[version,id,file.id,Math.max(...view.versions.map(v=>v.version))+1,file.digest,actor.id,now()]),bound(db,'UPDATE peg_proofs SET current_version=? WHERE id=?',[version,id]),permanentEvent(db,{workspace:task.workspace_id,actor:actor.id,action:'proof.version_added',type:'proof',id})])
  return {id,versionId:version,digest:file.digest}
}
export async function proofDecisionPreview(db:D1Database,actor:Actor,id:string) {
  const rev=await revision(db),view=await proofView(db,actor,id),{task,access}=await openTask(db,actor,view.taskId)
  const canDecide=!await routeFor(db,'proof',id)&&isAdministrator(await workspaceRole(db,actor.id,task.workspace_id))&&actor.id!==task.owner_id&&access.role!=='agent'&&access.role!=='guest'
  return {...view,canDecide,rev,token:await digest([rev,view.proof,view.versions])}
}
export async function decideProof(db:D1Database,actor:Actor,id:string,input:Record<string,any>) {
  if(await routeFor(db,'proof',id))throw conflict('use_routed_approval')
  const view=await proofDecisionPreview(db,actor,id);if(!view.canDecide)throw forbidden('independent_human_administrator')
  if(input.versionId!==view.proof.current_version||input.token!==view.token)throw conflict('stale_proof_decision')
  if(!['approve','changes','reject'].includes(input.action))throw invalid('proof_decision')
  const reason=text(input.reason,5000,'decision_reason'),decision=newId('proofdecision'),{task}=await openTask(db,actor,view.taskId)
  await guarded(db,view.rev,[bound(db,'INSERT INTO peg_proof_decisions VALUES(?,?,?,?,?,?,?)',[decision,id,input.versionId,actor.id,input.action,now(),reason]),permanentEvent(db,{workspace:task.workspace_id,actor:actor.id,action:'proof.'+input.action,type:'proof',id,metadata:{decisionId:decision}})])
  return {id:decision,versionId:input.versionId,action:input.action}
}

interface Output {id:string;task_id:string;project_id:string;actor_id:string;processor:string;body:string;policy:string;operation_key:string;created_at:number}
export async function submitOutput(db:D1Database,actor:Actor,taskId:string,input:Record<string,any>) {
  const rev=await revision(db),{task,access}=await openTask(db,actor,taskId);need(access,'edit')
  if(access.role!=='agent'||access.personal)throw forbidden('scoped_agent_required')
  const project=String(input.projectId??'');if(!access.contexts.get(project)?.capabilities.has('edit'))throw forbidden('project_scope')
  const processor=text(input.processor,100,'processor'),choice=await first<{approved:number;sharing:number;training:number}>(db,'SELECT approved,sharing,training FROM peg_processor_policies WHERE workspace_id=? AND processor=?',task.workspace_id,processor)
  if(!choice?.approved)throw forbidden('processor_not_approved')
  const body=text(input.body,1000000,'output_body'),key=text(input.key,100,'operation_key'),keyHash=await digest([actor.id,key])
  if(await first(db,"SELECT 1 FROM peg_data_erased_objects WHERE object_type='agent_output_key' AND object_id=?",keyHash))throw conflict('erased_output')
  const prior=await first<Output>(db,'SELECT * FROM peg_agent_outputs WHERE actor_id=? AND operation_key=?',actor.id,key)
  if(prior){if(prior.task_id!==task.id||prior.body!==body||prior.processor!==processor||prior.project_id!==project)throw conflict('output_key_changed');return {id:prior.id,replayed:true}}
  const id=newId('output'),selected=JSON.stringify({processor,sharing:!!choice.sharing,training:!!choice.training})
  await guarded(db,rev,[...reopenWork(db,actor,task.id,'agent_output'),bound(db,'INSERT INTO peg_agent_outputs VALUES(?,?,?,?,?,?,?,?,?)',[id,task.id,project,actor.id,processor,body,selected,key,now()]),bound(db,'INSERT INTO peg_agent_retrieval VALUES(?,?,?)',[id,task.id,body.normalize('NFKC')]),permanentEvent(db,{workspace:task.workspace_id,actor:actor.id,action:'agent.output_saved',type:'task',id:task.id})])
  return {id,replayed:false}
}
export async function outputView(db:D1Database,actor:Actor,id:string,retrieval=false) {
  const row=await first<Output>(db,'SELECT * FROM peg_agent_outputs WHERE id=?',id);if(!row)throw notFound()
  const {task,access}=await openTask(db,actor,row.task_id);if(!access.contexts.has(row.project_id))throw notFound()
  if(access.role==='agent'&&!await first(db,'SELECT 1 FROM peg_processor_policies WHERE workspace_id=? AND processor=? AND approved=1',task.workspace_id,row.processor))throw forbidden('processor_not_approved')
  const copy=retrieval?await first<{body:string}>(db,'SELECT body FROM peg_agent_retrieval WHERE output_id=?',id):null
  return {id:row.id,taskId:row.task_id,actorId:row.actor_id,processor:row.processor,body:retrieval?copy?.body??null:row.body,policy:JSON.parse(row.policy),createdAt:row.created_at}
}
export async function searchTasks(db:D1Database,actor:Actor,workspace:string,input:Record<string,string>) {
  const query=String(input.q??'').trim(),after=String(input.after??'')
  if(!query||query.length>200||after.length>100)throw invalid('search_query')
  // No hidden counts or skipped-row cursor: only authorized task IDs and current visible titles leave this door.
  const rows=await all<{task_id:string}>(db,"SELECT s.task_id FROM peg_search_records s JOIN peg_tasks t ON t.id=s.task_id WHERE t.workspace_id=? AND s.task_id>? AND instr(lower(s.body),lower(?))>0 ORDER BY s.task_id",workspace,after,query),results:Array<{id:string;title:string}>=[]
  for(const row of rows){try{const {task}=await openTask(db,actor,row.task_id);results.push({id:task.id,title:task.title});if(results.length===50)break}catch(error){if(!(error instanceof Error&&'status' in error&&error.status===404))throw error}}
  return {results,next:results.length===50?results.at(-1)!.id:null}
}
