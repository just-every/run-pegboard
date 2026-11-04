import assert from 'node:assert/strict'
import {hubspotCredential as credential} from '../support/hubspot-services.mjs'
import {restoreCanvasInstallation} from '../support/canvas-restore.mjs'
export const pass=async(p,status=200)=>{const r=await p;assert.equal(r.status,status,JSON.stringify(r.body));return r.body}
export const commercialInput=actorId=>({templateId:'gallery_onboarding',version:1,name:'Synthetic private delivery',startDate:'2026-11-09',roles:{'Account lead':actorId,Specialist:actorId,Reviewer:actorId},credential})
export async function commercialHubspotScenario(w,edge){
 const owner=w.owner,root='/api/v1/commercial',settings=()=>pass(owner.get(root))
 const member=await w.person(['synthetic-pegboard-703','example.invalid'].join('@'),'Commercial member'),guest=await w.person(['synthetic-pegboard-704','example.invalid'].join('@'),'Commercial guest','guest')
 await pass(edge.event(w,'2001','3000'),200)
 assert.equal((await settings()).handoffs.length,0,'valid app transport does not establish tenant authority')
 await pass(member.get(root),403);await pass(guest.get(root),403)
 await pass(member.post(root+'/portals',{portalId:'1001',credential,confirm:true}),403)
 await pass(owner.post(root+'/portals',{portalId:'1002',credential,confirm:true}),403)
 const portal=await pass(owner.post(root+'/portals',{portalId:'1001',credential,confirm:true}))
 await pass(edge.event(w,'2001','3001',{},false),401)
 const pendingBefore=await pass(owner.get('/api/v1/projects'))
 await pass(edge.event(w));await pass(edge.event(w))
 let source=(await settings()).handoffs[0]
 assert.equal((await settings()).handoffs.length,1)
 assert.deepEqual((await pass(owner.get('/api/v1/projects'))),pendingBefore,'events create no work')
 await pass(member.post(`${root}/${source.id}/reviews`,commercialInput(member.id)),403)
 edge.refused=true;await pass(owner.post(`${root}/${source.id}/reviews`,commercialInput(owner.id)),403);edge.refused=false
 const reviewed=await pass(owner.post(`${root}/${source.id}/reviews`,commercialInput(owner.id)))
 assert.equal(reviewed.plan.source.portalId,'1001');assert.equal(reviewed.plan.source.dealId,'2001')
 assert.deepEqual(Object.keys(reviewed.plan.source.fields).sort(),['closedate','dealname'])
 assert.deepEqual(reviewed.plan.clientShare.audience,[]);assert.deepEqual(reviewed.plan.clientShare.grants,[])
 assert.equal(reviewed.plan.template.visibility,'private');assert.ok(reviewed.plan.template.rules.every(r=>!r.active))
 for(const privateValue of ['synthetic-pegboard-excluded-customer','900000',credential])assert.ok(!JSON.stringify(reviewed).includes(privateValue))
 edge.change('2001',{name:'Changed source'})
 await pass(owner.post(`${root}/reviews/${reviewed.id}/adopt`,{credential,confirm:true}),409)
 const exact=await pass(owner.post(`${root}/${source.id}/reviews`,commercialInput(owner.id)))
 await pass(owner.post(`${root}/reviews/${exact.id}/adopt`,{credential,confirm:false}),400)
 const adopted=await pass(owner.post(`${root}/reviews/${exact.id}/adopt`,{credential,confirm:true}))
 assert.ok(adopted.projectId);assert.equal((await pass(owner.get('/api/v1/projects/'+adopted.projectId))).project.visibility,'private')
 await pass(guest.get('/api/v1/projects/'+adopted.projectId),404)
 const board=await pass(owner.get('/api/v1/projects/'+adopted.projectId)),tasks=board.columns.flatMap(c=>c.tasks)
 assert.equal(tasks.length,5);assert.equal(new Set(tasks.map(t=>t.id)).size,5)
 assert.ok(tasks.some(t=>t.title==='Welcome client and agree goals'&&t.owner===owner.name))
 const commitment=(await settings()).handoffs[0].commitment
 await w.restart()
 assert.equal((await pass(owner.post(`${root}/reviews/${exact.id}/adopt`,{credential,confirm:true}))).projectId,adopted.projectId)
 edge.change('2001',{stage:'open',close:'2027-01-10T00:00:00Z'});await pass(edge.event(w,'2001','3002'))
 source=(await settings()).handoffs[0];assert.equal(source.project_id,adopted.projectId);assert.deepEqual(source.commitment,commitment)
 // A distinct declined source never creates work, even after replay or reopen.
 await pass(edge.event(w,'2002','3010'));const decline=(await settings()).handoffs.find(h=>h.deal_id==='2002')
 await pass(owner.post(`${root}/${decline.id}/decline`,{confirm:true}));await pass(edge.event(w,'2002','3011'))
 assert.equal((await settings()).handoffs.find(h=>h.id===decline.id).project_id,null)
 await pass(owner.post(`${root}/${decline.id}/reviews`,commercialInput(owner.id)),409)
 // A source or native project change invalidates the exact return review before any write.
 let ret=await pass(owner.post(`${root}/${source.id}/returns`,{credential,status:'in_progress'}))
 edge.change('2001',{name:'New source revision'})
 await pass(owner.post(`${root}/reviews/${ret.id}/send`,{credential,confirm:true}),409)
 assert.equal(edge.writes,0)
 ret=await pass(owner.post(`${root}/${source.id}/returns`,{credential,status:'in_progress'}))
 await pass(owner.patch('/api/v1/tasks/'+tasks[0].id,{priority:'high'}))
 await pass(owner.post(`${root}/reviews/${ret.id}/send`,{credential,confirm:true}),409)
 ret=await pass(owner.post(`${root}/${source.id}/returns`,{credential,status:'in_progress'}))
 edge.rejectWrite=true
 assert.equal((await pass(owner.post(`${root}/reviews/${ret.id}/send`,{credential,confirm:true}))).state,'rejected')
 edge.rejectWrite=false
 assert.equal((await settings()).reviews.find(r=>r.id===ret.id).cause,'hubspot_source_refused')
 ret=await pass(owner.post(`${root}/${source.id}/returns`,{credential,status:'in_progress'}))
 edge.lose=true
 assert.equal((await pass(owner.post(`${root}/reviews/${ret.id}/send`,{credential,confirm:true}))).state,'uncertain')
 assert.equal(edge.writes,1)
 await pass(owner.post(`${root}/${source.id}/returns`,{credential,status:'delivered'}),409)
 await w.restart();edge.readOutage=false
 assert.equal((await pass(owner.post(`${root}/reviews/${ret.id}/reconcile`,{credential}))).state,'acknowledged')
 assert.equal((await pass(owner.post(`${root}/reviews/${ret.id}/send`,{credential,confirm:true}))).state,'acknowledged')
 assert.equal(edge.writes,1,'readback and replay never repeat an uncertain write')
 const delivered=await pass(owner.post(`${root}/${source.id}/returns`,{credential,status:'delivered'}))
 await pass(member.post(`${root}/reviews/${delivered.id}/send`,{credential,confirm:true}),403)
 assert.equal((await pass(owner.post(`${root}/reviews/${delivered.id}/send`,{credential,confirm:true}))).state,'acknowledged')
 assert.equal(edge.deal().delivery,'delivered');assert.equal(edge.deal().operation,delivered.id);assert.equal(edge.deal().stage,'open','delivery does not own CRM deal state')
 assert.equal(edge.writes,2)
 // Archive restoration preserves mapping but has no source or pending-operation authority.
 let restored
 try{
  restored=await restoreCanvasInstallation(owner)
  const inactive=await pass(restored.worker.owner.get(root))
  assert.ok(inactive.portals.every(p=>!p.active));assert.ok(inactive.handoffs.every(h=>h.state==='inactive'))
  await pass(restored.worker.owner.post(`${root}/reviews/${delivered.id}/send`,{credential,confirm:true}),404)
  assert.equal(edge.writes,2)
  assert.ok(!restored.archive.includes(credential));assert.ok(!restored.archive.includes('synthetic-pegboard-excluded-customer'))
 }finally{await restored?.stop()}
 // Exact erasure scope, holds and replay witness through the supported Data door.
 const data='/api/v1/data'
 let erase=await pass(owner.post(data+'/erasure-preview',{type:'project',id:adopted.projectId}))
 assert.equal(erase.counts.commercial_redactions,1);assert.ok(erase.counts.commercial_reviews>=1)
 const hold=await pass(owner.post(data+'/holds',{type:'project',id:adopted.projectId,authority:'Synthetic custody hold',expiresAt:Date.now()+3600000}))
 erase=await pass(owner.post(data+'/erasure-preview',{type:'project',id:adopted.projectId}))
 const held=await pass(owner.post(data+'/erase',{type:'project',id:adopted.projectId,token:erase.token,confirm:true}))
 assert.ok(held.conflicts.includes('active_legal_hold'));assert.equal((await settings()).handoffs[0].state,'adopted')
 await pass(owner.post(data+'/holds/'+hold.id+'/release',{confirm:true}))
 erase=await pass(owner.post(data+'/erasure-preview',{type:'project',id:adopted.projectId}))
 await pass(owner.post(data+'/erase',{type:'project',id:adopted.projectId,token:erase.token,confirm:true}))
 const erased=(await settings()).handoffs.find(h=>h.id===source.id)
 assert.equal(erased.state,'erased');assert.deepEqual(erased.commitment,{})
 await pass(edge.event(w,'2001','3090'));assert.equal((await settings()).handoffs.filter(h=>h.deal_id==='2001').length,1)
 await pass(owner.post(`${root}/${source.id}/reviews`,commercialInput(owner.id)),404)
 await pass(owner.post(root+'/portals/'+portal.id+'/revoke',{}))
 await pass(owner.post(`${root}/${decline.id}/decline`,{confirm:true}),403)
 assert.equal(edge.writes,2)
 return {projectId:adopted.projectId,sourceId:source.id,returns:[ret.id,delivered.id],writes:edge.writes}
}
