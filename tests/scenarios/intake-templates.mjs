import assert from 'node:assert/strict'
import {restoreCanvasInstallation,exportCanvasInstallation} from '../support/canvas-restore.mjs'
import {archiveRows} from './intake-erasure.mjs'
export const pass=async(call,status=200)=>{const r=await call;assert.equal(r.status,status,JSON.stringify(r.body));return r.body}
export async function intakeTemplateFixture(w){
 const owner=w.owner,peer=await w.person(['synthetic-pegboard-7101','example.invalid'].join('@'),'Template designer')
 const project=await pass(owner.post('/api/v1/projects',{name:'Intake template work'}))
 await pass(owner.post('/api/v1/grants',{objectType:'project',objectId:project.id,granteeId:peer.id,level:'editor'}))
 await pass(owner.post(`/api/v1/projects/${project.id}/prefix`,{prefix:'PBT'}))
 const definition={kind:'task',description:'Plain nested work',roles:['Lead','Designer'],phases:['Work'],fields:[],rules:[],dependencies:[],tasks:[
  {key:'root',title:'Template root',phase:'Work',role:'Lead',start:0,due:4,hours:2,fields:{}},
  {key:'draft',title:'Create draft',phase:'Work',role:'Designer',start:1,due:2,hours:3,parent:'root',fields:{}},
  {key:'check',title:'Check draft',phase:'Work',role:'Lead',start:3,due:4,hours:1,parent:'draft',fields:{}}
 ]}
 const template=await pass(owner.post('/api/v1/templates',{name:'Creative task',definition,authorityProjectId:project.id}))
 const config={name:'Template request',fields:[{id:'title',label:'Request title',required:true},{id:'details',label:'Details',required:true}],mapping:{title:'title',description:['details'],ownerId:owner.id,priority:'high'},hours:8,template:{id:template.id,version:1}}
 const form=await pass(owner.post(`/api/v1/projects/${project.id}/intake/forms`,config)),base=`/api/v1/intake/forms/${form.id}`
 const review=await pass(owner.get(base+'/review'))
 await pass(owner.post(base+'/publish',{version:1,review:review.review,audience:'public',consent:true}),400)
 await pass(owner.post(base+'/publish',{version:1,review:review.review,audience:'internal',consent:true}))
 const answers={title:'Keep this original request',details:'Retain every answer <script> as inert text'}
 const send=async key=>{
  const receipt=await pass(owner.post(base+'/submit',{version:1,requestKey:'synthetic-pegboard-'+key,answers}))
  const queue=await pass(owner.get(`/api/v1/projects/${project.id}/intake`)),item=queue.items.find(i=>i.id===receipt.receipt)
  return {...receipt,taskId:item.taskId,path:`/api/v1/intake/submissions/${receipt.receipt}/template`}
 }
 const input={startDate:'2026-01-05',roles:{Lead:owner.id,Designer:peer.id}}
 return {owner,peer,project,definition,template,config,form,base,answers,send,input}
}
export async function intakeTemplatesScenario(w){
 const f=await intakeTemplateFixture(w),{owner,peer,project,input}=f,item=await f.send('7102')
 const before=archiveRows(await exportCanvasInstallation(owner)),count=(rows,table)=>rows.filter(r=>r.table===table).length
 let review=await pass(owner.post(item.path+'/preview',input))
 assert.equal(review.taskId,item.taskId);assert.deepEqual(review.answers,f.answers)
 assert.equal(review.deadline,item.deadline);assert.equal(review.submittedAt,item.submittedAt)
 assert.deepEqual(review.tasks.map(t=>[t.key,t.ownerId,t.startDate,t.dueDate,t.hours,t.parent??null]),[['root',owner.id,'2026-01-05','2026-01-09',2,null],['draft',peer.id,'2026-01-06','2026-01-07',3,'root'],['check',owner.id,'2026-01-08','2026-01-09',1,'draft']])
 assert.equal((await pass(owner.get('/api/v1/tasks/'+item.taskId))).subtasks.length,0,'preview creates nothing')
 await pass(peer.post(item.path+'/apply',{...input,token:review.token,confirm:true}),403)
 await pass(owner.post(item.path+'/apply',{...input,token:review.token}),409)
 await pass(owner.patch('/api/v1/tasks/'+item.taskId,{priority:'urgent'}))
 await pass(owner.post(item.path+'/apply',{...input,token:review.token,confirm:true}),409)
 review=await pass(owner.post(item.path+'/preview',input))
 await pass(owner.post(`/api/v1/intake/submissions/${item.receipt}/triage`,{}))
 await pass(owner.post(item.path+'/apply',{...input,token:review.token,confirm:true}),409)
 review=await pass(owner.post(item.path+'/preview',input))
 const command={...input,token:review.token,confirm:true}
 const responses=await Promise.all([owner.post(item.path+'/apply',command),owner.post(item.path+'/apply',command)])
 assert.ok(responses.every(r=>[200,409].includes(r.status)),JSON.stringify(responses))
 const result=responses.find(r=>r.status===200).body
 const replay=await pass(owner.post(item.path+'/apply',command));assert.deepEqual(replay.taskIds,result.taskIds);assert.equal(replay.replayed,true)
 await pass(owner.post(item.path+'/apply',{...command,roles:{...input.roles,Lead:peer.id}}),409)
 const root=await pass(owner.get('/api/v1/tasks/'+item.taskId)),draft=await pass(owner.get('/api/v1/tasks/'+root.subtasks[0].id)),check=await pass(owner.get('/api/v1/tasks/'+draft.subtasks[0].id))
 assert.deepEqual(new Set(result.taskIds),new Set([item.taskId,draft.id,check.id]))
 assert.equal(root.ref,'PBT-1');assert.equal(draft.ref,'PBT-2');assert.equal(check.ref,'PBT-3')
 assert.equal(root.title,f.answers.title);assert.equal(root.description,'Details: '+f.answers.details);assert.equal(root.priority,'urgent')
 for(const [task,parent,person,start,due,hours]of [[root,null,owner.id,'2026-01-05','2026-01-09',2],[draft,root.id,peer.id,'2026-01-06','2026-01-07',3],[check,draft.id,owner.id,'2026-01-08','2026-01-09',1]]){
  assert.equal(task.parentId,parent);assert.equal(task.owner.id,person);assert.equal(task.startDate,start);assert.equal(task.dueDate,due);assert.equal(task.estimateHours,hours)
 }
 assert.ok(root.history.some(h=>h.kind==='intake.template_applied'&&h.actor===owner.name))
 const queue=await pass(owner.get(`/api/v1/projects/${project.id}/intake`)),after=queue.items.find(i=>i.id===item.receipt)
 assert.equal(after.taskId,item.taskId);assert.equal(after.deadline,item.deadline);assert.equal(after.submittedAt,item.submittedAt);assert.equal(after.state,'triaged')
 const audit=await pass(owner.get('/api/v1/admin/audit?action=intake.template_applied'))
 assert.equal(audit.events.length,1);assert.equal(audit.events[0].metadata.operationId,result.applicationId);assert.equal(audit.events[0].metadata.sourceId,item.receipt);assert.equal(audit.events[0].metadata.templateId,f.template.id);assert.equal(audit.events[0].metadata.version,1)
 assert.ok(!JSON.stringify(audit).includes(f.answers.title));assert.ok(!JSON.stringify(audit).includes(f.answers.details))
 await w.restart();assert.equal((await pass(owner.post(item.path+'/apply',command))).replayed,true)
 const archive=await exportCanvasInstallation(owner),rows=archiveRows(archive)
 const mapped=rows.filter(r=>r.table==='peg_intake_template_applications').map(r=>r.value??r.row)
 // Inspect the native archive rather than infer custody from policy declarations.
 assert.deepEqual(mapped.map(r=>[r.id,r.submission_id,r.template_id,r.template_version,r.state]),[[result.applicationId,item.receipt,f.template.id,1,'inactive']])
 for(const table of ['peg_projects','peg_grants','peg_task_decisions','peg_local_rules','peg_template_rules'])assert.equal(count(rows,table),count(before,table),table+' unchanged')
 assert.equal(count(rows,'peg_tasks'),count(before,'peg_tasks')+2)
 const originRows=rows.filter(r=>r.table==='peg_intake_template_tasks').map(r=>r.row)
 assert.deepEqual(new Set(originRows.map(r=>r.task_id)),new Set(result.taskIds))
 const submissionRow=rows.find(r=>r.table==='peg_intake_submissions'&&r.row.id===item.receipt).row
 assert.deepEqual(JSON.parse(submissionRow.answers),f.answers);assert.deepEqual(JSON.parse(submissionRow.template_pin),{id:f.template.id,version:1})
 const restored=await restoreCanvasInstallation(owner)
 try{
  const task=await pass(restored.worker.owner.get('/api/v1/tasks/'+root.id));assert.equal(task.subtasks[0].id,draft.id)
  await pass(restored.worker.owner.post(item.path+'/apply',command),404)
  const restoredQueue=await pass(restored.worker.owner.get(`/api/v1/projects/${project.id}/intake`));assert.equal(restoredQueue.items[0].deadline,item.deadline)
 }finally{await restored.stop()}
 await intakeMappingErasure(w,f,item,result,draft)
 await intakeMappingAuthority(w,f)
 const safeInput={...input,roles:{Lead:owner.id,Designer:owner.id}},stale=await f.send('7103'),old=await pass(owner.post(stale.path+'/preview',safeInput))
 await pass(owner.post(`/api/v1/templates/${f.template.id}/versions`,{baseVersion:1,definition:{...f.definition,description:'Changed template'}}))
 await pass(owner.post(stale.path+'/apply',{...safeInput,token:old.token,confirm:true}),409)
 assert.equal((await pass(owner.get('/api/v1/tasks/'+stale.taskId))).subtasks.length,0)
 const refreshed=await pass(owner.post(stale.path+'/preview',safeInput));assert.equal(refreshed.version,1);assert.equal(refreshed.headVersion,2);assert.notEqual(refreshed.token,old.token)
 await pass(owner.post(f.base+'/revoke',{}))
 await pass(owner.post(stale.path+'/apply',{...safeInput,token:refreshed.token,confirm:true}),404)
 for(const change of [{kind:'project'},{rules:[{key:'rule',name:'Priority rule',trigger:'task_created',action:'set_priority',priority:'high'}]},{fields:[{key:'note',label:'Note',type:'text'}]},{tasks:f.definition.tasks.map((t,i)=>i===0?{...t,approval:true}:t)},{dependencies:[{predecessor:'draft',successor:'check',type:'fs',lag:0}]}]){
  const unsupported=await pass(owner.post('/api/v1/templates',{name:'Unsupported intake template',definition:{...f.definition,...change}}))
  await pass(owner.post(`/api/v1/projects/${project.id}/intake/forms`,{...f.config,template:{id:unsupported.id,version:1}}),400)
 }
 console.log('PROBE PEG-007 template mapping: internal submission preview and explicit apply -> original root and answers, two nested identities, exact owners and dates, one redacted audit and unchanged triage clock')
 console.log('PROBE PEG-007 stale and replay: changed task, triage and template; concurrent apply; restart -> stale refusals with no extra work and one attributable application')
 console.log('PROBE PEG-007 inactive archive: native export and restore -> same work identities and deadline, inactive publication and refused old application')
 return {f,item,result}
}

