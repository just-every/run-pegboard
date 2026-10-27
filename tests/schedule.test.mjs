import {registerCalendarTests} from './scenarios/schedule-calendar.mjs'
import {registerReadinessTests} from './scenarios/readiness.mjs'
import {registerScheduleRuleTests} from './scenarios/schedule-rules.mjs'
// PEG-004 through the public doors: all four dependency types over a US holiday, a weekend and a daylight-saving change, the
// reviewed knock-on set, cycle and stale-plan refusals, an editor's confirmation (once, attributed, undone), an agent's pending
// proposal, a viewer's refusal, baselines that stay historical, and work the editor cannot see waiting for its approver.
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { startWorker } from './support/worker.mjs'

let w, owner, eli, vic, ava, hal, gina, launch, pairs = {}
const ok = async (promise, status = 200) => { const r = await promise; assert.equal(r.status, status, JSON.stringify(r.body)); return r.body }
const task = (title, extra) => ok(owner.post('/api/v1/tasks', { title, projectId: launch.id, ...extra }))
const dates = async id => { const t = await ok(owner.get(`/api/v1/tasks/${id}`)); return [t.startDate ?? t.start_date, t.dueDate ?? t.due_date] }
const preview = (client, moves) => ok(client.post('/api/v1/schedule/preview', { moves }))
const shiftOf = (plan, id) => plan.shifts.find(s => s.id === id)

