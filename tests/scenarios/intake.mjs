import assert from 'node:assert/strict'
// Independently integrate elapsed productive time from the route's receipt, rather than
// calculating its deadline with the application's scheduling implementation.
function productiveHours(from,to,calendar) {
 const formatter=new Intl.DateTimeFormat('en-US',{timeZone:calendar.zone,weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'})
 const holidays=new Set(),day=86400000,year=new Date(from).getUTCFullYear()
 for(const y of [year-1,year,year+1]){
  for(const [month,date]of [[1,1],[6,19],[7,4],[11,11],[12,25]]){let at=Date.UTC(y,month-1,date),weekday=new Date(at).getUTCDay();at+=weekday===6?-day:weekday===0?day:0;holidays.add(new Date(at).toISOString().slice(0,10))}
 }
 const weekdays=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];let productive=0
 for(let at=Math.floor(from/1000)*1000;at<to;){
  const next=Math.min(to,(Math.floor(at/60000)+1)*60000),p=Object.fromEntries(formatter.formatToParts(at).map(x=>[x.type,x.value]))
  const weekday=weekdays.indexOf(p.weekday),month=Number(p.month),date=Number(p.day),minute=Number(p.hour)*60+Number(p.minute),dateKey=p.year+'-'+p.month+'-'+p.day
  const floatingHoliday=weekday===1&&((month===1||month===2)&&date>=15&&date<=21||month===5&&date>=25||month===9&&date<=7||month===10&&date>=8&&date<=14)||month===11&&weekday===4&&date>=22&&date<=28
  const hours=calendar.week[weekday]
  if(hours&&minute>=hours.start&&minute<hours.end&&!holidays.has(dateKey)&&!floatingHoliday)productive+=next-at
  at=next
 }
 return productive/3600000
}
export async function intakeScenario(w) {
 const owner=w.owner,ok=async(p,status=200)=>{const r=await p;assert.equal(r.status,status,JSON.stringify(r.body));return r.body}
 const project=await ok(owner.post('/api/v1/projects',{name:'synthetic-pegboard-intake-private'}))
 const peer=await w.person(['synthetic-pegboard-1','example.com'].join('@'),'Intake editor')
 const guest=await w.person(['synthetic-pegboard-2','example.com'].join('@'),'Intake guest','guest')
 await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:project.id,granteeId:peer.id,level:'editor'}))
 const secret=await ok(owner.post('/api/v1/tasks',{projectId:project.id,title:'synthetic-pegboard-private-title',internalNotes:'synthetic-pegboard-private-note'}))
 const config={name:'Creative request',fields:[{id:'title',label:'Request title',required:true},{id:'kind',label:'Request type',required:true,choices:['Design','Other']},{id:'details',label:'Design details',required:true,when:{field:'kind',equals:'Design'}}],mapping:{title:'title',description:['kind','details'],ownerId:peer.id,priority:'high'},hours:8}
 const forms=`/api/v1/projects/${project.id}/intake/forms`
 await ok(peer.post(forms,config),403)
 await ok(owner.post(forms,{...config,mapping:{...config.mapping,description:[]}}),400)
 assert.equal((await ok(owner.get(forms))).length,0,'a form cannot acknowledge answers it would discard')
 const form=await ok(owner.post(forms,config)),base=`/api/v1/intake/forms/${form.id}`
 const review=await ok(owner.get(base+'/review'))
 await ok(owner.post(base+'/publish',{version:form.version,review:review.review,audience:'public'}),409)
 await ok(peer.post(base+'/publish',{version:form.version,review:review.review,audience:'public',consent:true}),403)
 const publish=await ok(owner.post(base+'/publish',{version:form.version,review:review.review,audience:'public',consent:true}))
 assert.ok(publish.capability)
 const publicPath='/api/v1/public-intake/'+publish.capability
 const call=async(method,path,input,headers={})=>{const r=await fetch(w.origin+path,{method,headers:{origin:w.origin,...(input?{'content-type':'application/json'}:{}),...headers},...(input?{body:JSON.stringify(input)}:{})});return {status:r.status,body:await r.json()}}
 const publicPost=input=>call('POST',publicPath,input)
 const safe=await ok(call('GET',publicPath))
 assert.deepEqual(Object.keys(safe).sort(),['attachments','fields','id','name','version'])
 const serialized=JSON.stringify(safe)
 for(const value of [project.id,project.name,owner.id,peer.id,secret.id,'synthetic-pegboard-private-note'])assert.ok(!serialized.includes(value))
 assert.ok(!JSON.stringify(await ok(owner.get(forms))).includes(publish.capability))
 await ok(guest.get(base),404)
 await ok(call('GET','/api/v1/projects/'+project.id),401)
 await ok(publicPost({version:form.version,requestKey:'missing-detail-1',answers:{title:'Incomplete',kind:'Design'}}),400)
 await ok(publicPost({version:form.version,requestKey:'hidden-detail-1',answers:{title:'Hidden branch',kind:'Other',details:'must not sneak through'}}),400)
 await ok(publicPost({version:form.version,requestKey:'unknown-answer-1',answers:{title:'Unknown field',kind:'Other',internalNotes:'attack'}}),400)
 await ok(publicPost({version:form.version,requestKey:'unsupported-file-1',answers:{title:'File',kind:'Other'},attachments:[{name:'example.txt'}]}),400)
 await ok(publicPost({version:form.version,requestKey:'malformed-answer-1',answers:{title:{html:'unsafe'},kind:'Other'}}),400)
 await ok(publicPost({version:form.version,requestKey:'honeypot-request-1',answers:{title:'Robot',kind:'Other'},website:'filled'}),400)
 await ok(publicPost({version:form.version-1,requestKey:'old-version-1',answers:{title:'Old version',kind:'Other'}}),409)
 await ok(call('POST',publicPath,{version:form.version,requestKey:'cross-origin-1',answers:{title:'Cross origin',kind:'Other'}},{origin:'https://example.invalid'}),403)
 const before=(await ok(owner.get(`/api/v1/projects/${project.id}`))).columns.flatMap(c=>c.tasks).map(t=>t.id)
 assert.deepEqual(before,[secret.id])
 const input={version:form.version,requestKey:'synthetic-pegboard-concurrent-1',answers:{title:'Public creative request',kind:'Design',details:'Treat <script> as inert text'}}
 const receipts=await Promise.all(Array.from({length:3},()=>publicPost(input).then(r=>{assert.equal(r.status,200,JSON.stringify(r.body));return r.body})))
 assert.equal(new Set(receipts.map(r=>r.receipt)).size,1)
 assert.equal(receipts.filter(r=>!r.replayed).length,1)
 assert.deepEqual(Object.keys(receipts[0]).sort(),['acknowledgment','deadline','receipt','replayed','submittedAt'])
 let queue=await ok(owner.get(`/api/v1/projects/${project.id}/intake`))
 assert.equal(queue.items.length,1)
 const item=queue.items[0],task=await ok(owner.get('/api/v1/tasks/'+item.taskId))
 assert.equal(task.id,item.taskId);assert.equal(task.title,input.answers.title);assert.equal(task.priority,'high');assert.equal(task.owner.id,peer.id)
 assert.equal(task.description,'Request type: Design\nDesign details: Treat <script> as inert text')
 assert.ok(task.history.some(h=>h.kind==='created'&&h.actor==='Public intake'))
 assert.ok(task.history.some(h=>h.kind==='intake.submitted'))
 assert.ok(receipts[0].deadline>receipts[0].submittedAt)
 assert.equal(productiveHours(receipts[0].submittedAt,receipts[0].deadline,review.calendar),config.hours,'receipt deadline contains exactly the reviewed productive hours')
 assert.equal(item.deadline,receipts[0].deadline);assert.equal(item.state,'waiting')
 await ok(publicPost({...input,answers:{...input.answers,title:'Changed replay'}}),409)
 await w.restart()
 assert.equal((await ok(publicPost(input))).receipt,receipts[0].receipt)
 await ok(owner.post('/api/v1/workspaces/ws_main/working-calendar',{zone:['America','Chicago'].join('/'),week:Array.from({length:7},()=>({start:660,end:720}))}))
 const internal=await ok(peer.post(base+'/submit',{version:form.version,requestKey:'internal-branch-request-1',answers:{title:'Internal other request',kind:'Other'}}))
 assert.equal(internal.acknowledgment,'Request received')
 assert.equal(productiveHours(internal.submittedAt,internal.deadline,review.calendar),config.hours,'later calendar edits do not silently change the published triage policy')
 await ok(peer.post(base+'/submit',{version:form.version,requestKey:'internal-file-request-1',answers:{title:'Not accepted',kind:'Other'},attachments:[]}),400)
 const fileResponse=await fetch(w.origin+publicPath,{method:'POST',headers:{origin:w.origin},body:(()=>{const f=new FormData();f.set('file',new Blob(['actual bytes']),'example.txt');return f})()})
 assert.equal(fileResponse.status,415)
 // Clock movement is the only fixture-only store edit; assertions read the ordinary triage route.
 await w.sql(`UPDATE peg_intake_submissions SET deadline=1 WHERE id='${item.id}'`)
 queue=await ok(peer.get(`/api/v1/projects/${project.id}/intake`))
 assert.equal(queue.items.find(r=>r.id===item.id).state,'overdue')
 assert.equal(queue.items.find(r=>r.id===item.id).escalation,'Project administrator attention required')
 await ok(guest.post(`/api/v1/intake/submissions/${item.id}/triage`,{}),404)
 await ok(peer.post(`/api/v1/intake/submissions/${item.id}/triage`,{}))
 assert.equal((await ok(owner.get(`/api/v1/projects/${project.id}/intake`))).items.find(r=>r.id===item.id).state,'triaged')
 const erasure=await ok(owner.post('/api/v1/data/erasure-preview',{type:'task',id:item.taskId}))
 await ok(owner.post('/api/v1/data/erase',{type:'task',id:item.taskId,token:erasure.token,confirm:true}))
 await ok(publicPost(input),410)
 await ok(owner.get('/api/v1/tasks/'+item.taskId),404)
 await ok(owner.post(base+'/revoke',{}))
 await ok(publicPost(input),404)
 // A new publication is never allowed to revive a prior capability.
 const nextReview=await ok(owner.get(base+'/review'))
 const next=await ok(owner.post(base+'/publish',{version:form.version,review:nextReview.review,audience:'public',consent:true}))
 assert.notEqual(next.capability,publish.capability)
 await ok(publicPost(input),404)
 const newer=await ok(owner.post(base+'/draft',{...config,version:form.version,name:'Revised request'}))
 assert.equal(newer.version,2)
 await ok(call('POST','/api/v1/public-intake/'+next.capability,input),404)
 await ok(peer.post(base+'/submit',input),404)
 const updatedReview=await ok(owner.get(base+'/review'))
 const final=await ok(owner.post(base+'/publish',{version:newer.version,review:updatedReview.review,audience:'public',consent:true}))
 const finalPath='/api/v1/public-intake/'+final.capability
 await ok(call('POST',finalPath,input),409)
 await ok(call('POST',finalPath,{version:2,requestKey:'forged-identity-1',answers:{title:'No impersonation',kind:'Other'},ownerId:owner.id}),400)
 await ok(call('POST',finalPath,{version:2,requestKey:'oversize-request-1',answers:{title:'Oversized',kind:'Other',details:'x'.repeat(25000)}}),413)
 const malformed=await fetch(w.origin+finalPath,{method:'POST',headers:{origin:w.origin,'content-type':'application/json'},body:'{'})
 assert.equal(malformed.status,400)
 // Abuse attempts consume a durable per-capability window without creating work.
 let throttled=false
 for(let i=0;i<24;i++){const r=await call('POST',finalPath,{version:2,requestKey:'abuse-request-'+i,answers:{title:'',kind:'Other'}});if(r.status===429){throttled=true;break}assert.equal(r.status,400)}
 assert.ok(throttled)
 // A publisher who loses administrator authority cannot revive old publication by regaining it.
 let admin=await w.person(['synthetic-pegboard-3','example.com'].join('@'),'Intake publisher')
 await ok(owner.post(`/api/v1/workspaces/ws_main/people/${admin.id}/account`,{role:'admin'}))
 admin=await w.signIn(admin.email,admin.name,admin.id)
 const adminReview=await ok(admin.get(base+'/review'))
 const adminPublication=await ok(admin.post(base+'/publish',{version:2,review:adminReview.review,audience:'public',consent:true}))
 await ok(owner.post(`/api/v1/workspaces/ws_main/people/${admin.id}/account`,{role:'member'}))
 const revokedPath='/api/v1/public-intake/'+adminPublication.capability
 await ok(call('POST',revokedPath,{version:2,requestKey:'lost-authority-1',answers:{title:'No task',kind:'Other'}}),404)
 await ok(owner.post(`/api/v1/workspaces/ws_main/people/${admin.id}/account`,{role:'admin'}))
 await ok(call('POST',revokedPath,{version:2,requestKey:'restored-authority-1',answers:{title:'Still no task',kind:'Other'}}),404)
 const after=await ok(owner.get(`/api/v1/projects/${project.id}`))
 assert.equal(after.columns.flatMap(c=>c.tasks).length,2)
 const projectErasure=await ok(owner.post('/api/v1/data/erasure-preview',{type:'project',id:project.id}))
 await ok(owner.post('/api/v1/data/erase',{type:'project',id:project.id,token:projectErasure.token,confirm:true}))
 await ok(owner.get(base+'/review'),404)
 await ok(call('GET',revokedPath),404)
 await ok(owner.get('/api/v1/projects/'+project.id),404)
 console.log('PROBE PEG-007 branching validation: internal and public form routes -> mapped title, fixed owner and priority, hidden branch refused')
 console.log('PROBE PEG-007 replay: concurrent and restarted submission routes -> one receipt and one exact task ID')
 console.log('PROBE PEG-007 business hours: receipt deadlines -> exactly eight reviewed working hours, unchanged by later calendar edits')
 console.log('PROBE PEG-007 triage: queue and triage routes -> waiting, visible overdue escalation, then triaged')
 console.log('PROBE PEG-007 erasure and authority: replay of erased task and old publication after publisher role renewal -> refused without work creation')
 console.log('PROBE PEG-007 privacy: anonymous routes -> prompts and receipt only; private work, identity claims, attachments, stale and revoked publication refused')
 await retainedAnswersScenario(w,ok,call)
 return {project,form,item}
}

