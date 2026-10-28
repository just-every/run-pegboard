import assert from 'node:assert/strict'
const token = 'synthetic-pegboard-251', calendarId = 'synthetic-pegboard-250'
const ok = async (promise, status = 200) => { const r = await promise; assert.equal(r.status, status, JSON.stringify(r.body)); return r.body }
export function registerCalendarBlockTests({ test, context }) {
 test('reserves free time on both provider schemas, reconciles DST moves, deletion, replay, reconnect and restart without changing deadlines', async () => {
  const { w, services } = context(), root = w.owner
  for (const service of ['google', 'microsoft']) {
   const p = await ok(root.post('/api/v1/projects', { name: 'Calendar ' + service })), task = await ok(root.post('/api/v1/tasks', { projectId: p.id, title: 'Private calendar work', dueDate: '2026-03-20', ownerId: root.id }))
   const connection = await ok(root.post('/api/v1/workspaces/ws_main/calendars', { service, calendarId, credential: token, consent: true }))
   const leave = await ok(root.post('/api/v1/workspaces/ws_main/time-off', {start:'2026-03-05',end:'2026-03-05'}))
   const closed = date => root.post(`/api/v1/tasks/${task.id}/calendar-preview`, {connectionId:connection.id,date,minutes:60,credential:token})
   assert.deepEqual((await ok(closed('2026-03-05'))).slots, [], 'personal leave remains unavailable')
   assert.deepEqual((await ok(closed('2026-01-19'))).slots, [], 'observed federal holidays remain unavailable')
   await ok(root.post(`/api/v1/workspaces/ws_main/time-off/${leave.id}/remove`, {}))
   const preview = await ok(root.post(`/api/v1/tasks/${task.id}/calendar-preview`, { connectionId: connection.id, date: '2026-03-06', minutes: 60, credential: token }))
   assert.equal(preview.slots[0].start, '2026-03-06T15:00:00.000Z', 'the locked 9am meeting remains reserved')
   assert.ok(preview.slots.every(s => s.start >= '2026-03-06T15:00:00.000Z' && s.end <= '2026-03-06T22:00:00.000Z'))
   const create = () => root.post(`/api/v1/calendar-previews/${preview.id}/apply`, { slot: 0, credential: token })
   services.state[service].loseNextCreate = true
   await ok(create(), 503)
   await w.restart()
   const block = await ok(create()); assert.equal(block.state, 'scheduled'); assert.equal(block.start_at, '2026-03-06T15:00:00.000Z')
   assert.equal((await ok(create())).id, block.id); assert.equal(services.state[service].events.size, 1)
   let mapping = await ok(root.get(`/api/v1/projects/${p.id}/calendar-blocks`)); assert.equal(mapping[0].event_id, block.event_id); assert.equal(mapping[0].connection_id, connection.id); assert.equal(mapping[0].task_id, task.id)
   const moved = await ok(root.post(`/api/v1/tasks/${task.id}/calendar-preview`, { connectionId: connection.id, date: '2026-03-09', minutes: 60, credential: token }))
   assert.equal(moved.slots[0].start, '2026-03-09T13:00:00.000Z', '9am stays local after DST')
   const changed = await ok(root.post(`/api/v1/calendar-previews/${moved.id}/apply`, { slot: 0, credential: token })); assert.equal(changed.event_id, block.event_id); assert.equal(changed.start_at, '2026-03-09T13:00:00.000Z')
   services.move(service, block.event_id, '2026-03-10T14:00:00.000Z', '2026-03-10T15:00:00.000Z')
   const synced = await ok(root.post(`/api/v1/calendar-blocks/${block.id}/sync`, { credential: token })); assert.equal(synced.start_at, '2026-03-10T14:00:00.000Z')
   await ok(root.post(`/api/v1/calendars/${connection.id}/disconnect`, {}))
   await ok(root.post(`/api/v1/calendar-blocks/${block.id}/sync`, { credential: token }), 409)
   const reconnect = await ok(root.post('/api/v1/workspaces/ws_main/calendars', { service, calendarId, credential: token, consent: true })); assert.equal(reconnect.id, connection.id)
   assert.equal((await ok(root.post(`/api/v1/calendar-blocks/${block.id}/sync`, { credential: token }))).event_id, block.event_id)
   assert.equal(services.state[service].events.size, 1)
   assert.equal((await ok(root.get(`/api/v1/tasks/${task.id}`))).dueDate, '2026-03-20')
   mapping = await ok(root.get(`/api/v1/projects/${p.id}/calendar-blocks`))
   const remove = () => root.post(`/api/v1/calendar-blocks/${block.id}/delete`, { revision: mapping[0].revision, credential: token })
   assert.equal((await ok(remove())).state, 'cancelled'); assert.equal((await ok(remove())).state, 'cancelled')
   assert.equal((await ok(create())).state, 'cancelled', 'old create replay cannot resurrect a deleted event'); assert.equal(services.state[service].events.size, 0)
   const cancelledRead = await ok(root.get(`/api/v1/projects/${p.id}/calendar-blocks`)); assert.equal(cancelledRead[0].state, 'cancelled')
   assert.equal((await ok(root.get(`/api/v1/tasks/${task.id}`))).dueDate, '2026-03-20')
   const events = services.state[service].calls.filter(c => ['POST', 'PATCH'].includes(c.method) && c.path.endsWith('/events'))
   assert.ok(events.every(c => !JSON.stringify(c.body).includes('Private calendar work') && !JSON.stringify(c.body).includes('2026-03-20')))
   assert.ok(!services.state[service].error, String(services.state[service].error))
   const erased = await ok(root.post('/api/v1/data/erasure-preview', {type:'task',id:task.id}))
   await ok(root.post('/api/v1/data/erase', {type:'task',id:task.id,token:erased.token,confirm:true}))
   const calls = services.state[service].calls.length
   await ok(create(), 400); assert.equal(services.state[service].calls.length, calls, 'erasure fences every old calendar intent before the network')
  }
  const exported = await ok(root.post('/api/portability/exports', {}), 201)
  let archive
  for (let page = 0; page < 40; page++) {
   const progress = await ok(root.post(`/api/portability/exports/${exported.id}/advance`, {maxParts:16}))
   if (progress.phase === 'complete') {archive = await ok(root.get(`/api/portability/exports/${exported.id}/download`)); break}
  }
  assert.ok(archive, 'the native archive completes')
  const text = JSON.stringify(archive)
  assert.ok(!text.includes(token) && !text.includes(calendarId), 'credentials and calendar account identity do not travel in the archive')
 })
 test('refuses unsafe calendar authority and stale reviews, exposes simultaneous task and provider conflicts and leaves deadlines untouched', async () => {
  const { w, services } = context(), root = w.owner, member = await w.person(['calendar-member', 'example.test'].join(String.fromCharCode(64)), 'Calendar member'), guest = await w.person(['calendar-guest', 'example.test'].join(String.fromCharCode(64)), 'Calendar guest', 'guest')
  const p = await ok(root.post('/api/v1/projects', { name: 'Conflict calendar', visibility: 'workspace' })), task = await ok(root.post('/api/v1/tasks', { projectId: p.id, title: 'Conflict work', ownerId: root.id, dueDate: '2026-03-20' }))
  for (const service of ['google', 'microsoft']) {
   const data = services.state[service], request = { service, calendarId, credential: token, consent: true }
   const noWrites = () => data.calls.filter(c => c.method !== 'GET').length
   let before = noWrites()
   await ok(member.post('/api/v1/workspaces/ws_main/calendars', request), 403); await ok(guest.post('/api/v1/workspaces/ws_main/calendars', request), 403); assert.equal(noWrites(), before)
   await ok(root.post('/api/v1/workspaces/ws_main/calendars', { ...request, consent: false }), 400)
   data.readOnly = true; await ok(root.post('/api/v1/workspaces/ws_main/calendars', request), 403); data.readOnly = false
   const c = await ok(root.post('/api/v1/workspaces/ws_main/calendars', request))
   const preview = (date = '2026-03-09') => root.post(`/api/v1/tasks/${task.id}/calendar-preview`, { connectionId: c.id, date, minutes: 60, credential: token })
   await ok(member.post(`/api/v1/tasks/${task.id}/calendar-preview`, { connectionId: c.id, date: '2026-03-09', minutes: 60, credential: token }), 403)
   assert.deepEqual((await ok(preview('2026-03-08'))).slots, [], 'closed Sunday never gets a reservation')
   assert.deepEqual((await ok(preview('2026-03-23'))).slots, [], 'no reservations after a deadline')
   let proposed = await ok(preview()); await ok(root.patch(`/api/v1/tasks/${task.id}`, { description: 'Concurrent task edit ' + service }))
   before = data.events.size; await ok(root.post(`/api/v1/calendar-previews/${proposed.id}/apply`, { slot: 0, credential: token }), 409); assert.equal(data.events.size, before)
   proposed = await ok(preview()); const block = await ok(root.post(`/api/v1/calendar-previews/${proposed.id}/apply`, { slot: 0, credential: token }))
   const next = await ok(preview('2026-03-10')); services.move(service, block.event_id, '2026-03-11T13:00:00.000Z', '2026-03-11T14:00:00.000Z')
   await ok(root.post(`/api/v1/calendar-previews/${next.id}/apply`, { slot: 0, credential: token }), 409)
   assert.equal((await ok(root.get(`/api/v1/projects/${p.id}/calendar-blocks`))).find(b => b.id === block.id).state, 'conflict')
   await ok(root.post(`/api/v1/calendar-blocks/${block.id}/sync`, { credential: token }))
   const race = await ok(preview('2026-03-12')); data.beforeWrite = () => ok(root.patch(`/api/v1/tasks/${task.id}`, { description: 'Edited during provider write ' + service }))
   await ok(root.post(`/api/v1/calendar-previews/${race.id}/apply`, { slot: 0, credential: token }), 409)
   let rows = await ok(root.get(`/api/v1/projects/${p.id}/calendar-blocks`)); assert.equal(rows.find(b => b.id === block.id).cause, 'calendar_task_changed')
   assert.equal((await ok(root.get(`/api/v1/tasks/${task.id}`))).dueDate, '2026-03-20'); assert.equal(data.events.size, 1)
   const repair = await ok(preview('2026-03-13')); await ok(root.post(`/api/v1/calendar-previews/${repair.id}/apply`, { slot: 0, credential: token }))
   data.denied = true; await ok(root.post(`/api/v1/calendar-blocks/${block.id}/sync`, { credential: token }), 403); data.denied = false
   await ok(root.post(`/api/v1/calendar-blocks/${block.id}/sync`, { credential: token }), 409)
   await ok(root.post('/api/v1/workspaces/ws_main/calendars', request))
   rows = await ok(root.get(`/api/v1/projects/${p.id}/calendar-blocks`)); await ok(root.post(`/api/v1/calendar-blocks/${block.id}/delete`, { revision: rows.find(b => b.id === block.id).revision, credential: token }))
   assert.equal(data.events.size, 0); assert.ok(!data.error, String(data.error))
  }
 })
}