describe('PEG-004 dependencies and believable schedules', { concurrency: false }, () => {
  before(async () => {
    w = await startWorker(); owner = w.owner
    eli = await w.person('synthetic-pegboard-004-eli@example.com', 'Eli Editor'); vic = await w.person('synthetic-pegboard-004-vic@example.com', 'Vic Viewer')
    ava = await w.person('synthetic-pegboard-004-ava@example.com', 'Ava Agent', 'agent'); hal = await w.person('synthetic-pegboard-004-hal@example.com', 'Hal Hidden')
    gina=await w.person('synthetic-pegboard-schedule-guest@example.com','Gina Guest','guest')
    launch = await ok(owner.post('/api/v1/projects', { name: 'Austin launch' }))
    for (const [person, level] of [[eli, 'editor'], [vic, 'viewer'], [ava, 'editor'], [hal, 'viewer']]) await ok(owner.post('/api/v1/grants', { objectType: 'project', objectId: launch.id, granteeId: person.id, level }))
  }, { timeout: 120000 })
  after(() => w?.stop())

  it('previews and applies all four dependency types over the July 4 holiday and a weekend, then a daylight-saving change, with the chain explained', async () => {
    const link = async (type, a, b, lag = 0) => ok(owner.post('/api/v1/dependencies', { predecessor: a.id, successor: b.id, type, lag }))
    pairs.fs = { a: await task('Final copy', { startDate: '2026-06-29', dueDate: '2026-07-01' }), b: await task('Print run', { startDate: '2026-07-02', dueDate: '2026-07-02' }) }
    pairs.ss = { a: await task('Shoot day', { startDate: '2026-06-29', dueDate: '2026-07-01' }), b: await task('Behind the scenes', { startDate: '2026-06-29', dueDate: '2026-06-30' }) }
    pairs.ff = { a: await task('Edit film', { startDate: '2026-06-29', dueDate: '2026-07-01' }), b: await task('Colour grade', { startDate: '2026-06-30', dueDate: '2026-07-02' }) }
    pairs.sf = { a: await task('Venue handover', { startDate: '2026-07-06', dueDate: '2026-07-08' }), b: await task('Site walk', { startDate: '2026-07-01', dueDate: '2026-07-06' }) }
    await link('fs', pairs.fs.a, pairs.fs.b); await link('ss', pairs.ss.a, pairs.ss.b); await link('ff', pairs.ff.a, pairs.ff.b, 1); await link('sf', pairs.sf.a, pairs.sf.b)
    // Baseline first, so the variance is measured against the plan before any shift.
    const baseline = await ok(owner.post(`/api/v1/projects/${launch.id}/baselines`, { name: 'Kickoff plan' }))
    const fs = await preview(owner, [{ taskId: pairs.fs.a.id, due: '2026-07-02' }])
    assert.deepEqual([shiftOf(fs, pairs.fs.b.id).to.start, shiftOf(fs, pairs.fs.b.id).to.due], ['2026-07-06', '2026-07-06'], 'finish-to-start skips the observed July 3 holiday and the weekend')
    assert.deepEqual(shiftOf(fs, pairs.fs.b.id).crossed.map(h => h.name), ['Independence Day']); assert.equal(shiftOf(fs, pairs.fs.b.id).reason.type, 'fs')
    const ss = await preview(owner, [{ taskId: pairs.ss.a.id, start: '2026-07-01', due: '2026-07-02' }])
    assert.deepEqual([shiftOf(ss, pairs.ss.b.id).to.start, shiftOf(ss, pairs.ss.b.id).to.due], ['2026-07-01', '2026-07-02'])
    const ff = await preview(owner, [{ taskId: pairs.ff.a.id, due: '2026-07-06' }])
    assert.deepEqual([shiftOf(ff, pairs.ff.b.id).to.start, shiftOf(ff, pairs.ff.b.id).to.due], ['2026-07-02', '2026-07-07'], 'finish-to-finish honours its one-day lag')
    const sf = await preview(owner, [{ taskId: pairs.sf.a.id, start: '2026-07-08', due: '2026-07-10' }])
    assert.deepEqual([shiftOf(sf, pairs.sf.b.id).to.start, shiftOf(sf, pairs.sf.b.id).to.due], ['2026-07-06', '2026-07-08'])
    // Nothing moved by previewing.
    assert.deepEqual(await dates(pairs.fs.b.id), ['2026-07-02', '2026-07-02'])
    const before = await ok(owner.get(`/api/v1/projects/${launch.id}/schedule`))
    assert.deepEqual(before.criticalPath.sort(),Object.values(pairs).flatMap(pair=>[pair.a.id,pair.b.id]).sort())
    assert.deepEqual(['fs','ss','ff','sf'].flatMap(type=>[pairs[type].a,pairs[type].b]).map(task=>before.tasks.find(row=>row.id===task.id).slack),[0,0,1,1,0,0,2,2])
    assert.equal(before.baselines[0].id,baseline.id)
    const applied = await ok(owner.post('/api/v1/schedule/apply', { moves: [{ taskId: pairs.fs.a.id, due: '2026-07-02' }], revision: fs.stamp }))
    assert.equal(applied.status, 'applied'); assert.deepEqual(await dates(pairs.fs.b.id), ['2026-07-06', '2026-07-06'])
    const after = await ok(owner.get(`/api/v1/projects/${launch.id}/schedule?baseline=${baseline.id}`))
    const printRun = after.tasks.find(t => t.id === pairs.fs.b.id)
    assert.equal(printRun.baseline.due, '2026-07-02', 'the baseline stays as it was saved'); assert.equal(printRun.baseline.varianceDays, 1); assert.equal(printRun.due, '2026-07-06')
    // A timed dependant keeps its local wall time across the March 8 change to daylight time.
    const p = await task('Approve boards', { dueDate: '2026-03-05T14:00:00Z' }), s = await task('Install displays', { startDate: '2026-03-06T14:00:00Z', dueDate: '2026-03-06T22:00:00Z' })
    await link('fs', p, s)
    const dst = await preview(owner, [{ taskId: p.id, due: '2026-03-06T14:00:00Z' }])
    assert.deepEqual([shiftOf(dst, s.id).to.start, shiftOf(dst, s.id).to.due], ['2026-03-09T13:00:00Z', '2026-03-09T21:00:00Z']); assert.equal(shiftOf(dst, s.id).dst, true)
  })

  it('refuses a cycle and a stale plan and leaves every downstream date untouched', async () => {
    await ok(owner.post('/api/v1/dependencies', { predecessor: pairs.fs.b.id, successor: pairs.fs.a.id, type: 'fs' }), 409)
    await ok(owner.post('/api/v1/dependencies', { predecessor: pairs.fs.a.id, successor: pairs.fs.a.id }), 400)
    const plan = await preview(owner, [{ taskId: pairs.ff.a.id, due: '2026-07-07' }])
    await ok(owner.patch(`/api/v1/tasks/${pairs.ff.b.id}`, { dueDate: '2026-07-14' }))
    const stale = await ok(owner.post('/api/v1/schedule/apply', { moves: [{ taskId: pairs.ff.a.id, due: '2026-07-07' }], revision: plan.stamp }), 409)
    assert.equal(stale.error, 'stale_plan'); assert.deepEqual(await dates(pairs.ff.a.id), ['2026-06-29', '2026-07-01']); assert.deepEqual(await dates(pairs.ff.b.id), ['2026-06-30', '2026-07-14'])
  })

  it('lets a project editor confirm a previewed set once, attributed to them, with undo and no second approval; a viewer and an agent cannot shift anything', async () => {
    const moves = [{ taskId: pairs.ss.a.id, start: '2026-07-07', due: '2026-07-09' }]
    const plan = await preview(eli, moves)
    assert.ok(plan.shifts.length === 2 && plan.editable && !plan.waits)
    const done = await ok(eli.post('/api/v1/schedule/apply', { moves, revision: plan.stamp }))
    assert.equal(done.status, 'applied')
    const moved = [await dates(pairs.ss.a.id), await dates(pairs.ss.b.id)]
    assert.deepEqual(moved[0], ['2026-07-07', '2026-07-09'])
    const history = (await ok(owner.get(`/api/v1/tasks/${pairs.ss.b.id}`))).history.filter(h => h.kind === 'schedule.shifted')
    assert.equal(history.length, 1, 'the dependant shifts exactly once'); assert.equal(history[0].actor, 'Eli Editor')
    await ok(eli.post('/api/v1/schedule/apply', { moves, revision: plan.stamp }), 409)
    assert.deepEqual([await dates(pairs.ss.a.id), await dates(pairs.ss.b.id)], moved)
    // A viewer sees the preview but cannot shift anything.
    const vplan = await preview(vic, [{ taskId: pairs.ff.a.id, due: '2026-07-20' }]); assert.equal(vplan.editable, false)
    await ok(vic.post('/api/v1/schedule/apply', { moves: [{ taskId: pairs.ff.a.id, due: '2026-07-20' }], revision: vplan.stamp }), 403)
    // An agent's set is only a proposal, for a named person's exact approval.
    const aplan = await preview(ava, [{ taskId: pairs.fs.a.id, due: '2026-07-08' }])
    await ok(ava.post('/api/v1/schedule/apply', { moves: [{ taskId: pairs.fs.a.id, due: '2026-07-08' }], revision: aplan.stamp }), 400)
    // Ineligible people cannot be nominated, even with a project Editor grant.
    const analyst = await w.person('synthetic-pegboard-004-analyst@example.com', 'Ana Analyst', 'analyst')
    for (const nominee of [analyst, gina]) await ok(owner.post('/api/v1/grants', { objectType: 'project', objectId: launch.id, granteeId: nominee.id, level: 'editor' }))
    const scheduledDates = async () => (await ok(owner.get(`/api/v1/projects/${launch.id}/schedule`))).tasks.map(row => ({ id: row.id, start: row.start, due: row.due })).sort((a, b) => a.id.localeCompare(b.id))
    const beforeNomination = await scheduledDates(), pendingBefore = await ok(owner.get('/api/v1/schedule/pending'))
    assert.deepEqual(aplan.shifts.map(row => row.id).sort(), [pairs.fs.a.id, pairs.fs.b.id].sort())
    for (const nominee of [analyst, gina]) {
      const refused = await ok(ava.post('/api/v1/schedule/apply', { moves: [{ taskId: pairs.fs.a.id, due: '2026-07-08' }], revision: aplan.stamp, approverId: nominee.id }), 400)
      assert.equal(refused.error, 'approver', `${nominee.name} cannot approve an agent schedule`)
      assert.deepEqual(await scheduledDates(), beforeNomination, 'every schedule date stays unchanged after an unsafe nomination')
      assert.deepEqual(await ok(owner.get('/api/v1/schedule/pending')), pendingBefore, 'refusal creates no pending proposal')
    }
    const proposal = await ok(ava.post('/api/v1/schedule/apply', { moves: [{ taskId: pairs.fs.a.id, due: '2026-07-08' }], revision: aplan.stamp, approverId: eli.id }))
    assert.equal(proposal.status, 'pending'); assert.deepEqual(await dates(pairs.fs.a.id), ['2026-06-29', '2026-07-02'])
    await ok(ava.post(`/api/v1/schedule/sets/${proposal.id}/approve`, { revision: aplan.stamp }), 404)
    await ok(vic.post(`/api/v1/schedule/sets/${proposal.id}/approve`, { revision: aplan.stamp }), 404)
    // Undo restores the old dates once, and refuses once the work has moved on.
    await ok(eli.post(`/api/v1/schedule/sets/${done.id}/undo`, {}))
    assert.deepEqual([await dates(pairs.ss.a.id), await dates(pairs.ss.b.id)], [['2026-06-29', '2026-07-01'], ['2026-06-29', '2026-06-30']])
    await ok(eli.post(`/api/v1/schedule/sets/${done.id}/undo`, {}), 409)
    // The named approver confirms the exact agent set; the change is theirs.
    const stillCurrent = await ok(eli.get(`/api/v1/schedule/sets/${proposal.id}`)); assert.equal(stillCurrent.canApprove, true)
    await ok(eli.post(`/api/v1/schedule/sets/${proposal.id}/approve`, { revision: stillCurrent.revision }))
    assert.equal((await dates(pairs.fs.a.id))[1], '2026-07-08')
    const note = (await ok(owner.get(`/api/v1/tasks/${pairs.fs.a.id}`))).history.filter(h => h.kind === 'schedule.shifted').at(-1); assert.equal(note.actor, 'Eli Editor')
  })

  it('holds a set that reaches work the editor cannot see for its approver, without disclosing it or applying part of it', async () => {
    const secret = await ok(hal.post('/api/v1/projects', { name: 'Confidential supplier negotiation' }))
    const hidden = await ok(hal.post('/api/v1/tasks', { title: 'Negotiate supplier margin', projectId: secret.id, startDate: '2026-07-10', dueDate: '2026-07-10' }))
    await ok(hal.post('/api/v1/dependencies', { predecessor: pairs.fs.a.id, successor: hidden.id, type: 'fs' }))
    const moves = [{ taskId: pairs.fs.a.id, due: '2026-07-10' }]
    const plan = await preview(eli, moves)
    assert.equal(plan.waits, true); assert.ok(!JSON.stringify(plan).includes(hidden.id) && !JSON.stringify(plan).includes('supplier'))
    const held = await ok(eli.post('/api/v1/schedule/apply', { moves, revision: plan.stamp }))
    assert.equal(held.status, 'pending'); assert.deepEqual(await dates(pairs.fs.a.id), ['2026-06-29', '2026-07-08']); assert.deepEqual(await dates(pairs.fs.b.id), ['2026-07-09', '2026-07-09'])
    const theirs = (await ok(eli.get('/api/v1/schedule/pending'))).pending; assert.ok(theirs.length === 1 && !theirs[0].canApprove && !JSON.stringify(theirs).includes('supplier'), 'the editor sees their own set but cannot decide one that reaches hidden work')
    await ok(eli.post(`/api/v1/schedule/sets/${held.id}/approve`, { revision: plan.stamp }), 403)
    const mine = (await ok(owner.get('/api/v1/schedule/pending'))).pending.find(p => p.id === held.id); assert.ok(mine && mine.canApprove)
    await ok(owner.post(`/api/v1/schedule/sets/${held.id}/approve`, { revision: mine.revision }))
    assert.equal((await dates(pairs.fs.a.id))[1], '2026-07-10'); assert.deepEqual(await ok(hal.get(`/api/v1/tasks/${hidden.id}`)).then(t => [t.startDate ?? t.start_date, t.dueDate ?? t.due_date]), ['2026-07-13', '2026-07-13'])
  })
  it('computes exact branching slack, negative lead and milestone dates and refuses an impossible completed-dependent cascade atomically',async()=>{
    const project=await ok(owner.post('/api/v1/projects',{name:'Chicago retail launch constraints'}))
    const make=(title,startDate,dueDate,extra={})=>ok(owner.post('/api/v1/tasks',{projectId:project.id,title,startDate,dueDate,...extra}))
    const a=await make('Approve retail copy','2026-11-03','2026-11-04'),b=await make('Print window cards','2026-11-05','2026-11-06'),c=await make('Prepare dispatch note','2026-11-05','2026-11-05'),milestone=await make('Release milestone','2026-11-04','2026-11-04',{kind:'milestone'})
    for(const [successor,lag] of [[b,0],[c,0],[milestone,-1]])await ok(owner.post('/api/v1/dependencies',{predecessor:a.id,successor:successor.id,type:'fs',lag}))
    const view=await ok(owner.get(`/api/v1/projects/${project.id}/schedule`))
    assert.deepEqual(view.criticalPath.sort(),[a.id,b.id].sort())
    assert.deepEqual([a,b,c,milestone].map(task=>view.tasks.find(row=>row.id===task.id).slack),[0,0,1,2])
    assert.equal(view.tasks.find(row=>row.id===milestone.id).kind,'milestone')
    const moves=[{taskId:a.id,due:'2026-11-06'}],plan=await preview(owner,moves)
    assert.deepEqual(plan.shifts.map(row=>row.id).sort(),[a.id,b.id,c.id,milestone.id].sort())
    assert.deepEqual([shiftOf(plan,b.id).to.start,shiftOf(plan,b.id).to.due],['2026-11-09','2026-11-10'])
    assert.deepEqual([shiftOf(plan,milestone.id).to.start,shiftOf(plan,milestone.id).to.due],['2026-11-06','2026-11-06'])
    assert.equal(shiftOf(plan,milestone.id).reason.lag,-1)
    await ok(owner.post('/api/v1/schedule/apply',{moves,revision:plan.stamp}))
    await ok(owner.patch(`/api/v1/tasks/${b.id}`,{status:'done'}))
    const heldMoves=[{taskId:a.id,due:'2026-11-09'}],held=await preview(owner,heldMoves),ids=[a.id,b.id,c.id,milestone.id]
    assert.equal(held.blocked,'impossible_constraint');assert.equal(shiftOf(held,b.id).completed,true)
    const before=await Promise.all(ids.map(id=>ok(owner.get(`/api/v1/tasks/${id}`))))
    const refusal=await ok(owner.post('/api/v1/schedule/apply',{moves:heldMoves,revision:held.stamp}),409)
    assert.equal(refusal.error,'impossible_constraint')
    assert.deepEqual(await Promise.all(ids.map(id=>ok(owner.get(`/api/v1/tasks/${id}`)))),before)
  })

  const api=()=>({root:owner,peer:eli,guest:gina,worker:w})
  registerCalendarTests({test:it,api})
  registerReadinessTests({test:it,api})
  registerScheduleRuleTests({test:it,api})

})
