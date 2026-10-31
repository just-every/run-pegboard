import assert from 'node:assert/strict'

export const pass = async (request, status = 200) => { const response = await request; assert.equal(response.status, status, JSON.stringify(response.body)); return response.body }
export const person = (w, n, name, role) => w.person('synthetic-pegboard-' + n + String.fromCharCode(64) + 'example.test', name, role)
export const inbox = client => pass(client.get('/api/v1/notices/approval-followup'))
export const log = owner => pass(owner.get('/api/v1/notices/approval-followup/log'))
export const queue = owner => pass(owner.post('/api/v1/notices/approval-followup/schedule', {}))
export const cron = (w, at) => pass(w.owner.get('/cdn-cgi/handler/scheduled?time=' + Date.parse(at)))
export const prefs = (client, input) => pass(client.post('/api/v1/notices/approval-followup/preferences', input))
export const record = async (owner, route, action) => {
  const view = await pass(owner.get('/api/v1/approvals/' + route.id))
  return pass(owner.post('/api/v1/approvals/' + route.id + '/decision', { token: view.token, version: view.version, action, reason: 'synthetic-pegboard-actual-human-review' }))
}
export async function policy(owner, project, recipients, escalation = [], extra = {}) {
  const input = { enabled: true, projects: [project.id], recipients: recipients.map(p => p.id), escalation: escalation.map(p => p.id), zone: 'UTC', days: ['1', '2', '3', '4', '5'], start: '09:00', end: '17:00', repeatMinutes: 1, maxRounds: 2, ...extra }
  const preview = await pass(owner.post('/api/v1/notices/approval-followup/policy/preview', input))
  await pass(owner.post('/api/v1/notices/approval-followup/policy', { ...input, token: preview.token, consent: true }))
  return { input, preview }
}
export async function routeTask(owner, project, author, reviewers, title) {
  const task = { ...await pass(owner.post('/api/v1/tasks', { projectId: project.id, title, description: 'Exact review material', ownerId: author.id, kind: 'approval', startDate: '2026-11-02', dueDate: '2026-11-03' })), title }
  const shares = []
  for (const reviewer of reviewers) shares.push(await pass(owner.post('/api/v1/grants', { objectType: 'task', objectId: task.id, granteeId: reviewer.id, level: 'viewer', scope: 'approve' })))
  const input = { mode: 'parallel', stages: [{ name: 'Independent review', people: reviewers.map(p => p.id), quorum: reviewers.length }], dueAt: 1 }
  const preview = await pass(owner.post('/api/v1/approval-routing/task/' + task.id + '/preview', input))
  const route = await pass(owner.post('/api/v1/approval-routing/task/' + task.id, { ...input, token: preview.token }))
  return { task, route, shares, input }
}
export const reroute = async (owner, task, input) => {
  const preview = await pass(owner.post('/api/v1/approval-routing/task/' + task.id + '/preview', input))
  return pass(owner.post('/api/v1/approval-routing/task/' + task.id, { ...input, token: preview.token }))
}
const episodeFor = (rows, id) => rows.find(e => e.route_id === id)

