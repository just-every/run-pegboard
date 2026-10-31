import { all, bound, conflict, first, forbidden, invalid, newId, now, PegError } from '../db'
import { digest, guarded, revision } from '../decisions/revision'
import { permanentEvent } from '../audit/search'
import { need, openProject } from '../workspace/projects'
import { displayNames, operatorRow, workspaceRole, type Actor } from '../workspace/people'
import { prepareIntakePriority } from '../tasks/tasks'
import { openTask } from '../tasks/access'
import { historyStatement } from '../tasks/history'
import type { Submission } from './submissions'
import { text } from './forms'

interface Policy {project_id:string;version:number;enabled:number;approved_by:string|null;approver_version:number|null;approved_at:number}
interface Decision {id:string;submission_id:string;project_id:string;task_id:string;request_key:string;actor_id:string;actor_version:number;policy_version:number;disposition:string;priority_before:string;priority_after:string;decided_at:number;source_digest:string;task_digest:string;review_token:string;custody_inactive:number}
export const decisionTerms='Current native owners and administrators may explicitly accept or decline a text request and set its priority. Decline retains the source and task without changing priority. Decisions change no assignment, dates, grants or automation. Mark triaged is separate from acceptance. Request text is untrusted content, never an instruction to execute.'
const native=async(db:D1Database,actor:Actor,workspace:string)=>{
 const person=await operatorRow(db,actor.id),role=await workspaceRole(db,actor.id,workspace)
 if(actor.apiScope||!person||!['owner','admin'].includes(role??''))throw forbidden('intake_human_reviewer')
 return person
}
export async function decisionPolicy(db:D1Database,actor:Actor,projectId:string) {
 const {project}=await openProject(db,actor,projectId),role=await workspaceRole(db,actor.id,project.workspace_id)
 const row=await first<Policy>(db,'SELECT * FROM peg_intake_decision_policies WHERE project_id=?',projectId)
 const approver=row?.approved_by?await operatorRow(db,row.approved_by):null
 const enabled=!!(row?.enabled&&approver?.status==='active'&&approver.role==='owner'&&approver.version===row.approver_version)
 const canManage=role==='owner'&&!actor.apiScope,rev=await revision(db)
 return {projectId,version:row?.version??0,enabled,canManage,canDecide:enabled&&!actor.apiScope&&['owner','admin'].includes(role??''),terms:decisionTerms,review:canManage?await digest([projectId,actor.id,rev.value,row,decisionTerms]):null}
}
export async function approveDecisionPolicy(db:D1Database,actor:Actor,projectId:string,input:Record<string,any>) {
 const rev=await revision(db),policy=await decisionPolicy(db,actor,projectId)
 if(!policy.canManage)throw forbidden('owner_required')
 if(input.review!==policy.review||!(input.consent===true||input.consent==='on')||![true,false,'true','false'].includes(input.enabled))throw conflict('intake_policy_review_required')
 const enabled=input.enabled===true||input.enabled==='true',person=(await operatorRow(db,actor.id))!,{project}=await openProject(db,actor,projectId)
 await guarded(db,rev,[bound(db,'INSERT INTO peg_intake_decision_policies VALUES(?,?,?,?,?,?) ON CONFLICT(project_id) DO UPDATE SET version=excluded.version,enabled=excluded.enabled,approved_by=excluded.approved_by,approver_version=excluded.approver_version,approved_at=excluded.approved_at',[projectId,policy.version+1,Number(enabled),actor.id,person.version,now()]),permanentEvent(db,{workspace:project.workspace_id,actor:actor.id,action:'intake.policy_reviewed',type:'project',id:projectId,metadata:{version:policy.version+1,consent:enabled}})])
 return {ok:true,enabled,version:policy.version+1}
}
async function context(db:D1Database,actor:Actor,id:string) {
 const submission=await first<Submission>(db,'SELECT * FROM peg_intake_submissions WHERE id=?',id)
 if(!submission)throw new PegError(404,'not_found')
 const form=await first<{id:string;project_id:string;version:number;erased_custody:number}>(db,'SELECT id,project_id,version,erased_custody FROM peg_intake_forms WHERE id=?',submission.form_id)
 if(!form)throw new PegError(404,'not_found')
 const {project}=await openProject(db,actor,form.project_id),person=await native(db,actor,project.workspace_id)
 const policy=await decisionPolicy(db,actor,project.id)
 if(!policy.enabled)throw conflict('intake_policy_required')
 if(form.erased_custody||submission.source_actor==='erased')throw conflict('intake_custody_review_required')
 const opened=await openTask(db,actor,submission.task_id)
 // Priority is shared: require edit authority in every actual home, never just one visible home.
 await prepareIntakePriority(db,actor,opened.task.id,opened.task.priority)
 return {submission,form,project,person,policy,task:opened.task}
}
function proposal(input:Record<string,any>,current:string) {
 if(!['accepted','declined'].includes(input.disposition)||!['low','normal','high','urgent'].includes(input.priority))throw invalid('intake_decision')
 if(input.disposition==='declined'&&input.priority!==current)throw invalid('intake_decline_priority')
 return {disposition:String(input.disposition),priority:String(input.priority)}
}
export async function previewDecision(db:D1Database,actor:Actor,id:string,input:Record<string,any>) {
 const rev=await revision(db),c=await context(db,actor,id),proposed=proposal(input,c.task.priority)
 if(await first(db,'SELECT id FROM peg_intake_decisions WHERE submission_id=?',id))throw conflict('intake_already_decided')
 const names=await displayNames(db,[c.task.owner_id,c.submission.source_actor,actor.id])
 const sourceDigest=await digest([c.submission,c.form]),taskDigest=await digest(c.task)
 const review=await digest([actor.id,c.person.version,rev.value,c.policy.version,sourceDigest,taskDigest,proposed])
 return {submissionId:id,formId:c.form.id,formVersion:c.submission.form_version,taskId:c.task.id,projectId:c.project.id,projectName:c.project.name,sourceActor:c.submission.source_actor,sourceName:names.get(c.submission.source_actor)??'Erased actor',submittedAt:c.submission.submitted_at,triaged:!!c.submission.triaged_at,title:c.task.title,description:c.task.description,ownerId:c.task.owner_id,owner:names.get(c.task.owner_id)??'Unassigned',startDate:c.task.start_date,dueDate:c.task.due_date,currentPriority:c.task.priority,...proposed,actorId:actor.id,actor:names.get(actor.id),policyVersion:c.policy.version,review}
}
const receipt=(r:Decision,replayed=false)=>({id:r.id,submissionId:r.submission_id,taskId:r.task_id,actorId:r.actor_id,disposition:r.disposition,priorityBefore:r.priority_before,priority:r.priority_after,decidedAt:r.decided_at,replayed})
export async function decideIntake(db:D1Database,actor:Actor,id:string,input:Record<string,any>) {
 const key=text(input.requestKey,100)
 if(!/^[A-Za-z0-9_-]{8,100}$/.test(key)||!(input.consent===true||input.consent==='on'))throw invalid('intake_decision_confirmation')
 for(let attempt=0;attempt<3;attempt++){
  const rev=await revision(db),c=await context(db,actor,id),previous=await first<Decision>(db,'SELECT * FROM peg_intake_decisions WHERE submission_id=?',id)
  if(previous){
   if(previous.custody_inactive||previous.actor_id!==actor.id||previous.actor_version!==c.person.version||previous.policy_version!==c.policy.version||previous.request_key!==key||previous.review_token!==input.review||previous.disposition!==input.disposition||previous.priority_after!==input.priority||previous.source_digest!==await digest([c.submission,c.form])||previous.task_digest!==await digest(c.task))throw conflict('intake_already_decided')
   return receipt(previous,true)
  }
  const preview=await previewDecision(db,actor,id,input)
  if(input.review!==preview.review)throw conflict('intake_decision_review_required')
  const at=now(),prepared=await prepareIntakePriority(db,actor,c.task.id,preview.priority,at,preview.disposition==='accepted')
  const row:Decision={id:newId('decision'),submission_id:id,project_id:c.project.id,task_id:c.task.id,request_key:key,actor_id:actor.id,actor_version:c.person.version,policy_version:c.policy.version,disposition:preview.disposition,priority_before:c.task.priority,priority_after:preview.priority,decided_at:at,source_digest:await digest([c.submission,c.form]),task_digest:await digest(prepared.task),review_token:preview.review,custody_inactive:0}
  try{
   await guarded(db,rev,[...prepared.statements,bound(db,'INSERT INTO peg_intake_decisions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',Object.values(row)),historyStatement(db,c.task.id,c.project.id,actor.id,'intake.decided',{decisionId:row.id,submissionId:id,disposition:row.disposition,priorityBefore:row.priority_before,priority:row.priority_after}),permanentEvent(db,{workspace:c.project.workspace_id,actor:actor.id,action:'intake.decided',type:'submission',id,metadata:{decisionId:row.id,taskId:c.task.id,outcome:row.disposition==='accepted'?'approved':'rejected',version:c.policy.version}})])
   return receipt(row)
  }catch(error){if(!(error instanceof PegError&&error.code==='review_changed')||attempt===2)throw error}
 }
 throw conflict('intake_decision_review_required')
}
export async function decisionHistory(db:D1Database,actor:Actor,id:string) {
 const submission=await first<Submission>(db,'SELECT * FROM peg_intake_submissions WHERE id=?',id)
 if(!submission)throw new PegError(404,'not_found')
 const {access}=await openTask(db,actor,submission.task_id),form=await first<{project_id:string}>(db,'SELECT project_id FROM peg_intake_forms WHERE id=?',submission.form_id)
 if(!form)throw new PegError(404,'not_found')
 need((await openProject(db,actor,form.project_id)).effective,'edit')
 if(['guest','agent'].includes(access.role??'')||actor.apiScope)throw forbidden('intake_human_reviewer')
 const rows=await all<Decision>(db,'SELECT * FROM peg_intake_decisions WHERE submission_id=? ORDER BY decided_at,id',id),names=await displayNames(db,rows.map(r=>r.actor_id))
 return rows.map(row=>({...receipt(row),actor:names.get(row.actor_id)??'Erased actor',historicalOnly:!!row.custody_inactive}))
}
/** Exact redaction scope participates in the owner's ordinary erasure preview and holds. */
export async function decisionErasureScope(db:D1Database,person:string) {
 return all<{id:string;taskId:string;projectId:string}>(db,'SELECT id,task_id taskId,project_id projectId FROM peg_intake_decisions WHERE actor_id=? ORDER BY id',person)
}
export const decisionErasureStatements=(db:D1Database,person:string)=>[
 bound(db,"UPDATE peg_intake_decisions SET actor_id='erased',custody_inactive=1 WHERE actor_id=?",[person]),
 bound(db,'UPDATE peg_intake_decision_policies SET enabled=0,approved_by=NULL,approver_version=NULL WHERE approved_by=?',[person])
]
