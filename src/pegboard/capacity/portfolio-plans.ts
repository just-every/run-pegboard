import { all, bound, conflict, first, forbidden, invalid, newId, notFound, now } from '../db'
import { digest, guarded, revision } from '../decisions/revision'
import type { Actor } from '../workspace/people'
import { capacityMember, capacityPeople } from './profiles'
import { workloadView, type Allocation } from './workload'
import { portfolioCapacityScope } from '../portfolios/rollup'
import { openTask, require } from '../tasks/access'
import { rootOf, taskAccess } from '../authorization/effective'
import { updateTask } from '../tasks/tasks'
import { historyStatement } from '../tasks/history'

interface Commitment {task_id:string;skills:string;locked:number}
interface Application {id:string;portfolio_id:string;task_id:string;actor_id:string;review_key:string;from_id:string;to_id:string;before_allocations:string;after_allocations:string;owner_epoch:number;allocation_epoch:number;applied_at:number;undone_at:number|null}
const allocations=(db:D1Database,id:string)=>all<Allocation>(db,'SELECT * FROM peg_effort_allocations WHERE task_id=? ORDER BY person_id',id)
const epoch=async(db:D1Database,id:string,kind:string)=>(await first<{generation:number}>(db,'SELECT generation FROM peg_rule_mutation_generations WHERE task_id=? AND kind=?',id,kind))?.generation??0
const skills=(value:string)=>value.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean)
const peopleActor=(actor:Actor,id:string):Actor=>({...actor,id,apiScope:undefined})

