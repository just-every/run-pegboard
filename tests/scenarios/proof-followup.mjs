import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { proofDocument } from '../support/worker.mjs'
import { exportCanvasInstallation, restoreCanvasInstallation } from '../support/canvas-restore.mjs'
export const pass=async(call,status=200)=>{const r=await call;assert.equal(r.status,status,JSON.stringify(r.body));return r.body}
export const person=(w,n,name,role)=>w.person('synthetic-pegboard-'+n+String.fromCharCode(64)+'example.test',name,role)
export const cron=(w)=>pass(w.owner.get('/cdn-cgi/handler/scheduled?time='+Date.parse('2030-01-07T12:00:00Z')))
export async function policy(owner,project,recipients){
 const input={enabled:true,projects:[project.id],recipients:recipients.map(p=>p.id),escalation:[],zone:'UTC',days:['1','2','3','4','5'],start:'09:00',end:'17:00',repeatMinutes:1,maxRounds:2}
 const preview=await pass(owner.post('/api/v1/proof-followup/policy/preview',input))
 await pass(owner.post('/api/v1/proof-followup/policy',{...input,token:preview.token,consent:true}))
 return input
}
export async function replace(owner,f,label){
 const bytes=proofDocument(label),file=await pass(owner.post(`/api/v1/tasks/${f.task.id}/attachments?projectId=${f.project.id}&name=synthetic-pegboard-proof.pdf`,bytes,{'content-type':'application/pdf'}))
 const version=await pass(owner.post('/api/v1/proofs/'+f.proof.id+'/versions',{attachmentId:file.id,currentVersion:f.versionId}))
 assert.equal(version.digest,createHash('sha256').update(bytes).digest('hex'))
 f.versionId=version.versionId;return {...version,bytes,file}
}
export async function route(owner,f,reviewers=f.reviewers){
 const input={mode:'parallel',stages:[{name:'Independent campaign review',people:reviewers.map(p=>p.id),quorum:reviewers.length}],dueAt:1}
 const preview=await pass(owner.post('/api/v1/approval-routing/proof/'+f.proof.id+'/preview',input))
 const result=await pass(owner.post('/api/v1/approval-routing/proof/'+f.proof.id,{...input,token:preview.token}))
 const links=[]
 for(const p of reviewers.filter(p=>p.guest)){
  const current=await pass(owner.get('/api/v1/approvals/'+result.id))
  links.push(await pass(owner.post('/api/v1/approvals/'+result.id+'/share',{token:current.token,recipientId:p.id,expiresAt:Date.parse('2035-01-01T00:00:00Z')})))
 }
 f.route=result;f.links=links;return result
}
export async function fixture(w,n=6700){
 const owner=w.owner, author=await person(w,n,'Creative author'), reviewer=await person(w,n+1,'Internal reviewer'),guest=await person(w,n+2,'Client reviewer','guest');guest.guest=true
 const project=await pass(owner.post('/api/v1/projects',{name:'Human creative review '+n}))
 const task=await pass(owner.post('/api/v1/tasks',{projectId:project.id,title:'Campaign artwork '+n,ownerId:author.id,description:'Human-controlled proof review'}))
 const shares=[]
 for(const p of [reviewer,guest])shares.push(await pass(owner.post('/api/v1/grants',{objectType:'task',objectId:task.id,granteeId:p.id,level:'viewer',scope:'approve'})))
 const bytes=proofDocument('synthetic-pegboard-v1'),file=await pass(owner.post(`/api/v1/tasks/${task.id}/attachments?projectId=${project.id}&name=synthetic-pegboard-v1.pdf`,bytes,{'content-type':'application/pdf'}))
 const proof=await pass(owner.post('/api/v1/tasks/'+task.id+'/proofs',{attachmentId:file.id}))
 const f={project,task,proof,author,reviewer,guest,reviewers:[reviewer,guest],shares,versionId:proof.versionId}
 await replace(owner,f,'synthetic-pegboard-v2');await route(owner,f);await policy(owner,project,[owner])
 return f
}
export const preview=(owner,f,episodeId)=>pass(owner.post('/api/v1/proofs/'+f.proof.id+'/followup/preview',{accountableId:owner.id,...(episodeId?{episodeId}:{})}))
export const begin=async(owner,f,episodeId)=>{const p=await preview(owner,f,episodeId);return pass(owner.post('/api/v1/proofs/'+f.proof.id+'/followup',{accountableId:owner.id,episodeId,token:p.token,consent:true}))}
export const view=(owner,e)=>pass(owner.get('/api/v1/proof-followup/'+e.id))
export const inbox=(client)=>pass(client.get('/api/v1/proof-followup/inbox'))
export const decide=async(client,route,action)=>{const p=await pass(client.get('/api/v1/approvals/'+route.id));return pass(client.post('/api/v1/approvals/'+route.id+'/decision',{token:p.token,version:p.version,action,reason:'synthetic-pegboard-reviewed-human-decision'}))}
export async function proofFollowupScenario(w){
 const owner=w.owner,f=await fixture(w),before=await pass(owner.get('/api/v1/tasks/'+f.task.id))
 const p=await preview(owner,f),starts=await Promise.all([1,2].map(()=>owner.post('/api/v1/proofs/'+f.proof.id+'/followup',{accountableId:owner.id,token:p.token,consent:true})))
 assert.equal(starts.filter(r=>r.status===200).length,1,JSON.stringify(starts));assert.equal(starts.filter(r=>r.status===409).length,1)
 const episode=starts.find(r=>r.status===200).body
 await pass(owner.post('/api/v1/proof-followup/schedule',{}));assert.deepEqual((await inbox(owner)).notices,[])
 await Promise.all([cron(w),cron(w)])
 let current=await view(owner,episode)
 assert.equal(current.episode.state,'active');assert.equal(current.events.filter(e=>e.state==='visible').length,1)
 assert.equal(current.episode.proof_id,f.proof.id);assert.equal(current.episode.route_id,f.route.id);assert.equal(current.episode.version_id,f.versionId)
 assert.deepEqual(current.missing[0].people.map(p=>p.id).sort(),f.reviewers.map(p=>p.id).sort())
 const notice=(await inbox(owner)).notices[0];assert.equal(notice.episodeId,episode.id);assert.equal(notice.versionId,f.versionId);assert.equal(notice.recipientId,owner.id)
 const v2=f.versionId,oldRoute=f.route,oldLink=f.links[0],stale=await pass(f.guest.get('/api/v1/proof-reviews/'+oldLink.id))
 await decide(f.guest,f.route,'changes')
 current=await view(owner,episode);assert.equal(current.episode.state,'awaiting_revision');assert.notEqual(current.episode.state,'approved')
 const v3=await replace(owner,f,'synthetic-pegboard-v3 supplied by a human')
 current=await view(owner,episode);assert.equal(current.episode.state,'awaiting_route');assert.equal(current.version.id,v3.versionId);assert.equal(current.events.filter(e=>e.state==='visible').length,0)
 await pass(f.guest.post('/api/v1/proof-reviews/'+oldLink.id+'/decision',{token:stale.token,version:stale.version,action:'approve',reason:'Old v2'}),404)
 await route(owner,f)
 assert.equal((await view(owner,episode)).episode.state,'awaiting_route','replacement and a route alone cannot approve or resume follow-up')
 await begin(owner,f,episode.id)
 current=await view(owner,episode);assert.equal(current.bindings.length,2);assert.equal(current.episode.digest,v3.digest);assert.equal(current.episode.version_id,v3.versionId);assert.notEqual(current.episode.route_id,oldRoute.id)
 assert.deepEqual(current.bindings.map(b=>[b.version_id,b.route_id]),[[v2,oldRoute.id],[v3.versionId,f.route.id]])
 const downloaded=await pass(f.guest.get('/api/v1/proof-reviews/'+f.links[0].id+'/material'));assert.ok(downloaded.includes('synthetic-pegboard-v3 supplied by a human'))
 await decide(f.reviewer,f.route,'approve')
 current=await view(owner,episode);assert.equal(current.episode.state,'active');assert.equal(current.routing.stages[0].approved,1);assert.deepEqual(current.missing[0].people.map(p=>p.id),[f.guest.id])
 await w.restart();await cron(w)
 assert.equal((await view(owner,episode)).episode.state,'active','restart, a partial vote and reminders do not meet quorum')
 const final=await decide(f.guest,f.route,'approve');assert.equal(final.state,'approved')
 current=await view(owner,episode);assert.equal(current.episode.state,'approved');assert.equal(current.episode.cause,'current_human_quorum');assert.equal(current.routing.stages[0].approved,2)
 assert.deepEqual(current.routing.votes.map(v=>[v.actor_id,v.version,v.action]).sort(),[[f.reviewer.id,v3.versionId,'approve'],[f.guest.id,v3.versionId,'approve']].sort())
 const proof=await pass(owner.get('/api/v1/proofs/'+f.proof.id));assert.equal(proof.state,'approve');assert.equal(proof.decisions.filter(d=>d.version_id===v3.versionId&&d.action==='approve').length,1)
 assert.equal(proof.decisions.find(d=>d.version_id===v3.versionId).id,final.id)
 assert.deepEqual((await inbox(owner)).notices,[])
 const after=await pass(owner.get('/api/v1/tasks/'+f.task.id));for(const key of ['status','startDate','dueDate'])assert.deepEqual(after[key],before[key])
 console.log('PROBE PEG-067 accountable episode: missing guest v2 review -> queued then one internal Inbox notice; guest requests changes -> same open episode; human v3 plus reviewed route continuation -> new binding and old v2 refused; one vote -> active; actual second independent human vote -> approved with reconciled decision IDs and byte digests; restart and concurrent replay deduplicated')
}
export async function proofFollowupCustodyScenario(w){
 const owner=w.owner,f=await fixture(w,6720),captured=await preview(owner,f),e=await begin(owner,f)
 const stranger=await person(w,6725,'Unrelated member')
 await pass(stranger.get('/api/v1/proof-followup/'+e.id),404);await pass(f.guest.get('/api/v1/proof-followup/'+e.id),404)
 await pass(stranger.post('/api/v1/proof-followup/policy/preview',{}),403)
 await pass(owner.post('/api/v1/proof-followup/schedule',{}))
 const oldArchive=await exportCanvasInstallation(owner)
 const restored=await restoreCanvasInstallation(owner)
 try{
  const r=restored.worker
  await cron(r);const episodes=await pass(r.owner.get('/api/v1/proofs/'+f.proof.id+'/followup'))
  assert.equal(episodes.find(x=>x.id===e.id).state,'cancelled');assert.equal(episodes.find(x=>x.id===e.id).cause,'restored_inactive')
  assert.deepEqual((await inbox(r.owner)).notices,[])
  assert.equal((await view(r.owner,e)).events.filter(n=>n.state==='visible').length,0)
 }finally{await restored.stop()}
 await pass(owner.post('/api/v1/proof-reviews/'+f.links[0].id+'/revoke',{}));await w.restart();await cron(w)
 assert.equal((await view(owner,e)).episode.state,'cancelled');assert.deepEqual((await inbox(owner)).notices,[])
 await route(owner,f);const fresh=await begin(owner,f)
 await pass(stranger.post('/api/v1/proof-followup/'+fresh.id+'/stop',{token:(await view(owner,fresh)).token,consent:true}),404)
 const stopping=await view(owner,fresh)
 await pass(owner.post('/api/v1/proof-followup/'+fresh.id+'/stop',{token:stopping.token,consent:true}))
 assert.equal((await view(owner,fresh)).episode.state,'stopped');await cron(w);assert.deepEqual((await inbox(owner)).notices,[])
 const plan=await pass(owner.post('/api/v1/data/erasure-preview',{type:'proof',id:f.proof.id}))
 assert.equal(plan.counts.peg_proof_followup_episodes,2);assert.ok(plan.counts.peg_proof_followup_bindings>=2);assert.ok(plan.counts.peg_proof_followup_events>=1)
 const hold=await pass(owner.post('/api/v1/data/holds',{type:'proof',id:f.proof.id,authority:'synthetic-pegboard-owner-reviewed-hold',expiresAt:Date.parse('2035-01-01T00:00:00Z')}))
 const held=await pass(owner.post('/api/v1/data/erasure-preview',{type:'proof',id:f.proof.id}))
 assert.ok(held.blockers.includes('active_legal_hold'))
 await pass(owner.post('/api/v1/data/erase',{type:'proof',id:f.proof.id,token:plan.token,confirm:true}),409)
 const retained=await pass(owner.post('/api/v1/data/erase',{type:'proof',id:f.proof.id,token:held.token,confirm:true}));assert.equal(retained.outcome,'retained')
 await pass(owner.post('/api/v1/data/holds/'+hold.id+'/release',{confirm:true}))
 const exact=await pass(owner.post('/api/v1/data/erasure-preview',{type:'proof',id:f.proof.id})),erased=await pass(owner.post('/api/v1/data/erase',{type:'proof',id:f.proof.id,token:exact.token,confirm:true}))
 assert.equal(erased.counts.peg_proof_followup_episodes,2);await pass(owner.get('/api/v1/proof-followup/'+e.id),404)
 await pass(owner.post('/api/v1/proofs/'+f.proof.id+'/followup',{accountableId:owner.id,token:captured.token,consent:true}),404)
 const after=await restoreCanvasInstallation(owner,{earlierArchive:oldArchive});try{await pass(after.worker.owner.get('/api/v1/proof-followup/'+e.id),404);assert.deepEqual((await inbox(after.worker.owner)).notices,[])}finally{await after.stop()}
 // A renewed grant or identity must not resurrect a queued episode, even before dispatch.
 const manager=await person(w,6730,'Accountable custodian','manager')
 for(const [index,loss] of ['custodian','reviewer','identity','expiry','reroute'].entries()){
  const subject=await fixture(w,6740+index*10)
  let authority
  if(loss==='custodian')authority=await pass(owner.post('/api/v1/grants',{objectType:'project',objectId:subject.project.id,granteeId:manager.id,level:'admin'}))
  await policy(owner,subject.project,loss==='custodian'?[manager]:[owner])
  const accountable=loss==='custodian'?manager.id:owner.id
  const p=await pass(owner.post('/api/v1/proofs/'+subject.proof.id+'/followup/preview',{accountableId:accountable}))
  const queued=await pass(owner.post('/api/v1/proofs/'+subject.proof.id+'/followup',{accountableId:accountable,token:p.token,consent:true}))
  await pass(owner.post('/api/v1/proof-followup/schedule',{}))
  if(loss==='custodian'){
   const permitted=await view(manager,queued)
   await pass(manager.post('/api/v1/proof-followup/'+queued.id+'/stop',{token:permitted.token,consent:true}),403)
   assert.equal((await view(owner,queued)).episode.state,'active','a permitted custodian is not an owner stop authority')
   await pass(owner.delete('/api/v1/grants/'+authority.id));await pass(manager.get('/api/v1/proof-followup/'+queued.id),404)
   await pass(owner.post('/api/v1/grants',{objectType:'project',objectId:subject.project.id,granteeId:manager.id,level:'admin'}))
  }else if(loss==='reviewer'){
   await pass(owner.delete('/api/v1/grants/'+subject.shares[0].id))
   await pass(owner.post('/api/v1/grants',{objectType:'task',objectId:subject.task.id,granteeId:subject.reviewer.id,level:'viewer',scope:'approve'}))
  }else if(loss==='identity'){
   await pass(owner.post('/api/v1/workspaces/ws_main/people/'+subject.reviewer.id+'/account',{status:'inactive'}))
   await pass(subject.reviewer.get('/api/v1/approvals/'+subject.route.id),401)
   await pass(owner.post('/api/v1/workspaces/ws_main/people/'+subject.reviewer.id+'/account',{status:'active'}))
  }else if(loss==='expiry')await w.sql("UPDATE peg_approval_links SET expires_at=1 WHERE id='"+subject.links[0].id+"'")
  else { const old=subject.route;await route(owner,subject);assert.notEqual(subject.route.id,old.id) }
  await w.restart();await cron(w)
  const ended=await view(owner,queued)
  assert.equal(ended.episode.state,loss==='reroute'?'awaiting_route':'cancelled',loss)
  assert.ok(ended.events.every(event=>event.state==='cancelled'&&event.visible_at===null),loss+' cannot revive queued work')
  assert.deepEqual((await inbox(loss==='custodian'?manager:owner)).notices,[])
 }
 const contextOnly=await fixture(w,6810),visibleProject=contextOnly.project
 const historical=await begin(owner,contextOnly)
 const visibleGrant=await pass(owner.post('/api/v1/grants',{objectType:'project',objectId:visibleProject.id,granteeId:manager.id,level:'admin'}))
 const hidden=await pass(owner.post('/api/v1/projects',{name:'Separate proof custody'}))
 await pass(owner.post('/api/v1/tasks/'+contextOnly.task.id+'/projects',{projectId:hidden.id}))
 contextOnly.project=hidden;await replace(owner,contextOnly,'synthetic-pegboard-hidden-proof-context');await route(owner,contextOnly)
 await policy(owner,hidden,[manager])
 await pass(manager.get('/api/v1/tasks/'+contextOnly.task.id))
 await pass(owner.post('/api/v1/proofs/'+contextOnly.proof.id+'/followup/preview',{accountableId:manager.id}),404)
 assert.equal((await pass(owner.get('/api/v1/proofs/'+contextOnly.proof.id+'/followup'))).length,1,'the owner retains the historical episode')
 await pass(owner.post('/api/v1/grants',{objectType:'project',objectId:hidden.id,granteeId:manager.id,level:'admin'}))
 await pass(owner.delete('/api/v1/grants/'+visibleGrant.id))
 await pass(manager.get('/api/v1/proofs/'+contextOnly.proof.id))
 await pass(manager.get('/api/v1/proof-followup/'+historical.id),404)
 assert.deepEqual(await pass(manager.get('/api/v1/proofs/'+contextOnly.proof.id+'/followup')),[],'current byte custody cannot enumerate hidden historical episodes')
 const audit=await pass(owner.get('/api/v1/admin/audit?action=proof_followup.stopped'));assert.ok(audit.events.some(x=>x.target_id===f.proof.id));assert.ok(!JSON.stringify(audit).includes('Human creative review'))
 console.log('PROBE PEG-067 custody: native archive -> disabled policy, cancelled events and no active source authority; reviewed share revocation -> durable cancellation; owner stop -> stopped; hidden reader refused; exact proof erasure -> counted episode children, legal hold retained, stale review refused and old archive barred by later journal; permanent audit retained without content')
}
