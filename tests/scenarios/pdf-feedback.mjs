import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { PDFDocument,StandardFonts } from 'pdf-lib'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { exportCanvasInstallation,restoreCanvasInstallation } from '../support/canvas-restore.mjs'

export const pass=async(p,status=200)=>{const r=await p;assert.equal(r.status,status,JSON.stringify(r.body));return r.body}
const identity=n=>['synthetic-pegboard-'+n,'example.test'].join(String.fromCharCode(64))
let fixtureIndex=0
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
export async function pdfBytes(version){
 const document=await PDFDocument.create(),font=await document.embedFont(StandardFonts.Helvetica)
 document.setCreationDate(new Date('2026-01-01T00:00:00Z'));document.setModificationDate(new Date('2026-01-01T00:00:00Z'))
 for(const text of ['Front draft '+version,'Back draft '+version]){const page=document.addPage([300,200]);page.drawText(text,{font,size:16,x:35,y:100})}
 return document.save()
}
export async function pdfFeedbackFixture(w){
 const base=1100+(++fixtureIndex)*10
 const owner=w.owner,writer=await w.person(identity(base+1),'PDF reviewer'),reader=await w.person(identity(base+2),'PDF reader'),scoped=await w.person(identity(base+3),'Scoped reviewer'),guest=await w.person(identity(base+4),'External reviewer','guest')
 const project=await pass(owner.post('/api/v1/projects',{name:'PDF production'})),hidden=await pass(owner.post('/api/v1/projects',{name:'Restricted first draft'}))
 const grants=[]
 for(const [person,level]of [[writer,'commenter'],[reader,'viewer'],[scoped,'commenter'],[guest,'commenter']])grants.push(await pass(owner.post('/api/v1/grants',{objectType:'project',objectId:project.id,granteeId:person.id,level})))
 const hiddenGrant=await pass(owner.post('/api/v1/grants',{objectType:'project',objectId:hidden.id,granteeId:writer.id,level:'commenter'}))
 const task=await pass(owner.post('/api/v1/tasks',{projectId:project.id,title:'Review retained campaign PDFs',ownerId:writer.id}))
 await pass(owner.post(`/api/v1/tasks/${task.id}/projects`,{projectId:hidden.id}))
 const upload=async(version,projectId=project.id)=>{const bytes=await pdfBytes(version),file=await pass(owner.post(`/api/v1/tasks/${task.id}/attachments?projectId=${projectId}&name=synthetic-pegboard-${version}.pdf`,bytes,{'content-type':['application','pdf'].join('/')}));return {bytes,file,digest:hash(bytes)}}
 const one=await upload('v1',hidden.id),proof=await pass(owner.post(`/api/v1/tasks/${task.id}/proofs`,{attachmentId:one.file.id}))
 one.versionId=proof.versionId
 const two=await upload('v2'),v2=await pass(owner.post(`/api/v1/proofs/${proof.id}/versions`,{attachmentId:two.file.id,currentVersion:one.versionId}));two.versionId=v2.versionId
 const api='/api/v1/proofs/'+proof.id
 const view=(client=writer,version=two.versionId,compare)=>pass(client.get(api+'/review?version='+version+(compare?'&compare='+compare:'')))
 const pin=async(client=writer,version=two.versionId,key='synthetic-pegboard-1105')=>{const review=await view(client,version);const input={versionId:version,token:review.token,key,body:'Keep this exact paragraph',page:2,x:0.25,y:0.75};return {...await pass(client.post(api+'/feedback',input)),input}}
 return {w,owner,writer,reader,scoped,guest,project,hidden,hiddenGrant,grants,task,one,two,proof,api,upload,view,pin}
}
export async function pdfFeedbackScenario(w){
 const f=await pdfFeedbackFixture(w),{owner,writer,reader,scoped,guest,api,one,two,proof}=f
 const view=await f.view(writer,two.versionId,one.versionId)
 assert.deepEqual(view.documents.map(d=>[d.id,d.attachment_id,d.digest,d.pages]),[two,one].map(v=>[v.versionId,v.file.id,v.digest,[{width:300,height:200},{width:300,height:200}]]))
 for(const [source,label]of [[one,'v1'],[two,'v2']]){
  const response=await fetch(w.origin+api+'/versions/'+source.versionId+'/material',{headers:{cookie:writer.cookie}})
  assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store')
  const bytes=new Uint8Array(await response.arrayBuffer());assert.equal(hash(bytes),source.digest);assert.equal(response.headers.get('x-proof-version'),source.versionId);assert.deepEqual(bytes,source.bytes)
  const pdf=await getDocument({data:bytes,useSystemFonts:true}).promise;assert.equal(pdf.numPages,2)
  for(const [index,text]of [[1,'Front draft '+label],[2,'Back draft '+label]])assert.equal((await (await pdf.getPage(index)).getTextContent()).items.map(item=>item.str).join(''),text)
  await pdf.destroy()
 }
 const first=await f.pin(),original=await f.view()
 assert.deepEqual(original.feedback.map(p=>[p.id,p.proof_id,p.version_id,p.attachment_id,p.digest,p.page,p.x,p.y,p.author_id,p.body,p.state,p.revision]),[[first.id,proof.id,two.versionId,two.file.id,two.digest,2,0.25,0.75,writer.id,first.input.body,'open',1]])
 assert.ok(original.feedback[0].created_at>0)
 assert.equal((await pass(writer.post(api+'/feedback',first.input))).id,first.id)
 await pass(writer.post(api+'/feedback',{...first.input,body:'Changed replay'}),409)
 for(const input of [{page:3},{x:-0.01},{y:1.01},{x:''}])await pass(writer.post(api+'/feedback',{...first.input,...input,key:'synthetic-pegboard-invalid'}),400)
 const edit={versionId:two.versionId,token:original.token,revision:1,body:'Keep the verified paragraph',state:'resolved'}
 await pass(owner.post(api+'/feedback/'+first.id,edit),403)
 await pass(reader.post(api+'/feedback',{...first.input,token:(await f.view(reader)).token,key:'synthetic-pegboard-reader'}),403)
 await pass(guest.get(api+'/review?version='+two.versionId),404)
 await pass(guest.get(api+'/versions/'+two.versionId+'/material'),404)
 await pass(guest.post(api+'/feedback',first.input),404)
 assert.deepEqual((await f.view(scoped)).documents.map(d=>d.id),[two.versionId])
 for(const path of ['/review?version='+one.versionId,'/review?version='+two.versionId+'&compare='+one.versionId,'/versions/'+one.versionId+'/material'])await pass(scoped.get(api+path),404)
 await pass(scoped.post(api+'/feedback',{...first.input,versionId:one.versionId}),404)
 await pass(owner.post('/api/v1/grants',{objectType:'project',objectId:f.hidden.id,granteeId:scoped.id,level:'viewer'}))
 const restrictedRead=await f.view(scoped,one.versionId)
 await pass(scoped.post(api+'/feedback',{...first.input,versionId:one.versionId,token:restrictedRead.token,key:'synthetic-pegboard-file-readonly'}),403)
 const fresh=await f.view();edit.token=fresh.token
 const changed=await pass(writer.post(api+'/feedback/'+first.id,edit));assert.equal(changed.revision,2)
 await pass(writer.post(api+'/feedback/'+first.id,edit),409)
 let current=await f.view();assert.deepEqual(current.history.map(h=>[h.version_id,h.actor_id,h.state,h.revision,h.body]),[[two.versionId,writer.id,'open',1,first.input.body],[two.versionId,writer.id,'resolved',2,edit.body]])
 const concurrent={...edit,token:current.token,revision:2,state:'open'}
 const results=await Promise.all([writer.post(api+'/feedback/'+first.id,concurrent),writer.post(api+'/feedback/'+first.id,{...concurrent,body:'A simultaneous alternative'})])
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409])
 current=await f.view();assert.equal(current.history.length,3);assert.equal(current.feedback[0].revision,3);assert.equal(current.feedback[0].state,'open')
 const approve=await pass(owner.get(api+'/decision-preview'))
 await pass(owner.post(api+'/decisions',{token:approve.token,versionId:two.versionId,action:'approve',reason:'Independent version review'}))
 const stale=await f.view(),three=await f.upload('v3',f.hidden.id),v3=await pass(owner.post(api+'/versions',{attachmentId:three.file.id,currentVersion:two.versionId}))
 await pass(writer.post(api+'/feedback',{...first.input,key:'synthetic-pegboard-stale',token:stale.token}),409)
 const defaultRead=await pass(reader.get(api+'/review'))
 assert.deepEqual(defaultRead.documents.map(d=>d.id),[two.versionId],'default review selects a readable retained PDF when the current file is hidden')
 assert.equal(defaultRead.currentVersion,null);assert.ok(!JSON.stringify(defaultRead).includes(v3.versionId))
 const limited=await f.view(reader);assert.equal(limited.currentVersion,null);assert.deepEqual(limited.versions.map(v=>v.id),[two.versionId]);assert.ok(!JSON.stringify(limited).includes(v3.versionId))
 await pass(reader.get(api+'/review?version='+two.versionId+'&compare='+v3.versionId),404)
 const latest=await pass(writer.get(api+'/review'));assert.equal(latest.currentVersion,v3.versionId);assert.deepEqual(latest.feedback,[])
 const old=await f.view();assert.equal(old.feedback[0].id,first.id);assert.equal(old.feedback[0].digest,two.digest);assert.equal(old.history.length,3)
 const custody=await pass(owner.get(api));assert.equal(custody.state,'pending');assert.deepEqual(custody.decisions.map(d=>[d.version_id,d.actor_id,d.action]),[[two.versionId,owner.id,'approve']])
 await w.restart();assert.deepEqual((await f.view()).feedback,old.feedback)
 assert.equal((await pass(writer.post(api+'/feedback',first.input))).id,first.id)
 // A trashed version is unavailable even while another version remains readable.
 const removed={type:'proof_version',id:one.versionId,action:'trash'},review=await pass(owner.post('/api/v1/recovery/preview',removed))
 await pass(owner.post('/api/v1/recovery/apply',{...removed,token:review.token}))
 await pass(writer.get(api+'/review?version='+one.versionId),404);await pass(writer.get(api+'/versions/'+one.versionId+'/material'),404)
 const revoking=await f.view(scoped)
 await pass(owner.post('/api/v1/grants/'+f.grants[2].id+'/revoke',{}))
 await pass(scoped.get(api+'/review?version='+two.versionId),404);await pass(scoped.get(api+'/versions/'+two.versionId+'/material'),404)
 await pass(scoped.post(api+'/feedback',{...first.input,token:revoking.token,key:'synthetic-pegboard-revoked'}),404)
 assert.equal((await f.view()).feedback.length,1)
 // Two submitted pins compete against the same review; the losing write leaves no history.
 const reviewed=await f.view(),submission={...first.input,token:reviewed.token,key:'synthetic-pegboard-concurrent-pin'}
 const submissions=[submission,{...submission,key:'synthetic-pegboard-alternative-pin',body:'A competing second-page comment'}]
 const competing=await Promise.all(submissions.map(input=>writer.post(api+'/feedback',input)))
 assert.deepEqual(competing.map(r=>r.status).sort(),[200,409])
 const saved=competing.find(r=>r.status===200).body,afterCreate=await f.view()
 assert.equal(afterCreate.feedback.length,2)
 assert.deepEqual(afterCreate.feedback.filter(p=>p.id===saved.id).map(p=>[p.version_id,p.author_id,p.page,p.x,p.y]),[[two.versionId,writer.id,2,0.25,0.75]])
 assert.equal(afterCreate.history.filter(h=>h.feedback_id===saved.id).length,1)
 await w.restart()
 assert.equal((await pass(writer.post(api+'/feedback',submissions[competing.findIndex(r=>r.status===200)]))).id,saved.id)
 assert.equal((await f.view()).history.filter(h=>h.feedback_id===saved.id).length,1)
 // Keeping read access after comment revocation never preserves annotation authority.
 const commentGrant=await pass(owner.post('/api/v1/grants',{objectType:'project',objectId:f.project.id,granteeId:reader.id,level:'commenter'}))
 const readerPin=await f.pin(reader,two.versionId,'synthetic-pegboard-comment-revocation'),commentReview=await f.view(reader)
 await pass(owner.post('/api/v1/grants/'+commentGrant.id+'/revoke',{}))
 const readOnly=await f.view(reader),retainedPin=readOnly.feedback.find(p=>p.id===readerPin.id)
 assert.equal(retainedPin.canEdit,false)
 await pass(reader.post(api+'/feedback/'+readerPin.id,{versionId:two.versionId,token:commentReview.token,revision:1,body:'Changed without comment authority',state:'resolved'}),403)
 await pass(reader.post(api+'/feedback',readerPin.input),403)
 const afterRefusal=await f.view(reader)
 assert.deepEqual(afterRefusal.feedback,readOnly.feedback);assert.deepEqual(afterRefusal.history,readOnly.history)
 await pass(owner.post('/api/v1/grants/'+f.grants[1].id+'/revoke',{}))
 await pass(reader.get(api+'/review'),404)
 await pass(reader.get(api+'/versions/'+two.versionId+'/material'),404)
 await pass(reader.post(api+'/feedback',readerPin.input),404)
 console.log('PROBE PEG-011 comment authority: author loses comment grant but retains Viewer access -> retained pages and feedback readable, old create replay and resolution refused without changes')
 console.log('PROBE PEG-011 render and identity: retained v1 and v2 material routes -> two real PDF pages, independent byte digests and exact version-specific pin identities')
 console.log('PROBE PEG-011 authority and concurrency: guest, hidden version, Viewer, nonauthor, revoked reader, stale and simultaneous writes -> refused without duplicate or changed feedback')
 console.log('PROBE PEG-011 version history: replace approved v2 with v3, restart and replay -> v2 feedback and approval retained, v3 pending with no inherited pins')
}

