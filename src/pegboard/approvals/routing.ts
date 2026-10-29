import { all, bound, conflict, first, forbidden, invalid, newId, notFound, now } from '../db'
import { openTask, require as need } from '../tasks/access'
import { taskAccess } from '../authorization/effective'
import { displayNames, operatorRow, workspaceRole, type Actor } from '../workspace/people'
import { digest, guarded, revision } from '../decisions/revision'
import { reopenGuard,historyStatement } from '../tasks/history'
import { permanentEvent } from '../audit/search'
import { isRecoveryHidden } from '../recovery/visibility'
import type { Delivery } from '../access-requests/notify'
import { proofContext } from './material'
import { readinessPreferences } from '../notices/preferences'

const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!))

interface Stage { name:string; people:string[]; quorum:number }
export interface Route { id:string;kind:'proof'|'task';subject_id:string;task_id:string;version:string;mode:'ordered'|'parallel';stages:string;due_at:number|null;reminder_at:number|null;created_by:string;created_at:number;withdrawn_at:number|null }
interface Vote { id:string;stage:number;actor_id:string;action:string;reason:string;at:number;version:string }
export const routeFor=(db:D1Database,kind:string,id:string)=>first<Route>(db,'SELECT * FROM peg_approval_routes WHERE kind=? AND subject_id=? ORDER BY created_at DESC,id DESC LIMIT 1',kind,id)
async function subject(db:D1Database,actor:Actor,kind:string,id:string){
 if(!['proof','task'].includes(kind))throw invalid('approval_kind')
 const proof=kind==='proof'?await first<{task_id:string;current_version:string}>(db,'SELECT * FROM peg_proofs WHERE id=?',id):null
 if(kind==='proof'&&!proof)throw notFound()
 const opened=await openTask(db,actor,proof?.task_id??id)
 if(kind==='task'&&!await first(db,'SELECT 1 FROM peg_approval_tasks WHERE task_id=?',id))throw invalid('approval_task_required')
 const {status,completed_at,updated_at,...material}=opened.task
 const version=proof?.current_version??await digest([
  material,
  await all(db,'SELECT * FROM peg_field_values WHERE task_id=? ORDER BY field_id',opened.task.id),
  await all(db,'SELECT id FROM peg_comments WHERE task_id=? ORDER BY id',opened.task.id),
  await all(db,'SELECT id FROM peg_attachments WHERE task_id=? ORDER BY id',opened.task.id),
  await all(db,'SELECT id,current_version FROM peg_proofs WHERE task_id=? ORDER BY id',opened.task.id),
  await all(db,'SELECT * FROM peg_task_projects WHERE task_id=? ORDER BY project_id',opened.task.id),
  await all(db,'SELECT * FROM peg_field_definitions WHERE id IN (SELECT field_id FROM peg_field_values WHERE task_id=? UNION SELECT field_id FROM peg_project_fields WHERE project_id IN (SELECT project_id FROM peg_task_projects WHERE task_id=?)) ORDER BY id',opened.task.id,opened.task.id),
  await all(db,'SELECT t.* FROM peg_tags t JOIN peg_task_tags tt ON tt.tag_id=t.id WHERE tt.task_id=? ORDER BY t.id',opened.task.id),
  await all(db,'SELECT operator_id FROM peg_task_collaborators WHERE task_id=? ORDER BY operator_id',opened.task.id),
  // Relation generations prevent restored values from reviving an earlier sign-off.
  await all(db,"SELECT kind,target_id,generation FROM peg_rule_link_generations WHERE task_id=? AND kind IN ('tag','collaborator') ORDER BY kind,target_id",opened.task.id),
 ])
 if(proof&&await isRecoveryHidden(db,'proof_version',version))throw notFound()
 return {...opened,version}
}
const timestamp=(value:unknown)=>{if(value===undefined||value===null||value==='')return null;const at=typeof value==='number'?value:/^\d+$/.test(String(value))?Number(value):Date.parse(String(value));if(!Number.isSafeInteger(at)||at<0)throw invalid('approval_time');return at}
function parse(input:Record<string,any>){
 if(input.stages===undefined)input={...input,stages:[1,2].map(n=>({name:input['stageName'+n]||'Review stage '+n,people:input['people'+n]??[],quorum:Number(input['quorum'+n]??1)})).filter(stage=>stage.people.length)}
 let stages:Stage[];try{stages=typeof input.stages==='string'?JSON.parse(input.stages):input.stages}catch{throw invalid('approval_stages')}
 if(!Array.isArray(stages)||!stages.length||stages.length>8)throw invalid('approval_stages')
 const people=new Set<string>()
 for(const s of stages){if(!s||typeof s.name!=='string'||!s.name.trim()||s.name.length>100||!Array.isArray(s.people)||!s.people.length||s.people.length>30||!Number.isInteger(s.quorum)||s.quorum<1||s.quorum>s.people.length)throw invalid('approval_stage');for(const p of s.people){if(typeof p!=='string'||people.has(p))throw invalid('duplicate_approver');people.add(p)}}
 if(!['ordered','parallel'].includes(input.mode))throw invalid('approval_mode')
 return {stages,mode:input.mode as 'ordered'|'parallel',dueAt:timestamp(input.dueAt),reminderAt:timestamp(input.reminderAt)}
}
async function independent(db:D1Database,taskId:string,owner:string,person:string){
 const epoch=(await first<{n:number}>(db,'SELECT COUNT(*) n FROM peg_task_decisions WHERE task_id=?',taskId))!.n
 return person!==owner&&!await first(db,'SELECT 1 FROM peg_approval_owners WHERE task_id=? AND epoch=? AND owner_id=?',taskId,epoch,person)
}
export async function previewRoute(db:D1Database,actor:Actor,kind:string,id:string,input:Record<string,any>){
 const rev=await revision(db),s=await subject(db,actor,kind,id);need(s.access,'manage_shares')
 if(kind==='proof')await proofContext(db,actor,s,s.version)
 if(s.access.personal||s.access.role==='guest'||s.access.role==='agent')throw forbidden('internal_routing_authority')
 const config=parse(input)
 for(const stage of config.stages)for(const person of stage.people){const role=await workspaceRole(db,person,s.task.workspace_id);if(!role||role==='agent'||!await independent(db,s.task.id,s.task.owner_id,person))throw forbidden('independent_named_human');const access=await taskAccess(db,{id:person} as Actor,s.task);need(access,'approve')}
 const token=await digest([actor.id,kind,id,s.version,rev,config])
 return {kind,id,version:s.version,...config,rev,token}
}
export async function configureRoute(db:D1Database,actor:Actor,kind:string,id:string,input:Record<string,any>){
 const p=await previewRoute(db,actor,kind,id,input);if(input.token!==p.token)throw conflict('approval_review_changed')
 const s=await subject(db,actor,kind,id),routeId=newId('route'),at=now()
 await guarded(db,p.rev,[reopenGuard(db,s.task.id,actor.id,'approval_rerouted'),bound(db,"UPDATE peg_tasks SET status='todo',completed_at=NULL,updated_at=? WHERE id=? AND status='done' AND EXISTS(SELECT 1 FROM peg_approval_tasks WHERE task_id=?)",[at,s.task.id,s.task.id]),bound(db,'UPDATE peg_approval_routes SET withdrawn_at=? WHERE kind=? AND subject_id=? AND withdrawn_at IS NULL',[at,kind,id]),bound(db,'INSERT INTO peg_approval_routes VALUES(?,?,?,?,?,?,?,?,?,?,?,NULL)',[routeId,kind,id,s.task.id,p.version,p.mode,JSON.stringify(p.stages),p.dueAt,p.reminderAt,actor.id,at]),historyStatement(db,s.task.id,null,actor.id,'approval.routed',{routeId,version:p.version,mode:p.mode})])
 return {id:routeId,version:p.version}
}
export async function routeView(db:D1Database,actor:Actor,id:string){
 const route=await first<Route>(db,'SELECT * FROM peg_approval_routes WHERE id=?',id);if(!route)throw notFound()
 const rev=await revision(db),s=await subject(db,actor,route.kind,route.subject_id),stages:Stage[]=JSON.parse(route.stages),votes=await all<Vote>(db,'SELECT * FROM peg_approval_votes WHERE route_id=? AND version=? ORDER BY at,id',id,route.version)
 const complete=stages.map((stage,i)=>votes.filter(v=>v.stage===i&&v.action==='approve').length>=stage.quorum)
 const mine=stages.findIndex(stage=>stage.people.includes(actor.id)),active=mine>=0&&(route.mode==='parallel'||complete.slice(0,mine).every(Boolean))
 const state=route.withdrawn_at?'withdrawn':s.version!==route.version?'stale':votes.some(v=>v.action==='reject')?'rejected':votes.some(v=>v.action==='changes')?'changes_requested':complete.every(Boolean)?'approved':'pending'
 const link=await first<{expires_at:number}>(db,'SELECT expires_at FROM peg_approval_links WHERE route_id=? AND recipient_id=? AND version=? AND revoked_at IS NULL AND expires_at>? ORDER BY expires_at DESC LIMIT 1',id,actor.id,route.version,now())
 if(s.access.role==='guest'&&link)rev.until=Math.min(rev.until??Infinity,link.expires_at)
 if(s.access.role==='guest'&&(!link||state==='withdrawn'||state==='stale'))throw notFound()
 const externalLink=s.access.role!=='guest'||!!link
 const cancelled=!!await first(db,'SELECT 1 FROM peg_identity_approval_cancellations WHERE route_id=? AND operator_id=?',id,actor.id)
 const canDecide=!cancelled&&externalLink&&state==='pending'&&active&&!votes.some(v=>v.actor_id===actor.id)&&s.access.capabilities.has('approve')&&s.access.role!=='agent'&&await independent(db,s.task.id,s.task.owner_id,actor.id)
 const canManage=s.access.capabilities.has('manage_shares')&&s.access.role!=='guest'&&s.access.role!=='agent'
 if(canManage&&route.kind==='proof')await proofContext(db,actor,s,route.version)
 const task=route.kind==='task'?{id:s.task.id,title:s.task.title,description:s.task.description,revision:route.version}:null
 const names=await displayNames(db,stages.flatMap(stage=>stage.people)),links=canManage?await all<{id:string;recipient_id:string;expires_at:number;revoked_at:number|null}>(db,'SELECT * FROM peg_approval_links WHERE route_id=?',id):[]
 const material=route.kind==='proof'?await first<{name:string;version:number}>(db,'SELECT a.name,v.version FROM peg_proof_versions v JOIN peg_attachments a ON a.id=v.attachment_id WHERE v.id=?',route.version):null
 return {task,names:Object.fromEntries([...names].filter(([id])=>canManage||id===actor.id)),material,links,id,kind:route.kind,subjectId:route.subject_id,taskId:s.task.id,version:route.version,state,mode:route.mode,dueAt:route.due_at,canDecide,canManage,stages:stages.map((stage,i)=>({name:stage.name,quorum:stage.quorum,approved:votes.filter(v=>v.stage===i&&v.action==='approve').length,complete:complete[i],...(canManage?{people:stage.people}:{})})),votes:canManage?votes:votes.filter(v=>v.actor_id===actor.id),rev,token:await digest([actor.id,route,s.version,rev,votes]),stage:mine}
}
export async function decideRoute(db:D1Database,actor:Actor,id:string,input:Record<string,any>){
 const view=await routeView(db,actor,id);if(!view.canDecide)throw forbidden('current_named_approver')
 if(input.token!==view.token||input.version!==view.version)throw conflict('approval_revision_changed')
 if(!['approve','changes','reject'].includes(input.action)||typeof input.reason!=='string'||!input.reason.trim()||input.reason.length>5000)throw invalid('approval_decision')
 const at=now(),decision=newId('routeddecision'),statements=[bound(db,'INSERT INTO peg_approval_votes VALUES(?,?,?,?,?,?,?,?)',[decision,id,view.version,view.stage,actor.id,input.action,input.reason.trim(),at]),historyStatement(db,view.taskId,null,actor.id,'approval.'+input.action,{routeId:id,version:view.version,decision})]
 const finishes=input.action==='approve'&&view.stages.every((s,i)=>s.complete||(i===view.stage&&s.approved+1>=s.quorum))
 if(view.kind==='task'&&(finishes||input.action!=='approve'))statements.push(bound(db,'INSERT INTO peg_task_decisions VALUES(?,?,?,?,?,?,?)',[decision,view.taskId,actor.id,at,view.version,input.action,input.reason.trim()]),bound(db,'INSERT INTO peg_decision_guards VALUES(?)',[view.taskId]),bound(db,'UPDATE peg_tasks SET status=?,completed_at=?,updated_at=? WHERE id=?',[finishes?'done':'todo',finishes?at:null,at,view.taskId]),bound(db,'DELETE FROM peg_decision_guards WHERE task_id=?',[view.taskId]))
 if(view.kind==='proof'&&(finishes||input.action!=='approve'))statements.push(bound(db,'INSERT INTO peg_proof_decisions VALUES(?,?,?,?,?,?,?)',[decision,view.subjectId,view.version,actor.id,input.action,at,input.reason.trim()]))
 statements.push(permanentEvent(db,{workspace:(await subject(db,actor,view.kind,view.subjectId)).task.workspace_id,actor:actor.id,action:'approval.'+input.action,type:'approval',id,metadata:{decisionId:decision}}))
 await guarded(db,view.rev,statements)
 return {id:decision,version:view.version,action:input.action,state:finishes?'approved':input.action==='approve'?'pending':input.action==='changes'?'changes_requested':'rejected'}
}
export async function changeRoute(db:D1Database,actor:Actor,id:string,input:Record<string,any>){
 const view=await routeView(db,actor,id);if(!view.canManage)throw forbidden('manage_shares');if(input.token!==view.token)throw conflict('approval_revision_changed')
 const route=(await first<Route>(db,'SELECT * FROM peg_approval_routes WHERE id=?',id))!,stages:Stage[]=JSON.parse(route.stages)
 if(route.withdrawn_at||(await routeFor(db,route.kind,route.subject_id))?.id!==id)throw conflict('approval_route_inactive')
 if(input.action==='delegate'){
 const stage=Number(input.stage),from=String(input.from??''),to=String(input.to??'');if(!stages[stage]?.people.includes(from)||stages.some(s=>s.people.includes(to))||view.votes.some(v=>v.actor_id===from))throw invalid('approval_delegate')
 stages[stage].people=stages[stage].people.map(p=>p===from?to:p)
 const p=await previewRoute(db,actor,route.kind,route.subject_id,{stages,mode:route.mode,dueAt:route.due_at,reminderAt:route.reminder_at})
 await guarded(db,p.rev,[bound(db,'UPDATE peg_approval_routes SET stages=? WHERE id=?',[JSON.stringify(stages),id]),bound(db,'UPDATE peg_approval_links SET revoked_at=? WHERE route_id=? AND recipient_id=?',[now(),id,from]),historyStatement(db,view.taskId,null,actor.id,'approval.delegated',{routeId:id,from,to,stage})])
 }else if(input.action==='withdraw')await guarded(db,view.rev,[reopenGuard(db,view.taskId,actor.id,'approval_withdrawn'),bound(db,"UPDATE peg_tasks SET status='todo',completed_at=NULL,updated_at=? WHERE id=? AND status='done' AND EXISTS(SELECT 1 FROM peg_approval_tasks WHERE task_id=?)",[now(),view.taskId,view.taskId]),bound(db,'UPDATE peg_approval_routes SET withdrawn_at=? WHERE id=?',[now(),id]),bound(db,'UPDATE peg_approval_links SET revoked_at=? WHERE route_id=?',[now(),id]),historyStatement(db,view.taskId,null,actor.id,'approval.withdrawn',{routeId:id})])
 else throw invalid('approval_action')
 return {id}
}
export async function shareRoute(db:D1Database,actor:Actor,id:string,input:Record<string,any>){
 const view=await routeView(db,actor,id);if(!view.canManage)throw forbidden('manage_shares');if(input.token!==view.token||view.state!=='pending')throw conflict('approval_review_changed')
 const recipient=String(input.recipientId??''),expiresAt=timestamp(input.expiresAt);if(!expiresAt||!view.stages.some(s=>s.people?.includes(recipient))||!await workspaceRole(db,recipient,(await subject(db,actor,view.kind,view.subjectId)).task.workspace_id)||await first(db,'SELECT 1 FROM peg_identity_approval_cancellations WHERE route_id=? AND operator_id=?',id,recipient))throw invalid('approval_recipient')
 const link=newId('review')
 await guarded(db,view.rev,[bound(db,'UPDATE peg_approval_links SET revoked_at=? WHERE route_id=? AND recipient_id=? AND revoked_at IS NULL',[now(),id,recipient]),bound(db,'INSERT INTO peg_approval_links VALUES(?,?,?,?,?,NULL)',[link,id,recipient,view.version,expiresAt]),historyStatement(db,view.taskId,null,actor.id,'approval.shared',{routeId:id,recipient,version:view.version})])
 return {id:link,path:'/app/proof-reviews/'+link,recipientId:recipient,version:view.version}
}
export async function reviewLink(db:D1Database,actor:Actor,id:string){
 const link=await first<{route_id:string;recipient_id:string;version:string;expires_at:number;revoked_at:number|null}>(db,'SELECT * FROM peg_approval_links WHERE id=?',id)
 if(!link||link.recipient_id!==actor.id||link.revoked_at||link.expires_at<=now())throw notFound()
 const view=await routeView(db,actor,link.route_id);if(view.version!==link.version||['stale','withdrawn'].includes(view.state)||!((await subject(db,actor,view.kind,view.subjectId)).access.capabilities.has('approve')))throw notFound()
 return {linkId:id,...view}
}
export async function revokeLink(db:D1Database,actor:Actor,id:string){
 const link=await first<{route_id:string}>(db,'SELECT route_id FROM peg_approval_links WHERE id=?',id);if(!link)throw notFound()
 const view=await routeView(db,actor,link.route_id);if(!view.canManage)throw forbidden('manage_shares')
 await guarded(db,view.rev,[bound(db,'UPDATE peg_approval_links SET revoked_at=? WHERE id=?',[now(),id]),historyStatement(db,view.taskId,null,actor.id,'approval.link_revoked',{linkId:id})]);return {id}
}
export async function proofMaterial(db:D1Database,actor:Actor,id:string){
 const view=await reviewLink(db,actor,id);if(view.kind!=='proof')throw notFound()
 const file=await first<{name:string;content_type:string;data:ArrayBuffer|number[]}>(db,'SELECT a.name,a.content_type,a.data FROM peg_attachments a JOIN peg_proof_versions v ON v.attachment_id=a.id WHERE v.id=?',view.version);if(!file)throw notFound()
 return new Response(file.data instanceof ArrayBuffer?file.data:new Uint8Array(file.data),{headers:{'content-type':file.content_type,'content-disposition':`attachment; filename="reviewed-proof"`,'cache-control':'no-store','x-content-type-options':'nosniff'}})
}
export async function dispatchReminders(db:D1Database,actor:Actor,id:string,delivery:Delivery){
 const view=await routeView(db,actor,id);if(!view.canManage)throw forbidden('manage_shares')
 const route=(await first<Route>(db,'SELECT * FROM peg_approval_routes WHERE id=?',id))!
 if(view.state!=='pending'||!route.reminder_at||route.reminder_at>now())return {sent:0}
 let sent=0
 for(const link of await all<{id:string;recipient_id:string}>(db,'SELECT * FROM peg_approval_links WHERE route_id=? AND revoked_at IS NULL AND expires_at>?',id,now())){
 const recipient=await operatorRow(db,link.recipient_id);if(!recipient)continue
 let current;try{current=await reviewLink(db,{id:recipient.id} as Actor,link.id)}catch{continue}if(!current.canDecide)continue
 const p=await readinessPreferences(db,{id:recipient.id} as Actor,(await subject(db,actor,view.kind,view.subjectId)).task.workspace_id)
 if(!p.enabled||p.muted||Math.max(p.dndUntil??0,p.digestUntil??0)>now()||!delivery.mail||!delivery.from)continue
 const claim=await bound(db,"INSERT OR IGNORE INTO peg_approval_reminders VALUES(?,'sending',NULL)",[link.id]).run();if(!claim.meta.changes)continue
 try{
 const text=`Proof approval reminder. Reviewed version ${view.version}. Sign in to review: ${delivery.origin}/app/proof-reviews/${link.id}`
 const receipt=await delivery.mail.send({deliveryId:'proof-reminder-'+link.id,from:delivery.from,to:[recipient.email],subject:'Proof approval reminder',text,html:`<p>Proof approval reminder. Reviewed version ${escapeHtml(view.version)}.</p><p><a href="${escapeHtml(delivery.origin+'/app/proof-reviews/'+link.id)}">Sign in to review</a></p>`,headers:{'Auto-Submitted':'auto-generated'}})
 await bound(db,'UPDATE peg_approval_reminders SET state=?,sent_at=? WHERE link_id=?',[receipt?.status??'accepted',now(),link.id]).run();sent++
 }catch{await bound(db,"UPDATE peg_approval_reminders SET state='failed' WHERE link_id=?",[link.id]).run()}
 }
 return {sent}
}

export async function processApprovalReminders(db:D1Database,delivery:Delivery){
 for(const route of await all<Route>(db,'SELECT * FROM peg_approval_routes WHERE withdrawn_at IS NULL AND reminder_at<=?',now())){
 const operator=await operatorRow(db,route.created_by);if(!operator)continue
 try{await dispatchReminders(db,{id:operator.id} as Actor,route.id,delivery)}catch{/* Revoked routing authority never sends. */}
 }
}
