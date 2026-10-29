import assert from 'node:assert/strict'
import { sheetsCredential as credential, spreadsheetId } from '../support/sheets-service.mjs'
const ok = async (promise, status = 200) => { const r = await promise; assert.equal(r.status, status, JSON.stringify(r.body)); return r.body }
const writes = edge => edge.state.calls.filter(c => c.method === 'POST').length
export async function eraseSheetTask(root, id) {
 const plan = await ok(root.post('/api/v1/data/erasure-preview', { type: 'task', id }))
 await ok(root.post('/api/v1/data/erase', { type: 'task', id, token: plan.token, confirm: true }))
}
export async function seedSheetWork(w) {
 const root = w.owner, projects = []
 for (const name of ['Agency launch', 'Operations delivery', 'Client rollout']) projects.push(await ok(root.post('/api/v1/projects', { name })))
 const shared = await ok(root.post('/api/v1/tasks', { title: '=Untrusted spreadsheet text', projectId: projects[0].id, status: 'todo', internalNotes: 'Never export the hidden agency note' }))
 await ok(root.post(`/api/v1/tasks/${shared.id}/projects`, { projectId: projects[1].id }))
 const second = await ok(root.post('/api/v1/tasks', { title: 'Operations review', projectId: projects[1].id }))
 const third = await ok(root.post('/api/v1/tasks', { title: 'Client checklist', projectId: projects[2].id }))
 const personal = await ok(root.post('/api/v1/tasks', { title: 'Private no-project work' }))
 const visible = await ok(root.post(`/api/v1/projects/${projects[0].id}/fields`, { key: 'delivery_code', label: 'Delivery code', type: 'text' }))
 const hidden = await ok(root.post(`/api/v1/projects/${projects[0].id}/fields`, { key: 'private_code', label: 'Hidden financial code', type: 'text', visibility: 'internal' }))
 await ok(root.post(`/api/v1/tasks/${shared.id}/fields`, { projectId: projects[0].id, values: { delivery_code: 'Agency-42', private_code: 'Never export hidden field value' } }))
 const fields = ['title', 'status', projects[0].id + ':' + visible.id]
 return { projects, shared, second, third, personal, visible, hidden, fields, input: { spreadsheetId, credential, projects: projects.map(p => p.id), fields, consent: true } }
}
export function registerSheetsExportTests({ test, context }) {
 test('exports and refreshes exact three-project Sheets rows, reconciles uncertain sends across restart and never imports spreadsheet edits', async () => {
  const { w, edge } = context(), root = w.owner, seeded = await seedSheetWork(w)
  const cfg = await ok(root.post('/api/v1/sheets', seeded.input)), preview = () => ok(root.post(`/api/v1/sheets/${cfg.id}/reviews`, { credential }))
  const review = await preview(), expectedIds = [seeded.shared.id, seeded.second.id, seeded.third.id].sort()
  assert.deepEqual(review.columns, ['Task ID', 'Project IDs', 'Record state', 'Title', 'Status', 'Agency launch: Delivery code'])
  assert.deepEqual(review.values.slice(2).map(r => r[0]), expectedIds)
  const expected = new Map([[seeded.shared.id, [seeded.shared.id, seeded.projects.slice(0, 2).map(p => p.id).sort().join(', '), 'active', '=Untrusted spreadsheet text', 'todo', 'Agency-42']], [seeded.second.id, [seeded.second.id, seeded.projects[1].id, 'active', 'Operations review', 'todo', '']], [seeded.third.id, [seeded.third.id, seeded.projects[2].id, 'active', 'Client checklist', 'todo', '']]])
  assert.deepEqual(review.values.slice(2), expectedIds.map(id => expected.get(id)))
  assert.deepEqual(review.audience.map(a => a.id), ['synthetic-pegboard-772', 'synthetic-pegboard-773'], 'Drive permission pagination includes the recipient')
  assert.ok(!JSON.stringify(review).includes(seeded.personal.id) && !JSON.stringify(review).includes('Never export'))
  edge.state.loseNextWrite = true
  const send = () => root.post(`/api/v1/sheet-reviews/${review.id}/send`, { credential, confirm: true })
  await ok(send(), 503); const before = writes(edge); await w.restart()
  assert.equal((await ok(send())).state, 'confirmed'); assert.equal(writes(edge), before, 'uncertain response is read back without retrying the write')
  assert.equal((await ok(send())).state, 'confirmed'); assert.equal(writes(edge), before)
  let settings = await ok(root.get('/api/v1/sheets')), cfgRow = settings.exports.find(e => e.id === cfg.id), tab = edge.state.tabs.get(cfgRow.sheet_id)
  assert.deepEqual(tab.values, review.values); assert.equal(cfgRow.watermark, review.watermark)
  tab.rows = tab.values.length
  tab.values.find(r => r[0] === seeded.shared.id)[3] = 'Edited in spreadsheet only'
  assert.equal((await ok(root.get(`/api/v1/tasks/${seeded.shared.id}`))).title, '=Untrusted spreadsheet text')
  await ok(root.patch(`/api/v1/tasks/${seeded.shared.id}`, { title: 'Edited native work', status: 'doing' }))
  await eraseSheetTask(root, seeded.second.id)
  const added = await ok(root.post('/api/v1/tasks', { title: 'New rollout work', projectId: seeded.projects[2].id }))
  const refresh = await preview()
  assert.deepEqual(refresh.values.slice(2).map(r => r[0]), [...expectedIds, added.id], 'old row mapping stays fixed and new work appends')
  const sharedRow = refresh.values.find(r => r[0] === seeded.shared.id), deletedRow = refresh.values.find(r => r[0] === seeded.second.id)
  assert.deepEqual(sharedRow.slice(2), ['active', 'Edited native work', 'doing', 'Agency-42']); assert.deepEqual(deletedRow, [seeded.second.id, '', 'deleted', '', '', ''])
  assert.equal((await ok(root.post(`/api/v1/sheet-reviews/${refresh.id}/send`, { credential, confirm: true }))).state, 'confirmed')
  assert.deepEqual(edge.state.tabs.get(cfgRow.sheet_id).values, refresh.values)
  assert.notEqual(refresh.values[0][2], review.values[0][2], 'every refresh has a distinct reconciliation identity')
  const interrupted = await preview(); edge.state.loseNextWrite = true
  await ok(root.post(`/api/v1/sheet-reviews/${interrupted.id}/send`, { credential, confirm: true }), 503)
  await ok(root.patch(`/api/v1/tasks/${seeded.shared.id}`, { title: 'Edited during uncertain response' }))
  await w.restart()
  const pendingView = await ok(root.get(`/api/v1/sheet-reviews/${interrupted.id}`)); assert.equal(pendingView.state, 'pending'); assert.ok(!pendingView.values, 'readback controls reveal no stale content')
  const attempts = writes(edge)
  assert.equal((await ok(root.post(`/api/v1/sheet-reviews/${interrupted.id}/reconcile`, { credential }))).state, 'confirmed'); assert.equal(writes(edge), attempts)
  assert.equal((await ok(root.get(`/api/v1/tasks/${seeded.shared.id}`))).title, 'Edited during uncertain response')
  const pending = await preview(); edge.state.failNextWrite = true
  await ok(root.post(`/api/v1/sheet-reviews/${pending.id}/send`, { credential, confirm: true }), 503)
  assert.equal((await ok(root.post(`/api/v1/sheet-reviews/${pending.id}/reconcile`, { credential }))).state, 'not_applied')
  const repaired = await preview(); await ok(root.post(`/api/v1/sheet-reviews/${repaired.id}/send`, { credential, confirm: true }))
  const unsafe = await preview(), erasure = await ok(root.post('/api/v1/data/erasure-preview', { type: 'task', id: seeded.shared.id }))
  await ok(root.post('/api/v1/data/erase', { type: 'task', id: seeded.shared.id, token: erasure.token, confirm: true }))
  const sent = writes(edge); await ok(root.post(`/api/v1/sheet-reviews/${unsafe.id}/send`, { credential, confirm: true }), 409); assert.equal(writes(edge), sent)
  const afterErase = await preview(); assert.deepEqual(afterErase.values.find(r => r[0] === seeded.shared.id), [seeded.shared.id, '', 'deleted', '', '', ''])
  await ok(root.post(`/api/v1/sheet-reviews/${afterErase.id}/send`, { credential, confirm: true }))
  const exportJob = await ok(root.post('/api/portability/exports', {}), 201)
  let archive
  for (let n = 0; n < 40; n++) { const progress = await ok(root.post(`/api/portability/exports/${exportJob.id}/advance`, { maxParts: 16 })); if (progress.phase === 'complete') { archive = await ok(root.get(`/api/portability/exports/${exportJob.id}/download`)); break } }
  assert.ok(archive); assert.ok(!JSON.stringify(archive).includes(spreadsheetId) && !JSON.stringify(archive).includes(credential), 'Google destination and ephemeral credentials do not travel in native archives')
  assert.ok(!edge.state.error, edge.state.error)
 })
 test('refuses stale content, changed or unknown audiences, unsafe authority and revoked Sheets grants without sending', async () => {
  const { w, edge } = context(), root = w.owner, seeded = await seedSheetWork(w)
  const member = await w.person(['sheets-member', 'example.test'].join(String.fromCharCode(64)), 'Sheets member'), guest = await w.person(['sheets-guest', 'example.test'].join(String.fromCharCode(64)), 'Sheets guest', 'guest')
  for (const client of [member, guest]) { await ok(client.post('/api/v1/sheets', seeded.input), 403); await ok(client.get('/api/v1/sheets'), 403); await ok(client.get('/app/settings/sheets'), 403) }
  await ok(root.post('/api/v1/sheets', { ...seeded.input, consent: false }), 400)
  await ok(root.post('/api/v1/sheets', { ...seeded.input, fields: ['internal_notes'] }), 403)
  edge.state.readOnly = true; await ok(root.post('/api/v1/sheets', seeded.input), 403); edge.state.readOnly = false
  const cfg = await ok(root.post('/api/v1/sheets', seeded.input)), preview = () => ok(root.post(`/api/v1/sheets/${cfg.id}/reviews`, { credential })), send = review => root.post(`/api/v1/sheet-reviews/${review.id}/send`, { credential, confirm: true })
  let review = await preview(), sent = writes(edge)
  await ok(send({ id: review.id }), 200); sent++
  review = await preview(); await ok(root.patch(`/api/v1/tasks/${seeded.shared.id}`, { title: 'Concurrent native edit' })); await ok(send(review), 409); assert.equal(writes(edge), sent)
  review = await preview(); edge.state.permissions[1].role = 'writer'; await ok(send(review), 409); assert.equal(writes(edge), sent)
  review = await preview(); await ok(send(review)); sent++
  review = await preview(); edge.state.unknownAudience = true; await ok(send(review), 409); await ok(root.post(`/api/v1/sheets/${cfg.id}/reviews`, { credential }), 409); edge.state.unknownAudience = false; assert.equal(writes(edge), sent)
  review = await preview(); edge.state.unavailable = true; await ok(send(review), 503); edge.state.unavailable = false; assert.equal(writes(edge), sent)
  review = await preview(); edge.state.trashed = true; await ok(send(review), 403); edge.state.trashed = false; assert.equal(writes(edge), sent)
  review = await preview(); edge.state.denied = true; await ok(send(review), 403); edge.state.denied = false; assert.equal(writes(edge), sent)
  const current = await preview(); const calls = edge.state.calls.length
  await ok(member.post(`/api/v1/sheet-reviews/${current.id}/send`, { credential, confirm: true }), 403)
  await ok(guest.get(`/api/v1/sheet-reviews/${current.id}`), 403); assert.equal(edge.state.calls.length, calls)
  await ok(root.post(`/api/v1/sheet-reviews/${current.id}/send`, { credential, confirm: false }), 400); assert.equal(writes(edge), sent)
  await ok(root.patch('/api/v1/workspaces/ws_main/settings', { integrationsEnabled: false }))
  const disabledCalls = edge.state.calls.length
  await ok(send(current), 403); assert.equal(edge.state.calls.length, disabledCalls, 'current export policy is rechecked before the network')
  const grant = await ok(root.post(`/api/v1/sheets/${cfg.id}/revoke`, {})); assert.equal(grant.active, false)
  await ok(root.patch('/api/v1/workspaces/ws_main/settings', { integrationsEnabled: true }))
  const snapshot = JSON.stringify([...edge.state.tabs]), stopped = edge.state.calls.length
  await ok(send(current), 409); await ok(root.post(`/api/v1/sheets/${cfg.id}/reviews`, { credential }), 409); await ok(root.get(`/api/v1/sheet-reviews/${current.id}`), 409)
  await w.restart(); await ok(send(current), 409); assert.equal(edge.state.calls.length, stopped); assert.equal(JSON.stringify([...edge.state.tabs]), snapshot, 'revocation does not claim to erase existing external copies')
  assert.ok(!JSON.stringify(await ok(root.get('/api/v1/sheets'))).includes(credential))
  assert.ok(!edge.state.error, edge.state.error)
 })
}
