import {excludedTable} from '@runeditrun/rer/modules/portability'
import policy from '../../src/pegboard/portability/policy.mjs'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { proofDocument, Client } from '../support/worker.mjs'
import { restoreCanvasInstallation } from '../support/canvas-restore.mjs'

const pass=async(request,status=200)=>{const r=await request;assert.equal(r.status,status,JSON.stringify(r.body));return r.body}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const parse=text=>{const records=text.trim().split('\n').map(line=>JSON.parse(line));return {manifest:records[0],parts:records.filter(r=>r.kind==='part'),closing:records.at(-1),rows:records.filter(r=>r.kind==='part').flatMap(r=>r.items).filter(r=>r.kind==='row')}}
const rows=(archive,table)=>archive.rows.filter(r=>r.table===table).map(r=>r.row)
const address=n=>['synthetic-pegboard-'+n,'example.test'].join('@')
const quote=value=>"'"+String(value).replaceAll("'","''")+"'"

export async function exportInstallation(w,{interrupt=false}={}){
 const owner=w.owner,job=await pass(owner.post('/api/portability/exports',{}),201)
 const initial=await pass(owner.post(`/api/portability/exports/${job.id}/advance`,{maxParts:1,expectedPart:0}))
 assert.equal(initial.completed,1)
 if(interrupt){await w.restart();assert.equal((await pass(owner.get(`/api/portability/exports/${job.id}`))).completed,1)}
 // Retrying an acknowledged cursor must not append another part.
 assert.equal((await pass(owner.post(`/api/portability/exports/${job.id}/advance`,{maxParts:1,expectedPart:0}))).completed,1)
 for(let i=0;i<100;i++){
  const status=await pass(owner.post(`/api/portability/exports/${job.id}/advance`,{maxParts:16}))
  if(status.phase==='complete')return {id:job.id,text:await pass(owner.get(`/api/portability/exports/${job.id}/download`))}
 }
 assert.fail('archive did not complete')
}

