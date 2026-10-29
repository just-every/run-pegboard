import { all, bound, conflict, invalid } from '../db'
import type { Actor } from '../workspace/people'
import { digest, revision } from '../decisions/revision'
import { openTask, require } from '../tasks/access'
import { updateTask } from '../tasks/tasks'
import { historyStatement } from '../tasks/history'
import { capacityMember, capacityPeople } from './profiles'
import { workloadView, type Allocation } from './workload'

export async function staffingScenario(db:D1Database,actor:Actor,workspace:string,input:Record<string,any>) {
 await capacityMember(db,actor,workspace,true)
 const rev=await revision(db),taskId=String(input.taskId??''),personId=String(input.personId??''),{task,access}=await openTask(db,actor,taskId)
 require(access,'edit')
 if(task.workspace_id!==workspace||access.personal||task.status==='done'||personId===task.owner_id||!(await capacityPeople(db,actor,workspace)).some(p=>p.id===personId))throw invalid('staffing_target')
 const before=await workloadView(db,actor,workspace,input),after=await workloadView(db,actor,workspace,input,{taskId,personId})
 const plan={taskId,personId,from:before.from,days:before.days,title:task.title,before,after,revision:rev.value}
 return {...plan,token:await digest([actor.id,plan]),review:rev}
}
export async function applyStaffing(db:D1Database,actor:Actor,workspace:string,input:Record<string,any>) {
 const plan=await staffingScenario(db,actor,workspace,input)
 if(input.token!==plan.token)throw conflict('review_changed')
 const {task}=await openTask(db,actor,plan.taskId),allocations=await all<Allocation>(db,'SELECT * FROM peg_effort_allocations WHERE task_id=?',task.id),old=allocations.find(a=>a.person_id===task.owner_id),extra=[]
 if(old){extra.push(bound(db,'DELETE FROM peg_effort_allocations WHERE task_id=? AND person_id=?',[task.id,task.owner_id]),bound(db,`INSERT INTO peg_effort_allocations VALUES(?,?,?,?) ON CONFLICT(task_id,person_id) DO UPDATE SET hours=hours+excluded.hours`,[task.id,plan.personId,old.source_person,old.hours]))}
 extra.push(historyStatement(db,task.id,null,actor.id,'capacity.reassigned',{from:task.owner_id,to:plan.personId}))
 await updateTask(db,actor,task.id,{ownerId:plan.personId},plan.review,extra)
 return {taskId:task.id,ownerId:plan.personId}
}
/** A read-only agent planning door: unavailable capacity never becomes a proposed allocation. */
export async function capacityPlan(db:D1Database,actor:Actor,workspace:string,input:Record<string,any>) {
 const view=await workloadView(db,actor,workspace,input),hours=Number(input.hours??1)
 if(!Number.isFinite(hours)||hours<=0||hours>100000)throw invalid('plan_hours')
 const candidates=view.people.flatMap(p=>p.days.filter(d=>!d.unknown&&d.availableHours-d.hours>=hours).map(d=>({personId:p.id,name:p.name,date:d.date,freeHours:d.availableHours-d.hours})))
 return {from:view.from,days:view.days,candidates,notice:'Read-only suggestions. Assignment changes require an authorized human review.'}
}
