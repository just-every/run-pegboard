import {taskCalendars} from '../schedule/availability'
import {all,first,PegError} from '../db'
import {rootOf,taskAccess} from '../authorization/effective'
import {openProject,need} from '../workspace/projects'
import {planChange} from '../schedule/plan'
import {propose} from '../schedule/graph'
import {toEdge} from '../schedule/dependencies'
import type {TaskRow} from '../model'
import type {Actor} from '../workspace/people'
import type {BulkInput} from '../recovery/bulk'

type DateChange={taskId:string;field:'start_date'|'due_date';before:string|null;after:string|null}
const validated=new WeakSet<object>()
export interface RuleScheduleEffects {readonly changes:readonly DateChange[];readonly taskId:string;readonly workspace:string;readonly actorId:string}
export const isRuleScheduleEffects=(value:RuleScheduleEffects)=>validated.has(value)
export async function reviewedScheduleScope(db:D1Database,actor:Actor,workspace:string,projectIds:string[]){
 const projects=[]
 for(const id of [...new Set(projectIds)].sort()){
  const opened=await openProject(db,actor,id);need(opened.effective,'manage_rules')
  if(opened.project.workspace_id!==workspace)throw new PegError(400,'workspace')
  projects.push({id,name:opened.project.name})
 }
 return projects
}
export async function prepareRuleScheduleEffects(db:D1Database,actor:Actor,workspace:string,projectId:string,taskId:string,patch:BulkInput['patch'],dependencyProjectIds:string[]=[]):Promise<RuleScheduleEffects|undefined>{
 if(patch.startDate===undefined&&patch.dueDate===undefined)return
 const plan=await planChange(db,actor,[{taskId,...(patch.startDate!==undefined?{start:patch.startDate}:{}),...(patch.dueDate!==undefined?{due:patch.dueDate}:{})}])
 if(plan.blocked)throw new PegError(409,'rule_schedule_impossible')
 if(plan.waits||!plan.editable)throw new PegError(409,'rule_schedule_pending')
 const trigger=await first<TaskRow>(db,'SELECT * FROM peg_tasks WHERE id=?',taskId)
 if(!trigger)throw new PegError(409,'rule_schedule_pending')
 const targets=new Map(plan.all.map(row=>[row.id,row.to]))
 // An undated trigger may not occur among the graph's shifts. Its exact reviewed dates still belong to this set.
 if(!targets.has(taskId))targets.set(taskId,{start:patch.startDate===undefined?trigger.start_date:patch.startDate,due:patch.dueDate===undefined?trigger.due_date:patch.dueDate})
 const scope=new Set([projectId,...dependencyProjectIds]),changes:DateChange[]=[]
 for(const [id,to] of targets){
  const task=await first<TaskRow>(db,'SELECT * FROM peg_tasks WHERE id=?',id)
  if(!task||task.workspace_id!==workspace)throw new PegError(409,'rule_schedule_pending')
  const access=await taskAccess(db,actor,task),homes=await all<{project_id:string}>(db,'SELECT project_id FROM peg_task_projects WHERE task_id=?',(await rootOf(db,task)).id)
  if(!access.capabilities.has('read')||!access.capabilities.has('edit')||!homes.length||homes.some(h=>!scope.has(h.project_id)||!access.contexts.get(h.project_id)?.capabilities.has('edit')))throw new PegError(409,'rule_schedule_pending')
  try{await reviewedScheduleScope(db,actor,workspace,homes.map(h=>h.project_id))}catch(error){if(error instanceof PegError&&[403,404].includes(error.status))throw new PegError(409,'rule_schedule_pending');throw error}
  for(const [field,value] of [['start_date',to.start],['due_date',to.due]] as const)if(task[field]!==value)changes.push({taskId:id,field,before:task[field],after:value})
 }
 if(!await coherentSchedule(db,workspace,changes))throw new PegError(409,'rule_schedule_impossible')
 const result=Object.freeze({changes:Object.freeze(changes.map(change=>Object.freeze(change))),taskId,workspace,actorId:actor.id});validated.add(result);return result
}

// Check a tentative final state with the same dependency algorithm, including constraints on explicitly edited tasks.
export async function coherentSchedule(db:D1Database,workspace:string,changes:readonly DateChange[]){
 if(!changes.length)return true
 const edges=(await all<Parameters<typeof toEdge>[0]>(db,'SELECT * FROM peg_dependencies WHERE workspace_id=?',workspace)).map(toEdge)
 const connected=new Set(changes.map(c=>c.taskId));let expanded=true
 while(expanded){expanded=false;for(const edge of edges)if(connected.has(edge.predecessor)||connected.has(edge.successor))for(const id of [edge.predecessor,edge.successor])if(!connected.has(id)){connected.add(id);expanded=true}}
 const nodes=[]
 const calendars=(await taskCalendars(db,await all<TaskRow>(db,'SELECT * FROM peg_tasks WHERE workspace_id=?',workspace))).calendars
 for(const id of connected){
  const task=await first<TaskRow>(db,'SELECT * FROM peg_tasks WHERE id=? AND workspace_id=?',id,workspace)
  if(!task)return false
  const dates={start:task.start_date,due:task.due_date}
  for(const change of changes.filter(c=>c.taskId===id))dates[change.field==='start_date'?'start':'due']=change.after
  nodes.push({id,start:dates.start,due:dates.due,done:task.status==='done',calendar:calendars.get(id)})
 }
 const result=propose(nodes,edges.filter(e=>connected.has(e.predecessor)&&connected.has(e.successor)),{})
 return !result.cyclic.length&&!result.shifts.length
}
