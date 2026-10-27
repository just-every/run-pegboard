import assert from 'node:assert/strict'

const pass = async (promise, status = 200) => { const r = await promise; assert.equal(r.status, status, JSON.stringify(r.body)); return r.body }
const week = [null, ...Array.from({ length: 5 }, () => ({ start: 540, end: 1020 })), null]
const shift = (plan, id) => { const row = plan.shifts.find(row => row.id === id); assert.ok(row, 'the exact affected task is present'); return row }
const dates = async (client, id) => { const task = await pass(client.get(`/api/v1/tasks/${id}`)); return [task.startDate ?? task.start_date, task.dueDate ?? task.due_date] }
const preview = (client, moves) => pass(client.post('/api/v1/schedule/preview', { moves }))
const apply = (client, moves, plan) => pass(client.post('/api/v1/schedule/apply', { moves, revision: plan.stamp }))
const work = (root, project, title, extra) => pass(root.post('/api/v1/tasks', { projectId: project.id, title, ...extra }))
async function workspace(root, peer, guest, name) {
  const ws = await pass(root.post('/api/v1/workspaces', { name }))
  for (const [person, role] of [[peer, 'member'], [guest, 'guest']]) await pass(root.post(`/api/v1/workspaces/${ws.id}/people`, { email: person.email, displayName: person.name, role }))
  const project = await pass(root.post('/api/v1/projects', { workspaceId: ws.id, name }))
  await pass(root.post('/api/v1/grants', { objectType: 'project', objectId: project.id, granteeId: peer.id, level: 'editor' }))
  return { ws, project, path: `/api/v1/workspaces/${ws.id}` }
}

