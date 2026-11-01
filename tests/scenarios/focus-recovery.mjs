import assert from 'node:assert/strict'
import { startWorker } from '../support/worker.mjs'
import { startCalendarServices } from '../support/calendar-services.mjs'
import { restoreCanvasInstallation } from '../support/canvas-restore.mjs'
export const credential='synthetic-pegboard-251',calendarId='synthetic-pegboard-250'
export const pass=async(p,status=200)=>{const r=await p;assert.equal(r.status,status,JSON.stringify(r.body));return r.body}
const api='/api/v1'
const email=n=>['synthetic-pegboard-'+n,'example.test'].join(String.fromCharCode(64))
export async function focusFixture(w,services,service='google') {
 const root=w.owner,p=await pass(root.post(api+'/projects',{name:'Human recovery '+service}))
 const connection=await pass(root.post(api+'/workspaces/ws_main/calendars',{service,calendarId,credential,consent:true}))
 const make=(title,hours)=>pass(root.post(api+'/tasks',{projectId:p.id,title,ownerId:root.id,estimateHours:hours,startDate:'2026-03-09',dueDate:'2026-03-09'}))
 const focused=await make('Protected focus',1),task=await make('Overrun work',3)
 const reserve=async(t,minutes)=>{const r=await pass(root.post(api+'/tasks/'+t.id+'/calendar-preview',{connectionId:connection.id,date:'2026-03-09',minutes,credential}));return pass(root.post(api+'/calendar-previews/'+r.id+'/apply',{slot:0,credential}))}
 const lockBlock=await reserve(focused,60),block=await reserve(task,180)
 const lock=async(locked=true)=>{const r=await pass(root.post(api+'/calendar-blocks/'+lockBlock.id+'/focus-preview',{locked,credential}));return pass(root.post(api+'/focus-reviews/'+r.id+'/lock',{stamp:r.stamp,confirm:true,credential}))}
 const change=(day,hours=3)=>({blockId:block.id,start:day+'T13:00:00Z',end:day+'T'+String(13+hours).padStart(2,'0')+':00:00Z',taskStart:day,taskDue:day})
 const inputs=(changes=[change('2026-03-10'),change('2026-03-11')])=>({connectionId:connection.id,credential,scenarios:changes.map((c,i)=>({label:'Human alternative '+(i+1),changes:[c]}))})
 const compare=(input=inputs())=>pass(root.post(api+'/focus-recovery',input))
 const apply=(r,extra={})=>root.post(api+'/focus-reviews/'+r.id+'/apply',{stamp:r.stamp,scenario:0,confirm:true,credential,...extra})
 return {root,p,connection,task,focused,lockBlock,block,lock,change,inputs,compare,apply,services,service}
}
async function withInstallation(run) {
 const services=await startCalendarServices();let w
 try{w=await startWorker({settings:{PEGBOARD_LOCAL_CALENDAR_ORIGINS:services.origins}});await run(w,services)}
 finally{await w?.stop();await services.stop()}
}
const taskDates=async(root,id)=>{const t=await pass(root.get(api+'/tasks/'+id));return [t.startDate,t.dueDate]}
export async function focusRecoveryScenario() {
 await withInstallation(async(w,services)=>{
  for(const service of ['google','microsoft']){
   const f=await focusFixture(w,services,service),{root,p,block,task,focused,lockBlock}=f,data=services.state[service]
   const colleague=await w.person(email('691-'+service),'Colleague')
   const deadline=await pass(root.post(api+'/tasks',{projectId:p.id,title:'Colleague commitment',ownerId:colleague.id,startDate:'2026-03-20',dueDate:'2026-03-20'}))
   const milestone=await pass(root.post(api+'/tasks',{projectId:p.id,title:'Shared milestone',kind:'milestone',ownerId:root.id,dueDate:'2026-03-20'}))
   await pass(root.post(api+'/dependencies',{predecessor:task.id,successor:deadline.id,type:'fs'}))
   await pass(root.post(api+'/dependencies',{predecessor:task.id,successor:milestone.id,type:'fs'}))
   const protectedBefore=structuredClone(data.events.get(lockBlock.event_id))
   await f.lock()
   const original=structuredClone(data.events.get(block.event_id))
   data.locked.push({start:block.start_at,end:block.end_at})
   // Actual time exceeds the earlier estimate; the reviewed remainder is three hours.
   await pass(root.patch(api+'/tasks/'+task.id,{estimateHours:2}))
   const sheet=await pass(root.post(api+'/timesheets',{startDate:'2026-03-09',endDate:'2026-03-15'}))
   await pass(root.post(api+'/timesheets/'+sheet.id+'/entries',{taskId:task.id,projectId:p.id,date:'2026-03-09',seconds:9000,key:'synthetic-pegboard-692-'+service}))
   await pass(root.patch(api+'/tasks/'+task.id,{estimateHours:5.5}))
   const displaced=await f.compare(f.inputs([f.change('2026-03-23'),f.change('2026-03-24')]))
   assert.ok(displaced.scenarios.every(s=>!s.feasible&&s.reasons.includes('colleague_or_dependency_dates_preserved')))
   await pass(f.apply(displaced),409)
   let r=await f.compare()
   assert.deepEqual(r.scenarios[0].items.map(i=>[i.estimateHours,i.actualHours,i.remainingHours]),[[5.5,2.5,3]])
   assert.deepEqual(r.scenarios.map(s=>[s.requiredHours,s.reservedHours,s.shortageHours,s.feasible]),[[3,3,0,true],[3,3,0,true]])
   assert.deepEqual(r.scenarios[0].days.map(d=>[d.date,d.freeHours,d.otherHours,d.availableHours]),[['2026-03-10',8,0,8]])
   assert.deepEqual(r.scenarios[0].items.map(i=>[i.taskId,i.blockId,i.eventId,i.fromStart,i.fromDue,i.taskStart,i.taskDue,i.start,i.end]),[[task.id,block.id,block.event_id,'2026-03-09','2026-03-09','2026-03-10','2026-03-10','2026-03-10T13:00:00.000Z','2026-03-10T16:00:00.000Z']])
   assert.deepEqual(await taskDates(root,task.id),['2026-03-09','2026-03-09'])
   data.loseNextMove=true
   const uncertain=await pass(f.apply(r))
   assert.equal(uncertain.state,'uncertain');assert.deepEqual(await taskDates(root,task.id),['2026-03-09','2026-03-09'])
   assert.equal(uncertain.operations[0].state,'sending')
   const writes=data.calls.filter(c=>c.method==='PATCH').length
   await w.restart()
   const reconciled=await pass(f.apply(r))
   assert.equal(reconciled.state,'reconciled');assert.equal(reconciled.operations[0].state,'verified')
   assert.equal(data.calls.filter(c=>c.method==='PATCH').length,writes,'restart reconciles by readback, without repeating a write')
   assert.equal((await pass(f.apply(r))).state,'reconciled')
   assert.deepEqual(await taskDates(root,task.id),['2026-03-10','2026-03-10'])
   assert.equal(data.events.size,2);assert.equal(data.events.get(block.event_id).id,block.event_id)
   const event=data.events.get(block.event_id)
   assert.equal(event.start.dateTime.replace(/Z?$/,'Z'),'2026-03-10T13:00:00.000Z')
   assert.equal(event.end.dateTime.replace(/Z?$/,'Z'),'2026-03-10T16:00:00.000Z')
   assert.deepEqual(data.events.get(lockBlock.event_id),protectedBefore)
   assert.deepEqual(await taskDates(root,focused.id),['2026-03-09','2026-03-09'])
   assert.deepEqual(await taskDates(root,deadline.id),['2026-03-20','2026-03-20'])
   assert.deepEqual(await taskDates(root,milestone.id),[null,'2026-03-20'])
   // Undo is a new exact review; remove the collision first, since undo may not overwrite a meeting.
   data.locked=data.locked.filter(b=>b.start!==block.start_at)
   let undo=await pass(root.post(api+'/focus-reviews/'+r.id+'/undo-preview',{credential}))
   assert.equal(undo.kind,'undo');assert.equal(undo.scenarios[0].items[0].taskDue,'2026-03-09')
   await pass(root.patch(api+'/tasks/'+task.id,{description:'Later human work'}))
   await pass(f.apply(undo),409)
   await pass(root.post(api+'/focus-reviews/'+r.id+'/undo-preview',{credential}),409)
   assert.deepEqual(await taskDates(root,task.id),['2026-03-10','2026-03-10'])
   // A subsequent recovery can be undone while the exact task and event remain unchanged.
   r=await f.compare(f.inputs([f.change('2026-03-11'),f.change('2026-03-12')]))
   data.loseNextMove=true
   assert.equal((await pass(f.apply(r))).state,'uncertain')
   // A provider edit can land after an uncertain write and before its readback.
   const laterContent=service==='google'
    ? {summary:'Later provider title',description:'Later provider notes',location:'Human meeting room'}
    : {subject:'Later provider title',body:{contentType:'text',content:'Later provider notes'},location:{displayName:'Human meeting room'}}
   Object.assign(data.events.get(block.event_id),laterContent,{[service==='google'?'etag':'@odata.etag']:'"42"'})
   assert.equal((await pass(f.apply(r))).state,'reconciled')
   undo=await pass(root.post(api+'/focus-reviews/'+r.id+'/undo-preview',{credential}))
   assert.equal((await pass(f.apply(undo))).state,'reconciled')
   assert.deepEqual(await taskDates(root,task.id),['2026-03-10','2026-03-10'])
   assert.equal((await pass(f.apply(undo))).state,'reconciled')
   for(const [key,value] of Object.entries(laterContent))assert.deepEqual(data.events.get(block.event_id)[key],value,'Undo preserves later provider content after uncertain readback')
   assert.equal(data.events.get(block.event_id).start.dateTime.replace(/Z?$/,'Z'),'2026-03-10T13:00:00.000Z')
   assert.equal(data.events.get(block.event_id).end.dateTime.replace(/Z?$/,'Z'),'2026-03-10T16:00:00.000Z')
   console.log('PROBE PEG-069 B '+service+': lost acknowledgment, provider content edit, readback and reviewed undo -> prior dates restored; later title, notes and location preserved')
   const audited=await pass(root.get(api+'/admin/audit?action=focus.reconciled'))
   assert.ok(audited.events.some(e=>e.target_id===r.id))
   assert.ok(!JSON.stringify(audited).includes(credential))
   // Exact scope names the dependent stores; holds prevent any removal.
   const held=await pass(root.post(api+'/data/holds',{type:'task',id:task.id,authority:'Human retention hold',expiresAt:Date.now()+86400000}))
   let erase=await pass(root.post(api+'/data/erasure-preview',{type:'task',id:task.id}))
   assert.ok(erase.counts.peg_focus_reviews>0);assert.ok(erase.counts.peg_focus_operations>0);assert.ok(erase.blockers.includes('active_legal_hold'))
   await pass(root.post(api+'/data/erase',{type:'task',id:task.id,token:erase.token,confirm:true}))
   assert.equal((await pass(root.get(api+'/focus-reviews/'+r.id))).state,'reconciled')
   await pass(root.post(api+'/data/holds/'+held.id+'/release',{confirm:true}))
   // Time is retained under the existing custody boundary; it is not falsely erased here.
   assert.ok(erase.blockers.includes('retained_time_records_require_separate_review'))
   assert.ok(!data.error,String(data.error))
   assert.ok(original)
   await f.lock(false)
   // Retire this provider's finished fixture through public doors before the next comparison.
   await pass(root.patch(api+'/tasks/'+task.id,{status:'done'}))
   await pass(root.patch(api+'/tasks/'+focused.id,{status:'done'}))
   await pass(root.post(api+'/calendars/'+f.connection.id+'/disconnect',{}))
  }
 })
}
export async function focusRecoveryRefusalsScenario() {
 await withInstallation(async(w,services)=>{
  const f=await focusFixture(w,services),{root,p,block,task,lockBlock}=f,data=services.state.google
  const member=await w.person(email('693'),'Other member'),guest=await w.person(email('694'),'Guest','guest')
  const writes=()=>data.calls.filter(c=>['PATCH','DELETE'].includes(c.method)).length
  const oldLock=await pass(root.post(api+'/calendar-blocks/'+lockBlock.id+'/focus-preview',{locked:true,credential}))
  await pass(root.patch(api+'/tasks/'+f.focused.id,{description:'Changed before lock approval'}))
  await pass(root.post(api+'/focus-reviews/'+oldLock.id+'/lock',{stamp:oldLock.stamp,confirm:true,credential}),409)
  await pass(root.post(api+'/calendar-blocks/'+lockBlock.id+'/sync',{credential}),409)
  const repair=await pass(root.post(api+'/tasks/'+f.focused.id+'/calendar-preview',{connectionId:f.connection.id,date:'2026-03-09',minutes:60,credential}))
  await pass(root.post(api+'/calendar-previews/'+repair.id+'/apply',{slot:0,credential}))
  await f.lock()
  await pass(root.patch(api+'/tasks/'+f.focused.id,{dueDate:'2026-03-10'}),409)
  let before=writes()
  for(const person of [member,guest]){
   await pass(person.post(api+'/focus-recovery',f.inputs()),403)
   await pass(person.post(api+'/calendar-blocks/'+lockBlock.id+'/focus-preview',{locked:false,credential}),403)
  }
  const staleMove=await pass(root.post(api+'/tasks/'+task.id+'/calendar-preview',{connectionId:f.connection.id,date:'2026-03-10',minutes:180,credential}))
  await pass(root.post(api+'/calendar-blocks/'+lockBlock.id+'/delete',{revision:lockBlock.revision,credential}),409)
  await pass(root.post(api+'/tasks/'+f.focused.id+'/calendar-preview',{connectionId:f.connection.id,date:'2026-03-10',minutes:60,credential}),409)
  const lockedPlan=await pass(root.post(api+'/schedule/preview',{moves:[{taskId:f.focused.id,start:'2026-03-10',due:'2026-03-10'}]}))
  await pass(root.post(api+'/schedule/apply',{moves:[{taskId:f.focused.id,start:'2026-03-10',due:'2026-03-10'}],revision:lockedPlan.stamp}),409)
  assert.equal(writes(),before)
  let r=await f.compare(f.inputs([f.change('2026-03-10',1),f.change('2026-03-11',1)]))
  assert.deepEqual(r.scenarios.map(s=>[s.feasible,s.shortageHours]),[[false,2],[false,2]])
  await pass(f.apply(r),409)
  data.freeBusyDenied=true
  await pass(root.post(api+'/focus-recovery',f.inputs()),403)
  data.freeBusyDenied=false
  r=await f.compare()
  await pass(f.apply(r,{confirm:false}),409)
  data.locked.push({start:'2026-03-10T13:00:00.000Z',end:'2026-03-10T14:00:00.000Z'})
  await pass(f.apply(r),409)
  data.locked.pop()
  await pass(f.apply(r),409)
  r=await f.compare()
  const leave=await pass(root.post(api+'/workspaces/ws_main/time-off',{start:'2026-03-10',end:'2026-03-10'}))
  await pass(f.apply(r),409)
  const noTime=await f.compare()
  assert.equal(noTime.scenarios[0].feasible,false);assert.equal(noTime.scenarios[0].days[0].availableHours,0)
  await pass(root.post(api+'/workspaces/ws_main/time-off/'+leave.id+'/remove',{}))
  await pass(root.post(api+'/calendar-previews/'+staleMove.id+'/apply',{slot:0,credential}),409)
  r=await f.compare()
  services.move('google',block.event_id,'2026-03-09T15:00:00.000Z','2026-03-09T18:00:00.000Z')
  await pass(f.apply(r),409)
  r=await f.compare()
  await pass(root.post(api+'/calendars/'+f.connection.id+'/disconnect',{}))
  await pass(f.apply(r),409)
  await pass(root.post(api+'/workspaces/ws_main/calendars',{service:'google',calendarId,credential,consent:true}))
  await pass(f.apply(r),409)
  assert.equal(writes(),before)
  // Two intended events cannot claim completion while only one has moved.
  const second=await pass(root.post(api+'/tasks',{projectId:p.id,title:'Second recovery block',ownerId:root.id,estimateHours:1,startDate:'2026-03-09',dueDate:'2026-03-09'}))
  const reserve=await pass(root.post(api+'/tasks/'+second.id+'/calendar-preview',{connectionId:f.connection.id,date:'2026-03-09',minutes:60,credential}))
  const secondBlock=await pass(root.post(api+'/calendar-previews/'+reserve.id+'/apply',{slot:0,credential}))
  // Surplus reservation on one task cannot cover another task's missing hours.
  const shortageInput={connectionId:f.connection.id,credential,scenarios:['2026-03-10','2026-03-11'].map((date,i)=>({label:'Human uneven reservation '+(i+1),changes:[f.change(date,1),{blockId:secondBlock.id,start:date+'T14:00:00Z',end:date+'T17:00:00Z',taskStart:date,taskDue:date}]}))}
  const shortage=await f.compare(shortageInput),shortageWrites=writes()
  assert.deepEqual(shortage.scenarios.map(s=>[s.requiredHours,s.reservedHours,s.shortageHours,s.feasible]),[[4,4,2,false],[4,4,2,false]])
  assert.ok(shortage.scenarios.every(s=>s.days[0].shortageHours===2&&s.reasons.includes('capacity_shortage')))
  await pass(f.apply(shortage),409)
  assert.equal(writes(),shortageWrites)
  assert.deepEqual(await taskDates(root,task.id),['2026-03-09','2026-03-09']);assert.deepEqual(await taskDates(root,second.id),['2026-03-09','2026-03-09'])
  console.log('PROBE PEG-069 A: 1 h reserved for 3 h task plus 3 h for 1 h companion -> shortage 2 h; apply 409; calendar writes and task dates unchanged')
  const multiInput=()=>({connectionId:f.connection.id,credential,scenarios:['2026-03-10','2026-03-11'].map((date,i)=>({label:'Human multi-event '+(i+1),changes:[f.change(date),{blockId:secondBlock.id,start:date+'T16:00:00Z',end:date+'T17:00:00Z',taskStart:date,taskDue:date}]}))})
  r=await pass(root.post(api+'/focus-recovery',multiInput()))
  data.beforeWrite=()=>pass(root.patch(api+'/tasks/'+second.id,{description:'Changed during the first provider write'}))
  const partial=await pass(f.apply(r));assert.equal(partial.state,'uncertain')
  assert.deepEqual(partial.operations.map(o=>o.state).sort(),['planned','sent'])
  assert.deepEqual(await taskDates(root,task.id),['2026-03-09','2026-03-09']);assert.deepEqual(await taskDates(root,second.id),['2026-03-09','2026-03-09'])
  const partialWrites=writes()
  await w.restart()
  const readback=await pass(root.post(api+'/focus-reviews/'+r.id+'/reconcile',{credential}))
  assert.equal(readback.state,'conflict');assert.equal(readback.cause,'partial_fresh_review_required');assert.equal(writes(),partialWrites)
  r=await pass(root.post(api+'/focus-recovery',multiInput()))
  let entered,release
  const started=new Promise(resolve=>{entered=resolve})
  data.beforeWrite=async()=>{entered();await new Promise(resolve=>{release=resolve})}
  const writing=f.apply(r)
  await started
  let duplicate,earlyRead
  try{
   duplicate=await f.apply(r)
   earlyRead=await root.post(api+'/focus-reviews/'+r.id+'/reconcile',{credential})
   const custody=await pass(root.post(api+'/data/erasure-preview',{type:'task',id:task.id}))
   assert.ok(custody.blockers.includes('focus_reconciliation_required_before_erasure'))
   const heldWrite=await pass(root.post(api+'/data/erase',{type:'task',id:task.id,token:custody.token,confirm:true}))
   assert.equal(heldWrite.outcome,'retained')
   assert.deepEqual(heldWrite.counts,{})

  }finally{release()}
  const concurrent=[await writing,duplicate]
  assert.equal(duplicate.status,200);assert.equal(duplicate.body.state,'applying')
  assert.equal(earlyRead.status,200);assert.equal(earlyRead.body.state,'applying','readback cannot finalize a write still in flight')
  assert.ok(concurrent.some(a=>a.status===200));assert.ok(concurrent.every(a=>a.status===200||a.status===409))
  assert.equal((await pass(root.get(api+'/focus-reviews/'+r.id))).state,'reconciled')
  assert.equal(writes()-partialWrites,2,'one human-approved write per intended event despite concurrent approval')
  assert.deepEqual(await taskDates(root,task.id),['2026-03-10','2026-03-10']);assert.deepEqual(await taskDates(root,second.id),['2026-03-10','2026-03-10'])
  for(const heldTask of [second.id,f.focused.id]){
   const hold=await pass(root.post(api+'/data/holds',{type:'task',id:heldTask,authority:'Preserve related recovery history',expiresAt:Date.now()+86400000}))
   const shared=await pass(root.post(api+'/data/erasure-preview',{type:'task',id:task.id}))
   assert.ok(shared.blockers.includes('active_legal_hold'),'Every affected task and recorded focus lock protects its recovery records')
   const retained=await pass(root.post(api+'/data/erase',{type:'task',id:task.id,token:shared.token,confirm:true}))
   assert.equal(retained.outcome,'retained');assert.deepEqual(retained.counts,{})
   assert.equal((await pass(root.get(api+'/focus-reviews/'+r.id))).state,'reconciled')
   await pass(root.post(api+'/data/holds/'+hold.id+'/release',{confirm:true}))
  }
  // Unknown owner availability prevents a feasibility claim; private work stays undisclosed.
  const hidden=await pass(member.post(api+'/tasks',{title:'Hidden obligation',ownerId:member.id,estimateHours:2,startDate:'2026-03-10',dueDate:'2026-03-10'}))
  const feed=await pass(root.post(api+'/workspaces/ws_main/capacity-feeds',{service:'willow',origin:'https://willow.example.test',mapping:{'synthetic-pegboard-695':root.id}}))
  const unknown=await f.compare()
  assert.equal(unknown.scenarios[0].feasible,false);assert.ok(unknown.scenarios[0].reasons.includes('capacity_context_incomplete'))
  assert.ok(!JSON.stringify(unknown).includes(hidden.id));assert.ok(!JSON.stringify(unknown).includes('Hidden obligation'))
  assert.deepEqual(await taskDates(root,task.id),['2026-03-10','2026-03-10'])
  // Restore is inactive: mappings survive as provenance, no old review or credential can resume a write.
  const calls=data.calls.length,restored=await restoreCanvasInstallation(root)
  try{
   const native=restored.worker.owner
   const connections=await pass(native.get(api+'/workspaces/ws_main/calendars'))
   assert.equal(connections.connections.find(c=>c.id===f.connection.id).active,0)
   assert.equal(connections.connections.find(c=>c.id===f.connection.id).calendar_id,'inactive:'+f.connection.id)
   await pass(native.post(api+'/focus-reviews/'+r.id+'/apply',{stamp:r.stamp,scenario:0,confirm:true,credential}),409)
   assert.equal(data.calls.length,calls)
  }finally{await restored.stop()}
  // Erasure includes every review referencing the task, its readback intents and lock decisions.
  const erase=await pass(root.post(api+'/data/erasure-preview',{type:'task',id:task.id}))
  assert.ok(erase.counts.peg_focus_reviews>0);assert.ok(erase.counts.peg_focus_subjects>0)
  await pass(root.post(api+'/data/erase',{type:'task',id:task.id,token:erase.token,confirm:true}))
  await pass(root.post(api+'/focus-reviews/'+r.id+'/apply',{stamp:r.stamp,scenario:0,confirm:true,credential}),400)
  assert.equal(data.calls.length,calls)
  assert.deepEqual(await taskDates(root,second.id),['2026-03-10','2026-03-10'])
  assert.ok(!data.error,String(data.error))
 })
}
