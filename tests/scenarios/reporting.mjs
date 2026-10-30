import assert from 'node:assert/strict'
const ok=async(promise,status=200)=>{const r=await promise;assert.equal(r.status,status,JSON.stringify(r.body));return r.body}
const instant=s=>Date.parse(s)
export async function reportingScenario(w,{erase=true}={}) {
 await reportingReconciliationScenario(w)
 const owner=w.owner,projects=[]
 for(const name of ['Reporting campaign','Reporting launch','Reporting delivery'])projects.push(await ok(owner.post('/api/v1/projects',{name})))
 const task=async(title,p,estimateHours)=>ok(owner.post('/api/v1/tasks',{title,projectId:projects[p].id,estimateHours}))
 const a=await task('Shared deliverable',0,2),b=await task('Removed deliverable',1,3),c=await task('Added deliverable',2,4),legacy=await task('Legacy baseline',0,1)
 await ok(owner.post(`/api/v1/tasks/${a.id}/projects`,{projectId:projects[1].id}))
 await ok(owner.patch(`/api/v1/tasks/${a.id}`,{status:'doing'}))
 await ok(owner.patch(`/api/v1/tasks/${a.id}`,{status:'done'}))
 await ok(owner.patch(`/api/v1/tasks/${a.id}`,{status:'todo'}))
 await ok(owner.patch(`/api/v1/tasks/${a.id}`,{estimateHours:5}))
 await ok(owner.patch(`/api/v1/tasks/${a.id}`,{status:'done'}))
 await ok(owner.patch(`/api/v1/tasks/${b.id}`,{status:'done'}))
 const outside=await ok(owner.post('/api/v1/projects',{name:'Outside reporting scope'}))
 await ok(owner.post(`/api/v1/tasks/${b.id}/move`,{from:projects[1].id,to:outside.id}))
 await ok(owner.patch(`/api/v1/tasks/${c.id}`,{status:'doing'}))
 await ok(owner.patch(`/api/v1/tasks/${c.id}`,{dueDate:'2026-03-08'}))
 await ok(owner.patch(`/api/v1/tasks/${c.id}`,{dueDate:'2026-03-12'}))
 const input={name:'Three project review',projects:projects.map(p=>p.id),start:'2026-03-06',end:'2026-03-10',timezone:'America/New_York',status:'all'}
 const dashboard=await ok(owner.post('/api/v1/reports',input)),base=`/api/v1/reports/${dashboard.id}`
 const before=await ok(owner.post(base+'/capture',{}))
 const sql=[]
 for(const source of before.sources){
  let completions=0
  for(const event of source.events){
   let at='2026-03-06T17:00:00Z'
   if(source.id===a.id&&event.kind==='state'){
    if(event.status==='doing')at='2026-03-07T17:00:00Z'
    else if(event.status==='done'){completions++;at=completions===1?'2026-03-08T14:00:00Z':'2026-03-10T15:00:00Z'}
    else at=event.effort===5?'2026-03-09T16:00:00Z':'2026-03-09T13:00:00Z'
   }
   if(source.id===b.id){if(event.kind==='state')at='2026-03-07T15:00:00Z';if(event.kind==='scope_removed'||event.kind==='scope_added'&&!event.projects.length)at='2026-03-09T14:00:00Z'}
   if(source.id===c.id){at=event.kind==='state'?'2026-03-09T17:00:00Z':'2026-03-08T16:00:00Z';if(event.kind==='deadline')at=event.due==='2026-03-08'?'2026-03-09T18:00:00Z':'2026-03-10T16:00:00Z'}
   if(source.id===legacy.id)at='2026-03-08T16:00:00Z'
   sql.push(`UPDATE peg_report_events SET at=${instant(at)}${source.id===legacy.id?",kind='baseline'":''} WHERE seq=${event.seq}`)
  }
 }
 await w.sql(sql.join(';'))
 const report=await ok(owner.post(base+'/capture',{})),download=`${base}/snapshots/${report.id}`
 assert.deepEqual(report.sources.map(s=>s.id).sort(),[a,b,c,legacy].map(t=>t.id).sort(),'one authorized source per task, including a removed but still readable task')
 assert.equal(report.window.startAt,instant('2026-03-06T05:00:00Z'))
 assert.equal(report.window.endAt,instant('2026-03-11T04:00:00Z'),'selected window crosses a 23-hour local day')
 const widget=kind=>report.widgets.find(w=>w.kind===kind)
 for(const kind of ['horizontal-bar','vertical-column','donut'])assert.deepEqual(widget(kind).values.map(v=>v.value),[1,1,1])
 assert.equal(widget('single-number').values[0].value,3)
 for(const kind of ['horizontal-bar','vertical-column','donut'])assert.deepEqual(widget(kind).values.map(v=>v.sourceIds),[[legacy.id],[c.id],[a.id]],'each status links to exactly the source task that supplies its value')
 assert.deepEqual(widget('table').values.map(v=>v.value),[1,1,1])
 for(const kind of ['line','burn-up','burn-down'])for(const [i,point] of widget(kind).values.entries())assert.deepEqual([...point.sourceIds].sort(),(i<2?[a,b]:i===2?[a,b,c,legacy]:[a,c,legacy]).map(t=>t.id).sort(),'each dated point preserves its exact event-time scope')
 const early=await ok(owner.post('/api/v1/reports',{...input,name:'Unknown prior history',start:'2026-03-05',end:'2026-03-05'}))
 const prior=await ok(owner.post(`/api/v1/reports/${early.id}/capture`,{}))
 for(const w of prior.widgets){assert.ok(w.values.length>0);assert.ok(w.values.every(v=>v.value===null),'every widget exposes unknown prior history rather than zero')}
 await ok(owner.post('/api/v1/reports',{...input,timezone:'Not a timezone'}),400)
 await ok(owner.post('/api/v1/reports',{...input,start:'2026-03-11'}),400)

 assert.deepEqual(widget('table').values.map(v=>v.label).sort(),['Added deliverable','Legacy baseline','Shared deliverable'])
 assert.deepEqual(widget('line').values.map(v=>v.value),[null,null,4,3,3])
 assert.deepEqual(widget('burn-up').values.map(v=>v.value),[null,null,2,0,1])
 assert.deepEqual(widget('burn-down').values.map(v=>v.value),[null,null,2,3,2])
 for(const kind of ['burn-up','burn-down'])assert.deepEqual(widget(kind).values.map(v=>v.scope),[null,null,4,3,3])
 assert.deepEqual(report.unknown,[legacy.id])
 for(const widget of report.widgets)for(const point of widget.values){assert.ok(point.sourceIds.every(id=>[a,b,c,legacy].some(t=>t.id===id)));assert.ok(point.eventIds.every(id=>report.sources.some(s=>s.events.some(e=>e.seq===id))))}
 const overdue=await ok(owner.post('/api/v1/reports',{...input,name:'Historical deadlines',projects:[projects[2].id],widgets:[{kind:'line',measure:'overdue'}]}))
 const overdueReport=await ok(owner.post(`/api/v1/reports/${overdue.id}/capture`,{}))
 assert.deepEqual(overdueReport.widgets[0].values.map(v=>v.value),[0,0,0,1,0],'a later deadline extension does not rewrite the earlier overdue day')
 const filtered=await ok(owner.post('/api/v1/reports',{...input,name:'Saved completed filter',status:'done'}))
 const filteredReport=await ok(owner.post(`/api/v1/reports/${filtered.id}/capture`,{}))
 assert.deepEqual(filteredReport.widgets.find(w=>w.kind==='table').values.map(v=>v.sourceIds),[[a.id]])
 // Explicit effort, completion and timing semantics use the same event stream.
 for(const [measure,expected] of [['effort',10],['completed',1],['throughput',3],['cycle-hours',70],['status-age-hours',null]]){
  const single=await ok(owner.post('/api/v1/reports',{...input,name:measure,widgets:[{kind:'single-number',measure}]}))
  const result=await ok(owner.post(`/api/v1/reports/${single.id}/capture`,{}))
  if(expected!==null)assert.equal(result.widgets[0].values[0].value,expected,measure)
  else assert.equal(result.widgets[0].values[0].value,null,'legacy status-age duration is unknown')
 }
 const effort=await ok(owner.post('/api/v1/reports',{...input,name:'Effort trends',widgets:[{kind:'burn-up',measure:'effort'},{kind:'burn-down',measure:'effort'}]}))
 const effortReport=await ok(owner.post(`/api/v1/reports/${effort.id}/capture`,{}))
 assert.deepEqual(effortReport.widgets.map(w=>w.values.map(v=>v.value)),[[null,null,5,0,5],[null,null,5,10,5]])
 // Byte formats are opened by independent readers by the caller.
 const files={}
 for(const format of ['csv','xlsx','pdf']){const r=await fetch(w.origin+download+'?format='+format,{headers:{cookie:owner.cookie}});assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');files[format]=new Uint8Array(await r.arrayBuffer())}
 const guest=await w.person(['report-guest','example.test'].join(String.fromCharCode(64)),'Reporting guest','guest')
 const grant=await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:projects[0].id,granteeId:guest.id,level:'viewer'}))
 const hidden=await task('Internal hidden work',0,900)
 await ok(owner.patch(`/api/v1/tasks/${hidden.id}`,{internalOnly:true,internalNotes:'Hidden report field'}))
 await ok(owner.post(`/api/v1/projects/${projects[0].id}/fields`,{key:'margin',label:'Hidden margin',visibility:'internal',type:'number'}))
 await ok(owner.post(`/api/v1/tasks/${a.id}/fields`,{projectId:projects[0].id,values:{margin:7777}}))
 await ok(guest.post('/api/v1/reports',input),404)
 await ok(guest.get(download),404)
 const own=await ok(guest.post('/api/v1/reports',{...input,projects:[projects[0].id]})),guestBase=`/api/v1/reports/${own.id}`
 const safe=await ok(guest.post(guestBase+'/capture',{}))
 assert.deepEqual(safe.sources.map(s=>s.id).sort(),[a.id,legacy.id].sort())
 assert.ok(!JSON.stringify(safe).includes('Hidden')&&!JSON.stringify(safe).includes('7777')&&!JSON.stringify(safe).includes(projects[1].id),'hidden fields, tasks and other project identities do not appear')
 for(const format of ['csv','xlsx','pdf'])assert.equal((await guest.get(`${base}/snapshots/${report.id}?format=${format}`)).status,404)
 await ok(owner.delete(`/api/v1/grants/${grant.id}`))
 for(const format of ['', '?format=csv','?format=xlsx','?format=pdf'])await ok(guest.get(`${guestBase}/snapshots/${safe.id}${format}`),404)
 await ok(guest.post(guestBase+'/capture',{}),404)
 await w.restart()
 assert.deepEqual((await ok(owner.get(download))).widgets,report.widgets,'restart preserves the authorized frozen snapshot')
 if(erase){
 const erased=await ok(owner.post('/api/v1/data/erasure-preview',{type:'task',id:c.id}))
 await ok(owner.post('/api/v1/data/erase',{type:'task',id:c.id,token:erased.token,confirm:true}))
 await ok(owner.get(download),410)
 const refreshed=await ok(owner.post(base+'/capture',{}))
 assert.ok(!JSON.stringify(refreshed).includes(c.id),'erased source and events never resurrect')
 }
 return {owner,projects,a,b,c,legacy,report,dashboard,download,files,guest,own,safe,grant,guestBase,input}
}

