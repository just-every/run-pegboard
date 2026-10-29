import assert from 'node:assert/strict'
const ok=async(promise,status=200)=>{const r=await promise;assert.equal(r.status,status,JSON.stringify(r.body));return r.body}
const instant=s=>Date.parse(s)
export async function reportingScenario(w,{erase=true}={}) {
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