export function registerArchiveCustodyTests({test,context}){
 test('reconciles complete database archives through native transfer and CLI restore with inactive authority and atomic refusals',async()=>{
  const {w,services,mailOrigin,mailCalls}=context(),owner=w.owner,scale=process.env.PEGBOARD_ARCHIVE_SCALE==='1',members=scale?500:12,tasks=scale?10000:40
  const member=await w.person(address(5801),'Archive member'),guest=await w.person(address(5802),'Archive guest','guest')
  const project=await pass(owner.post('/api/v1/projects',{name:'Archive project'})),other=await pass(owner.post('/api/v1/projects',{name:'Archive shared project'}))
  const task=await pass(owner.post('/api/v1/tasks',{projectId:project.id,title:'Retained archive work',description:'Retained body',ownerId:owner.id,dueDate:'2026-03-20'}))
  await pass(owner.post(`/api/v1/tasks/${task.id}/projects`,{projectId:other.id}))
  await pass(owner.post(`/api/v1/tasks/${task.id}/comments`,{body:'Retained attributable comment'}))
  const privateTask=await pass(member.post('/api/v1/tasks',{title:'Private archive custody',ownerId:member.id}))
  const grant=await pass(owner.post('/api/v1/grants',{objectType:'project',objectId:project.id,granteeId:guest.id,level:'commenter'}))
  const files=[]
  for(let version=1;version<=2;version++){
   const bytes=proofDocument('Retained real database proof '+version),file=await pass(owner.post(`/api/v1/tasks/${task.id}/attachments?name=synthetic-pegboard-58${version}.pdf`,bytes,{'content-type':'application/pdf'}))
   files.push({...file,bytes,digest:sha(bytes)})
  }
  const proof=await pass(owner.post(`/api/v1/tasks/${task.id}/proofs`,{attachmentId:files[0].id}))
  await pass(owner.post(`/api/v1/proofs/${proof.id}/versions`,{attachmentId:files[1].id,currentVersion:proof.versionId}))
  await pass(owner.post('/api/v1/grants',{objectType:'task',objectId:task.id,granteeId:guest.id,level:'viewer',scope:'approve'}))
  const routing={mode:'parallel',stages:[{name:'Archive review',people:[guest.id],quorum:1}],reminderAt:1}
  const routePreview=await pass(owner.post(`/api/v1/approval-routing/proof/${proof.id}/preview`,routing))
  const route=await pass(owner.post(`/api/v1/approval-routing/proof/${proof.id}`,{...routing,token:routePreview.token}))
  const routeView=await pass(owner.get('/api/v1/approvals/'+route.id))
  const link=await pass(owner.post(`/api/v1/approvals/${route.id}/share`,{recipientId:guest.id,token:routeView.token,expiresAt:Date.now()+3600000}))
  const oldReview=await pass(guest.get('/api/v1/proof-reviews/'+link.id));assert.equal(oldReview.state,'pending')
  const recurrenceInput={sourceType:'task',sourceId:task.id,mode:'calendar',timezone:'America/New_York',unit:'week',interval:1,start:'2026-03-08',count:1}
  const recurrencePreview=await pass(owner.post('/api/v1/recurrences/preview',recurrenceInput))
  const recurrence=await pass(owner.post('/api/v1/recurrences',{...recurrenceInput,revision:recurrencePreview.token}))
  const bundle=await pass(owner.post('/api/v1/workflow-bundles',{name:'Archive bundle'}))
  await pass(member.post('/api/v1/access-requests',{targetId:project.id,level:'viewer'}))
  const request=(await pass(owner.get('/api/v1/access-requests'))).toDecide.find(r=>r.targetId===project.id)
  assert.ok(request,'a real pending source access decision exists')
  const connection=await pass(owner.post('/api/v1/workspaces/ws_main/calendars',{service:'google',calendarId:'synthetic-pegboard-250',credential:'synthetic-pegboard-251',consent:true}))
  const preview=await pass(owner.post(`/api/v1/tasks/${task.id}/calendar-preview`,{connectionId:connection.id,date:'2026-03-09',minutes:60,credential:'synthetic-pegboard-251'}))
  const block=await pass(owner.post(`/api/v1/calendar-previews/${preview.id}/apply`,{slot:0,credential:'synthetic-pegboard-251'}))
  const rule=await pass(owner.post(`/api/v1/projects/${project.id}/rules`,{name:'Archive rule',trigger:'status',status:'doing',priority:'urgent',source:'fixed',fixedDate:'2026-03-12'}))
  const review=await pass(owner.post(`/api/v1/rules/${rule.id}/preview`,{}));await pass(owner.post(`/api/v1/rules/${rule.id}/activate`,{token:review.token}))
  const key=await pass(owner.post('/api/v1/api-keys',{name:'Archive key',projects:[project.id],writable:true,consent:true,expiresAt:Date.now()+3600000}))
  // Fixture size is input to the public archive door, not a parallel implementation.
  await w.sql(`WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<${members-2}) INSERT INTO oa_operators(id,email,display_name,role,status,created_at) SELECT 'synthetic-pegboard-member-'||x,'synthetic-pegboard-5800'||x||char(64)||'example.test','Archive member '||x,'member','active',1 FROM n;
  INSERT INTO peg_workspace_members(workspace_id,operator_id,role,created_by,created_at) SELECT 'ws_main',id,'member',${quote(owner.id)},1 FROM oa_operators WHERE id LIKE 'synthetic-pegboard-member-%';
  WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<${tasks-1}) INSERT INTO peg_tasks(id,workspace_id,title,description,owner_id,creator_id,created_at,updated_at) SELECT 'synthetic-pegboard-task-'||x,'ws_main','Archive work '||x,'Retained source row '||x,${quote(owner.id)},${quote(owner.id)},1,1 FROM n;
  INSERT INTO peg_task_projects(task_id,project_id,added_by,added_at) SELECT id,${quote(project.id)},${quote(owner.id)},1 FROM peg_tasks WHERE id LIKE 'synthetic-pegboard-task-%';
  INSERT INTO peg_history(task_id,project_id,actor_id,kind,detail,at) SELECT id,${quote(project.id)},${quote(owner.id)},'created','{}',1 FROM peg_tasks WHERE id LIKE 'synthetic-pegboard-task-%';
  INSERT INTO peg_local_rule_runs(id,rule_id,event_id,task_id,version,definition,activation_id,activated_by,source,status,created_at) SELECT 'synthetic-pegboard-5803',id,'synthetic-pegboard-5804',${quote(task.id)},version,definition,activation_id,activated_by,'{}','queued',1 FROM peg_local_rules WHERE id=${quote(rule.id)};
  INSERT INTO peg_bundle_jobs(id,bundle_id,project_id,item_key,task_id,epoch,config,actor_id,status,created_at) VALUES('synthetic-pegboard-5805',${quote(bundle.id)},${quote(project.id)},'archive-rule',${quote(task.id)},1,'{}',${quote(owner.id)},'pending',1);`)
  assert.equal((await pass(owner.get('/api/v1/workspaces/ws_main/people'))).people.length,members+1)
  const discovered=JSON.parse(await w.sql("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"))[0].results.map(row=>row.name).filter(name=>!excludedTable(name,policy)).sort()
  console.log('Archive fixture ready: '+members+' members and '+tasks+' project tasks')
  const exported=await exportInstallation(w,{interrupt:true}),archive=parse(exported.text)
  assert.deepEqual(archive.manifest.tables.map(t=>t.name),discovered,'every current portable store appears in the manifest')
  console.log('Archive exported: '+archive.parts.length+' resumable parts')
  assert.equal(rows(archive,'peg_tasks').length,tasks+1,'project tasks plus private work all travel')
  assert.equal(rows(archive,'peg_task_projects').filter(r=>r.project_id===project.id).length,tasks)
  assert.equal(rows(archive,'peg_workspace_members').length,members)
  assert.ok(rows(archive,'peg_tasks').some(r=>r.id===privateTask.id))
  const actualCounts=new Map(archive.manifest.tables.map(t=>[t.name,t.count]))
  for(const [table,count] of actualCounts)assert.equal(rows(archive,table).length,count,table+' declared count')
  const archivedTasks=new Map(rows(archive,'peg_tasks').map(t=>[t.id,t])),projectIds=new Set(rows(archive,'peg_projects').map(p=>p.id))
  for(let n=1;n<tasks;n++){
   const actual=archivedTasks.get('synthetic-pegboard-task-'+n)
   assert.equal(actual.title,'Archive work '+n);assert.equal(actual.description,'Retained source row '+n);assert.equal(actual.owner_id,owner.id)
  }
  for(const edge of rows(archive,'peg_task_projects')){assert.ok(archivedTasks.has(edge.task_id));assert.ok(projectIds.has(edge.project_id))}
  for(const file of files){const stored=rows(archive,'peg_attachments').find(r=>r.id===file.id);assert.equal(sha(Buffer.from(stored.data.blob,'base64')),file.digest);assert.equal(stored.size,file.bytes.length)}
  assert.equal(rows(archive,'peg_calendar_connections').find(r=>r.id===connection.id).active,0)
  assert.equal(rows(archive,'peg_calendar_blocks').find(r=>r.id===block.id).transaction_id,block.transaction_id)
  assert.equal(rows(archive,'peg_calendar_blocks').find(r=>r.id===block.id).event_id,block.event_id)
  for(const table of ['oa_tokens','oa_sessions','peg_api_keys','peg_calendar_previews'])assert.ok(!actualCounts.has(table),table+' source capability excluded')
  assert.ok(!exported.text.includes(key.secret)&&!exported.text.includes('synthetic-pegboard-251'))
  assert.ok(rows(archive,'peg_grants').every(r=>r.revoked_at!==null))
  assert.ok(rows(archive,'peg_local_rules').every(r=>r.enabled===0&&r.activation_id===null))
  assert.equal(rows(archive,'peg_local_rule_runs').find(r=>r.id==='synthetic-pegboard-5803').status,'pending')
  for(const actor of [member,guest]){
   await pass(actor.get(`/api/portability/exports/${exported.id}/download`),403)
   await pass(actor.get('/api/v1/data'),403)
   await pass(actor.post('/api/v1/data/archives',{}),403)
   await pass(actor.post(`/api/v1/data/archives/${exported.id}/advance`,{}),403)
  }
  // A corrupt part and a complete archive aimed at an occupied destination
  // leave the source product graph unchanged. Only transfer bookkeeping exists.
  const imported=await pass(owner.post('/api/portability/imports',{manifest:archive.manifest,confirmed:true}),201)
  const corrupt=structuredClone(archive.parts[0]);corrupt.sha256='0'.repeat(64)
  await pass(owner.call('PUT',`/api/portability/imports/${imported.id}/parts/0`,corrupt),400)
  for(const part of archive.parts)await pass(owner.call('PUT',`/api/portability/imports/${imported.id}/parts/${part.index}`,part))
  await w.restart()
  const refusal=await owner.post(`/api/portability/imports/${imported.id}/finalize`,archive.closing)
  assert.equal(refusal.status,409,JSON.stringify(refusal.body));assert.match(refusal.body.error,/target_not_empty/)
  assert.equal((await pass(owner.get(`/api/v1/tasks/${task.id}`))).title,'Retained archive work')
  await pass(owner.post(`/api/portability/imports/${imported.id}/abort`,{}))
  const afterRefusals=parse((await exportInstallation(w)).text)
  for(const table of archive.manifest.tables){
   if(table.name==='peg_permanent_audit')continue // Refusals retain their redacted operational audit.
   assert.deepEqual(rows(afterRefusals,table.name),rows(archive,table.name),table.name+' unchanged after unsafe imports')
  }

  console.log('Native occupied-destination and corrupt-part refusals passed')
  let copy
  const calls=services.state.google.calls.length,sends=mailCalls()
  try{
   copy=await restoreCanvasInstallation(owner,{archive:exported.text,roundTrip:true,interruptImport:scale,cliTimeout:scale?600000:180000,settings:{PEGBOARD_LOCAL_CALENDAR_ORIGINS:services.origins,PEGBOARD_LOCAL_APPROVAL_MAIL_ORIGIN:mailOrigin},
    async beforeImport({scratch,cli}){
     const corrupted=exported.text.replace(archive.parts[0].sha256,'0'.repeat(64));await writeFile(join(scratch,'exports/corrupt.rer'),corrupted,{mode:0o600})
     const refused=cli('import','--input','exports/corrupt.rer','--yes');assert.notEqual(refused.status,0);assert.match(refused.stdout+refused.stderr,/part_checksum/)
    },
    async afterImport({cli}){
     const refused=cli('import','--input','exports/canvas.rer','--yes');assert.equal(refused.status,4,refused.stdout+refused.stderr);assert.match(refused.stdout+refused.stderr,/target_not_empty/)
    }})
   console.log('Native CLI restore and re-export complete')
   const restored=parse(copy.roundTrip)
   assert.equal(restored.manifest.sourceIdentity,archive.manifest.sourceIdentity,'CLI round trip preserves the archive source identity')
   assert.equal(restored.manifest.epoch,archive.manifest.epoch,'CLI round trip preserves the erasure checkpoint')
   // Native CLI re-export retains every source row. Base deliberately advances
   // auth generation and appends its own restore audit; those are checked below.
   for(const table of archive.manifest.tables){
    const original=rows(archive,table.name),actual=rows(restored,table.name)
    if(table.name==='oa_auth_settings'){
     assert.equal(actual[0].generation,original[0].generation+1)
     assert.deepEqual(actual.map(({generation,...r})=>r),original.map(({generation,...r})=>r));continue
    }
    const additive=table.name==='peg_permanent_audit'
    assert.ok(additive?actual.length>=original.length:actual.length===original.length,table.name+' count')
    const images=new Set(actual.map(row=>JSON.stringify(row)))
    for(const row of original)assert.ok(images.has(JSON.stringify(row)),table.name+' exact row')
   }
   const root=copy.worker.owner
   await pass(root.get('/api/v1/tasks/'+privateTask.id),404)
   const restoredMember=await copy.worker.signIn(member.email,member.name,member.id)
   assert.equal((await pass(restoredMember.get('/api/v1/tasks/'+privateTask.id))).title,'Private archive custody')
   const oldSession=new Client(copy.worker.origin,owner.cookie,'old session');await pass(oldSession.get('/api/v1/me'),401)
   const oldKey=await fetch(copy.worker.origin+'/api/v1/public/tasks/'+task.id,{headers:{authorization:'Bearer '+key.secret}});assert.equal(oldKey.status,401)
   await pass(root.post(`/api/v1/calendar-previews/${preview.id}/apply`,{slot:0,credential:'synthetic-pegboard-251'}),400)
   const mapping=await pass(root.get(`/api/v1/projects/${project.id}/calendar-blocks`));assert.equal(mapping[0].restored_inactive,1);assert.equal(mapping[0].event_id,block.event_id)
   await pass(root.post(`/api/v1/calendar-blocks/${block.id}/sync`,{credential:'synthetic-pegboard-251'}),409)
   await pass(root.post(`/api/v1/calendar-blocks/${block.id}/delete`,{revision:block.revision,credential:'synthetic-pegboard-251'}),409)
   await pass(root.post(`/api/v1/projects/${project.id}/rules/process`,{}))
   const bundleResult=await pass(root.post(`/api/v1/workflow-bundles/${bundle.id}/jobs/process`,{}));assert.equal(bundleResult.applied,0)
   assert.equal((await pass(root.get('/api/v1/workflow-bundles/'+bundle.id))).jobs.find(j=>j.id==='synthetic-pegboard-5805').status,'cancelled')
   assert.equal((await pass(root.post(`/api/v1/recurrences/${recurrence.id}/run`,{}))).state,'finished')
   assert.equal((await pass(root.get('/api/v1/recurrences/'+recurrence.id))).occurrences.length,0)
   assert.equal((await pass(root.post(`/api/v1/approvals/${route.id}/reminders`,{}))).sent,0)
   const oldAccessDecision=await root.post(`/api/v1/access-requests/${request.id}/decision`,{decision:'approve',revision:request.revision,level:'viewer'})
   assert.equal(oldAccessDecision.status,409,JSON.stringify(oldAccessDecision.body))
   assert.equal((await pass(root.get(`/api/v1/projects/${project.id}/rules`))).runs.find(r=>r.id==='synthetic-pegboard-5803').status,'pending')
   for(const file of files){const r=await fetch(copy.worker.origin+'/api/v1/attachments/'+file.id,{headers:{cookie:root.cookie}});assert.equal(r.status,200);assert.equal(sha(Buffer.from(await r.arrayBuffer())),file.digest)}
   const versions=(await pass(root.get('/api/v1/proofs/'+proof.id))).versions;assert.deepEqual(versions.map(v=>v.digest).sort(),files.map(f=>f.digest).sort())
   assert.equal((await pass(root.get('/api/v1/tasks/'+task.id))).dueDate,'2026-03-20')
   const restoredGuest=await copy.worker.signIn(guest.email,guest.name,guest.id);await pass(restoredGuest.get('/api/v1/tasks/'+task.id),404)
   await pass(restoredGuest.get('/api/v1/proof-reviews/'+link.id),404)
   await pass(restoredGuest.post(`/api/v1/proof-reviews/${link.id}/decision`,{token:oldReview.token,version:oldReview.version,action:'approve',reason:'Source capability replay'}),404)
   assert.equal(services.state.google.calls.length,calls,'restore and old operations dispatch zero provider requests')
   assert.equal(mailCalls(),sends,'restored approvals and jobs dispatch zero mail requests')
   await pass(root.post('/api/v1/workspaces/ws_main/calendars',{service:'google',calendarId:'synthetic-pegboard-250',credential:'synthetic-pegboard-251',consent:true}))
   const afterConnect=services.state.google.calls.length
   await copy.worker.restart()
   await pass(root.post(`/api/v1/calendar-blocks/${block.id}/delete`,{revision:block.revision,credential:'synthetic-pegboard-251'}),409)
   assert.equal(services.state.google.calls.length,afterConnect,'explicit reconnection cannot revive old operation identities')
   const fresh=await pass(root.post(`/api/v1/tasks/${task.id}/calendar-preview`,{connectionId:connection.id,date:'2026-03-10',minutes:60,credential:'synthetic-pegboard-251'}))
   const newBlock=await pass(root.post(`/api/v1/calendar-previews/${fresh.id}/apply`,{slot:0,credential:'synthetic-pegboard-251'}))
   assert.notEqual(newBlock.transaction_id,block.transaction_id);assert.notEqual(newBlock.event_id,block.event_id)
   assert.ok(services.state.google.events.has(block.event_id),'the original provider event is untouched')
   console.log(JSON.stringify({archiveCustody:true,scale,members,tasks,parts:archive.parts.length,sourceIdentity:archive.manifest.sourceIdentity,bytes:files.map(f=>({size:f.bytes.length,digest:f.digest})),tables:archive.manifest.tables.length,records:archive.rows.length,sourceIdentityMatch:restored.manifest.sourceIdentity===archive.manifest.sourceIdentity,providerDispatchDuringRestore:0,mailDispatchDuringRestore:mailCalls()-sends,nativeImportRestarted:scale}))
  }finally{await copy?.stop()}
 },{timeout:scaleTimeout()})
}
function scaleTimeout(){return process.env.PEGBOARD_ARCHIVE_SCALE==='1'?1200000:360000}