// Ordinary edits must preserve timing, completion and the privacy of unrelated memberships.
export async function reportingReconciliationScenario(w) {
 const owner=w.owner,failures=[]
 const shared=await ok(owner.post('/api/v1/projects',{name:'Reconciliation shared project'}))
 const privateProject=await ok(owner.post('/api/v1/projects',{name:'Reconciliation private project'}))
 const input={name:'Reconciliation',projects:[shared.id],start:'2026-03-06',end:'2026-03-10',timezone:'America/New_York',status:'all'}
 const task=await ok(owner.post('/api/v1/tasks',{title:'Reconciled deliverable',projectId:shared.id,estimateHours:2}))
 await ok(owner.patch(`/api/v1/tasks/${task.id}`,{status:'doing'}))
 await ok(owner.patch(`/api/v1/tasks/${task.id}`,{estimateHours:5}))
 await ok(owner.patch(`/api/v1/tasks/${task.id}`,{status:'done',dueDate:'2026-03-12'}))
 const dashboard=await ok(owner.post('/api/v1/reports',{...input,widgets:[{kind:'single-number',measure:'cycle-hours'},{kind:'single-number',measure:'throughput'}]}))
 const base=`/api/v1/reports/${dashboard.id}`
 const before=await ok(owner.post(base+'/capture',{}))
 const events=before.sources.find(s=>s.id===task.id).events
 let doing=0
 await w.sql(events.map(event=>{
  const at=event.status==='doing'?(doing++===0?'2026-03-07T17:00:00Z':'2026-03-08T17:00:00Z'):event.status==='done'?'2026-03-09T17:00:00Z':'2026-03-06T17:00:00Z'
  return `UPDATE peg_report_events SET at=${instant(at)} WHERE seq=${event.seq}`
 }).join(';'))
 const timed=await ok(owner.post(base+'/capture',{}))
 for(const [index,expected] of [48,1].entries()){
  const actual=timed.widgets[index].values[0].value
  if(actual!==expected)failures.push(`${index===0?'Doing → estimate edit → Done cycle hours':'Completion with deadline edit throughput'}: expected ${expected}, received ${actual}`)
 }
 const guest=await w.person(['synthetic-pegboard-reconciliation','example.test'].join(String.fromCharCode(64)),'Reconciliation guest','guest')
 const grant=await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:shared.id,granteeId:guest.id,level:'viewer'}))
 const guestDashboard=await ok(guest.post('/api/v1/reports',input)),guestBase=`/api/v1/reports/${guestDashboard.id}`
 const visibleBefore=await ok(guest.post(guestBase+'/capture',{}))
 await ok(owner.post(`/api/v1/tasks/${task.id}/projects`,{projectId:privateProject.id}))
 // A distinct pinned instant makes disclosure visible independently of timestamp rounding.
 const privateDashboard=await ok(owner.post('/api/v1/reports',{...input,projects:[privateProject.id]}))
 const ownerView=await ok(owner.post(`/api/v1/reports/${privateDashboard.id}/capture`,{})),privateEvent=ownerView.sources.find(s=>s.id===task.id).events.at(-1)
 const privateAt=instant('2026-03-10T18:23:45Z')
 await w.sql(`UPDATE peg_report_events SET at=${privateAt} WHERE seq=${privateEvent.seq}`)
 const visibleAfter=await ok(guest.post(guestBase+'/capture',{}))
 const sourceEvents=report=>report.sources.find(s=>s.id===task.id).events
 if(JSON.stringify(sourceEvents(visibleBefore))!==JSON.stringify(sourceEvents(visibleAfter)))failures.push('Private project membership changed guest source history')
 const csv=await ok(guest.get(`${guestBase}/snapshots/${visibleAfter.id}?format=csv`))
 if(csv.includes(String(privateAt))||csv.includes(privateProject.id))failures.push('Guest CSV disclosed private project membership event or timestamp')
 const privateReport=await ok(owner.post(`/api/v1/reports/${privateDashboard.id}/capture`,{}))
 assert.ok(privateReport.sources.find(s=>s.id===task.id).events.some(e=>e.seq===privateEvent.seq&&e.at===privateAt),'the authorized private membership event is retained')
 const completion=sourceEvents(visibleAfter).find(e=>e.status==='done')
 assert.ok(completion,'the guest retains visible completion history')
 const remove=await ok(owner.post('/api/v1/projects',{name:'Reconciliation destination'}))
 await ok(owner.post(`/api/v1/tasks/${task.id}/move`,{from:privateProject.id,to:remove.id}))
 const afterMove=await ok(guest.post(guestBase+'/capture',{}))
 if(JSON.stringify(sourceEvents(visibleAfter))!==JSON.stringify(sourceEvents(afterMove)))failures.push('Moving private membership changed guest source history')
 await ok(owner.delete(`/api/v1/grants/${grant.id}`))
 await ok(guest.get(`${guestBase}/snapshots/${visibleAfter.id}?format=csv`),404)
 assert.deepEqual(failures,[],'source-event reconciliation and membership privacy')
}