export async function pdfFeedbackCustodyScenario(w){
 const f=await pdfFeedbackFixture(w),{owner,writer,api,proof,two}=f,pin=await f.pin()
 const initial=await f.view()
 const resolution={versionId:two.versionId,token:initial.token,revision:1,body:'Resolved on the retained second page',state:'resolved'}
 await pass(writer.post(api+'/feedback/'+pin.id,resolution))
 const original=await f.view(),archive=await exportCanvasInstallation(owner)
 const restored=await restoreCanvasInstallation(owner)
 try{
  const view=await pass(restored.worker.owner.get(api+'/review?version='+two.versionId))
  assert.deepEqual(view.feedback.map(({canEdit,...p})=>p),original.feedback.map(({canEdit,...p})=>p));assert.deepEqual(view.history,original.history)
  for(const source of [f.one,two]){
   const bytes=await fetch(restored.worker.origin+api+'/versions/'+source.versionId+'/material',{headers:{cookie:restored.worker.owner.cookie}})
   assert.equal(bytes.status,200)
   const actual=new Uint8Array(await bytes.arrayBuffer());assert.deepEqual(actual,source.bytes);assert.equal(hash(actual),source.digest)
  }
  assert.deepEqual(view.history.map(h=>[h.feedback_id,h.version_id,h.actor_id,h.revision,h.state,h.body]),[[pin.id,two.versionId,writer.id,1,'open',pin.input.body],[pin.id,two.versionId,writer.id,2,'resolved',resolution.body]])
  assert.equal((await fetch(restored.worker.origin+api+'/review?version='+two.versionId,{headers:{cookie:writer.cookie}})).status,401)
 }finally{await restored.stop()}
 // A new feedback revision invalidates irreversible review, even when selected IDs are unchanged.
 const proofScope={type:'proof',id:proof.id},beforeEdit=await pass(owner.post('/api/v1/data/erasure-preview',proofScope))
 const latest=await f.view()
 await pass(writer.post(api+'/feedback/'+pin.id,{...resolution,token:latest.token,revision:2,state:'open',body:'Reopened before irreversible review'}))
 const kept=await f.view()
 await pass(owner.post('/api/v1/data/erase',{...proofScope,token:beforeEdit.token,confirm:true}),409)
 assert.deepEqual((await f.view()).feedback,kept.feedback);assert.deepEqual((await f.view()).history,kept.history)
 await pass(writer.post('/api/v1/data/erase',{...proofScope,token:beforeEdit.token,confirm:true}),403)
 // Feedback has its own exact reviewed person scope, including the retained proof's holds.
 await pass(owner.patch('/api/v1/tasks/'+f.task.id,{ownerId:owner.id}))
 await pass(owner.post(`/api/v1/workspaces/ws_main/people/${writer.id}/account`,{status:'inactive'}))
 const person={type:'person',id:writer.id},preview=()=>pass(owner.post('/api/v1/data/erasure-preview',person))
 let plan=await preview();assert.equal(plan.counts.peg_proof_feedback,1);assert.equal(plan.counts.peg_proof_feedback_history,3);assert.deepEqual(plan.blockers,[])
 assert.deepEqual(plan.selections.find(s=>s.table==='peg_proof_feedback').keys,[{id:pin.id}])
 const hold=await pass(owner.post('/api/v1/data/holds',{type:'proof',id:proof.id,authority:'synthetic-pegboard-1106',expiresAt:Date.now()+86400000}))
 await pass(owner.post('/api/v1/data/erase',{...person,token:plan.token,confirm:true}),409)
 plan=await preview();assert.ok(plan.blockers.includes('active_legal_hold'))
 const blocked=await pass(owner.post('/api/v1/data/erase',{...person,token:plan.token,confirm:true}));assert.equal(blocked.outcome,'retained');assert.deepEqual(blocked.counts,{})
 assert.equal((await pass(owner.get(api+'/review?version='+two.versionId))).feedback.length,1)
 await pass(owner.post('/api/v1/data/holds/'+hold.id+'/release',{confirm:true}))
 plan=await preview();const receipt=await pass(owner.post('/api/v1/data/erase',{...person,token:plan.token,confirm:true}))
 assert.equal(receipt.counts.peg_proof_feedback,1);assert.equal(receipt.counts.peg_proof_feedback_history,3)
 const after=await pass(owner.get(api+'/review?version='+two.versionId));assert.deepEqual(after.feedback,[]);assert.deepEqual(after.history,[])
 await pass(writer.post(api+'/feedback',pin.input),401)
 const reconciled=await restoreCanvasInstallation(owner,{earlierArchive:archive})
 try{assert.deepEqual((await pass(reconciled.worker.owner.get(api+'/review?version='+two.versionId))).feedback,[])}finally{await reconciled.stop()}
 // Fresh authorized feedback participates in proof-group expiry, with person holds winning.
 await pass(owner.post('/api/v1/grants',{objectType:'project',objectId:f.project.id,granteeId:f.reader.id,level:'commenter'}))
 const next=await f.pin(f.reader,two.versionId,'synthetic-pegboard-1107')
 await w.sql(`UPDATE peg_attachments SET created_at=1 WHERE task_id='${f.task.id}'`)
 const setting={class:'attachments_proofs',days:1},retention=await pass(owner.post('/api/v1/data/retention-preview',setting))
 await pass(owner.post('/api/v1/data/retention',{...setting,token:retention.token,confirm:true}))
 const expiryInput={class:'attachments_proofs',cutoff:2},expiry=()=>pass(owner.post('/api/v1/data/expiry-preview',expiryInput))
 const personHold=await pass(owner.post('/api/v1/data/holds',{type:'person',id:f.reader.id,authority:'synthetic-pegboard-1108',expiresAt:Date.now()+86400000}))
 assert.equal((await expiry()).counts.peg_proof_feedback,undefined)
 await pass(owner.post('/api/v1/data/holds/'+personHold.id+'/release',{confirm:true}))
 const expiring=await expiry();assert.equal(expiring.counts.peg_proof_feedback,1);assert.equal(expiring.counts.peg_proof_feedback_history,1)
 assert.deepEqual(expiring.selections.find(s=>s.table==='peg_proof_feedback').keys,[{id:next.id}])
 const expired=await pass(owner.post('/api/v1/data/expire',{...expiryInput,token:expiring.token,confirm:true}));assert.equal(expired.counts.peg_proof_feedback,1)
 await pass(owner.get(api+'/review?version='+two.versionId),404);await pass(owner.post(api+'/feedback',pin.input),404)
 // Explicit proof erasure removes all reviewed versions and pins without losing the task.
 const erased=await pdfFeedbackFixture(w),erasedPin=await erased.pin(),erasedScope={type:'proof',id:erased.proof.id}
 const erasePreview=await pass(owner.post('/api/v1/data/erasure-preview',erasedScope))
 for(const [table,ids]of [['peg_proof_feedback',[erasedPin.id]],['peg_proof_versions',[erased.one.versionId,erased.two.versionId]],['peg_attachments',[erased.one.file.id,erased.two.file.id]]]){
  assert.deepEqual(erasePreview.selections.find(s=>s.table===table).keys.map(k=>k.id).sort(),ids.sort())
 }
 assert.equal(erasePreview.counts.peg_proof_feedback_history,1)
 const proofArchive=await exportCanvasInstallation(owner)
 await pass(erased.writer.post('/api/v1/data/erase',{...erasedScope,token:erasePreview.token,confirm:true}),403)
 const erasedReceipt=await pass(owner.post('/api/v1/data/erase',{...erasedScope,token:erasePreview.token,confirm:true}))
 for(const [table,count]of [['peg_proof_feedback',1],['peg_proof_feedback_history',1],['peg_proof_versions',2],['peg_attachments',2]])assert.equal(erasedReceipt.counts[table],count)
 for(const path of ['/review','/versions/'+erased.one.versionId+'/material','/versions/'+erased.two.versionId+'/material'])await pass(owner.get(erased.api+path),404)
 await pass(erased.writer.post(erased.api+'/feedback',erasedPin.input),404)
 assert.equal((await pass(owner.get('/api/v1/tasks/'+erased.task.id))).id,erased.task.id)
 const postErasure=await restoreCanvasInstallation(owner,{earlierArchive:proofArchive})
 try{
  await pass(postErasure.worker.owner.get(erased.api+'/review'),404)
  assert.equal((await pass(postErasure.worker.owner.get('/api/v1/tasks/'+erased.task.id))).id,erased.task.id)
 }finally{await postErasure.stop()}
 console.log('PROBE PEG-011 proof erasure: exact owner-reviewed proof group -> both byte streams and feedback removed, task survives, old feedback replay and earlier native archive cannot restore proof')
 console.log('PROBE PEG-011 custody: native archive, person erasure, proof hold and reviewed expiry -> exact feedback counts, byte continuity, inactive old session and older-archive journal refusal')
}
