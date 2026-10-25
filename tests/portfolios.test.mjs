// PEG-013 through the public doors: a two-level portfolio of 20 projects with shared tasks and a private project, live rollups
// from Tasks, a limited stakeholder's authorized totals, each default risk threshold at a pinned clock, the versioned policy,
// manual health beside computed flags, and the timeline, workload and dashboard tabs without double counts or leaks.
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { startWorker } from './support/worker.mjs'

let w, owner, sam, nina, root, retail, services, projects = [], shared, privateProject, flagged = {}
const ok = async (promise, status = 200) => { const r = await promise; assert.equal(r.status, status, JSON.stringify(r.body)); return r.body }
const clock = Date.parse('2026-03-16T12:00:00Z'), day = 86400000
const at = instant => `?at=${new Date(instant).toISOString()}`
const view = (client, id, extra = '') => ok(client.get(`/api/v1/portfolios/${id}${at(clock)}${extra}`))
const project = (name, extra = {}) => ok(owner.post('/api/v1/projects', { name, visibility: 'workspace', ...extra }))
const task = (projectId, title, extra = {}) => ok(owner.post('/api/v1/tasks', { title, projectId, ...extra }))
const reasons = row => row.flags.map(f => f.code).sort()

describe('PEG-013 portfolios that roll up truthfully', { concurrency: false }, () => {
  before(async () => {
    w = await startWorker(); owner = w.owner
    sam = await w.person('synthetic-pegboard-013-sam@example.com', 'Sam Stakeholder')
    nina = await w.person('synthetic-pegboard-013-nina@example.com', 'Nina Outsider')
  }, { timeout: 120000 })
  after(() => w?.stop())

  it('rolls up a two-level portfolio of 20 projects, counts shared tasks once and hides a private project from a stakeholder', async () => {
    root = await ok(owner.post('/api/v1/portfolios', { name: 'Spring programs' }))
    retail = await ok(owner.post('/api/v1/portfolios', { name: 'Retail launches', parentId: root.id }))
    services = await ok(owner.post('/api/v1/portfolios', { name: 'Services', parentId: root.id }))
    for (let i = 1; i <= 19; i++) projects.push(await project(`Austin campaign ${i}`))
    privateProject = await project('Confidential acquisition', { visibility: 'private' })
    // Ten projects in each child; project 10 is in both, the private project sits in Services.
    for (const p of projects.slice(0, 10)) await ok(owner.post(`/api/v1/portfolios/${retail.id}/projects`, { projectId: p.id }))
    for (const p of [...projects.slice(9), privateProject]) await ok(owner.post(`/api/v1/portfolios/${services.id}/projects`, { projectId: p.id }))
    for (const p of projects) await task(p.id, `Plan ${p.name}`, { dueDate: '2026-04-30' })
    shared = await task(projects[0].id, 'Shared creative brief', { dueDate: '2026-04-30', estimateHours: 6 })
    await ok(owner.post(`/api/v1/tasks/${shared.id}/projects`, { projectId: projects[1].id }))
    await ok(owner.post(`/api/v1/tasks/${shared.id}/projects`, { projectId: projects[12].id }))
    const secret = await task(privateProject.id, 'Negotiate acquisition terms', { dueDate: '2026-04-30' })
    await ok(owner.post(`/api/v1/portfolios/${root.id}/members`, { operatorId: sam.id, level: 'viewer' }))

    const full = await view(owner, root.id)
    assert.equal(full.summary.projects, 20)
    assert.equal(full.summary.tasks, 19 + 1 + 1, 'one plan per readable project, one shared task counted once, one private task')
    const children = Object.fromEntries(full.nested.children.map(c => [c.name, c.summary]))
    assert.equal(children['Retail launches'].projects, 10); assert.equal(children.Services.projects, 11)
    assert.ok(children['Retail launches'].tasks + children.Services.tasks > full.summary.tasks, 'children overlap on one project, the parent does not add them twice')
    assert.equal(full.tabs.workload.owners.reduce((n, o) => n + o.open, 0), full.summary.tasks, 'workload counts each task once')

    // The limited stakeholder reads totals only over what they may read; the private project leaves no name, count or task.
    const limited = await view(sam, root.id)
    assert.equal(limited.summary.projects, 19); assert.equal(limited.summary.tasks, full.summary.tasks - 1)
    const text = JSON.stringify(limited)
    for (const hidden of ['Confidential acquisition', 'Negotiate acquisition terms', privateProject.id, secret.id]) assert.ok(!text.includes(hidden), hidden)
    assert.ok(!JSON.stringify(await ok(sam.get('/api/v1/portfolios'))).includes('Confidential'))
    for (const tab of ['timeline', 'workload', 'dashboard']) assert.ok(!JSON.stringify(limited.tabs[tab]).includes('acquisition'))
    // Someone outside the portfolio finds nothing, and cannot tell it exists.
    await ok(nina.get(`/api/v1/portfolios/${root.id}`), 404)
    assert.deepEqual((await ok(nina.get('/api/v1/portfolios'))).portfolios, [])
    // Viewing never grants a project: the stakeholder cannot write through the portfolio.
    await ok(sam.post(`/api/v1/portfolios/${root.id}/projects`, { projectId: projects[0].id }), 403)
    await ok(sam.get(`/api/v1/projects/${privateProject.id}`), 404)
  })

  it('moves rollups when a blocker or completion changes through Tasks, with source drill-down', async () => {
    const before = await view(owner, root.id), blocker = await task(projects[2].id, 'Await legal sign-off', { dueDate: '2026-03-10' })
    const after = await view(owner, root.id)
    assert.equal(after.summary.tasks, before.summary.tasks + 1); assert.equal(after.summary.overdue, before.summary.overdue + 1)
    const row = after.projects.find(p => p.id === projects[2].id)
    assert.equal(row.overdue, 1)
    const drill = await ok(owner.get(`/api/v1/portfolios/${root.id}/drill${at(clock)}&metric=overdue&projectId=${projects[2].id}`))
    assert.deepEqual(drill.tasks.map(t => t.id), [blocker.id]); assert.equal(drill.tasks[0].link, `/app/tasks/${blocker.id}`)
    await ok(owner.patch(`/api/v1/tasks/${blocker.id}`, { status: 'done' }))
    const done = await view(owner, root.id)
    assert.equal(done.summary.overdue, before.summary.overdue); assert.equal(done.summary.byStatus.done, before.summary.byStatus.done + 1)
    assert.equal(done.projects.find(p => p.id === projects[2].id).overdue, 0)
  })

  it('flags each default threshold independently at a pinned clock, explains it with source rows and recalculates when resolved or the policy changes', async () => {
    const lab = async (name, build) => { const p = await project(name); await ok(owner.post(`/api/v1/portfolios/${services.id}/projects`, { projectId: p.id })); flagged[name] = { project: p, ...await build(p) }; return p }
    await lab('Lab milestone', async p => ({ milestone: await task(p.id, 'Venue contract signed', { kind: 'milestone', dueDate: '2026-03-02' }) }))
    await lab('Lab slack', async p => {
      const a = await task(p.id, 'Print proofs', { startDate: '2026-03-18', dueDate: '2026-03-27' }), b = await task(p.id, 'Install signage', { startDate: '2026-03-20', dueDate: '2026-03-23' })
      return { a, b, dependency: await ok(owner.post('/api/v1/dependencies', { predecessor: a.id, successor: b.id, type: 'fs' })) }
    })
    await lab('Lab exactly twenty', async p => ({ tasks: [await task(p.id, 'Late A', { dueDate: '2026-03-13' }), ...await Promise.all([1, 2, 3, 4].map(i => task(p.id, `On time ${i}`, { dueDate: '2026-03-30' })))] }))
    await lab('Lab under twenty', async p => ({ tasks: [await task(p.id, 'Late B', { dueDate: '2026-03-13' }), ...await Promise.all([1, 2, 3, 4, 5].map(i => task(p.id, `Fine ${i}`, { dueDate: '2026-03-30' })))] }))
    await lab('Lab no due dates', async p => ({ tasks: [await task(p.id, 'Open ended')] }))
    await lab('Lab stale', async p => ({ status: await ok(owner.post('/api/v1/status-updates', { subjectType: 'project', subjectId: p.id, health: 'on_track', summary: 'Creative approved.' })) }))
    const published = flagged['Lab stale'].status.publishedAt

    const rows = async (extra = '') => Object.fromEntries((await view(owner, root.id, extra)).projects.map(p => [p.name, p]))
    let now = await rows()
    assert.deepEqual(reasons(now['Lab milestone']), ['milestone_past_due']); assert.equal(now['Lab milestone'].flags[0].sources[0].id, flagged['Lab milestone'].milestone.id)
    assert.deepEqual(reasons(now['Lab slack']), ['negative_slack']); assert.equal(now['Lab slack'].flags[0].sources[0].id, flagged['Lab slack'].a.id)
    assert.deepEqual(reasons(now['Lab exactly twenty']), ['overdue_share']); assert.match(now['Lab exactly twenty'].flags[0].reason, /1 of 5/)
    assert.deepEqual(reasons(now['Lab under twenty']), []); assert.equal(now['Lab no due dates'].overdueShare, null); assert.deepEqual(reasons(now['Lab no due dates']), [])
    const staleAt = instant => ok(owner.get(`/api/v1/portfolios/${root.id}${at(instant)}`)).then(v => v.projects.find(p => p.name === 'Lab stale'))
    assert.deepEqual(reasons(await staleAt(published + 7 * day)), [], 'exactly seven days old is not stale')
    for (const row of [now['Lab milestone'], now['Lab slack'], now['Lab exactly twenty']]) assert.ok(row.flags.every(f => f.evaluatedAt === clock && f.policyVersion === 1 && f.sources.length))
    assert.equal(now['Lab no due dates'].computed, 'unknown', 'a never-published status is unknown, not healthy')
    // Just over seven days stale.
    const stale = await staleAt(published + 7 * day + 1000)
    assert.deepEqual(reasons(stale), ['status_stale']); assert.equal(stale.flags[0].sources[0].id, flagged['Lab stale'].status.id)
    assert.equal((await staleAt(published - 1000)).computed, 'unknown', 'a status published after the evaluated time does not count')
    // Manual health stays separate and cannot erase a computed reason.
    await ok(owner.post('/api/v1/status-updates', { subjectType: 'project', subjectId: flagged['Lab milestone'].project.id, health: 'on_track', summary: 'Contract is with legal.' }))
    const afterStatus = await ok(owner.get(`/api/v1/portfolios/${root.id}${at(Date.now() + 1000)}`)); now = Object.fromEntries(afterStatus.projects.map(p => [p.name, p]))
    assert.equal(now['Lab milestone'].manual.health, 'on_track'); assert.deepEqual(reasons(now['Lab milestone']), ['milestone_past_due']); assert.equal(now['Lab milestone'].computed, 'at_risk')
    // Resolve each by the work itself, then change the policy to see the recalculation under a new version.
    await ok(owner.patch(`/api/v1/tasks/${flagged['Lab milestone'].milestone.id}`, { status: 'done' }))
    await ok(owner.delete(`/api/v1/dependencies/${flagged['Lab slack'].dependency.id}`))
    now = await rows(); assert.deepEqual(reasons(now['Lab milestone']), []); assert.deepEqual(reasons(now['Lab slack']), [])
    assert.deepEqual(reasons(now['Lab exactly twenty']), ['overdue_share'])
    const policy = await ok(owner.post(`/api/v1/portfolios/${root.id}/policy`, { overdueShare: 25, staleDays: 14 }))
    assert.equal(policy.version, 2)
    const changed = await view(owner, root.id); const byName = Object.fromEntries(changed.projects.map(p => [p.name, p]))
    assert.deepEqual(reasons(byName['Lab exactly twenty']), []); assert.equal(changed.policy.version, 2); assert.equal(changed.policy.overdueShare, 25)
    assert.deepEqual(changed.history.map(h => h.version), [2, 1])
    await ok(sam.post(`/api/v1/portfolios/${root.id}/policy`, { overdueShare: 90 }), 403)
  })

  it('shows timeline, workload and dashboard tabs for the nested portfolio with saved filters and no leakage', async () => {
    const full = await view(owner, root.id), limited = await view(sam, root.id)
    assert.ok(full.tabs.timeline.projects.length >= 26 && full.tabs.timeline.tasks.some(t => t.id === shared.id && t.projects.length === 3))
    assert.equal(full.tabs.timeline.tasks.filter(t => t.id === shared.id).length, 1, 'the shared task is one row across projects')
    const d = full.tabs.dashboard.computed; assert.equal(d.at_risk + d.unknown + d.clear, full.summary.projects + 0); assert.ok(d.unknown > 0 && full.tabs.dashboard.manual.missing > 0 && full.tabs.dashboard.byStatus.length === 3)
    const saved = await ok(owner.post(`/api/v1/portfolios/${root.id}/filters`, { name: 'Overdue only', overdue: true }))
    const filtered = await view(owner, root.id, `&filter=${saved.id}`)
    assert.ok(filtered.tabs.timeline.tasks.every(t => t.overdue) && filtered.tabs.timeline.tasks.length > 0 && filtered.tabs.timeline.tasks.length < full.tabs.timeline.tasks.length)
    assert.ok(!JSON.stringify(limited).includes('Confidential'))
    assert.equal(limited.tabs.workload.owners.reduce((n, o) => n + o.open, 0), limited.summary.tasks - limited.summary.byStatus.done)
  })
})