/** Native business rows reconcile to real work, reviewed allocations and approved sheets, without widening read authority. */
export async function reportingBusinessScenario(w) {
 const owner=w.owner,projects=[]
 for(const name of ['Business campaign','Business launch','Business delivery'])projects.push(await ok(owner.post('/api/v1/projects',{name})))
 const person=(suffix,name,role)=>w.person(['synthetic-pegboard-'+suffix,'example.test'].join(String.fromCharCode(64)),name,role)
 const mia=await person('report-worker','Reporting worker','member'),manager=await person('report-manager','Reporting manager','manager')
 for(const p of projects)for(const [who,level] of [[mia,'editor'],[manager,'viewer']])await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:p.id,granteeId:who.id,level}))
 const week=[null,...Array.from({length:5},()=>({start:'09:00',end:'13:00'})),null]
 for(const who of [owner,mia])await ok(who.post('/api/v1/workspaces/ws_main/capacity-profile',{zone:'America/New_York',week}))
 await ok(owner.post('/api/v1/workspaces/ws_main/time-off',{start:'2026-03-10',end:'2026-03-10'}))
 const a=await ok(owner.post('/api/v1/tasks',{projectId:projects[0].id,title:'Shared scheduled business work',ownerId:mia.id,estimateHours:10,startDate:'2026-03-06',dueDate:'2026-03-09'}))
 await ok(owner.post(`/api/v1/tasks/${a.id}/projects`,{projectId:projects[1].id}))
 const allocation={source:'board-centric',sourceMode:'sum',people:[{personId:mia.id,sourcePerson:'synthetic-pegboard-5901'},{personId:owner.id,sourcePerson:'synthetic-pegboard-5902'}]}
 const preview=await ok(owner.post(`/api/v1/tasks/${a.id}/effort/preview`,allocation))
 await ok(owner.post(`/api/v1/tasks/${a.id}/effort/apply`,{...allocation,token:preview.token}))
 const c=await ok(owner.post('/api/v1/tasks',{projectId:projects[2].id,title:'Unscheduled business work',ownerId:mia.id,estimateHours:6}))
 const requestInput={requestKey:'synthetic-pegboard-5903',title:'Native business request'}
 const request=await ok(owner.post(`/api/v1/projects/${projects[2].id}/requests`,requestInput))
 assert.equal((await ok(owner.post(`/api/v1/projects/${projects[2].id}/requests`,requestInput))).id,request.id)
 const approved=await ok(owner.post('/api/v1/tasks',{projectId:projects[1].id,title:'Approved business review',ownerId:mia.id,kind:'approval'}))
 await ok(owner.post(`/api/v1/tasks/${approved.id}/decision`,{action:'approve',revision:(await ok(owner.get(`/api/v1/tasks/${approved.id}/decision-preview`))).token,reason:'synthetic-pegboard-5904'}))
 const pending=await ok(owner.post('/api/v1/tasks',{projectId:projects[0].id,title:'Pending business review',ownerId:mia.id,kind:'approval'}))
 const file=await ok(owner.post(`/api/v1/tasks/${a.id}/attachments?projectId=${projects[0].id}&name=synthetic-pegboard-5905.txt`,'synthetic-pegboard-5905',{'content-type':'text/plain'}))
 const proof=await ok(owner.post(`/api/v1/tasks/${a.id}/proofs`,{attachmentId:file.id}))
 const sheet=await ok(mia.post('/api/v1/timesheets',{startDate:'2026-03-06',endDate:'2026-03-10'}))
 const entry=await ok(mia.post(`/api/v1/timesheets/${sheet.id}/entries`,{taskId:a.id,projectId:projects[0].id,date:'2026-03-08',seconds:5400,key:'synthetic-pegboard-5906',notes:'Never export time notes'}))
 await ok(mia.post(`/api/v1/timesheets/${sheet.id}/entries`,{taskId:c.id,projectId:projects[2].id,date:'2026-03-09',seconds:1800,key:'synthetic-pegboard-5907'}))
 const approve=async s=>{
  await ok(mia.post(`/api/v1/timesheets/${s.id}/decision`,{action:'submit',revision:(await ok(mia.get(`/api/v1/timesheets/${s.id}`))).token}))
  await ok(owner.post(`/api/v1/timesheets/${s.id}/decision`,{action:'approve',revision:(await ok(owner.get(`/api/v1/timesheets/${s.id}`))).token}))
 }
 await approve(sheet)
 const adjustment=await ok(mia.post('/api/v1/timesheets',{startDate:'2026-03-06',endDate:'2026-03-10'}))
 await ok(mia.post(`/api/v1/time/${entry.id}/adjust`,{sheetId:adjustment.id,date:'2026-03-09',seconds:-900,key:'synthetic-pegboard-5908',reason:'Never export adjustment reason'}))
 await approve(adjustment)
 const draft=await ok(mia.post('/api/v1/timesheets',{startDate:'2026-03-06',endDate:'2026-03-10'}))
 await ok(mia.post(`/api/v1/timesheets/${draft.id}/entries`,{taskId:a.id,projectId:projects[0].id,date:'2026-03-08',seconds:32400,key:'synthetic-pegboard-5909'}))
 const outside=await ok(owner.post('/api/v1/projects',{name:'Private business records'}))
 await ok(owner.post(`/api/v1/tasks/${a.id}/projects`,{projectId:outside.id}))
 await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:outside.id,granteeId:mia.id,level:'editor'}))
 const secretFile=await ok(owner.post(`/api/v1/tasks/${a.id}/attachments?projectId=${outside.id}&name=synthetic-pegboard-5910.txt`,'Private proof content',{'content-type':'text/plain'}))
 const secretProof=await ok(owner.post(`/api/v1/tasks/${a.id}/proofs`,{attachmentId:secretFile.id}))
 const outsideSheet=await ok(mia.post('/api/v1/timesheets',{startDate:'2026-03-06',endDate:'2026-03-10'}))
 await ok(mia.post(`/api/v1/timesheets/${outsideSheet.id}/entries`,{taskId:a.id,projectId:outside.id,date:'2026-03-08',seconds:14400,key:'synthetic-pegboard-5911'}));await approve(outsideSheet)
 const at=instant('2026-03-08T06:30:00Z')
 await w.sql(`UPDATE peg_rule_requests SET created_at=${at} WHERE task_id='${request.id}';UPDATE peg_approval_tasks SET created_at=${at} WHERE task_id IN ('${approved.id}','${pending.id}');UPDATE peg_proofs SET created_at=${at} WHERE id IN ('${proof.id}','${secretProof.id}');UPDATE peg_report_events SET at=${instant('2026-03-06T17:00:00Z')} WHERE task_id IN ('${a.id}','${c.id}','${request.id}','${approved.id}','${pending.id}')`)
 const input={name:'Native business review',projects:projects.map(p=>p.id),start:'2026-03-06',end:'2026-03-10',timezone:'America/New_York',widgets:[
  {kind:'horizontal-bar',measure:'approved-hours'},{kind:'vertical-column',measure:'committed-hours'},{kind:'line',measure:'requests'},
  {kind:'donut',measure:'pending-approvals'},{kind:'single-number',measure:'unscheduled-hours'},{kind:'table',measure:'approved-approvals'},
  {kind:'burn-up',measure:'count'},{kind:'burn-down',measure:'count'},
  {kind:'single-number',measure:'available-hours'},{kind:'line',measure:'overload-hours'},
 ]}
 const dashboard=await ok(owner.post('/api/v1/reports',input)),base=`/api/v1/reports/${dashboard.id}`,report=await ok(owner.post(base+'/capture',{})),download=base+'/snapshots/'+report.id
 const values=measure=>report.widgets.find(widget=>widget.measure===measure).values.map(v=>v.value)
 assert.deepEqual(values('approved-hours'),[1.75,0,0],'only approved selected-project time, with signed adjustments, is counted once')
 assert.deepEqual(values('committed-hours'),[20,0,0],'reviewed Sum allocations are participant hours, not a duplicated task estimate')
 assert.deepEqual(values('requests'),[0,0,1,0,0],'replayed native intake is one request at its local creation day across DST')
 assert.deepEqual(values('pending-approvals'),[2,0,0],'one task and one permitted proof review remain pending')
 assert.deepEqual(values('unscheduled-hours'),[6],'undated effort is explicit and excluded from scheduled commitments')
 assert.deepEqual(values('approved-approvals'),[1])
 assert.deepEqual(values('available-hours'),[20],'distinct selected participants have 20 available hours after leave, without counting a shared task twice')
 assert.deepEqual(values('overload-hours'),[2,0,0,2,0],'overload compares each selected person and day before summing, rather than hiding one person’s overload in spare capacity')
 for(const measure of ['available-hours','overload-hours'])assert.ok(report.metrics.filter(r=>r.measure===measure).every(r=>r.taskIds.length&&r.taskIds.every(id=>report.sources.some(source=>source.id===id))))
 assert.equal(report.metrics.filter(r=>r.measure==='committed-hours').reduce((n,r)=>n+r.value,0),20)
 assert.deepEqual(report.metrics.filter(r=>r.measure==='committed-hours').map(r=>[r.day,r.value]),[['2026-03-06',10],['2026-03-09',10]])
 assert.equal(report.sources.filter(s=>s.id===a.id).length,1)
 for(const point of report.widgets.flatMap(w=>w.values))for(const id of point.metricIds??[])assert.ok(report.metrics.some(r=>r.measure+':'+r.id===id),'each plotted business value has a frozen source record')
 const body=JSON.stringify(report)
 for(const hidden of [outside.id,outsideSheet.id,secretProof.id,secretFile.id,'Never export time notes','Never export adjustment reason','Private proof content'])assert.ok(!body.includes(hidden),'unselected business data stays out of the snapshot')
 const time=await ok(owner.post('/api/v1/reports',{...input,widgets:[{kind:'line',measure:'approved-hours'},{kind:'single-number',measure:'approved-hours'}]}))
 const timeReport=await ok(owner.post(`/api/v1/reports/${time.id}/capture`,{}))
 assert.deepEqual(timeReport.widgets[0].values.map(v=>v.value),[0,0,1.5,0.25,0])
 assert.equal(timeReport.widgets[1].values[0].value,1.75)
 const alternate=await ok(owner.post('/api/v1/reports',{...input,timezone:'America/Los_Angeles',widgets:[{kind:'line',measure:'requests'},{kind:'line',measure:'approved-hours'}]}))
 const alternateReport=await ok(owner.post(`/api/v1/reports/${alternate.id}/capture`,{}))
 assert.deepEqual(alternateReport.widgets[0].values.map(v=>v.value),[0,1,0,0,0],'an intake instant belongs to its selected timezone day across DST')
 assert.deepEqual(alternateReport.widgets[1].values.map(v=>v.value),[0,0,1.5,0.25,0],'recorded work dates are not timezone-shifted')
 const signed=await ok(owner.post('/api/v1/reports',{...input,name:'Approved correction day',projects:[projects[0].id],start:'2026-03-09',end:'2026-03-09',widgets:['horizontal-bar','vertical-column','line','donut','single-number','table'].map(kind=>({kind,measure:'approved-hours'}))}))
 const signedReport=await ok(owner.post(`/api/v1/reports/${signed.id}/capture`,{}))
 assert.equal(signedReport.widgets.find(w=>w.kind==='single-number').values[0].value,-0.25,'a selected correction day retains its negative approved duration')
 const current=await ok(owner.get(`/api/v1/workspaces/ws_main/workload?from=2026-03-06&days=5`))
 assert.equal(current.people.reduce((n,p)=>n+p.hours,0),20,'the selected report reconciles to the native workload plan')
 await ok(owner.post('/api/v1/reports',{...input,widgets:[{kind:'line',measure:'unscheduled-hours'}]}),400)
 const privateDemand=await ok(owner.post('/api/v1/tasks',{projectId:outside.id,title:'Never selected capacity demand',ownerId:mia.id,estimateHours:100,startDate:'2026-03-09',dueDate:'2026-03-09'}))
 const isolated=await ok(owner.post(base+'/capture',{}))
 assert.deepEqual(isolated.widgets,report.widgets,'private outside demand cannot alter any selected-project widget or count')
 assert.ok(!JSON.stringify(isolated).includes(privateDemand.id))
 const managerDashboard=await ok(manager.post('/api/v1/reports',input)),managerBase=`/api/v1/reports/${managerDashboard.id}`
 const managerReport=await ok(manager.post(managerBase+'/capture',{}))
 assert.equal(managerReport.widgets[0].values[0].value,1.75)
 assert.ok(!JSON.stringify(managerReport).includes(outside.id))
 await ok(owner.patch(`/api/v1/workspaces/ws_main/people/${manager.id}`,{role:'member'}))
 for(const format of ['', '?format=csv','?format=xlsx','?format=pdf'])await ok(manager.get(`${managerBase}/snapshots/${managerReport.id}${format}`),410)
 const limited=await ok(manager.post(managerBase+'/capture',{}))
 assert.equal(limited.widgets[0].values[0].value,0,'task export authority does not imply another person’s timesheet authority')
 assert.ok(!JSON.stringify(limited).includes(sheet.id)&&!JSON.stringify(limited).includes(adjustment.id))
 const guest=await person('report-business-guest','Business guest','guest')
 for(const p of projects)await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:p.id,granteeId:guest.id,level:'viewer'}))
 const guestDashboard=await ok(guest.post('/api/v1/reports',input))
 await ok(guest.post(`/api/v1/reports/${guestDashboard.id}/capture`,{}),403)
 const files={}
 for(const format of ['csv','xlsx','pdf']){const response=await fetch(w.origin+download+'?format='+format,{headers:{cookie:owner.cookie}});assert.equal(response.status,200);files[format]=new Uint8Array(await response.arrayBuffer())}
 await w.restart()
 assert.deepEqual((await ok(owner.get(download))).metrics,report.metrics,'restart retains the same authorized business records')
 await ok(owner.post(`/api/v1/tasks/${approved.id}/comments`,{body:'synthetic-pegboard-5912'}))
 const changed=await ok(owner.post(base+'/capture',{}))
 assert.equal(changed.widgets.find(w=>w.measure==='approved-approvals').values.length,0,'material changes remove the current approval without rewriting a saved snapshot')
 assert.deepEqual((await ok(owner.get(download))).widgets,report.widgets)
 return {projects,dashboard,report,download,files,input,a,c,approved,pending,proof,manager,guest,signed,signedReport}
}
