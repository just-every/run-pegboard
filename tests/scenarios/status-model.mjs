import assert from 'node:assert/strict'
import { startWorker } from '../support/worker.mjs'
import { statusModelEdge } from '../support/status-model.mjs'

export async function statusModelScenario() {
  const edge=await statusModelEdge()
  const w=await startWorker({settings:{AI_ENABLED:'true',AI_API_KEY:'synthetic-pegboard-model-1',AI_BASE_URL:edge.origin,AI_MODEL:'synthetic-pegboard-model',AI_PROCESSOR:'status-model'}})
  const call=async(p,status=200)=>{const response=await p;assert.equal(response.status,status,JSON.stringify(response.body));return response.body}
  try {
    const owner=w.owner,member=await w.person('synthetic-pegboard-model-1'+'@'+'example.com','Model Reader'),guest=await w.person('synthetic-pegboard-model-2'+'@'+'example.com','Model Guest','guest')
    const project=await call(owner.post('/api/v1/projects',{name:'Status model project',visibility:'private'}))
    const source=await call(owner.post('/api/v1/tasks',{projectId:project.id,title:'Creative review',description:'Creative review is complete.',status:'done'}))
    await w.sql(`UPDATE peg_tasks SET updated_at=${Date.parse('2026-10-15T12:00:00Z')} WHERE id='${source.id}'`)
    const input={subjectType:'project',subjectId:project.id,from:'2026-10-01',to:'2026-10-31',sourceIds:[source.id],modelConsent:true}
    await call(owner.post('/api/v1/status-drafts/generate',input),403)
    assert.equal(edge.requests.length,0,'processor consent precedes inference')
    await call(owner.post('/api/v1/data/processors',{processor:'status-model',approved:true,sharing:true,training:false,confirm:true}))
    await call(member.post('/api/v1/status-drafts/generate',input),404)
    await call(guest.post('/api/v1/status-drafts/generate',input),404)
    await call(owner.post('/api/v1/status-drafts/generate',{...input,modelConsent:false}),403)
    await call(owner.post('/api/v1/status-drafts/generate',{...input,to:'2026-10-14'}),400)
    assert.equal(edge.requests.length,0)
    const projectDraft=await call(owner.post('/api/v1/status-drafts/generate',input))
    assert.deepEqual(projectDraft.recipients,[],'model cannot select an audience')
    assert.ok(projectDraft.content.highlights.includes(source.id))
    assert.equal(projectDraft.generation.model,'synthetic-pegboard-model')
    assert.deepEqual((await call(owner.get(`/api/v1/status-history/project/${project.id}`))).revisions,[])
    await call(owner.post(`/api/v1/status-drafts/${projectDraft.id}/reject`,{version:projectDraft.version,reason:'Source assertion needs human editing'}))
    await call(owner.post(`/api/v1/status-drafts/${projectDraft.id}/review`,{}),409)
    const edited=await call(owner.patch(`/api/v1/status-drafts/${projectDraft.id}`,{...projectDraft.content,version:projectDraft.version,summary:'Human reviewed creative status',highlights:'Creative review completed after human verification',sourceIds:[source.id],recipients:[]}))
    const review=await call(owner.post(`/api/v1/status-drafts/${edited.id}/review`,{}))
    const published=await call(owner.post(`/api/v1/status-drafts/${edited.id}/publish`,{token:review.token}))
    const revision=await call(owner.get(`/api/v1/status-revisions/${published.id}`))
    assert.equal(revision.reviewedBy,owner.id);assert.equal(revision.content.summary,'Human reviewed creative status')
    const portfolio=await call(owner.post('/api/v1/portfolios',{name:'Model portfolio'}))
    await call(owner.post(`/api/v1/portfolios/${portfolio.id}/projects`,{projectId:project.id}))
    const portfolioInput={...input,subjectType:'portfolio',subjectId:portfolio.id}
    const portfolioDraft=await call(owner.post('/api/v1/status-drafts/generate',portfolioInput))
    assert.equal(portfolioDraft.subjectType,'portfolio');assert.deepEqual(portfolioDraft.recipients,[])
    const pendingClient=await call(owner.post('/api/v1/status-drafts',{...portfolioDraft.content,subjectType:'portfolio',subjectId:portfolio.id,sourceIds:[source.id],recipients:[]}))
    assert.deepEqual((await call(owner.get(`/api/v1/status-history/portfolio/${portfolio.id}`))).revisions,[])
    edge.controls.mode='uncited'
    await call(owner.post('/api/v1/status-drafts/generate',input),503)
    edge.controls.mode='revoked'
    const unavailable=await call(owner.post('/api/v1/status-drafts/generate',input),503)
    assert.equal(unavailable.error,'status_model_unavailable')
    await call(owner.patch(`/api/v1/tasks/${source.id}`,{title:'Ordinary task editing still works'}))
    edge.controls.mode='valid';edge.controls.beforeReply=async()=>{await call(owner.patch(`/api/v1/tasks/${source.id}`,{description:'Changed while the model was running'}))}
    await call(owner.post('/api/v1/status-drafts/generate',input),409)
    assert.equal((await call(owner.get(`/api/v1/status-history/project/${project.id}`))).revisions.length,1,'refused generations create no publication')
    assert.equal((await call(owner.get(`/api/v1/status-drafts/${pendingClient.id}`))).version,1,'separate client draft remains pending')
  } finally {await w.stop();await edge.close()}
}
