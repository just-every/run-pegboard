// Explicit held-credential qualification; never selected by ordinary push Verify.
import assert from 'node:assert/strict'
import { startWorker } from '../support/worker.mjs'

if(!process.env.AI_API_KEY || !process.env.AI_MODEL) throw Error('Authorized model configuration required')
const w=await startWorker({settings:{AI_ENABLED:'true',AI_API_KEY:process.env.AI_API_KEY,AI_MODEL:process.env.AI_MODEL,AI_PROCESSOR:'status-model',AI_BASE_URL:'https://api.openai.com/v1'}})
const call=async(p,status=200)=>{const result=await p;assert.equal(result.status,status,JSON.stringify(result.body));return result.body}
try {
  const owner=w.owner,member=await w.person('synthetic-pegboard-model-3'+'@'+'example.com','Internal Status Reviewer')
  const portfolio=await call(owner.post('/api/v1/portfolios',{name:'Agency launch portfolio'})),projects=[],sources=[]
  const work=[['Creative review','Final creative is approved. The creative review is complete.','done'],['Venue contract','The venue contract is unsigned. Missing signature is a delivery risk.','todo'],['Launch decision','The client has not approved a final launch date. Next step is a human decision.','todo']]
  for(const [title,description,status] of work) {
    const project=await call(owner.post('/api/v1/projects',{name:title,visibility:'workspace'}));projects.push(project)
    await call(owner.post(`/api/v1/portfolios/${portfolio.id}/projects`,{projectId:project.id}))
    sources.push(await call(owner.post('/api/v1/tasks',{projectId:project.id,title,description,status})))
  }
  await call(owner.post('/api/v1/data/processors',{processor:'status-model',approved:true,sharing:true,training:false,confirm:true}))
  await w.sql(`UPDATE peg_tasks SET updated_at=${Date.parse('2026-10-15T12:00:00Z')} WHERE id IN (${sources.map(source=>`'${source.id}'`).join(',')})`)
  const receipts=[]
  for(const [type,id,selected] of [['project',projects[0].id,[sources[0]]],['portfolio',portfolio.id,sources]]) {
    const input={subjectType:type,subjectId:id,sourceIds:selected.map(source=>source.id),from:'2026-10-01',to:'2026-10-31',modelConsent:true}
    const draft=await call(owner.post('/api/v1/status-drafts/generate',input))
    assert.equal(draft.generation.model,process.env.AI_MODEL);assert.deepEqual(draft.recipients,[])
    assert.equal((await call(owner.get(`/api/v1/status-history/${type}/${id}`))).revisions.length,0)
    const assertions=JSON.parse(draft.generation.assertions)
    assert.ok(assertions.length>0);for(const assertion of assertions)assert.ok(assertion.sourceIds.every(source=>selected.some(row=>row.id===source)))
    await call(owner.post(`/api/v1/status-drafts/${draft.id}/reject`,{version:draft.version,reason:'Human reviewer requests a precise sourced assertion'}))
    await call(owner.post(`/api/v1/status-drafts/${draft.id}/review`,{}),409)
    const edited=await call(owner.patch(`/api/v1/status-drafts/${draft.id}`,{...draft.content,version:draft.version,summary:`Human-reviewed ${type} update`,highlights:'The creative review is complete; final creative is approved.',sourceIds:selected.map(source=>source.id),recipients:[{id:member.id,channels:['in_app']}]}))
    const review=await call(owner.post(`/api/v1/status-drafts/${edited.id}/review`,{}))
    const published=await call(owner.post(`/api/v1/status-drafts/${edited.id}/publish`,{token:review.token}))
    const replay=await call(owner.post(`/api/v1/status-drafts/${edited.id}/publish`,{token:review.token}))
    assert.equal(replay.id,published.id)
    const revision=await call(owner.get(`/api/v1/status-revisions/${published.id}`))
    assert.equal(revision.reviewedBy,owner.id);assert.equal(revision.content.highlights,'The creative review is complete; final creative is approved.')
    const clientDraft=await call(owner.post('/api/v1/status-drafts',{...edited.content,subjectType:type,subjectId:id,sourceIds:selected.map(source=>source.id),recipients:[]}))
    assert.equal((await call(owner.get(`/api/v1/status-drafts/${clientDraft.id}`))).version,1)
    assert.equal((await call(owner.get(`/api/v1/status-history/${type}/${id}`))).revisions.length,1)
    assert.ok((await call(member.get('/api/v1/status-inbox'))).updates.some(update=>update.id===published.id))
    receipts.push({subjectType:type,model:draft.generation.model,processor:draft.generation.processor,window:[draft.content.from,draft.content.to],sourceFacts:selected.map(source=>({id:source.id,title:source.title,description:source.description,status:source.status})),generated:draft.content,assertions,usage:JSON.parse(draft.generation.usage),humanPublished:true,replayOnce:true,clientPending:true})
  }
  console.log(JSON.stringify({qualification:'actual-model',receipts},null,2))
} finally {await w.stop()}
