import assert from 'node:assert/strict'
import { proofDocument } from '../support/worker.mjs'

export const identityOk = async (promise, status = 200) => {
  const r = await promise
  assert.equal(r.status, status, JSON.stringify(r.body))
  return r.body
}
const email = n => ['synthetic-pegboard-' + n, 'example.com'].join('@')

export async function identityFixture(w) {
  const owner = w.owner, ok = identityOk
  const member = await w.person(email(4501), 'Lifecycle member')
  const requester = await w.person(email(4502), 'Lifecycle requester')
  const approver = await w.person(email(4503), 'Lifecycle approver')
  const project = await ok(owner.post('/api/v1/projects', { name: 'Lifecycle shared work' }))
  for (const [person, level] of [[member, 'editor'], [approver, 'admin']]) await ok(owner.post('/api/v1/grants', { objectType: 'project', objectId: project.id, granteeId: person.id, level }))
  const task = await ok(owner.post('/api/v1/tasks', { projectId: project.id, title: 'Lifecycle shared task' }))
  await ok(owner.post('/api/v1/grants', { objectType: 'task', objectId: task.id, granteeId: member.id, level: 'viewer', scope: 'approve' }))
  const personal = await ok(member.post('/api/v1/tasks', { title: 'Private lifecycle work' }))
  const section = await ok(member.post('/api/v1/my-tasks/sections', { name: 'Private lifecycle section' }))
  await ok(member.post('/api/v1/my-tasks/rules', { group: 'Later', sectionId: section.id }))
  const issue = () => ok(member.post('/api/v1/api-keys', { name: 'Lifecycle delegation', projects: [project.id], personal: true, expiresAt: Date.now() + 86400000, consent: true }))
  const key = await issue()
  const attachment = await ok(owner.post(`/api/v1/tasks/${task.id}/attachments?name=synthetic-pegboard-4504.pdf`, proofDocument('Lifecycle reviewed proof'), { 'content-type': 'application/pdf' }))
  const proof = await ok(owner.post(`/api/v1/tasks/${task.id}/proofs`, { attachmentId: attachment.id }))
  const recurringInput = { sourceType: 'task', sourceId: personal.id, mode: 'calendar', timezone: 'America/New_York', unit: 'week', interval: 1, start: '2030-01-07', count: 2 }
  const recurringReview = await ok(member.post('/api/v1/recurrences/preview', recurringInput))
  const recurrence = await ok(member.post('/api/v1/recurrences', { ...recurringInput, revision: recurringReview.token }))
  const localRule = await ok(approver.post(`/api/v1/projects/${project.id}/rules`, { name: 'Lifecycle scheduled priority', trigger: 'status', status: 'doing', source: 'fixed', fixedDate: '2030-01-02', priority: 'high' }))
  const activateRule = async () => {
    const preview = await ok(approver.post(`/api/v1/rules/${localRule.id}/preview`, {}))
    return ok(approver.post(`/api/v1/rules/${localRule.id}/activate`, { token: preview.token }))
  }
  await activateRule()
  const config = { mode: 'parallel', stages: [{ name: 'Member decision', people: [member.id], quorum: 1 }] }
  const route = async () => {
    const preview = await ok(owner.post(`/api/v1/approval-routing/proof/${proof.id}/preview`, config))
    return ok(owner.post(`/api/v1/approval-routing/proof/${proof.id}`, { ...config, token: preview.token }))
  }
  const routed = await route()
  const share = async id => {
    const view = await ok(owner.get(`/api/v1/approvals/${id}`))
    return ok(owner.post(`/api/v1/approvals/${id}/share`, { token: view.token, recipientId: member.id, expiresAt: Date.now() + 86400000 }))
  }
  const link = await share(routed.id)
  const priorDecision = await ok(member.get(`/api/v1/proof-reviews/${link.id}`))
  const requestProject = await ok(owner.post('/api/v1/projects', { name: 'Lifecycle restricted work' }))
  await ok(owner.post('/api/v1/grants', { objectType: 'project', objectId: requestProject.id, granteeId: approver.id, level: 'admin' }))
  const ask = async person => {
    await ok(person.post('/api/v1/access-requests', { targetId: requestProject.id, level: 'viewer' }))
    const pending = (await ok(owner.get('/api/v1/access-requests'))).toDecide
    return pending.find(row => row.targetId === requestProject.id && row.requester.id === person.id)
  }
  const memberRequest = await ask(member), otherRequest = await ask(requester)
  const approverDecision = await ok(approver.get(`/api/v1/access-requests/${otherRequest.id}`))
  const path = person => `/api/v1/workspaces/ws_main/people/${person.id}`
  const preview = (person, status) => ok(owner.get(path(person) + '/lifecycle-preview?status=' + status))
  const change = async (person, status) => {
    const review = await preview(person, status)
    return ok(owner.post(path(person) + '/lifecycle', { status, token: review.token, confirm: true }))
  }
  const bearer = async (secret, transport = 'rest') => {
    const response = await fetch(w.origin + (transport === 'rest' ? `/api/v1/public/tasks/${task.id}` : '/api/v1/public/mcp'), {
      method: transport === 'rest' ? 'GET' : 'POST', headers: { authorization: 'Bearer ' + secret, 'content-type': 'application/json' },
      ...(transport === 'rest' ? {} : { body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }) }),
    })
    return { status: response.status, body: await response.json() }
  }
  return { w, owner, member, requester, approver, project, task, personal, section, recurrence, localRule, issue, key, routed, route, share, link, priorDecision, memberRequest, otherRequest, approverDecision, requestProject, path, preview, change, bearer }
}