export async function approvalFollowupRoutingScenario(w) {
  const owner = w.owner, author = await person(w, 3701, 'Material author'), reviewer = await person(w, 3702, 'Initial reviewer'), delegate = await person(w, 3703, 'Delegated reviewer')
  const project = await pass(owner.post('/api/v1/projects', { name: 'Native approval follow-up' }))
  const built = await routeTask(owner, project, author, [reviewer], 'Review launch material'), { task, route } = built
  await pass(owner.post('/api/v1/grants', { objectType: 'task', objectId: task.id, granteeId: delegate.id, level: 'viewer', scope: 'approve' }))
  const before = await pass(owner.get('/api/v1/tasks/' + task.id))
  await policy(owner, project, [reviewer, delegate], [delegate])
  await pass(reviewer.post('/api/v1/notices/approval-followup/policy/preview', {}), 403)
  await pass(reviewer.post('/api/v1/notices/approval-followup/schedule', {}), 403)
  await Promise.all([queue(owner), queue(owner)])
  let episode = episodeFor(await log(owner), route.id)
  assert.equal(episode.events.length, 1); assert.equal(episode.events[0].state, 'queued')
  assert.equal(episode.deliveries[0].recipient_id, reviewer.id)
  assert.deepEqual((await inbox(reviewer)).notices, [], 'a queued record is not visible delivery')
  const eventId = episode.events[0].id
  await cron(w, '2030-01-05T12:00:00Z')
  episode = episodeFor(await log(owner), route.id)
  assert.equal(episode.events[0].state, 'deferred')
  assert.equal(episode.deliveries[0].cause, 'working_hours')
  assert.equal(episode.deliveries[0].next_at, Date.parse('2030-01-07T09:00:00Z'))
  const view = await pass(owner.get('/api/v1/approvals/' + route.id))
  await pass(owner.post('/api/v1/approvals/' + route.id + '/change', { token: view.token, action: 'delegate', stage: 0, from: reviewer.id, to: delegate.id }))
  await prefs(delegate, { dndUntil: Date.parse('2030-01-07T10:00:00Z') })
  await cron(w, '2030-01-07T09:00:00Z')
  episode = episodeFor(await log(owner), route.id)
  assert.equal(episode.deliveries.find(d => d.recipient_id === reviewer.id).state, 'cancelled')
  const held = episode.deliveries.find(d => d.recipient_id === delegate.id)
  assert.equal(held.state, 'deferred'); assert.equal(held.cause, 'do_not_disturb'); assert.equal(held.next_at, Date.parse('2030-01-07T10:00:00Z'))
  assert.deepEqual((await inbox(reviewer)).notices, [])
  assert.equal((await inbox(delegate)).deferred[0].eventId, eventId)
  await w.restart()
  await prefs(delegate, { dndUntil: null })
  await Promise.all([cron(w, '2030-01-07T10:00:00Z'), cron(w, '2030-01-07T10:00:00Z')])
  const delivered = (await inbox(delegate)).notices
  assert.equal(delivered.length, 1); assert.equal(delivered[0].eventId, eventId); assert.equal(delivered[0].routeId, route.id); assert.equal(delivered[0].recipientId, delegate.id); assert.equal(delivered[0].version, route.version)
  const html = await pass(delegate.get('/app/inbox'))
  for (const value of [task.title, `data-event-id="${eventId}"`, `data-recipient-id="${delegate.id}"`, `data-notice-id="${delivered[0].id}"`, delivered[0].href]) assert.ok(html.includes(value), value)
  assert.equal((await pass(delegate.get(delivered[0].href))).includes('Exact review material'), true)
  await prefs(delegate, { dndUntil: Date.parse('2031-01-01T00:00:00Z') })
  assert.deepEqual((await inbox(delegate)).notices, [], 'read rechecks DND for an already delivered notice')
  await prefs(delegate, { dndUntil: null })
  await cron(w, '2030-01-07T10:01:00Z')
  episode = episodeFor(await log(owner), route.id)
  assert.equal(episode.events.length, 2); assert.equal(episode.events[1].kind, 'escalation'); assert.equal(episode.state, 'exhausted')
  assert.equal(episode.deliveries.filter(d => d.event_id === episode.events[1].id && d.state === 'visible').length, 1)
  assert.equal(episode.deliveries.find(d => d.event_id === episode.events[1].id).recipient_id, delegate.id)
  await cron(w, '2030-01-07T11:00:00Z')
  assert.equal(episodeFor(await log(owner), route.id).events.length, 2, 'finite repeats stop at the reviewed bound')
  const after = await pass(owner.get('/api/v1/tasks/' + task.id))
  for (const key of ['status', 'startDate', 'dueDate', 'completedAt']) assert.deepEqual(after[key], before[key], key)
  assert.equal((await pass(owner.get('/api/v1/approvals/' + route.id))).votes.length, 0, 'scheduling cannot fabricate a human response')
  const decision = await record(delegate, route, 'approve')
  assert.equal(decision.state, 'approved')
  await cron(w, '2030-01-08T10:00:00Z')
  assert.equal(episodeFor(await log(owner), route.id).state, 'responded')
  assert.deepEqual((await inbox(delegate)).notices, [])
  const finalLog = episodeFor(await log(owner), route.id)
  assert.ok(finalLog.outcomes.some(o => o.state === 'queued') && finalLog.outcomes.some(o => o.state === 'deferred') && finalLog.outcomes.some(o => o.state === 'visible') && finalLog.outcomes.some(o => o.state === 'cancelled'))
  console.log('PROBE PEG-037 routing and timing: native policy + scheduled handler + Inbox -> queued, working-hours and DND deferral, delegated recipient and event IDs, one visible delivery, finite escalation, actual decision stops follow-up; dates unchanged')
}

