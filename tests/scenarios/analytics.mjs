import assert from 'node:assert/strict'
import { proofDocument } from '../support/worker.mjs'

/** One seeded cross-dataset reconciliation through the same doors used by people and analysts. */
export async function analystDatasetScenario({ w, owner, mia, ok, csvRecords }) {
  const projects = []
  for (const name of ['Dataset launch', 'Dataset campaign', 'Dataset review']) projects.push(await ok(owner.post('/api/v1/projects', { name })))
  const outside = await ok(owner.post('/api/v1/projects', { name: 'Unreviewed dataset work' }))
  const tasks = []
  for (const [i, p] of projects.entries()) tasks.push(await ok(owner.post('/api/v1/tasks', { projectId: p.id, title: 'Dataset task ' + i, estimateHours: i + 1, ownerId: mia.id })))
  await ok(owner.post(`/api/v1/tasks/${tasks[0].id}/projects`, { projectId: projects[1].id }))
  const outsideTask = await ok(owner.post('/api/v1/tasks', { projectId: outside.id, title: 'Never selected work' }))
  await ok(owner.post('/api/v1/tasks', { title: 'Never selected personal work' }))
  await ok(owner.post('/api/v1/grants', { objectType: 'project', objectId: projects[0].id, granteeId: mia.id, level: 'editor' }))
  const sheet = await ok(mia.post('/api/v1/timesheets', { startDate: '2026-10-20', endDate: '2026-10-20' }))
  await ok(mia.post(`/api/v1/timesheets/${sheet.id}/entries`, { taskId: tasks[0].id, projectId: projects[0].id, date: '2026-10-20', seconds: 5400, key: 'synthetic-pegboard-4441' }))
  await ok(mia.post(`/api/v1/timesheets/${sheet.id}/decision`, { action: 'submit', revision: (await ok(mia.get(`/api/v1/timesheets/${sheet.id}`))).token }))
  await ok(owner.post(`/api/v1/timesheets/${sheet.id}/decision`, { action: 'approve', revision: (await ok(owner.get(`/api/v1/timesheets/${sheet.id}`))).token }))
  const portfolio = await ok(owner.post('/api/v1/portfolios', { name: 'Reviewed dataset portfolio' }))
  const child = await ok(owner.post('/api/v1/portfolios', { name: 'Nested dataset portfolio', parentId: portfolio.id }))
  for (const [i, p] of projects.entries()) await ok(owner.post(`/api/v1/portfolios/${i ? child.id : portfolio.id}/projects`, { projectId: p.id }))
  const goal = await ok(owner.post('/api/v1/goals', { title: 'Reviewed delivery goal', scope: 'company', mode: 'work', periodStart: '2026-01-01', periodEnd: '2026-12-31' }))
  for (const p of projects) await ok(owner.post(`/api/v1/goals/${goal.id}/links`, { sourceType: 'project', sourceId: p.id }))
  const personal = await ok(owner.post('/api/v1/goals', { title: 'Never selected personal goal', scope: 'personal', periodStart: '2026-01-01', periodEnd: '2026-12-31' }))
  const requestInput = { requestKey: 'synthetic-pegboard-4442', title: 'Reviewed intake request' }
  const request = await ok(owner.post(`/api/v1/projects/${projects[0].id}/requests`, requestInput))
  assert.equal((await ok(owner.post(`/api/v1/projects/${projects[0].id}/requests`, requestInput))).id, request.id)
  const approval = await ok(owner.post('/api/v1/tasks', { projectId: projects[0].id, title: 'Reviewed task approval', kind: 'approval', ownerId: mia.id, estimateHours: 4 }))
  const decide = await ok(owner.get(`/api/v1/tasks/${approval.id}/decision-preview`))
  await ok(owner.post(`/api/v1/tasks/${approval.id}/decision`, { action: 'approve', revision: decide.token, reason: 'Reviewed dataset work' }))
  const file = await ok(owner.post(`/api/v1/tasks/${tasks[0].id}/attachments?projectId=${projects[0].id}&name=synthetic-pegboard-4443.pdf`, proofDocument('synthetic-pegboard-4443'), { 'content-type': 'application/pdf' }))
  const proof = await ok(owner.post(`/api/v1/tasks/${tasks[0].id}/proofs`, { attachmentId: file.id }))
  const routing = { mode: 'parallel', stages: [{ name: 'Dataset proof review', people: [owner.id], quorum: 1 }] }
  const preview = await ok(owner.post(`/api/v1/approval-routing/proof/${proof.id}/preview`, routing))
  const route = await ok(owner.post(`/api/v1/approval-routing/proof/${proof.id}`, { ...routing, token: preview.token }))
  const review = await ok(owner.get(`/api/v1/approvals/${route.id}`))
  await ok(owner.post(`/api/v1/approvals/${route.id}/decision`, { token: review.token, version: review.version, action: 'approve', reason: 'Reviewed exact proof' }))
  const fields = {
    Projects: ['name', 'status'], Tasks: ['title', 'status', 'estimateHours'], TaskProjects: ['taskId', 'projectId'],
    TimeEntries: ['taskId', 'projectId', 'seconds'], Portfolios: ['name', 'parentId', 'taskCount', 'doneCount', 'estimateHours'],
    PortfolioProjects: ['portfolioId', 'projectId'], Goals: ['title', 'unit', 'progressPercent', 'state'], GoalLinks: ['goalId', 'sourceId', 'sourceType', 'weight'],
    Requests: ['taskId', 'projectId', 'status'], Approvals: ['taskId', 'kind', 'subjectId', 'state', 'version'],
  }
  const input = { name: 'Complete native dataset review', projects: projects.map(p => p.id), portfolios: [portfolio.id], goals: [goal.id], fields, expiresAt: Date.now() + 86400000, consent: true }
  assert.equal((await owner.post('/api/v1/analytics/keys', { ...input, projects: [projects[0].id] })).status, 400, 'a portfolio cannot widen reviewed projects')
  assert.equal((await owner.post('/api/v1/analytics/keys', { ...input, portfolios: [], projects: [projects[0].id] })).status, 400, 'a goal cannot widen reviewed projects')
  assert.equal((await owner.post('/api/v1/analytics/keys', { ...input, goals: [personal.id] })).status, 400, 'even an issuer cannot export personal goals')
  const key = await ok(owner.post('/api/v1/analytics/keys', input))
  const reportPath = `/api/v1/analytics/keys/${key.id}/reports`
  const native = await ok(owner.post(reportPath, {})), snapshot = native.snapshot
  assert.equal(native.counts.Tasks, 5); assert.equal(native.estimateHours, 10); assert.equal(native.approvedSeconds, 5400)
  assert.deepEqual(native.data.Tasks.map(t => t.id).sort(), [...tasks.map(t => t.id), request.id, approval.id].sort())
  assert.deepEqual(native.data.PortfolioProjects.map(p => p.projectId).sort(), projects.map(p => p.id).sort())
  const nativePortfolio = await ok(owner.get(`/api/v1/portfolios/${portfolio.id}`))
  assert.equal(native.data.Portfolios[0].taskCount, nativePortfolio.summary.tasks)
  assert.equal(native.data.Portfolios[0].doneCount, nativePortfolio.summary.byStatus.done)
  assert.equal(native.data.Portfolios[0].estimateHours, nativePortfolio.summary.estimateHours)
  assert.equal(native.data.Goals[0].progressPercent, (await ok(owner.get(`/api/v1/goals/${goal.id}`))).progress)
  assert.equal(native.data.GoalLinks.length, 3)
  assert.deepEqual(native.data.Requests.map(r => r.taskId), [request.id])
  assert.deepEqual(native.data.Approvals.map(a => [a.kind, a.subjectId, a.state]).sort(), [['proof', proof.id, 'approved'], ['task', approval.id, 'approved']])
  const read = async path => { const r = await fetch(new URL(path, w.origin), { headers: { authorization: 'Bearer ' + key.secret, prefer: 'odata.maxpagesize=1' } }); return { status: r.status, body: await r.json() } }
  const deltas = {}
  for (const [dataset, expected] of Object.entries(native.data)) {
    const got = []; let page = (await read(`${key.servicePath}/${dataset}?snapshot=${snapshot}`)).body
    for (;;) { got.push(...page.value); if (!page['@odata.nextLink']) break; page = (await read(page['@odata.nextLink'])).body }
    assert.deepEqual(got, expected, dataset + ' is exactly the report snapshot across pages')
    deltas[dataset] = page['@odata.deltaLink']
    const csv = csvRecords(await ok(owner.get(`${reportPath}?snapshot=${snapshot}&dataset=${dataset}`)))
    const names = csv[0]
    assert.deepEqual(csv.slice(1).map(row => Object.fromEntries(names.map((name, i) => [name, row[i]]))), expected.map(row => Object.fromEntries(names.map(name => [name, row[name] === null ? '' : String(row[name])]))), dataset + ' CSV uses the same rows and units')
  }
  for (const p of projects) {
    const exported = await ok(owner.get(`/api/v1/projects/${p.id}/export?format=json`))
    const expected = native.data.Tasks.filter(t => native.data.TaskProjects.some(r => r.projectId === p.id && r.taskId === t.id))
    assert.deepEqual(exported.tasks.map(t => t.id).sort(), expected.map(t => t.id).sort())
  }
  assert.ok(!JSON.stringify(native).includes(outsideTask.id)); assert.ok(!JSON.stringify(native).includes(personal.id))
  assert.equal((await mia.post(reportPath, {})).status, 403)
  assert.equal((await mia.get(`${reportPath}?snapshot=${snapshot}`)).status, 403)
  assert.equal((await mia.post(`/api/v1/analytics/keys/${key.id}/schedule`, { hours: 24, consent: true })).status, 403)
  assert.equal((await owner.post(`/api/v1/analytics/keys/${key.id}/schedule`, { hours: 24, consent: false })).status, 400)
  await ok(owner.post(`/api/v1/analytics/keys/${key.id}/schedule`, { hours: 24, consent: true }))
  const captured = await ok(owner.post('/api/v1/analytics/reports/run-due', {}))
  const scheduled = captured.results.find(r => r.keyId === key.id)
  assert.equal(scheduled.status, 'captured')
  const scheduledReport = await ok(owner.get(`${reportPath}?snapshot=${scheduled.snapshot}`))
  assert.deepEqual(scheduledReport.data, native.data)
  assert.equal((await ok(owner.post('/api/v1/analytics/reports/run-due', {}))).results.length, 0, 'the same due interval is not captured twice')
  await w.restart()
  assert.equal((await ok(owner.get(reportPath))).runs.length, 1, 'the schedule receipt survives restart')
  await ok(owner.patch(`/api/v1/tasks/${tasks[1].id}`, { status: 'done' }))
  assert.equal((await ok(owner.get(`${reportPath}?snapshot=${snapshot}`))).stale, true)
  for (const dataset of ['Portfolios', 'Goals']) assert.equal((await read(deltas[dataset])).body.value.length, 1, dataset + ' refresh exposes changed derived totals')
  const erasure = await ok(owner.post('/api/v1/data/erasure-preview', { type: 'task', id: request.id }))
  await ok(owner.post('/api/v1/data/erase', { type: 'task', id: request.id, token: erasure.token, confirm: true }))
  assert.equal((await owner.get(`${reportPath}?snapshot=${snapshot}`)).status, 410, 'erasure also invalidates cached aggregate reports')
  assert.ok((await read(deltas.Requests)).body.value.some(r => r.reason === 'deleted'), 'request refresh removes erased work')
  const fresh = await ok(owner.post(reportPath, {}))
  assert.equal(fresh.counts.Requests, 0); assert.equal(fresh.counts.Tasks, 4)
  assert.equal((await read((await read(key.servicePath + '/Requests')).body['@odata.deltaLink'])).body.value.length, 0)
  await ok(owner.post(`/api/v1/portfolios/${child.id}/projects`, { projectId: outside.id }))
  assert.equal((await owner.get(`${reportPath}?snapshot=${fresh.snapshot}`)).status, 400, 'new outside portfolio work ends old report authority')
  await ok(owner.post(`/api/v1/portfolios/${child.id}/projects/${outside.id}/remove`, {}))
  await ok(owner.post(`/api/v1/analytics/keys/${key.id}/revoke`, {}))
  assert.equal((await owner.get(`${reportPath}?snapshot=${fresh.snapshot}`)).status, 401)
  assert.equal((await read(deltas.Goals)).status, 401)
  await w.sql(`UPDATE peg_analytics_schedules SET next_at=1 WHERE key_id='${key.id}'`)
  assert.equal((await ok(owner.post('/api/v1/analytics/reports/run-due', {}))).results.find(r => r.keyId === key.id).status, 'authority_ended')
  assert.equal((await w.sql(`SELECT COUNT(*) AS n FROM peg_analytics_runs WHERE key_id='${key.id}'`)).includes('"n": 1'), true, 'revocation never captures a new result')
}