export async function identityLifecycleScenario(w) {
  const f = await identityFixture(w), ok = identityOk
  for (const transport of ['rest', 'mcp']) await ok(f.bearer(f.key.secret, transport))
  const review = await f.preview(f.member, 'inactive')
  assert.equal(review.counts.apiKeys, 1); assert.equal(review.counts.personalRules, 1); assert.equal(review.counts.proofLinks, 1)
  assert.ok(!JSON.stringify(review).includes('Private lifecycle'))
  await ok(f.requester.get(f.path(f.member) + '/lifecycle-preview?status=inactive'), 403)
  await ok(f.requester.post(f.path(f.member) + '/lifecycle', { status: 'inactive', token: review.token, confirm: true }), 403)
  await ok(f.member.get(`/api/v1/tasks/${f.task.id}`))
  await ok(f.owner.post(f.path(f.member) + '/lifecycle', { status: 'inactive', token: review.token }), 400)
  await f.issue()
  await ok(f.owner.post(f.path(f.member) + '/lifecycle', { status: 'inactive', token: review.token, confirm: true }), 409)
  await ok(f.member.get(`/api/v1/tasks/${f.task.id}`))
  await f.change(f.member, 'inactive')
  await ok(f.member.get('/api/v1/me'), 401)
  for (const transport of ['rest', 'mcp']) await ok(f.bearer(f.key.secret, transport), 401)
  await ok(f.owner.post(`/api/v1/access-requests/${f.memberRequest.id}/decision`, { revision: f.memberRequest.revision, decision: 'approve' }), 409)
  await f.change(f.member, 'active')
  await ok(f.member.get('/api/v1/me'), 401)
  f.member = await w.signIn(f.member.email, f.member.name, f.member.id)
  await ok(f.member.get(`/api/v1/tasks/${f.task.id}`))
  await ok(f.member.get(`/api/v1/proof-reviews/${f.link.id}`), 404)
  await ok(f.member.post(`/api/v1/approvals/${f.routed.id}/decision`, { token: f.priorDecision.token, version: f.priorDecision.version, action: 'approve', reason: 'Stale review' }), 403)
  assert.equal((await ok(f.owner.get(`/api/v1/approvals/${f.routed.id}`))).state, 'pending')
  assert.deepEqual((await ok(f.member.get('/api/v1/my-tasks'))).rules, [])
  assert.ok((await ok(f.member.get('/api/v1/api-keys'))).keys.every(key => key.revoked_at !== null))
  assert.equal((await ok(f.member.get(`/api/v1/recurrences/${f.recurrence.id}`))).schedule.active, 0)
  assert.equal((await ok(f.member.post(`/api/v1/recurrences/${f.recurrence.id}/run`, {}))).state, 'finished')
  await f.change(f.approver, 'inactive'); await f.change(f.approver, 'active')
  await ok(f.approver.get('/api/v1/me'), 401)
  f.approver = await w.signIn(f.approver.email, f.approver.name, f.approver.id)
  const ruleView = await ok(f.approver.get(`/api/v1/projects/${f.project.id}/rules`))
  assert.equal(ruleView.rules.find(row => row.id === f.localRule.id).enabled, 0)
  const ruleTask = await ok(f.owner.post('/api/v1/tasks', { projectId: f.project.id, title: 'Lifecycle scheduled work' }))
  await ok(f.owner.patch(`/api/v1/tasks/${ruleTask.id}`, { status: 'doing' }))
  await ok(f.owner.post(`/api/v1/projects/${f.project.id}/rules/process`, {}))
  assert.equal((await ok(f.owner.get(`/api/v1/tasks/${ruleTask.id}`))).priority, 'normal')
  const newActivation = await ok(f.approver.post(`/api/v1/rules/${f.localRule.id}/preview`, {}))
  await ok(f.approver.post(`/api/v1/rules/${f.localRule.id}/activate`, { token: newActivation.token }))
  await ok(f.owner.patch(`/api/v1/tasks/${ruleTask.id}`, { status: 'todo' }))
  await ok(f.owner.patch(`/api/v1/tasks/${ruleTask.id}`, { status: 'doing' }))
  await ok(f.owner.post(`/api/v1/projects/${f.project.id}/rules/process`, {}))
  assert.equal((await ok(f.owner.get(`/api/v1/tasks/${ruleTask.id}`))).priority, 'high')
  const decisionPath = `/api/v1/access-requests/${f.otherRequest.id}/decision`
  await ok(f.approver.post(decisionPath, { revision: f.approverDecision.revision, decision: 'approve' }), 404)
  await ok(f.approver.get(`/api/v1/access-requests/${f.otherRequest.id}`), 404)
  await ok(f.requester.get(`/api/v1/projects/${f.requestProject.id}`), 404)
  // The still-authorized owner can decide; a fresh request, key, rule and routing require fresh explicit actions.
  const ownerReview = await ok(f.owner.get(`/api/v1/access-requests/${f.otherRequest.id}`))
  await ok(f.owner.post(decisionPath, { revision: ownerReview.revision, decision: 'approve' }))
  await ok(f.requester.get(`/api/v1/projects/${f.requestProject.id}`))
  await w.restart()
  for (const transport of ['rest', 'mcp']) await ok(f.bearer(f.key.secret, transport), 401)
  await ok(f.member.get(`/api/v1/proof-reviews/${f.link.id}`), 404)
  assert.deepEqual((await ok(f.member.get('/api/v1/my-tasks'))).rules, [])
  await ok(f.approver.post(decisionPath, { revision: f.approverDecision.revision, decision: 'approve' }), 404)
  const renewed = await ok(f.member.post('/api/v1/api-keys', { name: 'Explicit renewal', projects: [f.project.id], consent: true, expiresAt: Date.now() + 86400000 }))
  for (const transport of ['rest', 'mcp']) await ok(f.bearer(renewed.secret, transport))
  await ok(f.member.post('/api/v1/my-tasks/rules', { group: 'Later', sectionId: f.section.id }))
  assert.equal((await ok(f.member.get('/api/v1/my-tasks'))).rules.length, 1)
  const renewedRoute = await f.route(), renewedLink = await f.share(renewedRoute.id)
  const view = await ok(f.member.get(`/api/v1/proof-reviews/${renewedLink.id}`))
  await ok(f.member.post(`/api/v1/proof-reviews/${renewedLink.id}/decision`, { token: view.token, version: view.version, action: 'approve', reason: 'Explicitly renewed review' }))
  assert.equal((await ok(f.owner.get(`/api/v1/approvals/${renewedRoute.id}`))).state, 'approved')
  await ok(f.member.get(`/api/v1/proof-reviews/${f.link.id}`), 404)
  await ok(f.owner.post(`/api/v1/access-requests/${f.memberRequest.id}/decision`, { revision: f.memberRequest.revision, decision: 'approve' }), 409)
  const downloaded = await f.owner.get('/api/v1/admin/access-review/download')
  assert.equal(downloaded.status, 200); assert.match(downloaded.headers.get('content-disposition'), /attachment/)
  const report = downloaded.body
  assert.ok(report.lifecycle.some(row => row.operatorId === f.member.id && row.status === 'inactive'))
  assert.ok(report.lifecycle.some(row => row.operatorId === f.member.id && row.status === 'active'))
  assert.equal(report.requests.find(row => row.id === f.memberRequest.id).status, 'stale')
  assert.equal(report.nativeCredentials.find(row => row.id === f.key.id).active, 0)
  assert.equal(report.nativeCredentials.find(row => row.id === renewed.id).active, 1)
  const text = JSON.stringify(report)
  for (const hidden of [f.key.secret, renewed.secret, 'token_hash', 'Private lifecycle work', 'Private lifecycle section', f.link.id]) assert.ok(!text.includes(hidden), 'review excludes private data and capabilities')
  await ok(f.requester.get('/api/v1/admin/access-review/download'), 403)
  const erased = await w.person(email(4505), 'Lifecycle erased identity')
  await ok(f.owner.post(f.path(erased) + '/account', { status: 'inactive' }))
  const eraseReview = await ok(f.owner.post('/api/v1/data/erasure-preview', { type: 'person', id: erased.id }))
  assert.deepEqual(eraseReview.blockers, [])
  await ok(f.owner.post('/api/v1/data/erase', { type: 'person', id: erased.id, token: eraseReview.token, confirm: true }))
  await ok(f.owner.get(f.path(erased) + '/lifecycle-preview?status=active'), 404)
  await ok(f.owner.post(f.path(erased) + '/account', { status: 'active' }), 409)
  await ok(erased.get('/api/v1/me'), 401)
}