async function retainedAnswersScenario(w,ok,call) {
 const project=await ok(w.owner.post('/api/v1/projects',{name:'synthetic-pegboard-retained-intake'}))
 const details=Array.from({length:5},(_,i)=>({id:'detail'+i,label:('Question '+i+' ').padEnd(120,'q'),required:true}))
 const config={name:'Long text request',fields:[{id:'title',label:'Request title',required:true},...details],mapping:{title:'title',description:details.map(f=>f.id),ownerId:w.owner.id,priority:'normal'},hours:8}
 const form=await ok(w.owner.post(`/api/v1/projects/${project.id}/intake/forms`,config)),base=`/api/v1/intake/forms/${form.id}`
 const review=await ok(w.owner.get(base+'/review'))
 const publication=await ok(w.owner.post(base+'/publish',{version:form.version,review:review.review,audience:'public',consent:true}))
 const path='/api/v1/public-intake/'+publication.capability
 const answers={title:'Retain every requested answer',...Object.fromEntries(details.map((field,i)=>[field.id,('Answer '+i+' ').padEnd(3880,'x')+' synthetic-pegboard-end']))}
 const input={version:form.version,requestKey:'synthetic-pegboard-long-public',answers}
 // The wire payload fits, but adding the reviewed question labels would overflow the task description.
 assert.ok(Buffer.byteLength(JSON.stringify(input))<20000)
 await ok(call('POST',path,input),400)
 await ok(w.owner.post(base+'/submit',{...input,requestKey:'synthetic-pegboard-long-internal'}),400)
 assert.deepEqual((await ok(w.owner.get(`/api/v1/projects/${project.id}/intake`))).items,[],'neither intake door acknowledges a task that would lose answers')
 const accepted={...answers,[details.at(-1).id]:'synthetic-pegboard-complete-final-answer'}
 const receipt=await ok(call('POST',path,{...input,requestKey:'synthetic-pegboard-complete-public',answers:accepted}))
 const queue=await ok(w.owner.get(`/api/v1/projects/${project.id}/intake`))
 assert.deepEqual(queue.items.map(item=>item.id),[receipt.receipt])
 const task=await ok(w.owner.get('/api/v1/tasks/'+queue.items[0].taskId))
 assert.equal(task.description,details.map(field=>field.label+': '+accepted[field.id]).join('\n'))
 const internal=await ok(w.owner.post(base+'/submit',{...input,requestKey:'synthetic-pegboard-complete-internal',answers:accepted}))
 const internalQueue=await ok(w.owner.get(`/api/v1/projects/${project.id}/intake`))
 const internalTask=await ok(w.owner.get('/api/v1/tasks/'+internalQueue.items.find(item=>item.id===internal.receipt).taskId))
 assert.equal(internalTask.description,task.description)
 assert.equal((await ok(w.owner.get(`/api/v1/projects/${project.id}`))).columns.flatMap(column=>column.tasks).length,2)
 console.log('PROBE PEG-007 retained answers: public and internal submission routes -> oversized mappings refused with no task; fitting mappings preserve every answer exactly')
}
