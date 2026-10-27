import {createServer} from 'node:http'
import assert from 'node:assert/strict'
import { createHash, createHmac } from 'node:crypto'

export function registerPublicApiTests({ test, api }) {
 const ok = async (promise, status = 200) => { const r = await promise; assert.equal(r.status, status, JSON.stringify(r.body)); return r.body }
 const issue = (person, projects, extra = {}) => ok(person.post('/api/v1/api-keys', { name: 'synthetic-pegboard-1', projects, writable: true, consent: true, expiresAt: Date.now() + 3600000, ...extra }))
 const rest = (worker, key) => async (method, path, body) => {
  const response = await fetch(worker.origin + '/api/v1/public' + path, { method, headers: { authorization: 'Bearer ' + key.secret, 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  return { status: response.status, body: await response.json() }
 }
 const mcp = (call) => async (name, args = {}) => {
  const response = await call('POST', '/mcp', { jsonrpc: '2.0', id: 2, method: ['tools','call'].join('/'), params: { name, arguments: args } })
  assert.equal(response.status, 200, JSON.stringify(response.body))
  const result = response.body.result
  const body = JSON.parse(result.content[0].text)
  return { status: result.isError ? body.status : 200, body }
 }
 test('creates and edits through the published REST and MCP doors with exact pages, reports and signed replay-safe events', async () => {
  const { worker, root, webhookEdge } = api(), project = await ok(root.post('/api/v1/projects', { name: 'Public work' }))
  const key = await issue(root, [project.id]), call = rest(worker, key), tool = mcp(call)
  const schema = await ok(call('GET', '/openapi.json'))
  const operation=name=>Object.entries(schema.paths).flatMap(([path,methods])=>Object.entries(methods).filter(([,definition])=>definition.operationId===name).map(([method])=>({method:method.toUpperCase(),path})))[0]
  const createDoor=operation('task_create')
  const a = await ok(call(createDoor.method, createDoor.path, { projectId: project.id, title: 'First task', estimateHours: 3, intent: 'create-first' }))
  assert.deepEqual(await ok(call('POST', '/tasks', { projectId: project.id, title: 'First task', estimateHours: 3, intent: 'create-first' })), a)
  await ok(call('POST', '/tasks', { projectId: project.id, title: 'Another title', intent: 'create-first' }), 409)
  const b = await ok(tool('task_create', { projectId: project.id, title: 'Second task', estimateHours: 5, intent: 'create-second' }))
  const read = await ok(tool('task_read', { taskId: a.id }))
  await ok(tool('task_update',{taskId:a.id,revision:read.revision,patch:{title:42},intent:'invalid-schema'}),400)
  await ok(call('POST','/tasks',{projectId:project.id,title:'Impersonation',intent:'invalid-create',actorId:root.id}),400)
  await ok(call('PATCH', `/tasks/${a.id}`, { revision: read.revision, patch: { title: 'Revised task', status: 'doing' }, intent: 'edit-first' }))
  await ok(tool('task_update', { taskId: a.id, revision: read.revision, patch: { title: 'Stale replacement' }, intent: 'stale-edit' }), 409)
  assert.equal((await ok(root.get(`/api/v1/tasks/${a.id}`))).title, 'Revised task')
  const page = await ok(call('GET', `/projects/${project.id}/tasks?limit=1`))
  assert.equal(page.tasks.length, 1); assert.ok(page.next)
  const second = await ok(tool('project_tasks', { projectId: project.id, limit: 1, cursor: page.next }))
  assert.equal(second.tasks.length, 1); assert.equal(second.next, null)
  assert.deepEqual([...page.tasks, ...second.tasks].map(t => t.id).sort(), [a.id, b.id].sort())
  await ok(call('GET', `/projects/${project.id}/tasks?limit=invalid`),400)
  const report = await ok(tool('project_report', { projectId: project.id }))
  assert.equal(report.tasks, 2); assert.equal(report.estimateHours, 8); assert.deepEqual(report.byStatus, { todo: 1, doing: 1, done: 0 })
  const events = await ok(call('GET', '/events'))
  const event = events.events.find(e => e.envelope.taskId === a.id && e.envelope.type === 'task.created')
  assert.ok(event, 'the created event is actually present')
  const signingKey = createHash('sha256').update(JSON.stringify(key.secret)).digest('hex')
  assert.equal(event.signature, createHmac('sha256', signingKey).update(JSON.stringify(event.envelope)).digest('hex'))
  await ok(tool('event_receive', { ...event, envelope: { ...event.envelope, taskId: b.id } }), 403)
  assert.equal((await ok(tool('event_receive', event))).applied, true)
  assert.equal((await ok(call('POST', '/events/receive', event))).applied, false)
  const hook = await ok(root.post('/api/v1/webhooks', {projectId:project.id,url:'https://webhooks.example.com/events',events:['task.created']}))
  webhookEdge.setSecret(hook.secret)
  const preview=await ok(root.get(`/api/v1/webhooks/${hook.id}/event-preview?eventId=${event.envelope.id}`))
  await ok(root.post(`/api/v1/webhooks/${hook.id}/deliver`,{eventId:event.envelope.id,revision:preview.token,consent:true,secret:'synthetic-pegboard-2'}),403)
  const sent=await ok(root.post(`/api/v1/webhooks/${hook.id}/deliver`,{eventId:event.envelope.id,revision:preview.token,consent:true,secret:hook.secret}))
  assert.equal(sent.state,'acknowledged');assert.equal(webhookEdge.deliveries.length,1);assert.equal(webhookEdge.effects.size,1)
  assert.deepEqual(Object.keys(webhookEdge.deliveries[0].event).sort(),['at','id','subscriptionId','taskId','type'])
  assert.equal(webhookEdge.deliveries[0].event.taskId,a.id)
  assert.equal(webhookEdge.deliveries[0].signature,createHmac('sha256',hook.secret).update(webhookEdge.deliveries[0].text).digest('hex'))
  const replay=await ok(root.post(`/api/v1/webhooks/${hook.id}/deliver`,{eventId:event.envelope.id,revision:preview.token,consent:true,secret:hook.secret}))
  assert.equal(replay.replayed,true);assert.equal(webhookEdge.deliveries.length,1)
  const packet=webhookEdge.deliveries[0]
  const duplicate=await fetch(webhookEdge.origin+'/events',{method:'POST',headers:{'x-pegboard-signature':packet.signature},body:packet.text})
  assert.equal(duplicate.status,200);assert.equal(webhookEdge.effects.size,1)
  const forged=await fetch(webhookEdge.origin+'/events',{method:'POST',headers:{'x-pegboard-signature':'synthetic-pegboard-3'},body:packet.text})
  assert.equal(forged.status,403);assert.equal(webhookEdge.effects.size,1)
  assert.deepEqual((await ok(root.get(`/api/v1/webhooks/${hook.id}/deliveries`))).deliveries.map(d=>[d.event_id,d.state,d.status]),[[event.envelope.id,'acknowledged',200]])
  await worker.restart()
  assert.equal((await ok(tool('event_receive', event))).applied, false)
  await ok(root.delete(`/api/v1/webhooks/${hook.id}`))
  await ok(root.get(`/api/v1/webhooks/${hook.id}/event-preview?eventId=${event.envelope.id}`),404)
  assert.deepEqual(await ok(call('POST', '/tasks', { projectId: project.id, title: 'First task', estimateHours: 3, intent: 'create-first' })), a)
 })
 test('connects named clients using the MCP schema and refuses widened scope, expired keys and agent approval', async () => {
  const { worker, root, peer } = api(), p = await ok(root.post('/api/v1/projects', { name: 'Client work' })), hidden = await ok(root.post('/api/v1/projects', { name: 'Outside key scope' }))
  const hiddenTask = await ok(root.post('/api/v1/tasks', { title: 'Unshared title', projectId: hidden.id }))
  const shared = await ok(root.post('/api/v1/tasks', { title: 'Shared task', projectId: p.id }))
  await ok(root.post(`/api/v1/tasks/${shared.id}/projects`, { projectId: hidden.id }))
  await ok(root.post(`/api/v1/tasks/${shared.id}/comments`, { body: 'Inside both scopes' }))
  const key = await issue(root, [p.id]), call = rest(worker, key), tool = mcp(call)
  // Official JSON-RPC initialize and tool schema edges; these do not qualify live vendor accounts.
  for (const name of ['Claude', 'ChatGPT', 'Gemini', 'Cursor']) {
   const initialized = await ok(call('POST', '/mcp', { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name, version: 'synthetic-pegboard-1' } } }))
   assert.equal(initialized.result.protocolVersion, '2025-03-26'); assert.ok(initialized.result.capabilities.tools)
   const listed = await ok(call('POST', '/mcp', { jsonrpc: '2.0', id: 2, method: ['tools','list'].join('/') }))
   const readTool=listed.result.tools.find(t=>t.name==='task_read')
   assert.equal((await ok(tool(readTool.name, { taskId: shared.id }))).id, shared.id)
  }
  for (const taskId of [hiddenTask.id, 'tsk_00000000000000000000']) {
   const a = await call('GET', `/tasks/${taskId}`), b = await tool('task_read', { taskId })
   assert.equal(a.status, 404); assert.equal(b.status, 404); assert.equal(a.body.error, b.body.error)
  }
  const seen = await ok(tool('task_read', { taskId: shared.id }))
  assert.deepEqual(seen.projects.map(p => p.id), [p.id]); assert.ok(!JSON.stringify(seen).includes(hidden.id) && !JSON.stringify(seen).includes('Outside key scope'))
  await ok(call('GET', `/projects/${hidden.id}/report`), 404)
  const approval = await ok(tool('task_create', { title: 'Review my work', projectId: p.id, kind: 'approval', intent: 'approval' }))
  await ok(tool('task_approve', { taskId: approval.id }), 403)
  const reviewed = await ok(tool('task_read', { taskId: approval.id }))
  await ok(tool('task_update', { taskId: approval.id, revision: reviewed.revision, patch: { status: 'done' }, intent: 'bypass-approval' }), 409)
  assert.equal((await ok(root.get(`/api/v1/tasks/${approval.id}`))).status, 'todo')
  const readOnly = rest(worker, await issue(root, [p.id], { writable: false }))
  assert.equal((await ok(readOnly('GET', `/tasks/${shared.id}`))).id, shared.id)
  await ok(readOnly('POST', '/tasks', { title: 'Refused', projectId: p.id, intent: 'readonly' }), 403)
  const expired = await issue(root, [p.id])
  await worker.sql(`UPDATE peg_api_keys SET expires_at=1 WHERE id='${expired.id}'`)
  await ok(rest(worker, expired)('GET', `/tasks/${shared.id}`), 401)
  await ok(root.delete(`/api/v1/api-keys/${key.id}`))
  await ok(call('GET', `/tasks/${shared.id}`), 401)
  await ok(peer.delete(`/api/v1/api-keys/${expired.id}`), 403)
 })
 test('preserves personal privacy and guest Editor and Viewer decisions across the UI API, REST and MCP', async () => {
  const { worker, root, peer, guest } = api(), p = await ok(root.post('/api/v1/projects', { name: 'Permission parity' }))
  await ok(root.post('/api/v1/grants', { objectType: 'project', objectId: p.id, granteeId: guest.id, level: 'editor' }))
  await ok(root.post('/api/v1/grants', { objectType: 'project', objectId: p.id, granteeId: peer.id, level: 'viewer' }))
  const personal = await ok(peer.post('/api/v1/tasks', { title: 'A private note' }))
  const mine = rest(worker, await issue(peer, [], { personal: true })), admin = rest(worker, await issue(root, [p.id], { personal: true }))
  assert.deepEqual((await ok(mcp(mine)('personal_tasks'))).tasks.map(t => t.id), [personal.id])
  assert.deepEqual((await ok(admin('GET', '/personal-tasks'))).tasks, [])
  await ok(admin('GET', `/tasks/${personal.id}`), 404); await ok(mcp(admin)('task_read', { taskId: personal.id }), 404)
  const task = await ok(root.post('/api/v1/tasks', { title: 'Shared edit', projectId: p.id }))
  const guestCall = rest(worker, await issue(guest, [p.id])), guestTool = mcp(guestCall)
  const before = await ok(guestTool('task_read', { taskId: task.id }))
  await ok(guestCall('PATCH', `/tasks/${task.id}`, { revision: before.revision, patch: { title: 'Guest edited' }, intent: 'guest-edit' }))
  await ok(guest.patch(`/api/v1/tasks/${task.id}`, { description: 'Native guest edit' }))
  const view = await ok(guestTool('task_read', { taskId: task.id }))
  await ok(guestTool('task_update', { taskId: task.id, revision: view.revision, patch: { status: 'doing' }, intent: 'guest-mcp' }))
  assert.equal((await ok(root.get(`/api/v1/tasks/${task.id}`))).title, 'Guest edited')
  assert.equal((await ok(root.get(`/api/v1/tasks/${task.id}`))).status, 'doing')
  const viewer = rest(worker, await issue(peer, [p.id]))
  for (const result of [await peer.post(`/api/v1/tasks/${task.id}/comments`, { body: 'Refused native' }), await viewer('POST', `/tasks/${task.id}/comments`, { body: 'Refused REST', intent: 'viewer-rest' }), await mcp(viewer)('task_comment', { taskId: task.id, body: 'Refused MCP', intent: 'viewer-mcp' })]) assert.equal(result.status, 403)
  assert.deepEqual((await ok(root.get(`/api/v1/tasks/${task.id}`))).comments, [])
  await ok(guestTool('task_comment', { taskId: task.id, body: 'Allowed comment', intent: 'guest-comment' }))
  assert.deepEqual((await ok(root.get(`/api/v1/tasks/${task.id}`))).comments.map(c => c.body), ['Allowed comment'])
  const hiddenInput={title:'Later hidden work',projectId:p.id,intent:'later-hidden'}
  const hiddenCreated=await ok(guestTool('task_create',hiddenInput))
  await ok(root.patch(`/api/v1/tasks/${hiddenCreated.id}`,{internalOnly:true}))
  await ok(guestTool('task_create',hiddenInput),404)
  const grant = (await ok(root.get(`/api/v1/grants?objectType=project&objectId=${p.id}`))).grants.find(g => g.grantee_id === guest.id)
  await ok(root.delete(`/api/v1/grants/${grant.id}`))
  const reduced=await ok(root.post('/api/v1/grants',{objectType:'project',objectId:p.id,granteeId:guest.id,level:'viewer'}))
  await ok(guestTool('task_comment',{taskId:task.id,body:'Allowed comment',intent:'guest-comment'}),403)
  assert.equal((await ok(guestTool('task_read',{taskId:task.id}))).title,'Guest edited')
  await ok(root.delete(`/api/v1/grants/${reduced.id}`))
  await ok(guestCall('GET', `/tasks/${task.id}`), 404)
  await ok(guestTool('task_comment', { taskId: task.id, body: 'Revoked', intent: 'revoked' }), 404)
 })
}

export async function startWebhookEdge() {
 const deliveries=[], effects=new Set()
 let secret='synthetic-pegboard-1'
 const server=createServer(async(req,res)=>{
  const chunks=[];for await(const chunk of req)chunks.push(chunk)
  const text=Buffer.concat(chunks).toString(), expected=createHmac('sha256',secret).update(text).digest('hex')
  if(req.headers['x-pegboard-signature']!==expected){res.writeHead(403);res.end('forged');return}
  const event=JSON.parse(text);deliveries.push({event,text,signature:req.headers['x-pegboard-signature']});effects.add(event.id)
  res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({received:event.id}))
 })
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 return {origin:'http://127.0.0.1:'+server.address().port,deliveries,effects,setSecret:value=>{secret=value},stop:()=>new Promise(resolve=>server.close(resolve))}
}
