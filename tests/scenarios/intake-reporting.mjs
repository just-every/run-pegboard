import assert from 'node:assert/strict'
const ok=async(p,status=200)=>{const r=await p;assert.equal(r.status,status,JSON.stringify(r.body));return r.body}
const at=s=>Date.parse(s)
const kinds=['horizontal-bar','vertical-column','line','donut','single-number','table']

/** Form receipts reconcile to reporting through ordinary publication and submission doors. */
export async function intakeReportingScenario(w) {
 const owner=w.owner,projects=[]
 for(const name of ['Receipt campaign','Receipt launch','Receipt delivery','Unselected receipt origin'])projects.push(await ok(owner.post('/api/v1/projects',{name})))
 const member=await w.person(['synthetic-pegboard-report-submitter','example.test'].join(String.fromCharCode(64)),'Private submitter identity')
 const forms=[]
 for(const project of projects){
  await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:project.id,granteeId:member.id,level:'editor'}))
  const form=await ok(owner.post(`/api/v1/projects/${project.id}/intake/forms`,{name:'Report request',fields:[{id:'title',label:'Request title',required:true},{id:'detail',label:'Private answer',required:true}],mapping:{title:'title',description:['detail'],ownerId:owner.id,priority:'normal'},hours:8}))
  const base=`/api/v1/intake/forms/${form.id}`,review=await ok(owner.get(base+'/review'))
  const published=await ok(owner.post(base+'/publish',{version:form.version,review:review.review,audience:forms.length%2?'internal':'public',consent:true}))
  forms.push({...form,base,project,capability:published.capability})
 }
 const publicPost=(form,input)=>fetch(w.origin+'/api/v1/public-intake/'+form.capability,{method:'POST',headers:{origin:w.origin,'content-type':['application','json'].join('/')},body:JSON.stringify(input)}).then(async r=>({status:r.status,body:await r.json()}))
 const submit=async(index,key,title='Reportable request')=>{
  const form=forms[index],input={version:form.version,requestKey:'synthetic-pegboard-'+key,answers:{title,detail:'Private raw answer excluded from reports'}}
  const post=()=>form.capability?publicPost(form,input):member.post(form.base+'/submit',input)
  const receipt=await ok(post())
  assert.equal((await ok(post())).receipt,receipt.receipt,'same submission replays one receipt')
  const queue=await ok(owner.get(`/api/v1/projects/${form.project.id}/intake`)),item=queue.items.find(item=>item.id===receipt.receipt)
  assert.ok(item,'public receipt matches a real triage item')
  return {id:receipt.receipt,taskId:item.taskId,projectId:form.project.id,receipt,post}
 }
 const input={name:'Form receipt dashboard',projects:projects.slice(0,3).map(p=>p.id),start:'2026-03-08',end:'2026-03-08',timezone:['America','New_York'].join('/'),widgets:kinds.map(kind=>({kind,measure:'requests'}))}
 const dashboard=await ok(owner.post('/api/v1/reports',input)),base=`/api/v1/reports/${dashboard.id}`
 const empty=await ok(owner.post(base+'/capture',{}))
 const a=await submit(0,'report-before'),b=await submit(0,'report-start'),c=await submit(1,'report-end'),d=await submit(1,'report-after')
 const fallStart=await submit(0,'report-fall-start'),fallEnd=await submit(1,'report-fall-end'),fallAfter=await submit(0,'report-fall-after')
 const outside=await submit(3,'report-outside'),moved=await submit(0,'report-moved'),hidden=await submit(0,'report-hidden')
 const legacy=await ok(owner.post(`/api/v1/projects/${projects[2].id}/requests`,{requestKey:'synthetic-pegboard-report-legacy',title:'Legacy report request'}))
 await ok(owner.post(`/api/v1/tasks/${b.taskId}/projects`,{projectId:projects[1].id}))
 await ok(owner.post(`/api/v1/tasks/${b.taskId}/projects`,{projectId:projects[2].id}))
 await ok(owner.patch(`/api/v1/tasks/${b.taskId}`,{status:'doing'}))
 await ok(owner.patch(`/api/v1/tasks/${c.taskId}`,{status:'done'}))
 await ok(owner.post(`/api/v1/tasks/${outside.taskId}/projects`,{projectId:projects[0].id}))
 await ok(owner.post(`/api/v1/tasks/${moved.taskId}/move`,{from:projects[0].id,to:projects[2].id}))
 await ok(owner.patch(`/api/v1/tasks/${hidden.taskId}`,{internalOnly:true}))
 // Only move the fixture clock. Receipt and task identities come from the public doors.
 const instants=[[a,'2026-03-08T04:59:59.999Z'],[b,'2026-03-08T05:00:00Z'],[c,'2026-03-09T03:59:59.999Z'],[d,'2026-03-09T04:00:00Z'],[fallStart,'2026-11-01T04:00:00Z'],[fallEnd,'2026-11-02T04:59:59.999Z'],[fallAfter,'2026-11-02T05:00:00Z'],[outside,'2026-03-08T08:00:00Z'],[moved,'2026-03-08T08:00:00Z'],[hidden,'2026-03-07T08:00:00Z']]
 await w.sql(instants.map(([row,instant])=>`UPDATE peg_intake_submissions SET submitted_at=${at(instant)} WHERE id='${row.id}'`).join(';')+`;UPDATE peg_rule_requests SET created_at=${at('2026-03-08T08:00:00Z')} WHERE task_id='${legacy.id}'`)
 const expected=[b.id,c.id],report=await ok(owner.post(base+'/capture',{}))
 const receiptRows=r=>r.metrics.filter(row=>row.measure==='requests')
 assert.deepEqual(receiptRows(report).map(row=>row.id).filter(id=>id.startsWith('submission_')).sort(),expected.sort())
 assert.equal(receiptRows(report).length,3,'two distinct receipts plus the retained legacy request')
 assert.deepEqual(receiptRows(report).filter(row=>expected.includes(row.id)).map(row=>[row.id,row.taskId,row.projectId,row.day,row.status]).sort(),[[b.id,b.taskId,b.projectId,'2026-03-08','doing'],[c.id,c.taskId,c.projectId,'2026-03-08','done']].sort())
 assert.ok(receiptRows(report).some(row=>row.taskId===legacy.id))
 assert.equal(report.window.endAt-report.window.startAt,23*3600000)
 for(const widget of report.widgets){
  assert.deepEqual(widget.values.map(v=>v.value),widget.kind==='line'||widget.kind==='single-number'?[3]:[1,1,1],widget.kind)
  assert.deepEqual(widget.values.flatMap(v=>v.metricIds).sort(),receiptRows(report).map(row=>'requests:'+row.id).sort())
  for(const point of widget.values)assert.equal(new Set(point.sourceIds).size,point.sourceIds.length,'task multi-homing cannot duplicate drill-through')
 }
 for(const row of receiptRows(report))assert.deepEqual(Object.keys(row).sort(),['id','taskId','projectId','measure','value','day','status'].sort(),'request projection contains only permitted report fields')
 const download=base+'/snapshots/'+report.id,files={}
 for(const format of ['csv','xlsx','pdf']){
  const r=await fetch(w.origin+download+'?format='+format,{headers:{cookie:owner.cookie}})
  assert.equal(r.status,200);files[format]=new Uint8Array(await r.arrayBuffer())
 }
 const serialized=JSON.stringify(report)
 for(const secret of [member.id,member.email,member.name,'Private raw answer excluded from reports',...forms.map(f=>f.capability).filter(Boolean),a.id,d.id,outside.id,moved.id])assert.ok(!serialized.includes(secret),'excluded receipt content and origins never leak')
 assert.equal((await ok(owner.get(base+'/snapshots/'+empty.id))).widgets[4].values[0].value,0,'a pre-submission snapshot stays frozen')
 // Different selected local-day windows use the persisted receipt instant, never task creation.
 const alternate=async extra=>{
  const saved=await ok(owner.post('/api/v1/reports',{...input,...extra}))
  return ok(owner.post(`/api/v1/reports/${saved.id}/capture`,{}))
 }
 const pacific=await alternate({timezone:['America','Los_Angeles'].join('/')})
 assert.deepEqual(receiptRows(pacific).map(row=>row.taskId).sort(),[c.taskId,d.taskId,legacy.id].sort())
 const fall=await alternate({start:'2026-11-01',end:'2026-11-01'})
 assert.deepEqual(receiptRows(fall).map(row=>row.id).sort(),[fallStart.id,fallEnd.id].sort())
 assert.equal(fall.window.endAt-fall.window.startAt,25*3600000)
 await ok(owner.patch(`/api/v1/tasks/${b.taskId}`,{status:'done'}))
 const done=await alternate({status:'done'})
 assert.deepEqual(receiptRows(done).map(row=>row.id).sort(),[b.id,c.id].sort())
 assert.equal(receiptRows(await ok(owner.get(download))).find(row=>row.id===b.id).status,'doing','saved status remains captured')
 const onlyDestination=await alternate({projects:[projects[2].id]})
 assert.deepEqual(receiptRows(onlyDestination).map(row=>row.taskId),[legacy.id],'a placement cannot substitute for the receipt origin')
 const guest=await w.person(['synthetic-pegboard-report-reader','example.test'].join(String.fromCharCode(64)),'Receipt report guest','guest'),grants=[]
 for(const project of projects.slice(0,3))grants.push(await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:project.id,granteeId:guest.id,level:'viewer'})))
 await ok(owner.post(`/api/v1/tasks/${hidden.taskId}/projects`,{projectId:projects[1].id}))
 await w.sql(`UPDATE peg_intake_submissions SET submitted_at=${at('2026-03-08T08:00:00Z')} WHERE id='${hidden.id}'`)
 const guestDashboard=await ok(guest.post('/api/v1/reports',input)),guestBase=`/api/v1/reports/${guestDashboard.id}`,safe=await ok(guest.post(guestBase+'/capture',{}))
 assert.deepEqual(receiptRows(safe).map(row=>row.taskId).sort(),[b.taskId,c.taskId,legacy.id].sort(),'hidden task and unselected origin remain excluded even with a visible placement')
 const requester=await w.person(['synthetic-pegboard-report-access','example.test'].join(String.fromCharCode(64)),'Access requester')
 await ok(requester.post('/api/v1/access-requests',{targetId:projects[0].id,level:'viewer'}))
 assert.deepEqual((await ok(guest.post(guestBase+'/capture',{}))).widgets,safe.widgets,'membership access requests cannot enter work intake')
 await ok(owner.delete(`/api/v1/grants/${grants[0].id}`))
 for(const format of ['','?format=csv','?format=xlsx','?format=pdf'])await ok(guest.get(guestBase+'/snapshots/'+safe.id+format),404)
 // Keeping task access through another placement cannot replace origin export authority.
 const readOnly=await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:projects[0].id,granteeId:guest.id,level:'viewer',scopes:['read']}))
 await ok(guest.get(`/api/v1/projects/${projects[0].id}`))
 await ok(guest.get(`/api/v1/tasks/${b.taskId}`))
 for(const format of ['','?format=csv','?format=xlsx','?format=pdf'])await ok(guest.get(guestBase+'/snapshots/'+safe.id+format),403)
 await ok(guest.post(guestBase+'/capture',{}),403)
 await ok(guest.post('/api/v1/reports',input),403)
 await ok(owner.delete(`/api/v1/grants/${readOnly.id}`))
 await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:projects[0].id,granteeId:guest.id,level:'viewer'}))
 assert.deepEqual((await ok(guest.get(guestBase+'/snapshots/'+safe.id))).metrics,safe.metrics,'renewed export authority serves only the original frozen receipt values')
 // A stricter workspace export floor applies to saved reports as well as new captures.
 await ok(owner.patch('/api/v1/workspaces/ws_main/settings',{exportMinLevel:'editor'}))
 await ok(guest.get(`/api/v1/tasks/${b.taskId}`))
 for(const format of ['','?format=csv','?format=xlsx','?format=pdf'])await ok(guest.get(guestBase+'/snapshots/'+safe.id+format),403)
 await ok(guest.post(guestBase+'/capture',{}),403)
 await ok(owner.patch('/api/v1/workspaces/ws_main/settings',{exportMinLevel:'viewer'}))
 assert.deepEqual((await ok(guest.get(guestBase+'/snapshots/'+safe.id))).metrics,safe.metrics)
 // Project remains exportable but loss of task readability also fences a saved snapshot.
 const taskScope=await ok(guest.post('/api/v1/reports',{...input,projects:[projects[1].id]})),taskBase=`/api/v1/reports/${taskScope.id}`
 const readable=await ok(guest.post(taskBase+'/capture',{}))
 await ok(owner.patch(`/api/v1/tasks/${c.taskId}`,{internalOnly:true}))
 for(const format of ['','?format=csv','?format=xlsx','?format=pdf'])await ok(guest.get(taskBase+'/snapshots/'+readable.id+format),410)
 await ok(owner.patch(`/api/v1/tasks/${c.taskId}`,{internalOnly:false}))
 const newInput={version:forms[1].version,requestKey:'synthetic-pegboard-report-race',answers:{title:'Concurrent report request',detail:'Private concurrent answer'}}
 const clock=Date.now(),raceDashboard=await ok(owner.post('/api/v1/reports',{...input,start:new Date(clock-2*86400000).toISOString().slice(0,10),end:new Date(clock+2*86400000).toISOString().slice(0,10)}))
 const raceBase=`/api/v1/reports/${raceDashboard.id}`
 const [capture,submission]=await Promise.all([owner.post(raceBase+'/capture',{}),member.post(forms[1].base+'/submit',newInput)])
 assert.equal(submission.status,200,JSON.stringify(submission.body))
 assert.ok([200,409].includes(capture.status),JSON.stringify(capture.body))
 if(capture.status===200){
  const concurrent=capture.body,ids=receiptRows(concurrent).map(row=>row.id)
  assert.equal(ids.length,new Set(ids).size)
  for(const metric of receiptRows(concurrent))assert.ok(concurrent.sources.some(source=>source.id===metric.taskId),'a successful concurrent capture has every metric source')
  const queue=await ok(owner.get(`/api/v1/projects/${projects[1].id}/intake`)),created=queue.items.find(item=>item.id===submission.body.receipt)
  assert.ok(created)
  assert.equal(concurrent.sources.some(source=>source.id===created.taskId),ids.includes(submission.body.receipt),'a successful in-window capture includes both the new task and its receipt, or neither')
 }
 const replay=await Promise.all([member.post(forms[1].base+'/submit',newInput),member.post(forms[1].base+'/submit',newInput)])
 for(const r of replay){assert.equal(r.status,200);assert.equal(r.body.receipt,submission.body.receipt)}
 // Use the observed receipt day rather than assuming a wall-clock day or date boundary.
 const dayParts=new Intl.DateTimeFormat('en-US',{timeZone:['America','New_York'].join('/'),year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(submission.body.submittedAt)
 const part=name=>dayParts.find(p=>p.type===name).value
 const today=part('year')+'-'+part('month')+'-'+part('day')
 const current=await alternate({start:today,end:today})
 assert.equal(receiptRows(current).filter(row=>row.id===submission.body.receipt).length,1,'concurrent replay contributes exactly once')
 await ok(owner.post(forms[0].base+'/revoke',{}))
 await ok(b.post(),404)
 assert.deepEqual((await ok(owner.get(download))).metrics,report.metrics,'closing publication retains already received work and frozen values')
 await w.restart()
 assert.deepEqual((await ok(owner.get(download))).metrics,report.metrics,'restart retains frozen receipt identities')
 const erase=await ok(owner.post('/api/v1/data/erasure-preview',{type:'task',id:c.taskId}))
 await ok(owner.post('/api/v1/data/erase',{type:'task',id:c.taskId,token:erase.token,confirm:true}))
 await ok(c.post(),410)
 for(const format of ['','?format=csv','?format=xlsx','?format=pdf'])await ok(owner.get(download+format),410)
 const fresh=await ok(owner.post(base+'/capture',{}))
 assert.ok(!JSON.stringify(fresh).includes(c.id)&&!JSON.stringify(fresh).includes(c.taskId),'erased task and retained replay witness never reappear in reports')
 console.log('PROBE PEG-018 receipt inclusion: public and internal submissions -> exact receipt and task IDs, replay once, legacy rows retained, six requests widgets reconcile')
 console.log('PROBE PEG-018 window and status: persisted instants -> 23-hour and 25-hour local DST days, alternate timezone and current status filter; frozen values unchanged')
 console.log('PROBE PEG-018 authority and privacy: selected-origin and task export doors -> hidden, moved and unselected origins excluded; revoked saved reads and downloads refused')
 console.log('PROBE PEG-018 export authority: readable origin and alternate task placement, then stricter workspace export floor -> saved JSON and all downloads 403, capture and new dashboard refused; restored authority retains frozen values')
 console.log('PROBE PEG-018 concurrency and restart: capture with submission and concurrent replay -> coherent capture or 409, one receipt, frozen restart read')
 console.log('PROBE PEG-018 erasure: erase mapped task then replay and download -> 410; fresh capture excludes receipt and task')
 return {files,report}
}
