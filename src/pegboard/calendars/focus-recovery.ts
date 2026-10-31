// Reviewed human scenarios only. A durable write intent is never automatically resent.
import type { Bindings } from '../../auth.server'
import { all, bound, conflict, first, forbidden, invalid, newId, now, run } from '../db'
import { digest, guarded, revision } from '../decisions/revision'
import { permanentEvent } from '../audit/search'
import { openTask, require } from '../tasks/access'
import { openProject } from '../workspace/projects'
import type { Actor } from '../workspace/people'
import type { TaskRow } from '../model'
import { historyStatement } from '../tasks/history'
import { moveInput, planChange } from '../schedule/plan'
import { taskCalendars } from '../schedule/availability'
import { availableIntervals, dayNumber, dayString, instantOf } from '../schedule/calendar'
import { workloadView, rounded, spread } from '../capacity/workload'
import type { Event, Slot } from '../connectors/calendars/edge'
import { calendarAdmin, connectionFor, taskFingerprint, type Connection } from './connections'
import { edgeFor, type Block } from './blocks'
import { blockFence, overlaps, type FocusLock } from './focus-guards'

interface Change extends Slot { blockId:string;taskStart:string|null;taskDue:string|null }
interface ScenarioInput { label:string;changes:Change[] }
interface Item extends Change { actualHours:number;remainingHours:number; taskId:string;title:string;beforeTask:TaskRow;block:Block;event:Event;zone:string }
interface Scenario { label:string;items:Item[];days:{date:string;zone:string;freeHours:number;otherHours:number;availableHours:number;requiredHours:number;shortageHours:number}[];requiredHours:number;reservedHours:number;shortageHours:number;feasible:boolean;reasons:string[];busyStamp:string;planStamp:string }
interface Body { scenarios:Scenario[];inputs:ScenarioInput[];context:number;locks:FocusLock[];blockId?:string;locked?:boolean;lockSnapshot?:string }
interface Review { lease_until:number;id:string;owner_id:string;connection_id:string;kind:string;state:string;body:string;stamp:string;expires_at:number;selected:number|null;source_id:string|null;cause:string|null;created_at:number;applied_at:number|null }
interface Operation { review_id:string;block_id:string;task_id:string;state:string;event_etag:string|null;task_after:string|null }
const confirmed=(input:Record<string,any>)=>input.confirm===true||input.confirm==='on'
const instant=(value:unknown)=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?Z$/.test(value)||!Number.isFinite(Date.parse(value)))throw invalid('focus_instant_utc');return new Date(value).toISOString()}
const localDay=(at:string,zone:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at))
const locksFor=(db:D1Database,actor:Actor)=>all<FocusLock>(db,'SELECT * FROM peg_focus_locks WHERE owner_id=? ORDER BY block_id',actor.id)
async function owned(db:D1Database,actor:Actor,id:string,connection:Connection) {
 const {task,access}=await openTask(db,actor,id);require(access,'edit')
 if(task.status==='done')throw conflict('focus_completed_task')
 if(task.owner_id!==actor.id||access.personal||task.workspace_id!==connection.workspace_id||task.kind==='milestone')throw forbidden('focus_owned_project_task')
 return task
}
async function load(db:D1Database,actor:Actor,id:string) {
 const r=await first<Review>(db,'SELECT * FROM peg_focus_reviews WHERE id=? AND owner_id=?',id,actor.id)
 if(!r)throw invalid('focus_review')
 const c=await connectionFor(db,actor,r.connection_id)
 for(const s of await all<{task_id:string}>(db,'SELECT task_id FROM peg_focus_subjects WHERE review_id=?',id))await owned(db,actor,s.task_id,c)
 return {r,c,body:JSON.parse(r.body) as Body}
}
async function save(db:D1Database,actor:Actor,c:Connection,kind:string,body:Body,source:string|null=null) {
 const id=newId('focus'),stamp=await digest(body)
 const rev=await revision(db)
 if(rev.value!==body.context)throw conflict('focus_review_changed')
 await guarded(db,rev,[
  bound(db,'INSERT INTO peg_focus_reviews(id,owner_id,connection_id,kind,state,body,stamp,expires_at,source_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',[id,actor.id,c.id,kind,'reviewed',JSON.stringify(body),stamp,now()+900000,source,now()]),
  ...[...new Set(body.scenarios.flatMap(s=>s.items.map(i=>i.taskId)))].map(task=>bound(db,'INSERT INTO peg_focus_subjects VALUES(?,?)',[id,task])),
 ])
 return reviewView(db,actor,id)
}
export async function previewFocusLock(env:Bindings,db:D1Database,actor:Actor,id:string,input:Record<string,any>) {
 const block=await first<Block>(db,'SELECT * FROM peg_calendar_blocks WHERE id=?',id)
 if(!block)throw invalid('calendar_block')
 const c=await connectionFor(db,actor,block.connection_id),task=await owned(db,actor,block.task_id,c)
 if(block.state!=='scheduled')throw conflict('focus_block_not_reconciled')
 if(await first(db,"SELECT 1 FROM peg_focus_operations o JOIN peg_focus_reviews r ON r.id=o.review_id WHERE o.block_id=? AND r.state IN ('applying','uncertain')",id))throw conflict('focus_reconciliation_required')
 const context=(await revision(db)).value,edge=await edgeFor(env,db,actor,c,input.credential),event=block.event_id?await edge.read(block.event_id):null
 if(!event||event.cancelled||event.recurring||event.etag!==block.etag||event.start!==block.start_at||event.end!==block.end_at)throw conflict('focus_provider_changed')
 const locked=input.locked===true||input.locked==='true',lock=await first<FocusLock>(db,'SELECT * FROM peg_focus_locks WHERE block_id=?',id)
 const body:Body={inputs:[],scenarios:[],context,locks:await locksFor(db,actor),blockId:id,locked,lockSnapshot:await digest([block,task,c,event,lock])}
 const result=await save(db,actor,c,'lock',body)
 await run(db,'INSERT INTO peg_focus_subjects VALUES(?,?)',result.id,task.id)
 return {...result,block:{id,title:task.title,start:block.start_at,end:block.end_at},locked}
}
export async function commitFocusLock(env:Bindings,db:D1Database,actor:Actor,id:string,input:Record<string,any>) {
 const {r,c,body}=await load(db,actor,id)
 if(r.kind!=='lock'||!confirmed(input)||input.stamp!==r.stamp)throw conflict('focus_exact_review_required')
 if(r.state==='reconciled')return reviewView(db,actor,id)
 if(r.state!=='reviewed'||r.expires_at<=now())throw conflict('focus_review_expired')
 const rev=await revision(db),block=(await first<Block>(db,'SELECT * FROM peg_calendar_blocks WHERE id=?',body.blockId!))!,task=await owned(db,actor,block.task_id,c)
 const edge=await edgeFor(env,db,actor,c,input.credential),event=block.event_id?await edge.read(block.event_id):null,lock=await first<FocusLock>(db,'SELECT * FROM peg_focus_locks WHERE block_id=?',block.id)
 if(rev.value!==body.context||await digest([block,task,c,event,lock])!==body.lockSnapshot)throw conflict('focus_review_changed')
 await guarded(db,rev,[
  bound(db,'INSERT INTO peg_focus_locks(block_id,owner_id,locked,start_at,end_at,reviewed_at) VALUES(?,?,?,?,?,?) ON CONFLICT(block_id) DO UPDATE SET locked=excluded.locked,start_at=excluded.start_at,end_at=excluded.end_at,reviewed_at=excluded.reviewed_at,revision=revision+1',[block.id,actor.id,body.locked?1:0,block.start_at,block.end_at,now()]),
  bound(db,"UPDATE peg_focus_reviews SET state='reconciled',applied_at=? WHERE id=?",[now(),id]),
  permanentEvent(db,{workspace:c.workspace_id,actor:actor.id,action:body.locked?'focus.locked':'focus.unlocked',type:'task',id:task.id,metadata:{id,taskId:task.id}}),
 ])
 return reviewView(db,actor,id)
}
function parseScenarios(input:Record<string,any>):ScenarioInput[] {
 let raw=input.scenarios
 if(typeof raw==='string'){try{raw=JSON.parse(raw)}catch{throw invalid('focus_scenarios')}}
 // The native form enters one affected block per alternative; the API also accepts several.
 if(!raw)raw=[0,1].map(i=>({label:String(input['label'+i]??''),changes:[{blockId:input.blockId,start:input['start'+i],end:input['end'+i],taskStart:input['taskStart'+i]||null,taskDue:input['taskDue'+i]||null}]}))
 if(!Array.isArray(raw)||raw.length!==2)throw invalid('focus_two_human_scenarios')
 return raw.map(s=>{
  if(typeof s.label!=='string'||!s.label.trim()||s.label.length>100||!Array.isArray(s.changes)||s.changes.length<1||s.changes.length>10)throw invalid('focus_scenarios')
  const seen=new Set<string>()
  const changes=s.changes.map((i:any)=>{
   if(typeof i.blockId!=='string'||seen.has(i.blockId))throw invalid('focus_block')
   seen.add(i.blockId);const start=instant(i.start),end=instant(i.end)
   if(Date.parse(end)<=Date.parse(start)||Date.parse(end)-Date.parse(start)>8*3600000)throw invalid('focus_interval')
   const move=moveInput([{taskId:i.blockId,start:i.taskStart,due:i.taskDue}])[0]
   return {blockId:i.blockId,start,end,taskStart:move.start??null,taskDue:move.due??null}
  })
  return {label:s.label.trim(),changes}
 })
}
async function analyse(env:Bindings,db:D1Database,actor:Actor,c:Connection,inputs:ScenarioInput[],credential:unknown):Promise<Body> {
 const context=(await revision(db)).value,edge=await edgeFor(env,db,actor,c,credential),locks=await locksFor(db,actor),scenarios:Scenario[]=[]
 for(const input of inputs) {
  const items:Item[]=[],reasons:string[]=[]
  if(await first(db,'SELECT 1 FROM peg_calendar_connections WHERE owner_id=? AND active=1 AND id<>?',actor.id,c.id))reasons.push('other_calendar_context_unavailable')
  for(const change of input.changes) {
   const block=await first<Block>(db,'SELECT * FROM peg_calendar_blocks WHERE id=? AND connection_id=?',change.blockId,c.id)
   if(!block||block.state==='cancelled'||!block.event_id)throw invalid('focus_mapped_block')
   const task=await owned(db,actor,block.task_id,c)
   await blockFence(db,block.id,c.id,change)
   const event=await edge.read(block.event_id)
   if(!event||event.cancelled||event.recurring)throw conflict('focus_provider_changed')
   items.push({...change,actualHours:0,remainingHours:0,taskId:task.id,title:task.title,beforeTask:task,block,event,zone:block.zone})
  }
  if(new Set(items.map(i=>i.taskId)).size!==items.length)throw invalid('focus_duplicate_task')
  const plan=await planChange(db,actor,items.map(i=>({taskId:i.taskId,start:i.taskStart,due:i.taskDue})))
  if(!plan.editable||plan.waits||plan.blocked||plan.all.some(t=>!items.some(i=>i.taskId===t.id)))reasons.push('colleague_or_dependency_dates_preserved')
  for(const i of items){const shift=plan.all.find(t=>t.id===i.taskId);if(shift&&(shift.to.start!==i.taskStart||shift.to.due!==i.taskDue))reasons.push('task_dates_require_new_review')}
  const calendars=await taskCalendars(db,items.map(i=>i.beforeTask)),dates=[...new Set(items.map(i=>localDay(i.start,i.zone)))].sort()
  if(dates.some(d=>dayNumber(d)-dayNumber(dates[0])>30))throw invalid('focus_window')
  const workload=await workloadView(db,actor,c.workspace_id,{from:dates[0],days:dayNumber(dates.at(-1)!)-dayNumber(dates[0])+1}),person=workload.people.find(p=>p.id===actor.id)
  const days:Scenario['days']=[],busyProof:unknown[]=[]
  const remaining=new Map<string,number>()
  for(const i of items) {
   const actual=await first<{seconds:number;running:number}>(db,'SELECT COALESCE(SUM(COALESCE(seconds,(end_ms-start_ms)/1000)),0) seconds,COALESCE(SUM(CASE WHEN seconds IS NULL AND end_ms IS NULL THEN 1 ELSE 0 END),0) running FROM peg_time_entries WHERE task_id=? AND person_id=?',i.taskId,actor.id)
   i.actualHours=rounded((actual?.seconds??0)/3600)
   i.remainingHours=rounded(Math.max(0,i.beforeTask.estimate_hours-i.actualHours))
   remaining.set(i.taskId,i.remainingHours)
   if(actual?.running)reasons.push('running_actual_time_unknown')
  }
  for(const date of dates) {
   const onDay=items.filter(i=>localDay(i.start,i.zone)===date),calendar=calendars.calendars.get(onDay[0].taskId)!,zone=calendar.zone
   if(onDay.some(i=>i.zone!==zone||localDay(i.end,i.zone)!==date))throw invalid('focus_single_local_day')
   const start=new Date(instantOf(date,0,zone)).toISOString(),end=new Date(instantOf(dayString(dayNumber(date)+1),0,zone)).toISOString()
   const busy=(await edge.busy(start,end,items.map(i=>i.event.id),zone)).sort((a,b)=>a.start.localeCompare(b.start)||a.end.localeCompare(b.end))
   busyProof.push([date,zone,busy])
   const unavailable=[...busy,...locks.filter(l=>l.locked&&!items.some(i=>i.blockId===l.block_id)).map(l=>({start:l.start_at,end:l.end_at}))]
   let freeHours=0
   for(const [lo,hi] of availableIntervals(dayNumber(date),calendar)) {
    let cursor=instantOf(date,lo,zone),through=instantOf(date,hi,zone)
    for(const b of [...unavailable].sort((a,b)=>a.start.localeCompare(b.start))) {
     const a=Math.max(cursor,Date.parse(b.start)),z=Math.min(through,Date.parse(b.end))
     if(z>a){freeHours+=(a-cursor)/3600000;cursor=z}
    }
    freeHours+=Math.max(0,through-cursor)/3600000
   }
   const day=person?.days.find(d=>d.date===date)
   if(!day||day.unknown||person?.unscheduledHours)reasons.push('capacity_context_incomplete')
   if(day&&(day.otherHours>0||person?.unknown))reasons.push('capacity_context_incomplete')
   const otherHours=day?.hours??0
   // Workload and external busy time are reserved conservatively; no hidden task identity is exposed.
   const selectedHours=await selectedLoad(db,items,date,calendar)
   const other=rounded(Math.max(0,otherHours-selectedHours))
   const availableHours=rounded(Math.max(0,freeHours-other)),requiredHours=rounded(onDay.reduce((n,i)=>n+remaining.get(i.taskId)!,0))
   const reserved=onDay.reduce((n,i)=>n+(Date.parse(i.end)-Date.parse(i.start))/3600000,0)
   const shortageHours=rounded(Math.max(0,requiredHours-availableHours,requiredHours-reserved))
   for(const i of onDay){
    const allowed=availableIntervals(dayNumber(date),calendars.calendars.get(i.taskId)!).some(([a,b])=>Date.parse(i.start)>=instantOf(date,a,zone)&&Date.parse(i.end)<=instantOf(date,b,zone))
    if(!allowed||unavailable.some(b=>overlaps(i,b)))reasons.push('meeting_or_availability_collision')
    if(i.taskStart&&Date.parse(i.start)<(i.taskStart.length===10?instantOf(i.taskStart,0,zone):Date.parse(i.taskStart))||i.taskDue&&Date.parse(i.end)>(i.taskDue.length===10?instantOf(dayString(dayNumber(i.taskDue)+1),0,zone):Date.parse(i.taskDue)))reasons.push('block_outside_task_dates')
    if(onDay.some(other=>other.blockId!==i.blockId&&overlaps(i,other)))reasons.push('scenario_overlap')
   }
   days.push({date,zone,freeHours:rounded(freeHours),otherHours:other,availableHours,requiredHours,shortageHours})
  }
  const requiredHours=rounded([...remaining.values()].reduce((n,h)=>n+h,0)),reservedHours=rounded(items.reduce((n,i)=>n+(Date.parse(i.end)-Date.parse(i.start))/3600000,0)),shortageHours=rounded(days.reduce((n,d)=>n+d.shortageHours,0))
  if(shortageHours>0)reasons.push('capacity_shortage')
  scenarios.push({label:input.label,items,days,requiredHours,reservedHours,shortageHours,feasible:reasons.length===0,reasons:[...new Set(reasons)],busyStamp:await digest(busyProof),planStamp:plan.stamp})
 }
 if((await revision(db)).value!==context)throw conflict('focus_review_changed')
 return {scenarios,inputs,context,locks}
}
async function selectedLoad(db:D1Database,items:Item[],date:string,calendar:Parameters<typeof availableIntervals>[1]) {
 const allocations=await all<{task_id:string;hours:number}>(db,'SELECT task_id,hours FROM peg_effort_allocations WHERE person_id=?',items[0].beforeTask.owner_id)
 return items.reduce((n,i)=>n+spread(i.beforeTask,allocations.some(a=>a.task_id===i.taskId)?allocations.filter(a=>a.task_id===i.taskId).reduce((n,a)=>n+a.hours,0):i.beforeTask.estimate_hours,calendar,[date])[0],0)
}
export async function previewRecovery(env:Bindings,db:D1Database,actor:Actor,input:Record<string,any>) {
 const c=await connectionFor(db,actor,String(input.connectionId)),inputs=parseScenarios(input)
 if(inputs[0].changes.map(i=>i.blockId).sort().join()!==inputs[1].changes.map(i=>i.blockId).sort().join())throw invalid('focus_same_affected_blocks')
 return save(db,actor,c,'recovery',await analyse(env,db,actor,c,inputs,input.credential))
}
export async function reviewView(db:D1Database,actor:Actor,id:string) {
 const {r,body}=await load(db,actor,id)
 // Provider credentials are never part of the persisted body or response.
 return {id:r.id,kind:r.kind,state:r.state,stamp:r.stamp,selected:r.selected,cause:r.cause,readbackAfter:r.lease_until,expiresAt:r.expires_at,blockId:body.blockId,locked:body.locked,
  locks:body.locks.filter(l=>l.locked).map(l=>({blockId:l.block_id,start:l.start_at,end:l.end_at})),
  scenarios:body.scenarios.map(s=>({...s,items:s.items.map(i=>({blockId:i.blockId,taskId:i.taskId,title:i.title,estimateHours:i.beforeTask.estimate_hours,actualHours:i.actualHours,remainingHours:i.remainingHours,start:i.start,end:i.end,taskStart:i.taskStart,taskDue:i.taskDue,fromStart:i.beforeTask.start_date,fromDue:i.beforeTask.due_date,eventId:i.event.id,eventStart:i.event.start,eventEnd:i.event.end}))})),
  operations:await all<Operation>(db,'SELECT * FROM peg_focus_operations WHERE review_id=? ORDER BY block_id',id)}
}
export async function recoveryProject(db:D1Database,actor:Actor,project:string) {
 const p=await openProject(db,actor,project)
 await calendarAdmin(db,actor,p.project.workspace_id)
 const rows=await all<Review>(db,'SELECT DISTINCT r.* FROM peg_focus_reviews r JOIN peg_focus_subjects s ON s.review_id=r.id JOIN peg_task_projects t ON t.task_id=s.task_id WHERE t.project_id=? AND r.owner_id=? ORDER BY r.created_at DESC LIMIT 30',project,actor.id),reviews=[]
 for(const r of rows){try{reviews.push(await reviewView(db,actor,r.id))}catch{}}
 return {project:p.project,locks:await locksFor(db,actor),reviews}
}
async function outcome(db:D1Database,id:string,state:string,cause:string|null) {
 await run(db,"UPDATE peg_focus_reviews SET state=?,cause=?,lease_until=0 WHERE id=? AND state NOT IN ('reconciled','inactive')",state,cause,id)
}
export async function applyRecovery(env:Bindings,db:D1Database,actor:Actor,id:string,input:Record<string,any>) {
 const {r,c,body}=await load(db,actor,id)
 if(!['recovery','undo'].includes(r.kind)||!confirmed(input)||input.stamp!==r.stamp)throw conflict('focus_exact_review_required')
 if(r.state==='applying')return reviewView(db,actor,id)
 if(['uncertain','reconciled'].includes(r.state))return reconcileRecovery(env,db,actor,id,input)
 if(r.state!=='reviewed'||r.expires_at<=now())throw conflict('focus_review_expired')
 const choice=Number(input.scenario),scenario=body.scenarios[choice]
 if(!Number.isInteger(choice)||!scenario)throw invalid('focus_scenario')
 const rev=await revision(db)
 try{
  if(rev.value!==body.context)throw conflict('focus_review_changed')
  const fresh=await analyse(env,db,actor,c,body.inputs,input.credential)
  if(await digest(fresh)!==r.stamp)throw conflict('focus_review_changed')
 }catch(error){await outcome(db,id,'conflict','fresh_review_required');throw error}
 if(!scenario.feasible)throw conflict('focus_scenario_infeasible')
 await guarded(db,rev,[
  // Operations claim their blocks before a provider call; concurrent approvals cannot both dispatch.
  ...scenario.items.map(i=>bound(db,"INSERT INTO peg_focus_operations(review_id,block_id,task_id,state) VALUES(?,?,?,'planned')",[id,i.blockId,i.taskId])),
  bound(db,"UPDATE peg_focus_reviews SET state='applying',selected=?,lease_until=? WHERE id=? AND state='reviewed'",[choice,now()+90000,id]),
  permanentEvent(db,{workspace:c.workspace_id,actor:actor.id,action:'focus.review_approved',type:'calendar',id,metadata:{id,count:scenario.items.length}}),
 ])
 for(const i of scenario.items) {
  try {
   await owned(db,actor,i.taskId,await connectionFor(db,actor,c.id))
   await blockFence(db,i.blockId,c.id,i,id)
   if((await revision(db)).value!==body.context)throw conflict('focus_review_changed')
   await run(db,"UPDATE peg_focus_reviews SET lease_until=? WHERE id=? AND state='applying'",now()+90000,id)
   const edge=await edgeFor(env,db,actor,c,input.credential),event=await edge.read(i.event.id)
   if(!event||event.etag!==i.event.etag)throw conflict('focus_provider_changed')
   const freshTask=await owned(db,actor,i.taskId,await connectionFor(db,actor,c.id))
   if((await revision(db)).value!==body.context||await taskFingerprint(freshTask)!==await taskFingerprint(i.beforeTask))throw conflict('focus_review_changed')
   await blockFence(db,i.blockId,c.id,i,id)
   await run(db,"UPDATE peg_focus_operations SET state='sending' WHERE review_id=? AND block_id=?",id,i.blockId)
   // Never send this intent again, including after a crash immediately before this call.
   await edge.move(event.id,event.etag,i,i.zone)
   await run(db,"UPDATE peg_focus_operations SET state='sent' WHERE review_id=? AND block_id=? AND state='sending'",id,i.blockId)
  } catch {
   await outcome(db,id,'uncertain','calendar_and_task_state_not_reconciled')
   return reviewView(db,actor,id)
  }
 }
 return reconcileRecovery(env,db,actor,id,input,true)
}
export async function reconcileRecovery(env:Bindings,db:D1Database,actor:Actor,id:string,input:Record<string,any>,writer=false) {
 const {r,c,body}=await load(db,actor,id)
 if(!writer&&r.state==='applying'&&r.lease_until>now())return reviewView(db,actor,id)
 if(r.state==='reconciled'||r.state==='inactive')return reviewView(db,actor,id)
 if(!['applying','uncertain'].includes(r.state)||r.selected===null)throw conflict('focus_not_reconciling')
 const scenario=body.scenarios[r.selected],rev=await revision(db),events=new Map<string,Event>()
 try {
  const edge=await edgeFor(env,db,actor,c,input.credential)
  for(const i of scenario.items) {
   await owned(db,actor,i.taskId,await connectionFor(db,actor,c.id))
   await blockFence(db,i.blockId,c.id,i,id)
   const event=await edge.read(i.event.id)
   if(!event||event.cancelled||event.recurring||event.start!==i.start||event.end!==i.end) {
    await outcome(db,id,'conflict','partial_fresh_review_required')
    return reviewView(db,actor,id)
   }
   events.set(i.blockId,event)
  }
  // Recompute capacity and dependency context while excluding this review's own reservations.
  // Provider versions now differ by design; compare only the independently observed busy windows.
  // Own claimed operations are admitted only for readback; the general preview door keeps them fenced.
  const context=await readbackContext(env,db,actor,c,scenario,input.credential)
  if(rev.value!==body.context||context!==scenario.busyStamp)throw conflict('focus_review_changed')
  for(const i of scenario.items) {
   const task=await owned(db,actor,i.taskId,c)
   if(await taskFingerprint(task)!==await taskFingerprint(i.beforeTask))throw conflict('focus_task_changed')
   const block=await first<Block>(db,'SELECT * FROM peg_calendar_blocks WHERE id=?',i.blockId)
   if(!block||await digest(block)!==await digest(i.block))throw conflict('focus_mapping_changed')
  }
 } catch(error) {
  await outcome(db,id,(error as {status?:number})?.status===503?'uncertain':'conflict','fresh_review_required')
  return reviewView(db,actor,id)
 }
 const at=now(),statements:D1PreparedStatement[]=[]
 for(const i of scenario.items) {
  const event=events.get(i.blockId)!,after={...i.beforeTask,start_date:i.taskStart,due_date:i.taskDue,updated_at:at},fingerprint=await taskFingerprint(after)
  statements.push(
   bound(db,'UPDATE peg_tasks SET start_date=?,due_date=?,updated_at=? WHERE id=?',[i.taskStart,i.taskDue,at,i.taskId]),
   historyStatement(db,i.taskId,null,actor.id,r.kind==='undo'?'focus.undone':'focus.recovered',{reviewId:id,from:{start:i.beforeTask.start_date,due:i.beforeTask.due_date},to:{start:i.taskStart,due:i.taskDue}}),
   bound(db,"UPDATE peg_calendar_blocks SET start_at=?,end_at=?,etag=?,task_revision=?,state='scheduled',cause=NULL,revision=revision+1 WHERE id=?",[i.start,i.end,event.etag,fingerprint,i.blockId]),
   bound(db,"UPDATE peg_focus_operations SET state='verified',event_etag=?,task_after=? WHERE review_id=? AND block_id=?",[event.etag,fingerprint,id,i.blockId]),
  )
 }
 statements.push(bound(db,"UPDATE peg_focus_reviews SET state='reconciled',cause=NULL,lease_until=0,applied_at=? WHERE id=?",[at,id]),
  permanentEvent(db,{workspace:c.workspace_id,actor:actor.id,action:r.kind==='undo'?'focus.undo_reconciled':'focus.reconciled',type:'calendar',id,metadata:{id,count:scenario.items.length}}))
 try{await guarded(db,rev,statements)}catch{await outcome(db,id,'conflict','fresh_review_required')}
 return reviewView(db,actor,id)
}
async function readbackContext(env:Bindings,db:D1Database,actor:Actor,c:Connection,scenario:Scenario,credential:unknown) {
 const edge=await edgeFor(env,db,actor,c,credential),proof:unknown[]=[]
 for(const day of scenario.days) {
  const start=new Date(instantOf(day.date,0,day.zone)).toISOString(),end=new Date(instantOf(dayString(dayNumber(day.date)+1),0,day.zone)).toISOString()
  proof.push([day.date,day.zone,(await edge.busy(start,end,scenario.items.map(i=>i.event.id),day.zone)).sort((a,b)=>a.start.localeCompare(b.start)||a.end.localeCompare(b.end))])
 }
 return digest(proof)
}
export async function previewRecoveryUndo(env:Bindings,db:D1Database,actor:Actor,id:string,input:Record<string,any>) {
 const {r,c,body}=await load(db,actor,id)
 if(r.kind!=='recovery'||r.state!=='reconciled'||r.selected===null)throw conflict('focus_not_undoable')
 if(await first(db,"SELECT 1 FROM peg_focus_reviews WHERE source_id=? AND state='reconciled'",id))throw conflict('focus_already_undone')
 const scenario=body.scenarios[r.selected],edge=await edgeFor(env,db,actor,c,input.credential),changes:Change[]=[]
 for(const i of scenario.items) {
  const op=(await first<Operation>(db,'SELECT * FROM peg_focus_operations WHERE review_id=? AND block_id=?',id,i.blockId))!,task=await owned(db,actor,i.taskId,c),event=await edge.read(i.event.id)
  if(await taskFingerprint(task)!==op.task_after||!event||event.etag!==op.event_etag||event.start!==i.start||event.end!==i.end)throw conflict('focus_undo_later_edit_preserved')
  changes.push({blockId:i.blockId,start:i.event.start,end:i.event.end,taskStart:i.beforeTask.start_date,taskDue:i.beforeTask.due_date})
 }
 const inputs=[{label:'Human undo of reviewed recovery',changes},{label:'Human undo comparison',changes}]
 return save(db,actor,c,'undo',await analyse(env,db,actor,c,inputs,input.credential),id)
}
