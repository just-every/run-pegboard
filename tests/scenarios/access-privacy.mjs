import assert from 'node:assert/strict'

const ok = async (promise, status = 200) => {
  const response = await promise
  assert.equal(response.status, status, JSON.stringify(response.body))
  return response.body
}
const address = number => `synthetic-pegboard-${number}@${'example.test'}`
const snapshot = async client => ok(client.get('/api/v1/access-requests'))

// A populated receipt list, blind real and invalid asks, both legitimate deciders,
// and current-access loss all pass through the authenticated public API.
export async function accessPrivacyScenario(w, {timing = false} = {}) {
  const owner = w.owner
  const requester = await w.person(address(9201), 'Privacy requester')
  const administrator = await w.person(address(9202), 'Privacy project administrator')
  const other = await w.person(address(9203), 'Unrelated reviewer')
  const create = name => ok(owner.post('/api/v1/projects', {name}))
  const known = await create('Known project')
  const hidden = await create('Private campaign synthetic-pegboard-9204')
  const invalid = 'prj_00000000000000000000'
  const grant = (project, person, level) => ok(owner.post('/api/v1/grants', {objectType:'project',objectId:project,granteeId:person.id,level}))
  await grant(hidden.id, administrator, 'admin')
  await grant(known.id, requester, 'viewer')
  await grant(known.id, other, 'admin')
  const ask = (target, level = 'viewer') => requester.post('/api/v1/access-requests', {targetId:target,level,message:'Please review access'})
  await ok(ask(known.id, 'editor'))
  await snapshot(owner)
  const baseline = await snapshot(requester)
  assert.equal(baseline.mine.length, 1, 'compare a populated receipt list, not an empty-list shortcut')
  const responses = [], samples = {private:[],invalid:[]}, receiptSamples = {private:[],invalid:[]}
  for (let index = 0; index < (timing ? 24 : 1); index++) {
    for (const [kind, target] of (index % 2 ? [['invalid',invalid],['private',hidden.id]] : [['private',hidden.id],['invalid',invalid]])) {
      const start = performance.now()
      const response = await ask(target)
      samples[kind].push(performance.now() - start)
      assert.equal(response.status, 200)
      responses.push(response.body)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      const readStart = performance.now()
      const receipts = await snapshot(requester)
      receiptSamples[kind].push(performance.now() - readStart)
      assert.deepEqual(receipts, baseline, 'shape, count, receipts, decisions and notices must remain identical')
    }
  }
  for (const response of responses) assert.deepEqual(response, responses[0])
  await w.restart()
  const unrelated = await snapshot(other)
  assert.ok(!unrelated.toDecide.some(request => request.targetId === hidden.id), 'unrelated Admin scope cannot resolve or see the private request')
  const ownerQueue = (await snapshot(owner)).toDecide.filter(request => request.targetId === hidden.id)
  const adminQueue = (await snapshot(administrator)).toDecide.filter(request => request.targetId === hidden.id)
  assert.equal(ownerQueue.length, 1, 'one real pending request survives restart and duplicate intake')
  assert.equal(adminQueue.length, 1)
  assert.equal(ownerQueue[0].id, adminQueue[0].id)
  assert.equal(ownerQueue[0].targetName, hidden.name)
  assert.equal((await requester.get('/api/v1/access-requests/'+ownerQueue[0].id)).status, 404)
  assert.deepEqual(await snapshot(requester), baseline)
  await ok(administrator.post('/api/v1/access-requests/'+adminQueue[0].id+'/decision', {decision:'deny',reason:'Private decision',revision:adminQueue[0].revision}))
  assert.deepEqual(await snapshot(requester), baseline, 'denial and its notice cannot become an existence oracle')
  assert.equal((await requester.get('/api/v1/projects/'+hidden.id)).status, 404)

  await ok(ask(hidden.id))
  const [second] = (await snapshot(owner)).toDecide.filter(request => request.targetId === hidden.id)
  assert.ok(second)
  assert.equal((await other.post('/api/v1/access-requests/'+second.id+'/decision', {decision:'approve',revision:second.revision})).status, 404)
  await ok(owner.post('/api/v1/access-requests/'+second.id+'/decision', {decision:'approve',revision:second.revision}))
  assert.equal((await requester.get('/api/v1/projects/'+hidden.id)).status, 200, 'the owner can grant the real request')
  assert.ok((await snapshot(requester)).mine.some(request => request.id === second.id && request.status === 'approved'))
  const access = (await ok(owner.get('/api/v1/grants?objectType=project&objectId='+hidden.id))).grants.find(row => row.grantee_id === requester.id)
  await ok(owner.delete('/api/v1/grants/'+access.id))
  assert.deepEqual(await snapshot(requester), baseline, 'revocation removes receipts and notices on the next read')
  for (const target of [hidden.id,invalid]) assert.equal((await requester.get('/api/v1/projects/'+target)).status, 404)
  assert.equal((await owner.post('/api/v1/access-requests/'+second.id+'/decision', {decision:'approve',revision:second.revision})).status, 409)
  assert.equal((await requester.get('/api/v1/projects/'+hidden.id)).status, 404, 'a captured decision cannot restore a revoked grant')

  // A queued ask from an ended identity cannot be revived by a later reviewer.
  const ended = await w.person(address(9205), 'Ended requester')
  await ok(ended.post('/api/v1/access-requests', {targetId:hidden.id}))
  await ok(owner.post('/api/v1/workspaces/ws_main/people/'+ended.id+'/account', {status:'inactive'}))
  const exported = await ok(owner.post('/api/portability/exports', {}), 201)
  let archive
  for (let index = 0; index < 100; index++) {
    const status = await ok(owner.post('/api/portability/exports/'+exported.id+'/advance', {maxParts:16}))
    if (status.phase === 'complete') { archive = await ok(owner.get('/api/portability/exports/'+exported.id+'/download')); break }
  }
  assert.equal(typeof archive, 'string', 'the native archive must complete')
  const rows = archive.trim().split('\n').map(line=>JSON.parse(line)).filter(record=>record.kind==='part').flatMap(record=>record.items).filter(record=>record.kind==='row')
  assert.ok(rows.some(record=>record.table==='peg_projects' && record.row.id===hidden.id), 'the archive contains the real project')
  assert.ok(!rows.some(record=>record.table==='peg_project_request_intake'), 'a restored capture must not replay blind intake authority')
  const erase = await ok(owner.post('/api/v1/data/erasure-preview', {type:'person',id:ended.id}))
  assert.deepEqual(erase.blockers, [])
  assert.equal(erase.counts.peg_project_request_intake, 1, 'erasure reviews the unresolved blind intake')
  await ok(owner.post('/api/v1/data/erase', {type:'person',id:ended.id,token:erase.token,confirm:true}))
  assert.ok(!(await snapshot(owner)).toDecide.some(request => request.requester.id === ended.id))
  assert.equal((await ended.post('/api/v1/access-requests', {targetId:hidden.id})).status, 401)

  const [knownRequest] = (await snapshot(owner)).toDecide.filter(request => request.targetId === known.id)
  await ok(owner.post('/api/v1/access-requests/'+knownRequest.id+'/decision', {decision:'deny',revision:knownRequest.revision}))

  if (timing) {
    const median = values => [...values].sort((a,b)=>a-b)[Math.floor(values.length/2)]
    const medians = Object.fromEntries(Object.entries(samples).map(([kind,values])=>[kind,median(values)]))
    const receiptMedians = Object.fromEntries(Object.entries(receiptSamples).map(([kind,values])=>[kind,median(values)]))
    // A broad integration bound catches target resolution or delivery on the response
    // path. Fixed-statement intake supplies the structural timing guarantee.
    for (const result of [medians,receiptMedians]) assert.ok(Math.abs(result.private-result.invalid) < Math.max(50, Math.min(result.private,result.invalid)), JSON.stringify(result))
    console.log(JSON.stringify({proof:'blind project acknowledgment timing',samples:24,medianMs:medians,receiptMedianMs:receiptMedians,head:process.env.PEGBOARD_PROOF_HEAD}))
  }
}
