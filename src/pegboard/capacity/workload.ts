import { all, batch, bound, invalid, newId, now } from '../db'
import { workspaceRole, type Actor } from '../workspace/people'
import type { TaskRow } from '../model'
import { taskAccess } from '../authorization/effective'
import { isRecoveryHidden } from '../recovery/visibility'
import { availableIntervals, dayNumber, dayString, readStamp, type TimeOff, type WorkingCalendar } from '../schedule/calendar'
import { capacityAdmin, capacityMember, capacityPeople, calendarDate, effortHours } from './profiles'

export interface Allocation {task_id:string;person_id:string;hours:number;source_person:string}
export const rounded=(n:number)=>Math.round(n*10000)/10000
export function range(input:Record<string,any>) {
 const from=calendarDate(input.from??new Date().toISOString().slice(0,10)),days=Number(input.days??7)
 if(!Number.isInteger(days)||days<1||days>31)throw invalid('capacity_days')
 return {from,days,dates:Array.from({length:days},(_,i)=>dayString(dayNumber(from)+i))}
}
export function spread(task:TaskRow,hours:number,calendar:WorkingCalendar,dates:string[]) {
 if(!task.start_date&&!task.due_date)return dates.map(()=>0)
 const start=readStamp(task.start_date??task.due_date!,calendar.zone),end=readStamp(task.due_date??task.start_date!,calendar.zone)
 if(end.day<start.day||end.day-start.day>3660)throw invalid('capacity_task_dates')
 const weights=new Map<number,number>();let total=0
 for(let day=start.day;day<=end.day;day++) {
  const lo=day===start.day?(start.wallMs??0):0,hi=day===end.day?(end.wallMs??86400000):86400000
  const weight=availableIntervals(day,{...calendar,timeOff:[]}).reduce((sum,[a,b])=>sum+Math.max(0,Math.min(b,hi)-Math.max(a,lo)),0)
  weights.set(day,weight);total+=weight
 }
 if(!total){for(let day=start.day;day<=end.day;day++)weights.set(day,1);total=end.day-start.day+1}
 return dates.map(date=>hours*(weights.get(dayNumber(date))??0)/total)
}
export async function workloadView(db:D1Database,actor:Actor,workspace:string,input:Record<string,any>={},move?:{taskId:string;personId:string}) {
 await capacityMember(db,actor,workspace)
 const window=range(input),people=await capacityPeople(db,actor,workspace)
 const feeds=await all<{id:string;service:string;fetched_at:number|null;active:number;mapping:string;issuer_id:string}>(db,'SELECT * FROM peg_capacity_feeds WHERE workspace_id=?',workspace)
 const liveFeeds: (typeof feeds[number]&{live:boolean;fresh:boolean})[]=[]
 for(const f of feeds){const role=await workspaceRole(db,f.issuer_id,workspace);liveFeeds.push({...f,live:!!f.active&&(role==='owner'||role==='admin'),fresh:!!f.fetched_at&&now()-f.fetched_at<=86400000})}
 const leave=await all<{operator_id:string;start_date:string;end_date:string;source:string;source_id:string|null}>(db,'SELECT * FROM peg_time_off WHERE workspace_id=?',workspace)
 const allocations=await all<Allocation>(db,'SELECT a.* FROM peg_effort_allocations a JOIN peg_tasks t ON t.id=a.task_id WHERE t.workspace_id=?',workspace)
 const rows=await all<TaskRow>(db,"SELECT * FROM peg_tasks WHERE workspace_id=? AND status<>'done' ORDER BY id",workspace)
 const tasks:{task:TaskRow;read:boolean;edit:boolean}[]=[]
 for(const task of rows){if(await isRecoveryHidden(db,'task',task.id))continue;const access=await taskAccess(db,actor,task);tasks.push({task,read:access.capabilities.has('read'),edit:access.capabilities.has('edit')})}
 const visible=tasks.filter(t=>t.read),shown=visible.map(({task,edit})=>({id:task.id,title:task.title,ownerId:task.owner_id,estimateHours:task.estimate_hours,start:task.start_date,due:task.due_date,canEdit:edit,allocations:allocations.filter(a=>a.task_id===task.id).map(a=>({personId:a.person_id,hours:a.hours,sourcePerson:a.source_person}))}))
 const persons=people.map(person=>{
  const ownLeave=leave.filter(l=>l.operator_id===person.id&&(l.source==='self'||liveFeeds.some(f=>f.id===l.source_id&&f.live&&f.fresh)))
  const calendar:WorkingCalendar={zone:person.zone,week:person.week,timeOff:ownLeave.map(l=>({start:l.start_date,end:l.end_date}))}
  const unknown=liveFeeds.some(f=>Object.values(JSON.parse(f.mapping)).includes(person.id)&&(!f.live||!f.fresh))
  const days=window.dates.map(date=>({date,availableHours:availableIntervals(dayNumber(date),calendar).reduce((n,[a,b])=>n+(b-a)/3600000,0),hours:0,visibleHours:0,unknown,selfDeclared:ownLeave.some(l=>l.source==='self'&&readStamp(l.start_date,person.zone).day<=dayNumber(date)&&readStamp(l.end_date,person.zone).day>=dayNumber(date))}))
  let unscheduledHours=0
  for(const {task,read} of tasks){const explicit=allocations.filter(a=>a.task_id===task.id);let effort=explicit.length?explicit.filter(a=>a.person_id===person.id).reduce((n,a)=>n+a.hours,0):(task.owner_id===person.id?task.estimate_hours:0)
   if(move&&move.taskId===task.id){const old=explicit.length?explicit.filter(a=>a.person_id===task.owner_id).reduce((n,a)=>n+a.hours,0):task.estimate_hours;if(person.id===task.owner_id)effort-=old;if(person.id===move.personId)effort+=old}
   if(!task.start_date&&!task.due_date){unscheduledHours+=effort;continue}
   const loads=spread(task,effort,calendar,window.dates);for(const [i,load] of loads.entries()){days[i].hours+=load;if(read)days[i].visibleHours+=load}
  }
  return {id:person.id,name:person.name,zone:person.zone,skills:person.skills,days:days.map(d=>({...d,hours:rounded(d.hours),visibleHours:rounded(d.visibleHours),otherHours:rounded(d.hours-d.visibleHours),availableHours:rounded(d.availableHours),overloadHours:rounded(Math.max(0,d.hours-d.availableHours))})),hours:rounded(days.reduce((n,d)=>n+d.hours,0)),availableHours:rounded(days.reduce((n,d)=>n+d.availableHours,0)),unscheduledHours:rounded(unscheduledHours),unknown}
 })
 const plans=await all<{id:string;role:string;person_id:string|null;hours:number;start_date:string;end_date:string}>(db,'SELECT * FROM peg_resource_plans WHERE workspace_id=? AND start_date<=? AND end_date>=?',workspace,window.dates.at(-1)!,window.from)
 return {...window,workspace,people:persons,tasks:shown,totals:{taskCount:visible.length,taskEstimateHours:rounded(visible.reduce((n,{task})=>n+task.estimate_hours,0)),participantHours:rounded(visible.reduce((n,{task})=>n+(allocations.some(a=>a.task_id===task.id)?allocations.filter(a=>a.task_id===task.id).reduce((s,a)=>s+a.hours,0):task.estimate_hours),0))},tentative:plans.map(p=>({id:p.id,role:p.role,personId:p.person_id,hours:p.hours,start:p.start_date,end:p.end_date})),feeds:liveFeeds.map(f=>({id:f.id,service:f.service,freshness:f.live&&f.fresh?'current':'unknown',fetchedAt:f.fetched_at})),notice:'Visible task totals exclude hidden work. Other commitments contribute hours only. Tentative resource plans are separate from committed work.'}
}
export async function addResourcePlan(db:D1Database,actor:Actor,workspace:string,input:Record<string,any>) {
 await capacityAdmin(db,actor,workspace)
 const start=calendarDate(input.start),end=calendarDate(input.end),role=String(input.role??'').trim(),person=input.personId||null
 if(!role||role.length>100||start>end)throw invalid('resource_plan')
 if(person&&!(await capacityPeople(db,actor,workspace)).some(p=>p.id===person))throw invalid('capacity_person')
 const id=newId('resource');await batch(db,[bound(db,'INSERT INTO peg_resource_plans VALUES(?,?,?,?,?,?,?,?)',[id,workspace,role,person,effortHours(input.hours),start,end,actor.id])]);return {id}
}