async function editable(db:D1Database,actor:Actor,id:string) {
 const opened=await openTask(db,actor,id)
 await capacityMember(db,actor,opened.task.workspace_id,true)
 require(opened.access,'edit')
 const homes=await all<{project_id:string}>(db,'SELECT project_id FROM peg_task_projects WHERE task_id=?',(await rootOf(db,opened.task)).id)
 if(!homes.length||homes.some(h=>!opened.access.contexts.get(h.project_id)?.capabilities.has('edit')))throw forbidden('capacity_whole_task')
 return opened
}
export async function saveCapacityCommitment(db:D1Database,actor:Actor,id:string,input:Record<string,any>) {
 const rev=await revision(db)
 await editable(db,actor,id)
 const required=String(input.skills??'').trim(),locked=input.locked===true||input.locked==='on'||input.locked==='1'
 if(required.length>300)throw invalid('capacity_skills')
 await guarded(db,rev,[bound(db,'INSERT INTO peg_capacity_commitments VALUES(?,?,?) ON CONFLICT(task_id) DO UPDATE SET skills=excluded.skills,locked=excluded.locked',[id,required,locked?1:0]),historyStatement(db,id,null,actor.id,'capacity.commitment',{locked,skills:required})])
 return {taskId:id,skills:required,locked}
}
export async function portfolioCapacity(db:D1Database,actor:Actor,id:string,input:Record<string,any>) {
 const rev=await revision(db),scope=await portfolioCapacityScope(db,actor,id)
 await capacityMember(db,actor,scope.workspace)
 const workload=await workloadView(db,actor,scope.workspace,input)
 const commitments=await all<Commitment>(db,'SELECT * FROM peg_capacity_commitments')
 const tasks=workload.tasks.filter(t=>scope.taskIds.includes(t.id)).map(t=>({...t,skills:commitments.find(c=>c.task_id===t.id)?.skills??'',locked:!!commitments.find(c=>c.task_id===t.id)?.locked}))
 const applications=(await all<Application>(db,'SELECT * FROM peg_capacity_applications WHERE portfolio_id=? ORDER BY applied_at DESC',id)).filter(op=>tasks.some(t=>t.id===op.task_id)).map(op=>({id:op.id,taskId:op.task_id,actorId:op.actor_id,appliedAt:op.applied_at,undone:!!op.undone_at}))
 return {applications,portfolioId:id,name:scope.name,workspace:scope.workspace,projectCount:scope.projectIds.length,limited:!scope.complete,from:workload.from,days:workload.days,dates:workload.dates,tasks,people:workload.people,revision:rev.value}
}
function alternativesOf(input:Record<string,any>) {
 let value=input.alternatives
 if(typeof value==='string'){try{value=JSON.parse(value)}catch{throw invalid('capacity_alternatives')}}
 value??=[1,2].map(n=>({taskId:input['taskId'+n],personId:input['personId'+n]}))
 if(!Array.isArray(value)||value.length!==2||value.some(a=>!a||typeof a.taskId!=='string'||typeof a.personId!=='string'))throw invalid('capacity_alternatives')
 if(value[0].taskId===value[1].taskId&&value[0].personId===value[1].personId)throw invalid('capacity_distinct_alternatives')
 return value.map(a=>({taskId:String(a.taskId),personId:String(a.personId)}))
}
/** Human-entered alternatives are never represented as generated or ranked agent output. */
export async function comparePortfolioCapacity(db:D1Database,actor:Actor,id:string,input:Record<string,any>) {
 const rev=await revision(db),view=await portfolioCapacity(db,actor,id,input)
 await capacityMember(db,actor,view.workspace,true)
 const proposed=alternativesOf(input),alternatives=[]
 for(const move of proposed) {
  const source=view.tasks.find(t=>t.id===move.taskId),person=view.people.find(p=>p.id===move.personId)
  if(!source||!person||source.ownerId===person.id)throw invalid('capacity_target')
  const {task}=await openTask(db,actor,source.id),reasons:string[]=[]
  try{await editable(db,actor,source.id)}catch{reasons.push('Current authority over every task project is required.')}
  const receiving=await taskAccess(db,peopleActor(actor,person.id),task)
  const homes=await all<{project_id:string}>(db,'SELECT project_id FROM peg_task_projects WHERE task_id=?',(await rootOf(db,task)).id)
  if(!receiving.capabilities.has('edit')||homes.some(h=>!receiving.contexts.get(h.project_id)?.capabilities.has('edit')))reasons.push('Alternate needs existing access to every task project.')
  if(source.locked)reasons.push('This commitment is locked for capacity plans.')
  if(skills(source.skills).some(s=>!skills(person.skills).includes(s)))reasons.push('Alternate does not have every required skill.')
  const after=await workloadView(db,actor,view.workspace,input,move),affected=[source.ownerId,person.id]
  const beforePeople=view.people.filter(p=>affected.includes(p.id)),afterPeople=after.people.filter(p=>affected.includes(p.id))
  const incomplete=view.limited||afterPeople.length!==2||afterPeople.some(p=>p.unknown||p.unscheduledHours>0||p.days.some(d=>d.unknown||d.otherHours>0))
   ||!source.start||!source.due||source.start.slice(0,10)<view.from||source.due.slice(0,10)>view.dates.at(-1)!
  if(incomplete)reasons.push('Limited context: feasibility is unverified. Refresh access, dates and availability.')
  if(afterPeople.some(p=>p.days.some(d=>d.overloadHours>0)))reasons.push('Staffing shortage: an affected person remains over capacity.')
  // Scheduling cannot borrow an unavailable day merely because the whole week has spare hours.
  const receivingDays=afterPeople.find(p=>p.id===person.id)?.days??[]
  if(receivingDays.some(d=>d.hours>d.availableHours))reasons.push('Alternate is unavailable for the committed work.')
  alternatives.push({sources:after.tasks.filter(t=>affected.includes(t.ownerId)||t.allocations.some(a=>affected.includes(a.personId))),...move,title:source.title,fromPersonId:source.ownerId,hours:source.allocations.length?source.allocations.filter(a=>a.personId===source.ownerId).reduce((n,a)=>n+a.hours,0):source.estimateHours,start:source.start,due:source.due,skills:source.skills,locked:source.locked,before:beforePeople,after:afterPeople,reasons,feasible:reasons.length===0})
 }
 const result={kind:'human-scenarios' as const,portfolioId:id,from:view.from,days:view.days,alternatives,limited:view.limited,locked:view.tasks.filter(t=>t.locked).map(t=>({id:t.id,title:t.title,ownerId:t.ownerId,start:t.start,due:t.due,estimateHours:t.estimateHours})),shortage:alternatives.every(a=>!a.feasible),revision:rev.value}
 return {...result,token:await digest([actor.id,rev,result]),review:rev}
}
export async function applyPortfolioCapacity(db:D1Database,actor:Actor,id:string,input:Record<string,any>) {
 const scope=await portfolioCapacityScope(db,actor,id)
 await capacityMember(db,actor,scope.workspace,true)
 const choice=Number(input.choice)
 if(!Number.isInteger(choice)||choice<0||choice>1||typeof input.token!=='string')throw invalid('capacity_choice')
 const key=await digest([actor.id,input.token,choice])
 const previous=await first<Application>(db,'SELECT * FROM peg_capacity_applications WHERE review_key=? AND portfolio_id=?',key,id)
 if(previous){if(!scope.taskIds.includes(previous.task_id))throw notFound();await editable(db,actor,previous.task_id);return {id:previous.id,taskId:previous.task_id,replayed:true,undone:!!previous.undone_at}}
 const plan=await comparePortfolioCapacity(db,actor,id,input)
 if(input.token!==plan.token)throw conflict('capacity_review_changed')
 const selected=plan.alternatives[choice]
 if(!selected.feasible)throw conflict('capacity_not_feasible')
 const before=await allocations(db,selected.taskId),after=before.map(a=>({...a})),old=after.find(a=>a.person_id===selected.fromPersonId)
 if(old){after.splice(after.indexOf(old),1);const replacement=after.find(a=>a.person_id===selected.personId);if(replacement)replacement.hours+=old.hours;else after.push({...old,person_id:selected.personId})}
 after.sort((a,b)=>a.person_id.localeCompare(b.person_id))
 const operation=newId('capacity'),at=now()
 const statements=[bound(db,'DELETE FROM peg_effort_allocations WHERE task_id=?',[selected.taskId]),...after.map(a=>bound(db,'INSERT INTO peg_effort_allocations VALUES(?,?,?,?)',[a.task_id,a.person_id,a.source_person,a.hours])),
  historyStatement(db,selected.taskId,null,actor.id,'capacity.portfolio_applied',{operationId:operation,from:selected.fromPersonId,to:selected.personId}),
  bound(db,`INSERT INTO peg_capacity_applications VALUES(?,?,?,?,?,?,?,?,?,COALESCE((SELECT generation FROM peg_rule_mutation_generations WHERE task_id=? AND kind='owner_id'),0),COALESCE((SELECT generation FROM peg_rule_mutation_generations WHERE task_id=? AND kind='capacity_allocations'),0),?,NULL)`,[operation,id,selected.taskId,actor.id,key,selected.fromPersonId,selected.personId,JSON.stringify(before),JSON.stringify(after),selected.taskId,selected.taskId,at])]
 await updateTask(db,actor,selected.taskId,{ownerId:selected.personId},plan.review,statements)
 return {id:operation,taskId:selected.taskId,replayed:false}
}
export async function portfolioCapacityUndoPreview(db:D1Database,actor:Actor,id:string,operationId:string) {
 const rev=await revision(db),scope=await portfolioCapacityScope(db,actor,id)
 await capacityMember(db,actor,scope.workspace,true)
 const op=await first<Application>(db,'SELECT * FROM peg_capacity_applications WHERE id=? AND portfolio_id=?',operationId,id)
 if(!op||!scope.taskIds.includes(op.task_id))throw notFound()
 const {task}=await editable(db,actor,op.task_id)
 const current=await allocations(db,task.id),people=await capacityPeople(db,actor,scope.workspace),reasons:string[]=[]
 if(op.undone_at)reasons.push('Already undone.')
 if(task.owner_id!==op.to_id||await epoch(db,task.id,'owner_id')!==op.owner_epoch||await epoch(db,task.id,'capacity_allocations')!==op.allocation_epoch||JSON.stringify(current)!==op.after_allocations)reasons.push('Later assignment or allocation edits are preserved.')
 if(!people.some(p=>p.id===op.from_id)||(JSON.parse(op.before_allocations) as Allocation[]).some(a=>!people.some(p=>p.id===a.person_id)))reasons.push('Original people are no longer available.')
 if((await first<Commitment>(db,'SELECT * FROM peg_capacity_commitments WHERE task_id=?',task.id))?.locked)reasons.push('This commitment is now locked.')
 const original=await taskAccess(db,peopleActor(actor,op.from_id),task)
 const homes=await all<{project_id:string}>(db,'SELECT project_id FROM peg_task_projects WHERE task_id=?',(await rootOf(db,task)).id)
 if(!original.capabilities.has('edit')||homes.some(h=>!original.contexts.get(h.project_id)?.capabilities.has('edit')))reasons.push('Original person no longer has task access.')
 const result={id:op.id,taskId:task.id,title:task.title,from:op.to_id,to:op.from_id,canUndo:reasons.length===0,reasons,appliedAt:op.applied_at,actorId:op.actor_id}
 return {...result,token:await digest([actor.id,rev,result]),review:rev}
}
export async function undoPortfolioCapacity(db:D1Database,actor:Actor,id:string,operationId:string,input:Record<string,any>) {
 const plan=await portfolioCapacityUndoPreview(db,actor,id,operationId)
 if(input.token!==plan.token||!plan.canUndo)throw conflict('capacity_undo_changed')
 const op=(await first<Application>(db,'SELECT * FROM peg_capacity_applications WHERE id=?',operationId))!
 const prior=JSON.parse(op.before_allocations) as Allocation[]
 await updateTask(db,actor,plan.taskId,{ownerId:op.from_id},plan.review,[bound(db,'DELETE FROM peg_effort_allocations WHERE task_id=?',[plan.taskId]),...prior.map(a=>bound(db,'INSERT INTO peg_effort_allocations VALUES(?,?,?,?)',[a.task_id,a.person_id,a.source_person,a.hours])),bound(db,'UPDATE peg_capacity_applications SET undone_at=? WHERE id=?',[now(),operationId]),historyStatement(db,plan.taskId,null,actor.id,'capacity.portfolio_undone',{operationId})])
 return {id:operationId,undone:true}
}