async function intakeMappingErasure(w,f,item,result,draft){
 const {owner,peer}=f,preview=()=>pass(owner.post('/api/v1/data/erasure-preview',{type:'person',id:peer.id})),erase=review=>pass(owner.post('/api/v1/data/erase',{type:'person',id:peer.id,token:review.token,confirm:true}))
 const active=await preview();assert.ok(active.blockers.includes('deactivate_person_before_erasure'));assert.ok(active.blockers.includes('transfer_owned_work_before_erasure'))
 await pass(owner.patch('/api/v1/tasks/'+draft.id,{ownerId:owner.id}))
 await pass(owner.post(`/api/v1/workspaces/ws_main/people/${peer.id}/account`,{status:'inactive'}))
 let review=await preview();assert.deepEqual(review.blockers,[]);assert.deepEqual(review.intake.mappings.map(r=>r.id),[result.applicationId]);assert.equal(review.counts.intake_template_redactions,1)
 const hold=await pass(owner.post('/api/v1/data/holds',{type:'task',id:draft.id,authority:'synthetic-pegboard-intake-custody',expiresAt:Date.now()+86400000}))
 await pass(owner.post('/api/v1/data/erase',{type:'person',id:peer.id,token:review.token,confirm:true}),409)
 const held=await preview();assert.ok(held.blockers.includes('active_legal_hold'));const retained=await erase(held);assert.equal(retained.outcome,'retained');assert.deepEqual(retained.counts,{})
 await pass(owner.post(`/api/v1/data/holds/${hold.id}/release`,{confirm:true}))
 review=await preview();const receipt=await erase(review);assert.equal(receipt.counts.intake_template_redactions,1);assert.deepEqual(receipt.intake.mappings,review.intake.mappings)
 const durable=await pass(owner.get('/api/v1/data/receipts/'+receipt.id));assert.equal(durable.applied,true);assert.equal(durable.counts.intake_template_redactions,1)
 const after=archiveRows(await exportCanvasInstallation(owner)),mapped=after.filter(r=>r.table==='peg_intake_template_tasks'&&r.row.application_id===result.applicationId)
 assert.equal(mapped.length,3);assert.ok(mapped.every(r=>r.row.owner_id!==peer.id&&r.row.before_owner!==peer.id))
 assert.equal(after.find(r=>r.table==='peg_intake_template_applications'&&r.row.id===result.applicationId).row.state,'inactive')
 assert.equal((await pass(owner.get('/api/v1/tasks/'+item.taskId))).subtasks[0].id,draft.id)
 console.log('PROBE PEG-007 mapping erasure: active and held person review -> retained; transferred deactivated person -> exact one mapping redaction and inactive replay witness with unchanged work')
}
async function intakeMappingAuthority(w,f){
 const {owner,project,config,input}=f,person=await w.person(['synthetic-pegboard-7104','example.invalid'].join('@'),'Intake publisher')
 await pass(owner.post(`/api/v1/workspaces/ws_main/people/${person.id}/account`,{role:'admin'}))
 const admin=await w.signIn(person.email,person.name,person.id)
 const form=await pass(admin.post(`/api/v1/projects/${project.id}/intake/forms`,config)),base=`/api/v1/intake/forms/${form.id}`
 const publication=await pass(admin.get(base+'/review'))
 await pass(admin.post(base+'/publish',{version:1,review:publication.review,audience:'internal',consent:true}))
 const receipt=await pass(owner.post(base+'/submit',{version:1,requestKey:'synthetic-pegboard-authority',answers:f.answers})),path=`/api/v1/intake/submissions/${receipt.receipt}/template`
 const queue=await pass(owner.get(`/api/v1/projects/${project.id}/intake`)),taskId=queue.items.find(r=>r.id===receipt.receipt).taskId
 const next={...input,roles:{Lead:owner.id,Designer:owner.id}},review=await pass(admin.post(path+'/preview',next))
 await pass(owner.post(`/api/v1/workspaces/ws_main/people/${person.id}/account`,{status:'inactive'}))
 await pass(admin.post(path+'/apply',{...next,token:review.token,confirm:true}),401)
 await pass(owner.post(path+'/apply',{...next,token:review.token,confirm:true}),404)
 await pass(owner.post(`/api/v1/workspaces/ws_main/people/${person.id}/account`,{status:'active'}))
 await pass(owner.post(path+'/preview',next),404)
 assert.equal((await pass(owner.get('/api/v1/tasks/'+taskId))).subtasks.length,0)
 console.log('PROBE PEG-007 revoked authority: publisher and reviewer deactivated then renewed -> old session and publication refused without nested work or revived authority')
}
