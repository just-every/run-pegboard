import { PegError, all, bound, conflict, first, forbidden, invalid, newId, notFound, now } from '../db'
import { openProject, need } from '../workspace/projects'
import { displayNames, workspaceRole, type Actor } from '../workspace/people'
import { openTask } from '../tasks/access'
import { digest, guarded, revision } from '../decisions/revision'
import { moveInput, planChange } from '../schedule/plan'
import { historyStatement } from '../tasks/history'
import { auditStatement } from '../authorization/audit'

export const kinds = ['risk', 'blocker', 'assumption', 'decision', 'change'] as const
interface Row { id:string; project_id:string; kind:string; title:string; owner_id:string; impact:string; next_action:string; review_date:string; task_id:string|null; parent_id:string|null; vector_url:string|null; proposal:string; baseline:string; status:string; approver_id:string; created_by:string; created_at:number; decided_by:string|null; decided_at:number|null; reason:string|null }
const text = (v:unknown, key:string, max=4000) => { if(typeof v!=='string'||!v.trim()||v.length>max)throw invalid(key);return v.trim() }
const date = (v:unknown) => { const s=text(v,'review_date',10);if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)throw invalid('review_date');return s }
async function linked(db:D1Database,actor:Actor,projectId:string,taskId:string) {
 const opened=await openTask(db,actor,taskId)
 if(!opened.access.contexts.has(projectId))throw invalid('project_task')
 return opened
}
export async function registerView(db:D1Database,actor:Actor,projectId:string) {
 const {project,effective}=await openProject(db,actor,projectId), rows=await all<Row>(db,'SELECT * FROM peg_delivery_records WHERE project_id=? ORDER BY created_at,id',projectId), records=[]
 const names=await displayNames(db,rows.flatMap(r=>[r.owner_id,r.approver_id,r.decided_by??'',r.created_by]))
 for(const row of rows){
  let task=null
  if(row.task_id){try{task=(await linked(db,actor,projectId,row.task_id)).task}catch(error){if(error instanceof PegError&&[400,403,404].includes(error.status))continue;throw error}}
  const proposal=JSON.parse(row.proposal), baseline=JSON.parse(row.baseline)
  // A baseline may contain other affected projects: never disclose an unreadable task through this register.
  let readable=true
  for(const t of baseline.tasks??[])try{await openTask(db,actor,t.id)}catch(error){if(error instanceof PegError&&[403,404].includes(error.status))readable=false;else throw error}
  if(!readable)continue
  records.push({...row,proposal,baseline,owner:names.get(row.owner_id)??'Former member',approver:names.get(row.approver_id)??'Former member',decider:row.decided_by?names.get(row.decided_by)??'Former member':null,task:task?{id:task.id,title:task.title}:null,token:await digest(row),canDecide:row.status==='pending'&&row.approver_id===actor.id&&effective.capabilities.has('manage_settings')&&await workspaceRole(db,actor.id,project.workspace_id)!=='agent'})
 }
 return {project:{id:project.id,name:project.name,ownerId:project.owner_id},canEdit:effective.capabilities.has('edit'),records}
}
export async function createRecord(db:D1Database,actor:Actor,projectId:string,input:Record<string,any>){
 const rev=await revision(db),{project,effective}=await openProject(db,actor,projectId);need(effective,'edit')
 if(!kinds.includes(input.kind))throw invalid('kind')
 const ownerId=text(input.ownerId,'owner'),approverId=text(input.approverId||project.owner_id,'approver')
 if(await workspaceRole(db,approverId,project.workspace_id)==='agent')throw invalid('human_approver')
 for(const who of [ownerId,approverId]){
  const person=await first<{status:string}>(db,'SELECT status FROM oa_operators WHERE id=?',who)
  if(person?.status!=='active')throw invalid('person')
  const delegated={...actor,id:who},permission=await openProject(db,delegated,projectId)
  need(permission.effective,who===approverId?'manage_settings':'edit')
 }
 const taskId=input.taskId?text(input.taskId,'task'):null
 if(taskId)await linked(db,actor,projectId,taskId)
 const parentId=input.parentId||null
 if(parentId&&!(await registerView(db,actor,projectId)).records.some(r=>r.id===parentId))throw invalid('related_record')
 const vectorUrl=input.vectorUrl?text(input.vectorUrl,'vector_url',1000):null
 if(vectorUrl){let url;try{url=new URL(vectorUrl)}catch{throw invalid('vector_url')}if(url.protocol!=='https:')throw invalid('vector_url')}
 const proposal:{scope?:string;due?:string}={}
 let plan=null
 if(input.kind==='change'){
  if(input.scope)proposal.scope=text(input.scope,'scope')
  if(input.due){if(!taskId)throw invalid('task_required');proposal.due=text(input.due,'due');plan=await planChange(db,actor,moveInput([{taskId,due:proposal.due}]))}
  if(!proposal.scope&&!proposal.due)throw invalid('change_required')
  if(plan&&(!plan.editable||plan.waits||plan.blocked))throw conflict('schedule_not_ready')
 }
 const baseline={scope:project.description,tasks:plan?.all??[],stamp:plan?.stamp??null},id=newId('delivery'),at=now()
 await guarded(db,rev,[bound(db,'INSERT INTO peg_delivery_records(id,project_id,kind,title,owner_id,impact,next_action,review_date,task_id,parent_id,vector_url,proposal,baseline,status,approver_id,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[id,projectId,input.kind,text(input.title,'title',160),ownerId,text(input.impact,'impact'),text(input.nextAction,'next_action'),date(input.reviewDate),taskId,parentId,vectorUrl,JSON.stringify(proposal),JSON.stringify(baseline),'pending',approverId,actor.id,at]),auditStatement(db,{workspaceId:project.workspace_id,actorId:actor.id,action:'delivery.raised',targetType:'project',targetId:projectId,subjectId:id})])
 return (await registerView(db,actor,projectId)).records.find(r=>r.id===id)!
}
export async function decideRecord(db:D1Database,actor:Actor,projectId:string,id:string,input:Record<string,any>){
 const rev=await revision(db),view=await registerView(db,actor,projectId),record=view.records.find(r=>r.id===id)
 if(!record)throw notFound()
 if(record.status!=='pending')throw conflict('already_decided')
 if(!record.canDecide)throw forbidden('named_human_project_admin')
 if(input.revision!==record.token)throw conflict('record_changed')
 if(!['accept','reject'].includes(input.action))throw invalid('decision')
 const reason=text(input.reason,'reason'),at=now(),{project}=await openProject(db,actor,projectId),statements=[]
 if(input.action==='accept'&&record.kind==='change'){
  if(record.proposal.scope&&project.description!==record.baseline.scope)throw conflict('scope_changed')
  if(record.proposal.due){
   const plan=await planChange(db,actor,moveInput([{taskId:record.task_id,due:record.proposal.due}]))
   if(plan.stamp!==record.baseline.stamp)throw conflict('schedule_changed')
   if(!plan.editable||plan.waits||plan.blocked)throw forbidden('all_affected_work')
   for(const change of plan.all)statements.push(bound(db,'UPDATE peg_tasks SET start_date=?,due_date=?,updated_at=? WHERE id=?',[change.to.start,change.to.due,at,change.id]),historyStatement(db,change.id,null,actor.id,'schedule.shifted',{recordId:id,from:{start:change.start,due:change.due},to:change.to}))
  }
  if(record.proposal.scope)statements.push(bound(db,'UPDATE peg_projects SET description=? WHERE id=?',[record.proposal.scope,projectId]))
 }
 statements.push(bound(db,'UPDATE peg_delivery_records SET status=?,decided_by=?,decided_at=?,reason=? WHERE id=?',[input.action==='accept'?'accepted':'rejected',actor.id,at,reason,id]),auditStatement(db,{workspaceId:project.workspace_id,actorId:actor.id,action:'delivery.'+input.action,targetType:'project',targetId:projectId,subjectId:id}))
 await guarded(db,rev,statements)
 return (await registerView(db,actor,projectId)).records.find(r=>r.id===id)!
}