export async function approvalFollowupAuthorityScenario(w) {
  const owner = w.owner, author = await person(w, 3710, 'Second author'), reviewer = await person(w, 3711, 'Authorized reviewer'), hidden = await person(w, 3712, 'Unrelated member'), guest = await person(w, 3713, 'Guest reader', 'guest')
  const project = await pass(owner.post('/api/v1/projects', { name: 'Approval authority fences' }))
  await policy(owner, project, [reviewer], [reviewer])
  await pass(guest.get('/api/v1/notices/approval-followup'), 403)
  await pass(guest.post('/api/v1/notices/approval-followup/policy/preview', {}), 403)
  const revoked = await routeTask(owner, project, author, [reviewer], 'Private approval subject')
  await queue(owner)
  await pass(owner.delete('/api/v1/grants/' + revoked.shares[0].id))
  await cron(w, '2030-01-07T10:00:00Z')
  assert.deepEqual((await inbox(reviewer)).notices, [])
  assert.ok(!JSON.stringify(await inbox(hidden)).includes(revoked.task.title))
  assert.ok(!(await pass(hidden.get('/app/inbox'))).includes(revoked.task.title))
  await pass(reviewer.get('/app/approvals/' + revoked.route.id), 404)
  assert.equal(episodeFor(await log(owner), revoked.route.id).events[0].state, 'blocked')
  await pass(owner.post('/api/v1/grants', { objectType: 'task', objectId: revoked.task.id, granteeId: reviewer.id, level: 'viewer', scope: 'approve' }))
  await cron(w, '2030-01-08T10:00:00Z')
  assert.deepEqual((await inbox(reviewer)).notices, [], 'renewed access does not resurrect old work')
  const changed = await routeTask(owner, project, author, [reviewer], 'Changed review material')
  await queue(owner)
  await pass(owner.patch('/api/v1/tasks/' + changed.task.id, { description: 'Changed material' }))
  await pass(owner.patch('/api/v1/tasks/' + changed.task.id, { description: 'Exact review material' }))
  await cron(w, '2030-01-07T10:00:00Z')
  assert.equal(episodeFor(await log(owner), changed.route.id).cause, 'material_changed')
  const reopened = await reroute(owner, changed.task, changed.input)
  await queue(owner)
  assert.notEqual(episodeFor(await log(owner), reopened.id).id, episodeFor(await log(owner), changed.route.id).id)
  const current = await pass(owner.get('/api/v1/approvals/' + reopened.id))
  await pass(owner.post('/api/v1/approvals/' + reopened.id + '/change', { token: current.token, action: 'withdraw' }))
  assert.equal(episodeFor(await log(owner), reopened.id).cause, 'route_withdrawn')
  const manager = await person(w, 3714, 'Routing manager', 'manager')
  const management = await pass(owner.post('/api/v1/grants', { objectType: 'project', objectId: project.id, granteeId: manager.id, level: 'admin' }))
  const lost = await routeTask(owner, project, author, [reviewer], 'Routing authority loss')
  const managed = await reroute(manager, lost.task, lost.input)
  await queue(owner)
  await pass(owner.delete('/api/v1/grants/' + management.id))
  await cron(w, '2030-01-07T10:00:00Z')
  assert.equal(episodeFor(await log(owner), managed.id).cause, 'routing_authority_lost')
  assert.deepEqual((await inbox(reviewer)).notices, [])
  const muted = await routeTask(owner, project, author, [reviewer], 'Muted follow-up')
  await queue(owner); await prefs(reviewer, { muted: true }); await cron(w, '2030-01-07T10:00:00Z')
  assert.equal(episodeFor(await log(owner), muted.route.id).deliveries[0].cause, 'recipient_muted')
  await prefs(reviewer, { muted: false }); await cron(w, '2030-01-08T10:00:00Z')
  assert.deepEqual((await inbox(reviewer)).notices, [])
  const inactive = await routeTask(owner, project, author, [reviewer], 'Deactivated reviewer follow-up')
  await queue(owner)
  await pass(owner.post('/api/v1/workspaces/ws_main/people/' + reviewer.id + '/account', { status: 'inactive' }))
  await pass(reviewer.get('/api/v1/notices/approval-followup'), 401)
  await pass(owner.post('/api/v1/workspaces/ws_main/people/' + reviewer.id + '/account', { status: 'active' }))
  await cron(w, '2030-01-07T10:00:00Z')
  assert.equal(episodeFor(await log(owner), inactive.route.id).events[0].state, 'blocked')
  const renewed = await w.signIn(reviewer.email, 'Authorized reviewer', reviewer.id)
  assert.deepEqual((await inbox(renewed)).notices, [])
  // A delegated identity can lose authority before dispatch has created its delivery row.
  const later = await person(w, 3715, 'Queued delegate')
  let restoredDelegate = later
  for (const loss of ['deactivation', 'revocation']) {
    await policy(owner, project, [renewed, later], [later])
    const delegated = await routeTask(owner, project, author, [renewed], 'Delegated identity fence ' + loss)
    const grant = await pass(owner.post('/api/v1/grants', { objectType: 'task', objectId: delegated.task.id, granteeId: later.id, level: 'viewer', scope: 'approve' }))
    await queue(owner)
    const delegation = await pass(owner.get('/api/v1/approvals/' + delegated.route.id))
    await pass(owner.post('/api/v1/approvals/' + delegated.route.id + '/change', { token: delegation.token, action: 'delegate', stage: 0, from: renewed.id, to: later.id }))
    if (loss === 'deactivation') {
      await pass(owner.post('/api/v1/workspaces/ws_main/people/' + later.id + '/account', { status: 'inactive' }))
      await pass(restoredDelegate.get('/api/v1/notices/approval-followup'), 401)
      await pass(owner.post('/api/v1/workspaces/ws_main/people/' + later.id + '/account', { status: 'active' }))
      restoredDelegate = await w.signIn(later.email, 'Queued delegate', later.id)
    } else {
      await pass(owner.delete('/api/v1/grants/' + grant.id))
      await pass(restoredDelegate.get('/app/approvals/' + delegated.route.id), 404)
      await pass(owner.post('/api/v1/grants', { objectType: 'task', objectId: delegated.task.id, granteeId: later.id, level: 'viewer', scope: 'approve' }))
    }
    await w.restart(); await cron(w, '2030-01-07T10:00:00Z')
    assert.deepEqual((await inbox(restoredDelegate)).notices, [], loss + ' cannot revive a queued delegated identity before its first dispatch')
    const excluded = episodeFor(await log(owner), delegated.route.id)
    assert.equal(excluded.state, 'blocked')
    assert.ok(excluded.outcomes.some(o => o.state === 'blocked' && o.cause === 'no_authorized_deliverable_reviewer'))
    // An explicit fresh review may use the renewed authority, with a new episode and event.
    const freshRoute = await reroute(owner, delegated.task, { ...delegated.input, stages: [{ name: 'Independent review', people: [later.id], quorum: 1 }] })
    await queue(owner); await cron(w, '2030-01-07T10:00:00Z')
    const freshNotice = (await inbox(restoredDelegate)).notices
    assert.equal(freshNotice.length, 1); assert.equal(freshNotice[0].routeId, freshRoute.id)
    assert.notEqual(freshNotice[0].episodeId, excluded.id); assert.notEqual(freshNotice[0].eventId, excluded.events[0].id)
    await record(restoredDelegate, freshRoute, 'changes')
  }
  // The same native decision door stops each supported human outcome before its next escalation.
  for (const action of ['approve', 'changes', 'reject']) {
    const fresh = await routeTask(owner, project, author, action === 'approve' ? [renewed, owner] : [renewed], 'Human decision ' + action)
    await queue(owner); await cron(w, '2030-01-07T10:00:00Z')
    const snapshot = await pass(owner.get('/api/v1/tasks/' + fresh.task.id))
    const recorded = await record(renewed, fresh.route, action)
    if (action === 'approve') assert.equal(recorded.state, 'pending', 'a human response stops follow-up without bypassing the remaining quorum')
    await w.restart(); await cron(w, '2030-01-08T10:00:00Z')
    const ended = episodeFor(await log(owner), fresh.route.id)
    assert.equal(ended.state, 'responded'); assert.equal(ended.events.length, 1)
    const decisions = (await pass(owner.get('/api/v1/approvals/' + fresh.route.id))).votes
    assert.equal(decisions.length, 1); assert.equal(decisions[0].actor_id, renewed.id); assert.equal(decisions[0].action, action)
    const after = await pass(owner.get('/api/v1/tasks/' + fresh.task.id))
    for (const key of ['startDate', 'dueDate']) assert.deepEqual(after[key], snapshot[key])
    assert.deepEqual((await inbox(renewed)).notices, [])
  }
  // Reaching the repeat limit stops scheduling, but existing visible cards still need cancellation.
  await policy(owner, project, [renewed], [], { maxRounds: 1 })
  for (const stop of ['material', 'withdrawal', 'routing', 'policy']) {
    const last = await routeTask(owner, project, author, [renewed], 'Final reminder cancellation ' + stop)
    let routingGrant
    if (stop === 'routing') {
      routingGrant = await pass(owner.post('/api/v1/grants', { objectType: 'project', objectId: project.id, granteeId: manager.id, level: 'admin' }))
      last.route = await reroute(manager, last.task, last.input)
    }
    await queue(owner); await cron(w, '2030-01-07T10:00:00Z')
    const exhausted = episodeFor(await log(owner), last.route.id)
    assert.equal(exhausted.state, 'exhausted')
    assert.equal(exhausted.deliveries.filter(d => d.state === 'visible').length, 1)
    assert.ok((await inbox(renewed)).notices.some(n => n.routeId === last.route.id))
    if (stop === 'material') await pass(owner.patch('/api/v1/tasks/' + last.task.id, { description: 'New final material' }))
    else if (stop === 'withdrawal') {
      const view = await pass(owner.get('/api/v1/approvals/' + last.route.id))
      await pass(owner.post('/api/v1/approvals/' + last.route.id + '/change', { token: view.token, action: 'withdraw' }))
    } else if (stop === 'routing') await pass(owner.delete('/api/v1/grants/' + routingGrant.id))
    else await policy(owner, project, [renewed], [], { enabled: false, maxRounds: 1 })
    await w.restart(); await cron(w, '2030-01-08T10:00:00Z')
    const cancelled = episodeFor(await log(owner), last.route.id)
    assert.equal(cancelled.state, 'cancelled', stop + ' cancels exhausted work durably')
    assert.equal(cancelled.cause, { material: 'material_changed', withdrawal: 'route_withdrawn', routing: 'routing_authority_lost', policy: 'policy_replaced' }[stop])
    assert.ok(cancelled.deliveries.every(d => d.state === 'cancelled' && d.next_at === null))
    assert.ok(cancelled.outcomes.some(o => o.recipient_id === renewed.id && o.state === 'cancelled' && o.cause === cancelled.cause))
    assert.ok(!(await inbox(renewed)).notices.some(n => n.routeId === last.route.id))
  }
  console.log('PROBE PEG-037 queued identity: delegate before first dispatch, deactivate or revoke, renew authority, restart -> old episode blocked; explicit fresh route delivers one new event')
  console.log('PROBE PEG-037 terminal outcomes: final visible reminder then changed material, withdrawal, lost routing authority or policy replacement -> persisted cancellation and Inbox removal across restart')
  console.log('PROBE PEG-037 authority and lifecycle: native approvals + Inbox -> hidden, revoked, deactivated and muted readers refused; stale material and withdrawal cancelled; reopened route fresh; approve, request-changes and reject each stop escalation across restart')
}
