import assert from 'node:assert/strict'
import { exportCanvasInstallation, restoreCanvasInstallation } from '../support/canvas-restore.mjs'
export async function pass(call,status=200){const r=await call;assert.equal(r.status,status,JSON.stringify(r.body));return r.body}
export const reviewPerson=(owner,id)=>pass(owner.post('/api/v1/data/erasure-preview',{type:'person',id}))
export const erasePerson=(owner,review)=>owner.post('/api/v1/data/erase',{type:'person',id:review.id,token:review.token,confirm:true})
export const archiveRows=archive=>archive.trim().split('\n').map(line=>JSON.parse(line)).filter(r=>r.kind==='part').flatMap(r=>r.items).filter(r=>r.kind==='row')
export async function intakeErasureFixture(w){
 const owner=w.owner,person=await w.person(['synthetic-pegboard-5901','example.invalid'].join('@'),'synthetic-pegboard-5901')
 await pass(owner.post(`/api/v1/workspaces/ws_main/people/${person.id}/account`,{role:'admin'}))
 const target=await w.signIn(person.email,person.name,person.id)
 const peer=await w.person(['synthetic-pegboard-5902','example.invalid'].join('@'),'synthetic-pegboard-5902')
 const project=await pass(owner.post('/api/v1/projects',{name:'synthetic-pegboard-5903'}))
 await pass(owner.post('/api/v1/grants',{objectType:'project',objectId:project.id,granteeId:peer.id,level:'editor'}))
 const config={name:'synthetic-pegboard-5904',fields:[{id:'title',label:'Request title',required:true}],mapping:{title:'title',description:[],ownerId:owner.id,priority:'normal'},hours:8}
 const make=async(creator,publisher,mapped=owner.id)=>{
  const form=await pass(creator.post(`/api/v1/projects/${project.id}/intake/forms`,{...config,mapping:{...config.mapping,ownerId:mapped}})),path=`/api/v1/intake/forms/${form.id}`
  const review=await pass(publisher.get(path+'/review')),publication=await pass(publisher.post(path+'/publish',{version:1,review:review.review,audience:'public',consent:true}))
  return {...form,path,capability:publication.capability}
 }
 const authored=await make(target,owner),published=await make(owner,target),mapped=await make(owner,owner,target.id),untouched=await make(owner,owner)
 const send=async(client,form,key)=>{const input={version:1,requestKey:'synthetic-pegboard-'+key,answers:{title:'synthetic-pegboard-'+key}},receipt=await pass(client.post(form.path+'/submit',input));return {...receipt,form,input}}
 const source=await send(target,untouched,5905),triager=await send(peer,untouched,5906),both=await send(target,untouched,5907),witness=await send(peer,authored,5908),owned=await send(peer,mapped,5909)
 await pass(target.post(`/api/v1/intake/submissions/${triager.receipt}/triage`,{}));await pass(target.post(`/api/v1/intake/submissions/${both.receipt}/triage`,{}))
 const queue=await pass(owner.get(`/api/v1/projects/${project.id}/intake`))
 for(const submission of [source,triager,both,witness,owned])submission.taskId=queue.items.find(row=>row.id===submission.receipt).taskId
 return {owner,target,peer,project,config,authored,published,mapped,untouched,source,triager,both,witness,owned,send}
}
export async function intakeErasureScenario(w){
 const f=await intakeErasureFixture(w),{owner,target,peer,project}=f
 await pass(peer.post('/api/v1/data/erasure-preview',{type:'person',id:target.id}),403)
 let review=await reviewPerson(owner,target.id)
 assert.ok(review.blockers.includes('deactivate_person_before_erasure'))
 assert.ok(review.blockers.includes('transfer_owned_work_before_erasure'))
 let retained=await pass(erasePerson(owner,review));assert.equal(retained.outcome,'retained');assert.deepEqual(retained.counts,{})
 await pass(owner.patch('/api/v1/tasks/'+f.owned.taskId,{ownerId:owner.id}))
 await pass(owner.post(`/api/v1/workspaces/ws_main/people/${target.id}/account`,{status:'inactive'}))
 review=await reviewPerson(owner,target.id)
 assert.deepEqual(review.blockers,[])
 const extra=await f.send(peer,f.untouched,5910)
 await pass(erasePerson(owner,review),409)
 review=await reviewPerson(owner,target.id)
 await pass(peer.post(`/api/v1/intake/submissions/${extra.receipt}/triage`,{}))
 await pass(erasePerson(owner,review),409)
 // The same dependency scope includes person, form-project and linked-submission task holds.
 for(const [type,id]of [['person',target.id],['project',project.id],['task',f.source.taskId]]){
  const stale=await reviewPerson(owner,target.id),hold=await pass(owner.post('/api/v1/data/holds',{type,id,authority:'synthetic-pegboard-5911',expiresAt:Date.now()+86400000}))
  await pass(erasePerson(owner,stale),409)
  const held=await reviewPerson(owner,target.id);assert.ok(held.blockers.includes('active_legal_hold'))
  retained=await pass(erasePerson(owner,held));assert.equal(retained.outcome,'retained');assert.deepEqual(retained.counts,{})
  assert.equal((await pass(owner.get('/api/v1/data/receipts/'+retained.id))).applied,false)
  assert.equal((await pass(owner.get(f.authored.path+'/review'))).version,1,'a held receipt changes no form')
  await pass(owner.post(`/api/v1/data/holds/${hold.id}/release`,{confirm:true}))
 }
 const old=await exportCanvasInstallation(owner)
 review=await reviewPerson(owner,target.id)
 const sorted=values=>values.slice().sort()
 assert.deepEqual(sorted(review.intake.forms.map(r=>r.id)),sorted([f.authored.id,f.published.id,f.mapped.id]))
 assert.deepEqual(sorted(review.intake.submissions.map(r=>r.id)),sorted([f.source.receipt,f.triager.receipt,f.both.receipt,f.witness.receipt,f.owned.receipt]))
 assert.deepEqual(review.intake.forms.map(r=>[r.id,r.author,r.publisher,r.mappedOwner]).sort(),[[f.authored.id,true,false,false],[f.published.id,false,true,false],[f.mapped.id,false,false,true]].sort())
 assert.deepEqual(review.intake.submissions.map(r=>[r.id,r.source,r.triager]).sort(),[[f.source.receipt,true,false],[f.triager.receipt,false,true],[f.both.receipt,true,true],[f.witness.receipt,false,false],[f.owned.receipt,false,false]].sort())
 const expected={intake_submission_sources:2,intake_submission_triagers:2,intake_form_authors:1,intake_form_publishers:1,intake_form_mapped_owners:1,intake_publications_disabled:3}
 for(const [key,count]of Object.entries(expected))assert.equal(review.counts[key],count,key)
 assert.equal(review.retained.intake_replay_witnesses,5);assert.equal(review.retained.intake_form_provenance,3)
 await pass(peer.post('/api/v1/data/erase',{type:'person',id:target.id,token:review.token,confirm:true}),403)
 const receipt=await pass(erasePerson(owner,review));assert.equal(receipt.outcome,'partial')
 assert.deepEqual(receipt.intake,review.intake);assert.equal(receipt.revision,review.revision)
 for(const [key,count]of Object.entries(expected))assert.equal(receipt.counts[key],count,key)
 const durable=await pass(owner.get('/api/v1/data/receipts/'+receipt.id));assert.equal(durable.applied,true)
 assert.deepEqual(durable.intake,review.intake);assert.equal(durable.scopeDigest,receipt.scopeDigest)
 assert.deepEqual(durable.counts,receipt.counts);assert.deepEqual(durable.retained.counts,receipt.retained)
 await pass(peer.get('/api/v1/data/receipts/'+receipt.id),403)
 const audit=await pass(owner.get('/api/v1/admin/audit?action=data.erasure&subject='+target.id))
 assert.equal(audit.events.filter(r=>r.metadata.id===receipt.id).length,1)
 assert.equal(audit.events.find(r=>r.metadata.id===receipt.id).metadata.scopeDigest,receipt.scopeDigest)
 await pass(erasePerson(owner,review),409)
 const after=await reviewPerson(owner,target.id)
 assert.deepEqual(after.intake,{forms:[],submissions:[]},'the live Data door finds no unredacted target reference')
 await w.restart()
 const restored=await restoreCanvasInstallation(owner,{earlierArchive:old})
 try{
  const rows=archiveRows(restored.archive),original=archiveRows(old),row=(table,id)=>rows.find(r=>r.table===table&&r.row.id===id)?.row
  for(const submission of [f.source,f.triager,f.both,f.witness,f.owned]){
   const actual=row('peg_intake_submissions',submission.receipt),prior=original.find(r=>r.table==='peg_intake_submissions'&&r.row.id===submission.receipt).row
   assert.ok(actual);assert.equal(actual.source_actor,[f.source,f.both].includes(submission)?'erased':peer.id)
   assert.equal(actual.triaged_by,[f.triager,f.both].includes(submission)?null:prior.triaged_by)
   for(const key of ['id','form_id','form_version','request_key','fingerprint','task_id','submitted_at','deadline','calendar','triaged_at','escalated_at'])assert.equal(actual[key],prior[key],key+' retained')
   assert.ok(row('peg_tasks',submission.taskId),'owned work survives')
  }
  for(const form of [f.authored,f.published,f.mapped]){
   const actual=row('peg_intake_forms',form.id);assert.equal(actual.erased_custody,1);assert.equal(actual.version,2)
   assert.equal(actual.published_version,null);assert.equal(actual.public_hash,null);assert.ok(actual.revoked_at)
   if(form===f.authored)assert.equal(actual.created_by,'erased')
   if(form===f.published)assert.equal(actual.publisher_id,null)
   if(form===f.mapped)assert.equal(JSON.parse(actual.definition).mapping.ownerId,null)
   const fresh=await pass(owner.get(form.path+'/review'))
   await pass(owner.post(form.path+'/publish',{version:2,review:fresh.review,audience:'public',consent:true}),409)
   await pass(peer.post(form.path+'/submit',{version:2,requestKey:'synthetic-pegboard-5912',answers:{title:'synthetic-pegboard-5912'}}),404)
   const response=await fetch(w.origin+'/api/v1/public-intake/'+form.capability);assert.equal(response.status,404)
   assert.equal((await restored.worker.owner.get(form.path+'/review')).body.published,false)
   assert.equal((await fetch(restored.worker.origin+'/api/v1/public-intake/'+form.capability)).status,404)
  }
  await pass(target.get('/api/v1/me'),401)
  const replay=await pass(peer.post(f.triager.form.path+'/submit',f.triager.input));assert.equal(replay.receipt,f.triager.receipt);assert.equal(replay.replayed,true)
  const taskReview=await pass(owner.post('/api/v1/data/erasure-preview',{type:'task',id:f.triager.taskId}))
  await pass(owner.post('/api/v1/data/erase',{type:'task',id:f.triager.taskId,token:taskReview.token,confirm:true}))
  await pass(peer.post(f.triager.form.path+'/submit',f.triager.input),410)
  const restoredReceipt=await pass(restored.worker.owner.get('/api/v1/data/receipts/'+receipt.id));assert.deepEqual(restoredReceipt.intake,review.intake)
  assert.deepEqual(restoredReceipt.counts,receipt.counts);assert.equal(restoredReceipt.scopeDigest,receipt.scopeDigest)
  const again=await exportCanvasInstallation(restored.worker.owner),againRows=archiveRows(again)
  for(const submission of review.intake.submissions){const actual=againRows.find(r=>r.table==='peg_intake_submissions'&&r.row.id===submission.id).row;assert.notEqual(actual.source_actor,target.id);assert.notEqual(actual.triaged_by,target.id)}
  const people=await pass(restored.worker.owner.get('/api/v1/workspaces/ws_main/people'));assert.ok(!JSON.stringify(people).includes('synthetic-pegboard-5901'))
  const live=await pass(owner.get(`/api/v1/projects/${project.id}/intake`));assert.equal(live.items.length,5,'erased task replay creates no replacement')
 }finally{await restored.stop()}
 console.log('PROBE PEG-059 intake scope: owner Data preview -> exact three form IDs, five submission IDs and independent redaction counts')
 console.log('PROBE PEG-059 authority and holds: non-owner, active person, owned work and person/project/task holds -> refused or retained without intake mutation')
 console.log('PROBE PEG-059 concurrency: submission and triage after review -> stale erasure refused; committed receipt and audit bind the same revision and digest')
 console.log('PROBE PEG-059 restart and replay: retained witness -> original receipt; erased task replay -> 410 without new work; old actor and form capability -> refused')
 console.log('PROBE PEG-059 archive: native old archive with later journal -> refused; later archive restore -> exact redacted references, receipt and inactive publications')
}