// Public requests use the real authenticated Worker, database and scheduling algorithm. Resolve clients after setup.
export function registerCalendarTests({ test, api }) {
  test('uses persisted working hours and personal time off for requested timed edits and dependent shifts across DST', async () => {
    const { root, peer, guest, worker } = api(), { project, path } = await workspace(root, peer, guest, 'Synthetic calendar launch')
    const form = { zone: 'America/Chicago' }
    for (let day = 0; day < 7; day++) { form[`day${day}Start`] = day === 0 || day === 3 || day === 6 ? '' : '09:00'; form[`day${day}End`] = day === 0 || day === 3 || day === 6 ? '' : day === 5 ? '13:00' : '17:00' }
    await pass(root.form(path + '/working-calendar', form), 303)
    await pass(peer.form(path + '/time-off', { start: '2026-03-09', end: '2026-03-09' }), 303)
    const pred = await work(root, project, 'Synthetic boards review', { dueDate: '2026-03-05T15:00:00Z' })
    const succ = await work(root, project, 'Synthetic display setup', { ownerId: peer.id, startDate: '2026-03-06T15:00:00Z', dueDate: '2026-03-06T17:00:00Z', estimateHours: 2 })
    const requested = await work(root, project, 'Synthetic requested timed edit', { startDate: '2026-03-03T15:00:00Z', dueDate: '2026-03-03T17:00:00Z' })
    await pass(root.post('/api/v1/dependencies', { predecessor: pred.id, successor: succ.id, type: 'fs' }))
    const baseline = await pass(root.post(`/api/v1/projects/${project.id}/baselines`, { name: 'Synthetic original calendar' }))
    await worker.restart()
    const own = await pass(peer.get(path + '/availability'))
    assert.equal(own.zone, 'America/Chicago'); assert.deepEqual(own.week[5], { start: 540, end: 780 }); assert.equal(own.week[3], null)
    assert.deepEqual(own.timeOff.map(row => [row.start, row.end]), [['2026-03-09', '2026-03-09']])
    const moves = [{ taskId: pred.id, due: '2026-03-06T15:00:00Z' }, { taskId: requested.id, start: '2026-03-07T13:00:00Z', due: '2026-03-07T15:00:00Z' }]
    const plan = await preview(root, moves), dependent = shift(plan, succ.id), explicit = shift(plan, requested.id)
    assert.deepEqual([dependent.to.start, dependent.to.due], ['2026-03-10T14:00:00Z', '2026-03-10T16:00:00Z'], 'the dependent skips its owner’s Monday leave and retains two local working hours after DST')
    assert.equal(dependent.timezone,'America/Chicago'); assert.equal(dependent.owner, peer.name); assert.equal(dependent.estimateHours, 2); assert.equal(dependent.dst, true); assert.equal(dependent.calendarAdjusted, true)
    assert.deepEqual([explicit.to.start, explicit.to.due], ['2026-03-09T14:00:00Z', '2026-03-09T16:00:00Z'], 'the explicit Saturday request moves to opening hours; another owner’s leave does not affect it')
    assert.equal(explicit.calendarAdjusted, true)
    assert.deepEqual(await dates(root, succ.id), ['2026-03-06T15:00:00Z', '2026-03-06T17:00:00Z'], 'preview writes no dates')
    await apply(root, moves, plan)
    assert.deepEqual(await dates(root, succ.id), [dependent.to.start, dependent.to.due]); assert.deepEqual(await dates(root, requested.id), [explicit.to.start, explicit.to.due])
    const historical = await pass(root.get(`/api/v1/projects/${project.id}/schedule?baseline=${baseline.id}`))
    assert.equal(historical.project.timezone, 'America/Chicago'); assert.equal(historical.tasks.find(row => row.id === succ.id).baseline.due, '2026-03-06T17:00:00Z')
    const allDay = await work(root, project, 'Synthetic date only task', { ownerId: peer.id, startDate: '2026-03-02', dueDate: '2026-03-03' })
    const dayMoves = [{ taskId: allDay.id, start: '2026-03-08', due: '2026-03-10' }], days = await preview(root, dayMoves)
    assert.deepEqual(shift(days, allDay.id).to, { start: '2026-03-10', due: '2026-03-12' }, 'date-only work skips personal leave and the closed Wednesday while retaining its working-day duration')
    await apply(root, dayMoves, days); assert.deepEqual(await dates(root, allDay.id), ['2026-03-10', '2026-03-12'])
  })

  test('preserves timed duration through partial time off and refuses stale calendars and leave revisions without partial writes', async () => {
    const { root, peer, guest } = api(), { project, path } = await workspace(root, peer, guest, 'Synthetic availability revisions')
    await pass(root.post(path + '/working-calendar', { zone: 'America/New_York', week }))
    const task = await work(root, project, 'Synthetic partial day work', { ownerId: peer.id, startDate: '2026-10-30T13:00:00Z', dueDate: '2026-10-30T15:00:00Z' })
    const leave = await pass(peer.post(path + '/time-off', { start: '2026-11-02T15:00:00Z', end: '2026-11-02T17:00:00Z' }))
    const moves = [{ taskId: task.id, start: '2026-11-02T14:00:00Z', due: '2026-11-02T16:00:00Z' }], plan = await preview(root, moves)
    assert.deepEqual(shift(plan, task.id).to, { start: '2026-11-02T14:00:00Z', due: '2026-11-02T18:00:00Z' }, 'two productive hours span the unavailable 10 am to noon interval')
    assert.equal(shift(plan, task.id).calendarAdjusted, true)
    assert.ok(!JSON.stringify(plan).includes(leave.id), 'a schedule preview discloses availability impact without exposing a personal leave record')
    await pass(peer.delete(path + `/time-off/${leave.id}`))
    const refused = await pass(root.post('/api/v1/schedule/apply', { moves, revision: plan.stamp }), 409); assert.equal(refused.error, 'stale_plan')
    assert.deepEqual(await dates(root, task.id), ['2026-10-30T13:00:00Z', '2026-10-30T15:00:00Z'])
    const restored = await preview(root, moves), transient = await pass(peer.post(path + '/time-off', { start: '2026-11-02', end: '2026-11-02' }))
    await pass(peer.delete(path + `/time-off/${transient.id}`))
    await pass(root.post('/api/v1/schedule/apply', { moves, revision: restored.stamp }), 409)
    const beforeHours = await preview(root, moves)
    await pass(root.post(path + '/working-calendar', { zone: 'America/Los_Angeles', week }))
    await pass(root.post('/api/v1/schedule/apply', { moves, revision: beforeHours.stamp }), 409)
    assert.deepEqual(await dates(root, task.id), ['2026-10-30T13:00:00Z', '2026-10-30T15:00:00Z'])
    const fresh = await preview(root, moves)
    assert.deepEqual(shift(fresh, task.id).to, { start: '2026-11-02T17:00:00Z', due: '2026-11-02T19:00:00Z' }, 'a fresh preview uses the new timezone and opens at 9 am local')
    await apply(root, moves, fresh); assert.deepEqual(await dates(root, task.id), ['2026-11-02T17:00:00Z', '2026-11-02T19:00:00Z'])
  })

  test('limits calendar configuration to administrators and personal leave to its owner without exposing private reasons', async () => {
    const { root, peer, guest } = api(), { path } = await workspace(root, peer, guest, 'Synthetic private availability')
    await pass(peer.post(path + '/working-calendar', { zone: 'UTC', week }), 403)
    await pass(guest.get(path + '/availability'), 403); await pass(guest.post(path + '/time-off', { start: '2026-11-03', end: '2026-11-03' }), 403)
    await pass(peer.post(path + '/time-off', { start: '2026-11-03', end: '2026-11-03', operatorId: root.id }), 400)
    await pass(peer.post(path + '/time-off', { start: '2026-11-03', end: '2026-11-03', reason: 'Synthetic private reason' }), 400)
    const leave = await pass(peer.post(path + '/time-off', { start: '2026-11-03', end: '2026-11-04' }))
    await pass(root.delete(path + `/time-off/${leave.id}`), 404)
    const colleague = await pass(root.get(path + `/availability?operatorId=${peer.id}`)), own = await pass(peer.get(path + `/availability?operatorId=${root.id}`))
    assert.deepEqual(colleague.timeOff, []); assert.deepEqual(own.timeOff, [{ id: leave.id, start: '2026-11-03', end: '2026-11-04' }])
    assert.equal(own.canConfigure, false); assert.equal(colleague.canConfigure, true)
    await pass(root.post(path + '/working-calendar', { zone: 'synthetic-invalid-zone', week }), 400)
    await pass(root.post(path + '/working-calendar', { zone: 'UTC', week: Array(7).fill(null) }), 400)
    await pass(root.post(path + '/working-calendar', { zone: 'UTC', week: [null, { start: 1020, end: 540 }, ...week.slice(2)] }), 400)
    await pass(peer.post(path + '/time-off', { start: '2026-02-30', end: '2026-03-02' }), 400)
    await pass(peer.form(path + `/time-off/${leave.id}/remove`, {}), 303)
    assert.deepEqual((await pass(peer.get(path + '/availability'))).timeOff, [])
  })
}
