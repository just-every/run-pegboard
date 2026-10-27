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
    // The blocker gates work in another project: moving its due date through Tasks breaks the chain and the flag follows.
    const gated = await task(projects[3].id, 'Open the pop-up shop', { startDate: '2026-03-20', dueDate: '2026-03-25' })
    await ok(owner.post('/api/v1/dependencies', { predecessor: blocker.id, successor: gated.id, type: 'fs' }))
    const row3 = async () => (await view(owner, root.id)).projects.find(p => p.id === projects[2].id)
    assert.deepEqual(reasons(await row3()).filter(code => code === 'negative_slack'), [])
    await ok(owner.patch(`/api/v1/tasks/${blocker.id}`, { dueDate: '2026-03-24' }))
    const broken = (await row3()).flags.find(f => f.code === 'negative_slack'); assert.equal(broken.sources[0].id, blocker.id)
    await ok(owner.patch(`/api/v1/tasks/${blocker.id}`, { status: 'done' }))
    assert.deepEqual(reasons(await row3()).filter(code => code === 'negative_slack'), [])
    const done = await view(owner, root.id)
    assert.equal(done.summary.byStatus.done, before.summary.byStatus.done + 1)
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

describe('Delivery register', {concurrency:false},()=>{
 let server,owner,editor,agent,guest,project,task,milestone,risk
 const records=()=>ok(owner.get(`/api/v1/projects/${project.id}/register`))
 const raise=(input)=>ok(editor.post(`/api/v1/projects/${project.id}/register`,{kind:'risk',title:'Print dependency at risk',ownerId:editor.id,approverId:owner.id,impact:'Retail launch may slip',nextAction:'Reserve backup printer',reviewDate:'2026-11-06',taskId:task.id,...input}))
 const decide=(record,action)=>owner.post(`/api/v1/projects/${project.id}/register/${record.id}/decision`,{revision:record.token,action,reason:action==='accept'?'Approved exact scope and dates':'Keep the original commitment'})
 before(async()=>{
  server=await startWorker();owner=server.owner
  editor=await server.person('synthetic-pegboard-3501@example.com','Maya Delivery')
  agent=await server.person('synthetic-pegboard-3502@example.com','Planning agent','agent')
  guest=await server.person('synthetic-pegboard-3503@example.com','Client guest','guest')
  project=await ok(owner.post('/api/v1/projects',{name:'Austin retail launch',description:'Original campaign scope',visibility:'private'}))
  for(const [person,level] of [[editor,'editor'],[agent,'editor'],[guest,'viewer']])await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:project.id,granteeId:person.id,level}))
  task=await ok(owner.post('/api/v1/tasks',{projectId:project.id,title:'Print launch signage',startDate:'2026-11-09',dueDate:'2026-11-10'}))
  milestone=await ok(owner.post('/api/v1/tasks',{projectId:project.id,title:'Open retail display',kind:'milestone',startDate:'2026-11-11',dueDate:'2026-11-11'}))
  await ok(owner.post('/api/v1/dependencies',{predecessor:task.id,successor:milestone.id,type:'fs'}))
 },{timeout:120000})
 after(()=>server?.stop())
 it('carries an accountable dependency risk through rejected and accepted changes into linked work and the existing portfolio status',async()=>{
  risk=await raise({})
  assert.equal(risk.owner_id,editor.id);assert.equal(risk.impact,'Retail launch may slip');assert.equal(risk.next_action,'Reserve backup printer');assert.equal(risk.review_date,'2026-11-06')
  const rejected=await raise({kind:'change',title:'Rush production alternative',parentId:risk.id,due:'2026-11-12',scope:'Rush the original campaign'})
  await ok(decide(rejected,'reject'))
  assert.equal((await ok(owner.get(`/api/v1/tasks/${task.id}`))).dueDate,'2026-11-10')
  const accepted=await raise({kind:'change',title:'Approved backup print plan',parentId:risk.id,due:'2026-11-13',scope:'Use backup printer for retail campaign'})
  await ok(editor.post(`/api/v1/projects/${project.id}/register/${accepted.id}/decision`,{revision:accepted.token,action:'accept',reason:'Self approve'}),403)
  const decision=await ok(decide(accepted,'accept'));assert.equal(decision.decided_by,owner.id)
  assert.equal(decision.baseline.scope,'Original campaign scope');assert.equal(decision.baseline.tasks.find(t=>t.id===task.id).due,'2026-11-10');assert.ok(decision.baseline.tasks.some(t=>t.id===milestone.id))
  assert.ok((await ok(owner.get(`/api/v1/tasks/${milestone.id}`))).dueDate>'2026-11-11')
  const saved=await records();assert.equal(saved.records.find(r=>r.id===rejected.id).status,'rejected');assert.equal(saved.records.find(r=>r.id===accepted.id).status,'accepted')
  const updated=await ok(owner.get(`/api/v1/tasks/${task.id}`));assert.equal(updated.dueDate,'2026-11-13');assert.ok(updated.deliveryRecords.some(r=>r.id===risk.id));assert.ok(updated.history.some(h=>h.detail.recordId===accepted.id))
  const portfolio=await ok(owner.post('/api/v1/portfolios',{name:'Retail programs'}));await ok(owner.post(`/api/v1/portfolios/${portfolio.id}/projects`,{projectId:project.id}))
  await ok(owner.post('/api/v1/status-updates',{subjectType:'portfolio',subjectId:portfolio.id,health:'at_risk',summary:'Backup printer approved after dependency risk.',recordIds:[risk.id,accepted.id]}))
  const rollup=await ok(owner.get(`/api/v1/portfolios/${portfolio.id}`));assert.deepEqual(rollup.manual.citations.map(c=>c.id).sort(),[risk.id,accepted.id].sort())
  await ok(decide(accepted,'accept'),409)
 })
 it('refuses stale changes and agents, and filters records against current linked-work access',async()=>{
  const stale=await raise({kind:'change',title:'Old schedule proposal',due:'2026-11-16'})
  await ok(owner.patch(`/api/v1/tasks/${task.id}`,{dueDate:'2026-11-17'}))
  await ok(decide(stale,'accept'),409)
  assert.equal((await ok(owner.get(`/api/v1/tasks/${task.id}`))).dueDate,'2026-11-17')
  await ok(editor.post(`/api/v1/projects/${project.id}/register`,{kind:'decision',title:'Agent approval',ownerId:editor.id,approverId:agent.id,impact:'Scope',nextAction:'Decide',reviewDate:'2026-11-06'}),400)
  const hidden=await ok(owner.post('/api/v1/tasks',{projectId:project.id,title:'Internal budget decision',internalOnly:true}))
  const secret=await raise({taskId:hidden.id,title:'Internal delivery risk'})
  const visible=await ok(guest.get(`/api/v1/projects/${project.id}/register`));assert.ok(!JSON.stringify(visible).includes(secret.id))
  assert.equal((await records()).records.find(r=>r.id===stale.id).status,'pending')
  await server.restart();assert.ok((await records()).records.some(r=>r.id===risk.id))
 })
})

describe('Reusable workflow bundles',{concurrency:false},()=>{
 let server,owner,member,source,projects,bundle,field,kept,stageRun
 const root=()=>`/api/v1/workflow-bundles/${bundle.id}`
 const view=()=>ok(owner.get(root()))
 const version=async(key,component)=>{const v=await view();return ok(owner.post(root()+'/versions',{version:v.current.version,key,...component}))}
 const preview=()=>ok(owner.post(root()+'/preview',{projectIds:projects.map(p=>p.id)}))
 const adopt=async(keys)=>{const p=await preview();return ok(owner.post(root()+'/adopt',{projectIds:projects.map(p=>p.id),keys,revision:p.token}))}
 before(async()=>{
  server=await startWorker();owner=server.owner;member=await server.person('synthetic-pegboard-3401@example.com','Maya Campaign')
  source=await ok(owner.post('/api/v1/projects',{name:'Campaign definitions',visibility:'workspace'}))
  field=await ok(owner.post(`/api/v1/projects/${source.id}/fields`,{key:'campaign_code',label:'Campaign code',type:'text'}))
  projects=[];for(const name of ['Austin launch','Dallas launch','Denver launch'])projects.push(await ok(owner.post('/api/v1/projects',{name,visibility:'workspace'})))
  bundle=await ok(owner.post('/api/v1/workflow-bundles',{name:'Retail campaign workflow'}))
  for(const [key,c] of Object.entries({code:{kind:'field',name:'Campaign code',fieldId:field.id},open:{kind:'view',name:'Open campaign work',status:'todo'},route:{kind:'rule',name:'Campaign priority',priority:'high'},brief:{kind:'template',name:'Creative brief',title:'Draft the campaign brief',taskKind:'task'},review:{kind:'stages',name:'Campaign sign-off',titles:['Legal sign-off','Brand sign-off']}}))await version(key,c)
 },{timeout:120000})
 after(()=>server?.stop())
 it('applies all five bundle component types to three projects and runs their real fields, saved view, task template, rule and human approval stages',async()=>{
  const adopted=await adopt(['code','open','route','brief','review']);assert.equal(adopted.adoptions.length,3);assert.equal(adopted.items.length,15)
  const p=projects[0],task=await ok(owner.post('/api/v1/tasks',{projectId:p.id,title:'Existing launch plan'}))
  await ok(owner.post(`/api/v1/tasks/${task.id}/fields`,{projectId:p.id,values:{campaign_code:'AUS-26'}}))
  assert.equal((await ok(owner.get(`/api/v1/projects/${p.id}`))).fields.find(f=>f.key==='campaign_code').id,field.id)
  const rule=await ok(owner.post(root()+'/jobs/process',{}));assert.equal(rule.applied,1);assert.equal((await ok(owner.get(`/api/v1/tasks/${task.id}`))).priority,'high')
  const made=await ok(owner.post(root()+`/projects/${p.id}/start`,{key:'brief',ownerId:member.id}));assert.equal((await ok(owner.get(`/api/v1/tasks/${made.taskId}`))).title,'Draft the campaign brief')
  const firstStage=await ok(owner.post(root()+`/projects/${p.id}/start`,{key:'review',ownerId:member.id}));stageRun=firstStage.runId
  await ok(owner.post(root()+`/projects/${p.id}/start`,{key:'review',runId:stageRun}),409)
  const decision=await ok(owner.get(`/api/v1/tasks/${firstStage.taskId}/decision-preview`));await ok(owner.post(`/api/v1/tasks/${firstStage.taskId}/decision`,{revision:decision.token,action:'approve',reason:'Legal approved current work'}))
  const next=await ok(owner.post(root()+`/projects/${p.id}/start`,{key:'review',runId:stageRun}));assert.equal((await ok(owner.get(`/api/v1/tasks/${next.taskId}`))).title,'Brand sign-off');assert.equal((await ok(owner.get(`/api/v1/tasks/${next.taskId}/decision-preview`))).state,'pending')
  kept={taskId:task.id,approval:firstStage.taskId,before:await ok(owner.get(`/api/v1/tasks/${firstStage.taskId}/decision-preview`)),taskBefore:await ok(owner.get(`/api/v1/tasks/${task.id}`))}
  const done=await ok(owner.post('/api/v1/tasks',{projectId:p.id,title:'Already complete',status:'done'}))
  const response=await owner.get(`/app/projects/${p.id}?view=list&savedView=${bundle.id}:open`);assert.equal(response.status,200);assert.ok(response.body.includes('Existing launch plan'));assert.ok(!response.body.includes(done.id))
 })
 it('previews upgrades, preserves local overrides and unchosen changes, refuses incompatible and stale adoption, and cancels obsolete queued actions on disable',async()=>{
  const p=projects[0],other=projects[1]
  await ok(owner.post(root()+`/projects/${p.id}/override`,{key:'route',priority:'low'}))
  await version('route',{kind:'rule',name:'Campaign priority',priority:'urgent'})
  await version('open',{kind:'view',name:'Completed campaign work',status:'done'})
  const source2=await ok(owner.post('/api/v1/projects',{name:'Other definitions',visibility:'workspace'})),conflicting=await ok(owner.post(`/api/v1/projects/${source2.id}/fields`,{key:'campaign_code',label:'Different campaign field',type:'number'}))
  await version('code',{kind:'field',name:'Incompatible field',fieldId:conflicting.id})
  let plan=await preview();assert.equal(plan.projects[0].rows.find(r=>r.key==='route').state,'override');assert.equal(plan.projects[1].rows.find(r=>r.key==='code').state,'incompatible')
  await ok(owner.post(root()+'/adopt',{projectIds:projects.map(p=>p.id),keys:['code'],revision:plan.token}),409)
  const stale=plan.token;await ok(owner.post('/api/v1/tasks',{projectId:other.id,title:'Concurrent campaign task'}));await ok(owner.post(root()+'/adopt',{projectIds:projects.map(p=>p.id),keys:['route'],revision:stale}),409)
  const upgraded=await adopt(['route']);assert.equal(upgraded.items.find(i=>i.project_id===p.id&&i.item_key==='route').config.priority,'low');assert.equal(upgraded.items.find(i=>i.project_id===other.id&&i.item_key==='route').config.priority,'urgent');assert.equal(upgraded.items.find(i=>i.project_id===other.id&&i.item_key==='open').config.status,'todo')
  assert.deepEqual((await ok(owner.get(`/api/v1/tasks/${kept.approval}/decision-preview`))).decisions,kept.before.decisions)
  assert.deepEqual((await ok(owner.get(`/api/v1/tasks/${kept.taskId}`))).history,kept.taskBefore.history)
  const live=await ok(owner.post('/api/v1/tasks',{projectId:other.id,title:'Live campaign rule'}));await ok(owner.post(root()+'/jobs/process',{}));assert.equal((await ok(owner.get(`/api/v1/tasks/${live.id}`))).priority,'urgent')
  const obsolete=await ok(owner.post('/api/v1/tasks',{projectId:other.id,title:'Queued before disabling'}));assert.ok((await view()).jobs.some(j=>j.task_id===obsolete.id&&j.status==='queued'))
  await ok(owner.post(root()+`/projects/${other.id}/disable`,{}));await ok(owner.post(root()+'/jobs/process',{}));assert.equal((await ok(owner.get(`/api/v1/tasks/${obsolete.id}`))).priority,'normal');assert.equal((await view()).jobs.find(j=>j.task_id===obsolete.id).status,'cancelled')
  await ok(owner.post(root()+`/projects/${other.id}/start`,{key:'brief'}),409)
  assert.ok((await view()).history.some(h=>h.action==='disabled'));await server.restart();assert.ok((await view()).versions.some(v=>v.components.route?.priority==='high'))
  const current=await view();await ok(member.post(root()+'/versions',{version:current.current.version,key:'route',kind:'rule',name:'Unauthorized',priority:'high'}),403)
  const limited=await ok(member.get(`/api/v1/projects/${projects[2].id}/bundle-configuration`));assert.ok(limited.every(i=>i.kind==='view'||i.kind==='field'))
 })
})

describe('Activated rule effect recovery',{concurrency:false},()=>{
 let w,owner,member,outsider
 const pass=async promise=>{const r=await promise;assert.equal(r.status,200,JSON.stringify(r.body)+(r.status===500?' '+(w.output().match(/(?:D1_ERROR|SQLITE_\w+|Error:)[^\n]*/g)??[]).slice(-3).join(' '):''));return r.body}
 before(async()=>{w=await startWorker();owner=w.owner;member=await w.person('synthetic-pegboard-6401@example.com','Maya Production');outsider=await w.person('synthetic-pegboard-6402@example.com','Other department')},{timeout:120000})
 after(()=>w?.stop())
 it('records activated date and assignment effects once and undoes only unchanged fields with current authority',async()=>{
  const p=await pass(owner.post('/api/v1/projects',{name:'Autumn retail production'}))
  await pass(owner.post('/api/v1/grants',{objectType:'project',objectId:p.id,granteeId:member.id,level:'editor'}))
  const b=await pass(owner.post('/api/v1/workflow-bundles',{name:'Fixed production routing'})),root=`/api/v1/workflow-bundles/${b.id}`
  const definition={version:1,key:'production',kind:'rule',name:'Fixed production commitments',priority:'high',ownerId:member.id,startDate:'2026-12-01',dueDate:'2026-12-15'}
  assert.equal((await member.post(root+'/versions',definition)).status,403)
  await pass(owner.post(root+'/versions',definition))
  const preview=await pass(owner.post(root+'/preview',{projectIds:[p.id]}));await pass(owner.post(root+'/adopt',{projectIds:[p.id],keys:['production'],revision:preview.token}))
  const t=await pass(owner.post('/api/v1/tasks',{projectId:p.id,title:'Print Austin launch cards',startDate:'2026-11-27',dueDate:'2026-12-10'}))
  await w.restart();assert.equal((await pass(owner.post(root+'/jobs/process',{}))).applied,1);assert.equal((await pass(owner.post(root+'/jobs/process',{}))).applied,0)
  const applied=await pass(owner.get(`/api/v1/tasks/${t.id}`));assert.equal(applied.owner.id,member.id);assert.equal(applied.startDate,'2026-12-01');assert.equal(applied.dueDate,'2026-12-15')
  const job=(await pass(owner.get(root))).jobs.find(j=>j.task_id===t.id);assert.ok(job.operation_id)
  const undoPath=`/api/v1/recovery/bulk/${job.operation_id}`
  assert.equal((await outsider.get(undoPath+'/undo-preview')).status,404)
  let undo=await pass(owner.get(undoPath+'/undo-preview'));assert.equal(undo.origin.run_id,job.id);assert.equal(undo.origin.definition_version,2);assert.equal(undo.origin.activating_admin,owner.id);assert.equal(undo.restored.length,4);assert.ok(undo.restored.every(e=>e.effectId))
  await pass(member.patch(`/api/v1/tasks/${t.id}`,{dueDate:'2026-12-16'}));await pass(member.patch(`/api/v1/tasks/${t.id}`,{dueDate:'2026-12-15',description:'Keep the later print instructions'}))
  assert.equal((await owner.post(undoPath+'/undo',{token:undo.token})).status,409)
  undo=await pass(owner.get(undoPath+'/undo-preview'));assert.ok(undo.conflicts.some(e=>e.field==='due_date'&&e.reason==='later_field_edit'))
  const result=await pass(owner.post(undoPath+'/undo',{token:undo.token}));assert.equal(result.restored.length,3)
  const restored=await pass(owner.get(`/api/v1/tasks/${t.id}`));assert.equal(restored.owner.id,owner.id);assert.equal(restored.startDate,'2026-11-27');assert.equal(restored.dueDate,'2026-12-15');assert.equal(restored.description,'Keep the later print instructions')
  assert.equal((await owner.post(undoPath+'/undo',{token:undo.token})).status,409);await w.restart();assert.equal((await pass(owner.post(root+'/jobs/process',{}))).applied,0)
  const remove=await pass(owner.post('/api/v1/data/erasure-preview',{type:'task',id:t.id}));await pass(owner.post('/api/v1/data/erase',{type:'task',id:t.id,token:remove.token,confirm:true}));assert.equal((await owner.get(undoPath+'/undo-preview')).status,404)
 })
})

describe('Owned rule work action recovery',{concurrency:false},()=>{
 let w,owner,member,outsider,p,q,tag,b,root
 const pass=async promise=>{const r=await promise;assert.equal(r.status,200,JSON.stringify(r.body)+(r.status===500?' '+(w.output().match(/(?:D1_ERROR|SQLITE_\w+|Error:)[^\n]*/g)??[]).slice(-3).join(' '):''));return r.body}
 const configure=async actions=>{
  const view=await pass(owner.get(root));await pass(owner.post(root+'/versions',{version:view.current.version,key:'work',kind:'rule',name:'Reviewed production actions',priority:'normal',actions}));const preview=await pass(owner.post(root+'/preview',{projectIds:[p.id]}));return pass(owner.post(root+'/adopt',{projectIds:[p.id],keys:['work'],revision:preview.token}))
 }
 const run=async(title,concurrent=false)=>{const task=await pass(owner.post('/api/v1/tasks',{projectId:p.id,title}));if(concurrent){const responses=await Promise.all([owner.post(root+'/jobs/process',{}),owner.post(root+'/jobs/process',{})]);assert.ok(responses.some(r=>r.status===200));assert.ok(responses.every(r=>[200,409].includes(r.status)))}else await pass(owner.post(root+'/jobs/process',{}));const job=(await pass(owner.get(root))).jobs.find(j=>j.task_id===task.id);return {task,job,path:`/api/v1/recovery/rules/${job.id}`}}
 before(async()=>{
  w=await startWorker();owner=w.owner;member=await w.person('synthetic-pegboard-6403@example.com','Maya Campaign');outsider=await w.person('synthetic-pegboard-6404@example.com','Other department')
  p=await pass(owner.post('/api/v1/projects',{name:'Austin rule production'}));q=await pass(owner.post('/api/v1/projects',{name:'Dallas shared production'}));for(const project of [p,q])await pass(owner.post('/api/v1/grants',{objectType:'project',objectId:project.id,granteeId:member.id,level:'editor'}))
  tag=await pass(owner.post('/api/v1/tags',{projectId:p.id,name:'Retail production',visibility:'project'}));b=await pass(owner.post('/api/v1/workflow-bundles',{name:'Scoped production actions'}));root=`/api/v1/workflow-bundles/${b.id}`
 },{timeout:120000})
 after(()=>w?.stop())
 it('runs all six owned actions once and preserves later work and reintroduced relationships during scoped undo',async()=>{
  const actions=[{kind:'complete'},{kind:'comment',value:'Production routing recorded by the activated rule'},{kind:'collaborator',value:member.id},{kind:'project',value:q.id},{kind:'subtask',value:'Prepare regional print artwork'},{kind:'tag',value:tag.id}]
  await configure(actions)
  const first=await run('Unchanged production routing',true),read=()=>pass(owner.get(`/api/v1/tasks/${first.task.id}`)),before=await read();assert.equal(before.status,'done');assert.equal(before.comments.length,1);assert.equal(before.subtasks.length,1);assert.equal(before.collaborators.length,1);assert.equal(before.projects.length,2);assert.equal(before.tags.length,1)
  await w.restart();assert.equal((await pass(owner.post(root+'/jobs/process',{}))).applied,0);assert.equal((await read()).subtasks.length,1)
  assert.equal((await outsider.get(first.path+'/undo-preview')).status,404)
  let preview=await pass(owner.get(first.path+'/undo-preview'));assert.equal(preview.restoredWork.length,6);assert.ok(preview.restoredWork.every(e=>e.effectId));assert.equal(preview.origin.activating_admin,owner.id)
  await pass(owner.post(first.path+'/undo',{token:preview.token}));const restored=await read();assert.equal(restored.status,'todo');assert.equal(restored.comments.length,0);assert.equal(restored.subtasks.length,0);assert.equal(restored.projects.length,1);assert.equal(restored.collaborators.length,0);assert.equal(restored.tags.length,0);assert.equal((await owner.get(`/api/v1/tasks/${before.subtasks[0].id}`)).status,404)
  const second=await run('Later human routing work'),view=await pass(owner.get(`/api/v1/tasks/${second.task.id}`)),child=view.subtasks[0]
  await pass(member.patch(`/api/v1/tasks/${child.id}`,{description:'Preserve the later production instructions'}));await pass(member.patch(`/api/v1/tasks/${second.task.id}`,{collaborators:[]}));await pass(member.patch(`/api/v1/tasks/${second.task.id}`,{collaborators:[member.id]}))
  await pass(member.post(`/api/v1/tasks/${second.task.id}/tags`,{tagId:tag.id,remove:true}));await pass(member.post(`/api/v1/tasks/${second.task.id}/tags`,{tagId:tag.id}))
  preview=await pass(owner.get(second.path+'/undo-preview'));assert.ok(preview.conflicts.some(e=>e.field==='subtask'&&e.reason==='later_created_work'));assert.ok(preview.conflicts.some(e=>e.field==='collaborator'&&e.reason==='later_relationship_change'));assert.ok(preview.conflicts.some(e=>e.field==='tag'&&e.reason==='later_relationship_change'));assert.ok(preview.conflicts.some(e=>e.field==='project'&&e.reason==='later_project_work'))
  await pass(member.patch(`/api/v1/tasks/${second.task.id}`,{description:'Preserve the separate print note'}));assert.equal((await owner.post(second.path+'/undo',{token:preview.token})).status,409)
  preview=await pass(owner.get(second.path+'/undo-preview'));await pass(owner.post(second.path+'/undo',{token:preview.token}));const kept=await pass(owner.get(`/api/v1/tasks/${second.task.id}`));assert.equal(kept.description,'Preserve the separate print note');assert.equal(kept.comments.length,0);assert.equal(kept.collaborators.length,1);assert.equal(kept.tags.length,1);assert.equal(kept.subtasks.length,1);assert.equal((await pass(owner.get(`/api/v1/tasks/${child.id}`))).description,'Preserve the later production instructions')
  await configure([{kind:'complete'}]);const approval=await pass(owner.post('/api/v1/tasks',{projectId:p.id,title:'Independent sign-off',kind:'approval',ownerId:member.id}));await pass(owner.post(root+'/jobs/process',{}));assert.equal((await pass(owner.get(root))).jobs.find(j=>j.task_id===approval.id).outcome_reason,'approval_decision_required');assert.equal((await pass(owner.get(`/api/v1/tasks/${approval.id}/decision-preview`))).state,'pending')
  await configure([{kind:'collaborator',value:outsider.id}]);const denied=await run('No new recipient access');assert.equal(denied.job.status,'cancelled');assert.equal((await outsider.get(`/api/v1/tasks/${denied.task.id}`)).status,404)
 })
})

describe('Selective configuration revision recovery',{concurrency:false},()=>{
 let w,owner,editor
 const pass=async promise=>{const r=await promise;assert.equal(r.status,200,JSON.stringify(r.body));return r.body}
 before(async()=>{w=await startWorker();owner=w.owner;editor=await w.person('synthetic-pegboard-6412@example.com','Maya Production')},{timeout:120000})
 after(()=>w?.stop())
 it('compares and restores a retained component without replacing newer configuration, activated rules or dependent work',async()=>{
  const p=await pass(owner.post('/api/v1/projects',{name:'Retained production workflow'}));await pass(owner.post('/api/v1/grants',{objectType:'project',objectId:p.id,granteeId:editor.id,level:'editor'}))
  const b=await pass(owner.post('/api/v1/workflow-bundles',{name:'Production revision history'})),root=`/api/v1/workflow-bundles/${b.id}`
  await pass(owner.post(root+'/versions',{version:1,key:'brief',kind:'template',name:'Production brief',title:'Original print brief'}));await pass(owner.post(root+'/versions',{version:2,key:'route',kind:'rule',name:'Fixed production priority',priority:'high'}))
  const adoption=await pass(owner.post(root+'/preview',{projectIds:[p.id]}));await pass(owner.post(root+'/adopt',{projectIds:[p.id],keys:['brief','route'],revision:adoption.token}));const work=await pass(owner.post(root+`/projects/${p.id}/start`,{key:'brief',ownerId:editor.id}));await pass(editor.patch(`/api/v1/tasks/${work.taskId}`,{description:'Keep the later print specification'}))
  await pass(owner.post(root+'/versions',{version:3,key:'brief',kind:'template',name:'Revised production brief',title:'Revised print brief'}));await pass(owner.post(root+'/versions',{version:4,key:'route',kind:'rule',name:'Revised priority',priority:'urgent'}))
  const input={fromVersion:2,component:'brief'};assert.equal((await editor.post(root+'/revisions/preview',input)).status,403)
  let preview=await pass(owner.post(root+'/revisions/preview',input));assert.equal(preview.current.title,'Revised print brief');assert.equal(preview.restored.title,'Original print brief')
  await pass(owner.post(root+'/versions',{version:5,key:'other',kind:'view',name:'Later saved view',status:'todo'}));assert.equal((await owner.post(root+'/revisions/restore',{...input,token:preview.token})).status,409)
  preview=await pass(owner.post(root+'/revisions/preview',input));await pass(owner.post(root+'/revisions/restore',{...input,token:preview.token}));let view=await pass(owner.get(root));assert.equal(view.current.components.brief.title,'Original print brief');assert.equal(view.current.components.route.priority,'urgent');assert.equal(view.current.components.other.name,'Later saved view');assert.equal(view.items.find(i=>i.item_key==='route').config.priority,'high');assert.equal((await pass(owner.get(`/api/v1/tasks/${work.taskId}`))).description,'Keep the later print specification')
  await pass(owner.post(root+'/versions',{version:view.current.version,key:'brief',remove:true}));preview=await pass(owner.post(root+'/revisions/preview',input));assert.equal(preview.current,null);await pass(owner.post(root+'/revisions/restore',{...input,token:preview.token}));view=await pass(owner.get(root));assert.equal(view.current.components.brief.title,'Original print brief');assert.equal(view.items.find(i=>i.item_key==='brief').version,3)
 })
})

describe('Reusable templates through reviewed public doors', { concurrency: false }, () => {
  let worker, human, designer, reviewer, ai, outsider, gallery, application, custom, baseDefinition
  const call = async (promise, status = 200) => { const response = await promise; assert.equal(response.status, status, JSON.stringify(response.body)); return response.body }
  const plan = (entry, extra = {}) => ({ templateId: entry.template.id, version: entry.version, startDate: '2026-07-02', name: `${entry.template.name} — regional delivery`, roles: Object.fromEntries(entry.definition.roles.map((role, i) => [role, [human.id, designer.id, reviewer.id][i % 3]])), ...extra })
  before(async () => {
    worker = await startWorker(); human = worker.owner
    designer = await worker.person('synthetic-pegboard-6001@example.com', 'Maya Creative')
    reviewer = await worker.person('synthetic-pegboard-6002@example.com', 'Leo Review')
    ai = await worker.person('synthetic-pegboard-6003@example.com', 'Planning agent', 'agent')
    outsider = await worker.person('synthetic-pegboard-6004@example.com', 'Unassigned stakeholder')
    gallery = (await call(human.get('/api/v1/templates'))).templates
  }, { timeout: 120000 })
  after(() => worker?.stop())

  it('instantiates every gallery family with reviewed working dates, nested work, owners, fields, dependencies, pending approvals and inactive rules', async () => {
    assert.deepEqual(new Set(gallery.map(entry => entry.template.family)), new Set(['marketing', 'launch', 'onboarding', 'event', 'content']))
    for (const entry of gallery) {
      const input = plan(entry), preview = await call(human.post('/api/v1/templates/preview', input))
      assert.deepEqual(preview.missingRoles, []); assert.equal(preview.visibility, 'private')
      assert.ok(preview.capacity.some(row => row.addedHours > 0)); assert.ok(preview.unreachableOwners.includes(designer.id))
      assert.equal(preview.tasks.find(t => t.start === 0).startDate, '2026-07-02')
      assert.equal(preview.tasks.find(t => t.due === 1).dueDate, '2026-07-06', 'relative dates skip the observed holiday and weekend')
      const applied = await call(human.post('/api/v1/templates/apply', { ...input, token: preview.token }))
      assert.deepEqual(await call(human.post('/api/v1/templates/apply', { ...input, token: preview.token })), applied, 'replaying the reviewed choice returns one application')
      const board = await call(human.get(`/api/v1/projects/${applied.projectId}`))
      assert.equal(board.project.visibility, 'private'); assert.deepEqual(board.fields.map(f => f.key).sort(), entry.definition.fields.map(f => f.key).sort())
      const rows = await Promise.all(applied.taskIds.map(id => call(human.get(`/api/v1/tasks/${id}`))))
      assert.equal(rows.length, entry.definition.tasks.length); assert.equal(new Set(applied.taskIds).size, rows.length)
      for (const [index, row] of rows.entries()) {
        const expected = preview.tasks[index]
        assert.equal(row.title, expected.title); assert.equal(row.startDate, expected.startDate); assert.equal(row.dueDate, expected.dueDate); assert.equal(row.owner.id, expected.ownerId)
        const values = Object.fromEntries(row.projects.find(p => p.id === applied.projectId).fields.map(f => [f.key, f.value]))
        for (const [key, value] of Object.entries(expected.fields)) assert.deepEqual(values[key], value)
        if (expected.parent) assert.equal(row.parentId, applied.taskIds[entry.definition.tasks.findIndex(t => t.key === expected.parent)])
        if (expected.approval) { const decision = await call(human.get(`/api/v1/tasks/${row.id}/decision-preview`)); assert.equal(decision.state, 'pending'); assert.deepEqual(decision.decisions, []) }
      }
      for (const edge of entry.definition.dependencies) {
        const successor = rows[entry.definition.tasks.findIndex(t => t.key === edge.successor)]
        const links = await call(human.get(`/api/v1/tasks/${successor.id}/dependencies`))
        assert.ok(links.dependencies.some(d => d.direction === 'predecessor' && d.task.id === applied.taskIds[entry.definition.tasks.findIndex(t => t.key === edge.predecessor)] && d.type === edge.type))
      }
      const applications = (await call(human.get(`/api/v1/projects/${applied.projectId}/template-applications`))).applications
      assert.ok(applications.some(a => a.id === applied.applicationId))
      const staged = (await call(human.get(`/api/v1/template-applications/${applied.applicationId}/rules`))).rules
      assert.deepEqual(staged.map(r => r.definition), entry.definition.rules.map(r => ({ ...r, active: false }))); assert.ok(staged.every(r => !r.active))
      await call(outsider.get(`/api/v1/projects/${applied.projectId}`), 404)
      if (entry.template.family === 'marketing') { application = applied; baseDefinition = structuredClone(entry.definition) }
    }
  })

  it('requires an explicit missing-role choice and applies a new template version only after review while retaining human edits', async () => {
    const entry = gallery[0], input = plan(entry), roles = { ...input.roles }; delete roles[entry.definition.roles[0]]
    let preview = await call(human.post('/api/v1/templates/preview', { ...input, roles }))
    assert.deepEqual(preview.missingRoles, [entry.definition.roles[0]])
    await call(human.post('/api/v1/templates/apply', { ...input, roles, token: preview.token }), 400)
    const explicit = { ...input, name: 'Unassigned launch review', roles: { ...roles, [entry.definition.roles[0]]: null }, keepUnassigned: true }
    preview = await call(human.post('/api/v1/templates/preview', explicit)); assert.deepEqual(preview.missingRoles, [])
    const unassigned = await call(human.post('/api/v1/templates/apply', { ...explicit, token: preview.token }))
    assert.equal((await call(human.get(`/api/v1/tasks/${unassigned.taskIds[0]}`))).owner.id, '')
    const copyInput = { name: 'Explicitly unassigned copied campaign', taskIds: unassigned.taskIds, includeAssignees: true }
    const copyPreview = await call(human.post(`/api/v1/projects/${unassigned.projectId}/duplicate/preview`, copyInput))
    const copy = await call(human.post(`/api/v1/projects/${unassigned.projectId}/duplicate`, { ...copyInput, revision: copyPreview.token }))
    assert.equal(copy.tasks.find(t => t.sourceId === unassigned.taskIds[0]).ownerId, '')
    custom = await call(human.post('/api/v1/templates', { name: 'Regional campaign standard', definition: baseDefinition }))
    const customInput = { ...input, templateId: custom.id, version: custom.version }
    preview = await call(human.post('/api/v1/templates/preview', customInput))
    application = await call(human.post('/api/v1/templates/apply', { ...customInput, token: preview.token }))
    const updated = structuredClone(baseDefinition); updated.tasks[0].title = 'Agree the revised regional brief'; updated.tasks[0].due += 1; updated.tasks[1].title = 'Revised audience checklist'
    await call(human.patch(`/api/v1/tasks/${application.taskIds[1]}`, { title: 'Human-owned audience research' }))
    const next = await call(human.post(`/api/v1/templates/${custom.id}/versions`, { baseVersion: custom.version, definition: updated }))
    assert.equal((await call(human.get(`/api/v1/tasks/${application.taskIds[0]}`))).title, baseDefinition.tasks[0].title)
    let adoption = await call(human.post(`/api/v1/template-applications/${application.applicationId}/adoption/preview`, { version: next.version }))
    await call(human.patch(`/api/v1/tasks/${application.taskIds[2]}`, { description: 'Retain later production context' }))
    await call(human.post(`/api/v1/template-applications/${application.applicationId}/adopt`, { version: next.version, token: adoption.token }), 409)
    adoption = await call(human.post(`/api/v1/template-applications/${application.applicationId}/adoption/preview`, { version: next.version }))
    await call(human.post(`/api/v1/template-applications/${application.applicationId}/adopt`, { version: next.version, token: adoption.token }))
    assert.equal((await call(human.get(`/api/v1/tasks/${application.taskIds[0]}`))).title, updated.tasks[0].title)
    assert.equal((await call(human.get(`/api/v1/tasks/${application.taskIds[1]}`))).title, 'Human-owned audience research')
    assert.equal((await call(human.get(`/api/v1/tasks/${application.taskIds[2]}`))).description, 'Retain later production context')
  })

  it('captures task and project structures as scoped reusable templates and separately activates retained rules', async () => {
    await call(human.patch(`/api/v1/tasks/${application.taskIds[0]}`, { internalNotes: 'Private source negotiation' }))
    await call(human.post(`/api/v1/tasks/${application.taskIds[0]}/comments`, { body: 'Source-only discussion' }))
    for (const sourceTaskId of [undefined, application.taskIds[0]]) {
      const input = { sourceProjectId: application.projectId, ...(sourceTaskId ? { sourceTaskId } : {}), name: sourceTaskId ? 'Regional brief checklist' : 'Regional campaign structure' }
      const preview = await call(human.post('/api/v1/templates/capture/preview', input))
      assert.equal(preview.definition.kind, sourceTaskId ? 'task' : 'project')
      for (const secret of ['Private source negotiation', 'Source-only discussion', designer.id, reviewer.id]) assert.ok(!JSON.stringify(preview.definition).includes(secret))
      const saved = await call(human.post('/api/v1/templates/capture', { ...input, token: preview.token }))
      await call(outsider.get(`/api/v1/templates/${saved.id}`), 404)
      const entry = await call(human.get(`/api/v1/templates/${saved.id}`)), nextInput = plan(entry, { name: `${input.name} for Brisbane` })
      const review = await call(human.post('/api/v1/templates/preview', nextInput))
      const result = await call(human.post('/api/v1/templates/apply', { ...nextInput, token: review.token }))
      assert.equal(result.taskIds.length, preview.definition.tasks.length)
      assert.ok(result.taskIds.every(id => !application.taskIds.includes(id)))
      for (const id of result.taskIds) { const task = await call(human.get(`/api/v1/tasks/${id}`)); assert.equal(task.internalNotes, ''); assert.deepEqual(task.comments, []) }
    }
    const staged = (await call(human.get(`/api/v1/template-applications/${application.applicationId}/rules`))).rules[0]
    const review = await call(human.post(`/api/v1/template-staged-rules/${staged.id}/preview`, {}))
    const activated = await call(human.post(`/api/v1/template-staged-rules/${staged.id}/activate`, { token: review.token }))
    const created = await call(human.post('/api/v1/tasks', { projectId: application.projectId, title: 'Fresh post-activation brief' }))
    await call(human.post(`/api/v1/workflow-bundles/${activated.bundleId}/jobs/process`, {}))
    assert.equal((await call(human.get(`/api/v1/tasks/${created.id}`))).priority, staged.definition.priority)
  })

  it('holds an agent-selected template and date for exact human review and refuses changed choices, replay after revocation and unauthorized settings', async () => {
    const entry = gallery[1], input = plan(entry, { name: 'Agent proposed launch' })
    const proposed = await call(ai.post('/api/v1/templates/preview', input))
    await call(ai.post('/api/v1/templates/apply', { ...input, token: proposed.token }), 403)
    await call(human.post('/api/v1/templates/apply', { ...input, token: proposed.token }), 409)
    const reviewed = await call(human.post('/api/v1/templates/preview', input))
    await call(human.post('/api/v1/templates/apply', { ...input, startDate: '2026-07-07', token: reviewed.token }), 409)
    await call(human.post('/api/v1/templates/apply', { ...input, templateId: gallery[0].template.id, token: reviewed.token }), 400)
    const applied = await call(human.post('/api/v1/templates/apply', { ...input, token: reviewed.token }))
    await call(ai.post('/api/v1/templates', { name: 'Unapproved agent template', definition: baseDefinition }), 403)
    const grant = await call(human.post('/api/v1/grants', { objectType: 'project', objectId: applied.projectId, granteeId: designer.id, level: 'admin' }))
    const add = plan(entry, { name: 'Added reviewed launch work', targetProjectId: applied.projectId })
    const open = await call(designer.post('/api/v1/templates/preview', add))
    await call(human.post(`/api/v1/grants/${grant.id}/revoke`, {}))
    await call(designer.post('/api/v1/templates/apply', { ...add, token: open.token }), 404)
    const after = await call(human.get(`/api/v1/projects/${applied.projectId}`)); assert.equal(after.counts.tasks, entry.definition.tasks.length)
  })
})

describe('Pinned template rules through current Admin review', { concurrency: false }, () => {
  let worker, human, production, ai, project, template, rule, definition, mapping
  const call = async (promise, status = 200) => { const response = await promise; assert.equal(response.status, status, JSON.stringify(response.body)); return response.body }
  const state = () => call(human.get(`/api/v1/projects/${project.id}/template-rules`))
  const activate = async (extra = {}) => { const preview = await call(human.post(`/api/v1/template-rules/${rule.id}/preview`, extra)); return call(human.post(`/api/v1/template-rules/${rule.id}/activate`, { ...extra, token: preview.token })) }
  before(async () => {
    worker = await startWorker(); human = worker.owner
    production = await worker.person('synthetic-pegboard-6201@example.com', 'Maya Production')
    ai = await worker.person('synthetic-pegboard-6202@example.com', 'Planning agent', 'agent')
    project = await call(human.post('/api/v1/projects', { name: 'Regional print requests' }))
    await call(human.post(`/api/v1/projects/${project.id}/prefix`, { prefix: 'PRINT' }))
    for (const person of [production, ai]) await call(human.post('/api/v1/grants', { objectType: 'project', objectId: project.id, granteeId: person.id, level: 'editor' }))
    definition = { kind: 'task', description: 'Regional production checklist', roles: ['Producer'], phases: ['Production'], fields: [{ key: 'batch_code', label: 'Batch code', type: 'text' }], tasks: [{ key: 'print', title: 'Prepare print production', phase: 'Production', role: 'Producer', start: 0, due: 2, hours: 4, fields: { batch_code: 'Regional' } }, { key: 'check', parent: 'print', title: 'Check print dimensions', phase: 'Production', role: 'Producer', start: 0, due: 1, hours: 1, fields: {} }], dependencies: [], rules: [] }
    template = await call(human.post('/api/v1/templates', { name: 'Regional print checklist', definition }))
    mapping = { name: 'Route regional print requests', templateId: template.id, templateVersion: template.version, workName: 'Regional production checklist', roles: { Producer: production.id }, date: { source: 'fixed', value: '2026-07-02', offsetDays: 0 } }
    rule = await call(human.post(`/api/v1/projects/${project.id}/template-rules`, mapping))
  }, { timeout: 120000 })
  after(() => worker?.stop())

  it('applies activated pinned template dates and assignments before responding, with durable once-only runs and no recursive generation', async () => {
    await call(production.post(`/api/v1/template-rules/${rule.id}/preview`, {}), 403)
    await call(ai.post(`/api/v1/template-rules/${rule.id}/activate`, { token: 'synthetic-pegboard-6203' }), 403)
    await call(human.post(`/api/v1/template-rules/${rule.id}/activate`, { token: 'synthetic-pegboard-6204' }), 409)
    await activate()
    const created = []
    for (const title of ['Austin store request', 'Denver store request']) {
      const trigger = await call(production.post('/api/v1/tasks', { projectId: project.id, title }))
      const history = await state(), run = history.runs.find(r => r.task_id === trigger.id)
      assert.equal(run.status, 'applied'); assert.equal(run.computed_start_date, '2026-07-02'); assert.equal(run.result.taskIds.length, definition.tasks.length)
      for (const id of run.result.taskIds) {
        const task = await call(human.get(`/api/v1/tasks/${id}`)); assert.equal(task.owner.id, production.id); assert.equal(task.startDate, '2026-07-02'); assert.equal(task.dueDate, task.parentId ? '2026-07-06' : '2026-07-07'); assert.ok(task.ref)
        created.push(id)
      }
      assert.equal(new Set(created).size, created.length)
    }
    const before = await state(); assert.equal(before.runs.length, 2)
    await worker.restart()
    await call(human.post(`/api/v1/projects/${project.id}/template-rules/process`, {}))
    const after = await state(); assert.deepEqual(after.runs.map(r => [r.id, r.result.taskIds]).sort(), before.runs.map(r => [r.id, r.result.taskIds]).sort())
    const tasks = (await call(human.get(`/api/v1/projects/${project.id}`))).columns.flatMap(c => c.tasks)
    assert.equal(tasks.length, 4, 'two initiating tasks plus one generated root per run')
    const exported = await call(human.post('/api/portability/exports', {}), 201)
    let archive
    for (let part = 0; part < 100; part++) {
      const progress = await call(human.post(`/api/portability/exports/${exported.id}/advance`, { maxParts: 16 }))
      if (progress.phase === 'complete') { archive = await call(human.get(`/api/portability/exports/${exported.id}/download`)); break }
    }
    assert.ok(archive, 'native archive completes with template configuration')
    const archivedRows = archive.trim().split('\n').map(line => JSON.parse(line)).filter(part => part.kind === 'part').flatMap(part => part.items).filter(item => item.kind === 'row')
    const archivedRule = archivedRows.find(item => item.table === 'peg_template_rules' && item.row.id === rule.id)
    assert.equal(archivedRule.row.enabled, 0); assert.equal(archivedRule.row.activation_id, null)
    assert.ok(!archivedRows.some(item => item.table === 'peg_template_rule_execution_guards'))
  })

  it('holds a changed template or mapping until exact reactivation and rechecks the activating administrator before execution', async () => {
    const nextDefinition = structuredClone(definition); nextDefinition.tasks[0].title = 'Prepare updated print production'
    const next = await call(human.post(`/api/v1/templates/${template.id}/versions`, { baseVersion: template.version, definition: nextDefinition }))
    const trigger = await call(production.post('/api/v1/tasks', { projectId: project.id, title: 'Request after template revision' }))
    let history = await state(), pending = history.runs.find(r => r.task_id === trigger.id)
    assert.equal(pending.status, 'pending'); assert.equal(pending.result, null)
    mapping = { ...mapping, templateVersion: next.version, roles: { Producer: human.id }, date: { source: 'fixed', value: '2026-07-08', offsetDays: 0 } }
    const changed = await call(human.post(`/api/v1/template-rules/${rule.id}`, { ...mapping, ruleVersion: rule.version })); rule.version = changed.version
    const held = await call(production.post('/api/v1/tasks', { projectId: project.id, title: 'Request after mapping revision' }))
    assert.equal((await state()).runs.find(r => r.task_id === held.id).status, 'pending')
    const preview = await call(human.post(`/api/v1/template-rules/${rule.id}/preview`, { runIds: [pending.id] }))
    await call(human.patch(`/api/v1/tasks/${held.id}`, { description: 'Later request details' }))
    await call(human.post(`/api/v1/template-rules/${rule.id}/activate`, { runIds: [pending.id], token: preview.token }), 409)
    await activate({ runIds: [pending.id] })
    history = await state(); pending = history.runs.find(r => r.id === pending.id)
    assert.equal(pending.status, 'applied'); assert.equal(pending.computed_start_date, '2026-07-08')
    assert.equal((await call(human.get(`/api/v1/tasks/${pending.result.taskIds[0]}`))).owner.id, human.id)
    assert.equal((await call(human.get(`/api/v1/tasks/${pending.result.taskIds[0]}`))).title, nextDefinition.tasks[0].title)
    assert.equal((await call(human.get(`/api/v1/tasks/${held.id}`))).description, 'Later request details')
    const grant = await call(human.post('/api/v1/grants', { objectType: 'project', objectId: project.id, granteeId: production.id, level: 'admin' }))
    const delegated = await call(production.post(`/api/v1/projects/${project.id}/template-rules`, { ...mapping, name: 'Delegated print routing' }))
    const delegatedPreview = await call(production.post(`/api/v1/template-rules/${delegated.id}/preview`, {}))
    await call(production.post(`/api/v1/template-rules/${delegated.id}/activate`, { token: delegatedPreview.token }))
    await call(human.post(`/api/v1/grants/${grant.id}/revoke`, {}))
    const latest = await call(human.post('/api/v1/tasks', { projectId: project.id, title: 'Request after Admin revocation' }))
    const refused = (await state()).runs.find(r => r.rule_id === delegated.id && r.task_id === latest.id)
    assert.equal(refused.status, 'pending'); assert.equal(refused.result, null); assert.equal(refused.outcome, 'activation_scope_changed')
    const dynamic = await call(human.post(`/api/v1/projects/${project.id}/template-rules`, { ...mapping, name: 'Reviewed request-date mapping', date: { source: 'task_start', offsetDays: 0 }, sampleSourceDate: '2026-07-09' }))
    let exact = await call(human.post(`/api/v1/template-rules/${dynamic.id}/preview`, { sampleSourceDate: '2026-07-09' }))
    await call(human.post(`/api/v1/template-rules/${dynamic.id}/activate`, { sampleSourceDate: '2026-07-09', token: exact.token }))
    const proposed = await call(ai.post('/api/v1/tasks', { projectId: project.id, title: 'Agent-selected request date', startDate: '2026-07-13' }))
    const heldByAi = (await state()).runs.find(r => r.rule_id === dynamic.id && r.task_id === proposed.id)
    assert.equal(heldByAi.status, 'pending'); assert.equal(heldByAi.outcome, 'ai_source_requires_exact_review'); assert.equal(heldByAi.result, null)
    exact = await call(human.post(`/api/v1/template-rules/${dynamic.id}/preview`, { runIds: [heldByAi.id] }))
    assert.equal(exact.selectedRuns[0].startDate, '2026-07-13')
    await call(human.post(`/api/v1/template-rules/${dynamic.id}/activate`, { runIds: [heldByAi.id], token: exact.token }))
    assert.equal((await state()).runs.find(r => r.id === heldByAi.id).status, 'applied')
  })
})

describe('Conditional local work rules',{concurrency:false},()=>{
 let w,owner,editor,admin,agent,p,q
 const pass=async(promise,status=200)=>{const r=await promise;assert.equal(r.status,status,JSON.stringify(r.body));return r.body}
 const save=(project,input)=>pass(owner.post(`/api/v1/projects/${project.id}/rules`,{name:'Route production',source:'task_start',offset:5,unit:'business_days',priority:'high',...input}))
 const activate=async(id,client=owner)=>{const preview=await pass(client.post(`/api/v1/rules/${id}/preview`,{sampleDate:'2026-07-02'}));await pass(client.post(`/api/v1/rules/${id}/activate`,{token:preview.token}));return preview}
 const task=(project,extra={})=>pass(editor.post('/api/v1/tasks',{projectId:project.id,title:'Regional print request',startDate:'2026-07-02',dueDate:'2026-07-06',...extra}))
 before(async()=>{
  w=await startWorker();owner=w.owner
  editor=await w.person('synthetic-pegboard-1201@example.com','Riley Designer');admin=await w.person('synthetic-pegboard-1202@example.com','Morgan Admin');agent=await w.person('synthetic-pegboard-1203@example.com','Intake Agent','agent')
  p=await pass(owner.post('/api/v1/projects',{name:'Austin conditional rules'}));q=await pass(owner.post('/api/v1/projects',{name:'Dallas conditional rules'}))
  for(const project of [p,q])for(const [person,level] of [[editor,'editor'],[admin,'admin'],[agent,'editor']])await pass(owner.post('/api/v1/grants',{objectType:'project',objectId:project.id,granteeId:person.id,level}))
 },{timeout:120000})
 after(()=>w?.stop())
 it('activates form and section date mappings, applies twenty exact effects once through restart and preserves a later edit during scoped undo',async()=>{
  const status=await save(p,{trigger:'form',ownerId:editor.id}),preview=await activate(status.id)
  assert.equal(preview.computedDate,'2026-07-10','observed July 3 holiday and weekend do not count')
  const sec=await pass(owner.post(`/api/v1/projects/${q.id}/sections`,{name:'Editorial review'}))
  const move=await save(q,{name:'Editorial move',trigger:'section',sectionId:sec.id,source:'task_start',offset:2,unit:'days',ownerId:owner.id});await activate(move.id)
  const ids=[],moved=[]
  for(let i=0;i<10;i++){
   const a=await pass(editor.post(`/api/v1/projects/${p.id}/requests`,{requestKey:`synthetic-pegboard-request-${i}`,title:'Regional print request',startDate:'2026-07-02',dueDate:'2026-07-06'})),b=await task(q);ids.push(a.id);moved.push(b.id)
   await pass(editor.post(`/api/v1/tasks/${b.id}/section`,{projectId:q.id,sectionId:sec.id}))
   const av=await pass(owner.get(`/api/v1/tasks/${a.id}`)),bv=await pass(owner.get(`/api/v1/tasks/${b.id}`))
   assert.equal(av.dueDate,'2026-07-10');assert.equal(av.owner.id,editor.id);assert.equal(av.priority,'high')
   assert.equal(bv.dueDate,'2026-07-04');assert.equal(bv.owner.id,owner.id)
  }
  await w.restart()
  for(const [i,id] of ids.entries()){const replay=await pass(editor.post(`/api/v1/projects/${p.id}/requests`,{requestKey:`synthetic-pegboard-request-${i}`,title:'Regional print request',startDate:'2026-07-02',dueDate:'2026-07-06'}));assert.equal(replay.id,id);assert.equal(replay.replayed,true)}
  for(const id of moved)await pass(editor.post(`/api/v1/tasks/${id}/section`,{projectId:q.id,sectionId:sec.id}))
  for(const project of [p,q]){
   await pass(owner.post(`/api/v1/projects/${project.id}/rules/process`,{}));const view=await pass(owner.get(`/api/v1/projects/${project.id}/rules`))
   assert.equal(view.runs.length,10);assert.ok(view.runs.every(r=>r.status==='applied'&&r.version===1&&r.activated_by===owner.id&&r.activation_id&&r.operation_id&&r.source.startDate==='2026-07-02'&&r.computed.dueDate===(project===p?'2026-07-10':'2026-07-04')))
  }
  const run=(await pass(owner.get(`/api/v1/projects/${p.id}/rules`))).runs.find(r=>r.task_id===ids[0]),undo=`/api/v1/recovery/bulk/${run.operation_id}`
  await pass(editor.patch(`/api/v1/tasks/${ids[0]}`,{dueDate:'2026-07-15'}))
  const review=await pass(owner.get(undo+'/undo-preview'))
  assert.ok(review.conflicts.some(c=>c.field==='due_date'&&c.reason==='later_field_value'));assert.ok(review.restored.some(e=>e.field==='priority'))
  await pass(owner.post(undo+'/undo',{token:review.token}))
  const restored=await pass(owner.get(`/api/v1/tasks/${ids[0]}`));assert.equal(restored.dueDate,'2026-07-15');assert.equal(restored.priority,'normal')
 })
 it('refuses editor configuration, stale activation, revoked Admins and agent provenance; holds dependency changes and records missing dates',async()=>{
  await pass(editor.get(`/app/projects/${p.id}/rules`),403);await pass(editor.post(`/api/v1/projects/${p.id}/rules`,{name:'Unauthorized'}),403)
  const r=await save(q,{name:'Reviewed authority',status:'done',ownerId:editor.id})
  await pass(editor.post(`/api/v1/rules/${r.id}/preview`,{}),403)
  let preview=await pass(admin.post(`/api/v1/rules/${r.id}/preview`,{}));await pass(owner.post(`/api/v1/rules/${r.id}`,{name:'Changed definition',version:1,source:'task_start',offset:-14,priority:'urgent',status:'done'}))
  await pass(admin.post(`/api/v1/rules/${r.id}/activate`,{token:preview.token}),409)
  await activate(r.id,admin)
  const grants=await pass(owner.get(`/api/v1/grants?objectType=project&objectId=${q.id}`))
  const grant=grants.grants.find(g=>g.grantee_id===admin.id);await pass(owner.delete(`/api/v1/grants/${grant.id}`))
  const t=await task(q);await pass(editor.patch(`/api/v1/tasks/${t.id}`,{status:'done'}))
  let runs=(await pass(owner.get(`/api/v1/projects/${q.id}/rules`))).runs
  assert.equal(runs.find(j=>j.task_id===t.id&&j.rule_id===r.id).status,'pending');assert.equal((await pass(owner.get(`/api/v1/tasks/${t.id}`))).dueDate,'2026-07-06')
  const safety=await save(p,{name:'Status source safeguards'});await activate(safety.id)
  const missing=await task(p,{startDate:null});await pass(editor.patch(`/api/v1/tasks/${missing.id}`,{status:'doing'}))
  runs=(await pass(owner.get(`/api/v1/projects/${p.id}/rules`))).runs;assert.equal(runs.find(j=>j.task_id===missing.id).outcome,'source_date_missing');assert.equal(runs.find(j=>j.task_id===missing.id).status,'noop')
  const linked=await task(p),hiddenProject=await pass(owner.post('/api/v1/projects',{name:'Private dependent project'})),hidden=await pass(owner.post('/api/v1/tasks',{projectId:hiddenProject.id,title:'Private acquisition delivery',startDate:'2026-07-07',dueDate:'2026-07-08'}))
  await pass(owner.post('/api/v1/dependencies',{predecessor:linked.id,successor:hidden.id,type:'fs'}));await pass(editor.patch(`/api/v1/tasks/${linked.id}`,{status:'doing'}))
  runs=(await pass(owner.get(`/api/v1/projects/${p.id}/rules`))).runs;assert.equal(runs.find(j=>j.task_id===linked.id).outcome,'dependency_cascade_requires_review');assert.equal((await pass(owner.get(`/api/v1/tasks/${linked.id}`))).dueDate,'2026-07-06');assert.equal((await pass(owner.get(`/api/v1/tasks/${hidden.id}`))).dueDate,'2026-07-08');assert.ok(!JSON.stringify(runs).includes('Private acquisition delivery'))
  const suggestion=await pass(editor.post(`/api/v1/projects/${p.id}/rule-suggestions`,{message:'Route print reviews to the designer.'}))
  let requests=await pass(editor.get(`/api/v1/projects/${p.id}/rule-suggestions`));assert.ok(requests.responsible.some(a=>a.id===owner.id));assert.equal(requests.requests.find(r=>r.id===suggestion.id).status,'submitted')
  await pass(editor.post(`/api/v1/rule-suggestions/${suggestion.id}/review`,{}),403);await pass(owner.post(`/api/v1/rule-suggestions/${suggestion.id}/review`,{}))
  requests=await pass(editor.get(`/api/v1/projects/${p.id}/rule-suggestions`));assert.equal(requests.requests.find(r=>r.id===suggestion.id).status,'reviewed')
  const ai=await task(p);await pass(agent.patch(`/api/v1/tasks/${ai.id}`,{status:'doing'}))
  runs=(await pass(owner.get(`/api/v1/projects/${p.id}/rules`))).runs;assert.equal(runs.find(j=>j.task_id===ai.id).outcome,'ai_source_requires_exact_review');assert.equal((await pass(owner.get(`/api/v1/tasks/${ai.id}`))).dueDate,'2026-07-06')
  await pass(owner.patch(`/api/v1/tasks/${ai.id}`,{status:'todo'}));await pass(owner.patch(`/api/v1/tasks/${ai.id}`,{status:'doing'}));runs=(await pass(owner.get(`/api/v1/projects/${p.id}/rules`))).runs.filter(j=>j.task_id===ai.id);assert.equal(runs.length,2);assert.ok(runs.every(j=>j.status==='pending'&&j.outcome==='ai_source_requires_exact_review'))
 })
 it('applies the complete work-action set once, undoes its own effects and refuses approval decisions or expanded audiences',async()=>{
  const a=await pass(owner.post('/api/v1/projects',{name:'Reviewed work actions'})),b=await pass(owner.post('/api/v1/projects',{name:'Same audience work'})),privateProject=await pass(owner.post('/api/v1/projects',{name:'Unreviewed wider audience',visibility:'workspace'}))
  for(const project of [a,b])await pass(owner.post('/api/v1/grants',{objectType:'project',objectId:project.id,granteeId:editor.id,level:'editor'}))
  const tag=await pass(owner.post('/api/v1/tags',{projectId:a.id,name:'Ready for production',visibility:'project'}))
  const actions=[{kind:'complete'},{kind:'comment',value:'Production handoff recorded.'},{kind:'collaborator',value:editor.id},{kind:'project',value:b.id},{kind:'subtask',value:'Prepare meeting agenda'},{kind:'tag',value:tag.id}]
  const rule=await save(a,{name:'Full work handoff',ownerId:editor.id,actions});await activate(rule.id)
  const t=await task(a);await pass(editor.patch(`/api/v1/tasks/${t.id}`,{status:'doing'}));await w.restart();await pass(owner.post(`/api/v1/projects/${a.id}/rules/process`,{}))
  let view=await pass(owner.get(`/api/v1/tasks/${t.id}`));assert.equal(view.status,'done');assert.equal(view.comments.length,1);assert.equal(view.comments[0].body,'Production handoff recorded.');assert.equal(view.subtasks.length,1);assert.equal(view.collaborators.length,1);assert.equal(view.projects.length,2);assert.equal(view.tags.length,1)
  const runs=await pass(owner.get(`/api/v1/projects/${a.id}/rules`));assert.equal(runs.runs.length,1);assert.equal(runs.runs[0].work_count,6)
  const path=`/api/v1/recovery/bulk/${runs.runs[0].operation_id}`,undo=await pass(owner.get(path+'/undo-preview'));assert.equal(undo.restoredWork.length,6);assert.equal(undo.origin.activating_admin,owner.id);await pass(owner.post(path+'/undo',{token:undo.token}))
  view=await pass(owner.get(`/api/v1/tasks/${t.id}`));assert.equal(view.status,'doing');assert.equal(view.comments.length,0);assert.equal(view.subtasks.length,0);assert.equal(view.collaborators.length,0);assert.equal(view.projects.length,1);assert.equal(view.tags.length,0)
  const approval=await task(a,{kind:'approval'});await pass(editor.patch(`/api/v1/tasks/${approval.id}`,{status:'doing'}));let history=await pass(owner.get(`/api/v1/projects/${a.id}/rules`));assert.equal(history.runs.find(j=>j.task_id===approval.id).outcome,'approval_decision_required');assert.equal((await pass(owner.get(`/api/v1/tasks/${approval.id}/decision-preview`))).state,'pending')
  await pass(owner.post(`/api/v1/rules/${rule.id}`,{name:'New audience needs independent review',version:1,source:'task_start',actions:[{kind:'project',value:privateProject.id}]}));await activate(rule.id)
  const held=await task(a);await pass(editor.patch(`/api/v1/tasks/${held.id}`,{status:'doing'}));history=await pass(owner.get(`/api/v1/projects/${a.id}/rules`));assert.equal(history.runs.find(j=>j.task_id===held.id).outcome,'share_review_required');assert.equal((await pass(owner.get(`/api/v1/tasks/${held.id}`))).projects.length,1)
  const outsider=await w.person('synthetic-pegboard-1204@example.com','Unshared collaborator')
  await pass(owner.post(`/api/v1/rules/${rule.id}`,{name:'No collaborator access escalation',version:2,source:'task_start',actions:[{kind:'collaborator',value:outsider.id}]}));await activate(rule.id)
  const unshared=await task(a);await pass(editor.patch(`/api/v1/tasks/${unshared.id}`,{status:'doing'}));history=await pass(owner.get(`/api/v1/projects/${a.id}/rules`));assert.equal(history.runs.find(j=>j.task_id===unshared.id).outcome,'collaborator_existing_access');await pass(outsider.get(`/api/v1/tasks/${unshared.id}`),404)
 })
 it('exports rules without active authority and erases source inputs and project suggestions through reviewed custody doors',async()=>{
  const p=await pass(owner.post('/api/v1/projects',{name:'Rule custody'})),r=await save(p,{});await activate(r.id)
  const t=await pass(owner.post('/api/v1/tasks',{projectId:p.id,title:'Custody source',startDate:'2026-07-02'}));await pass(owner.patch(`/api/v1/tasks/${t.id}`,{status:'doing'}));await pass(owner.post(`/api/v1/projects/${p.id}/rule-suggestions`,{message:'Retained suggestion'}))
  const exported=await pass(owner.post('/api/portability/exports',{}),201)
  let archive
  for(let i=0;i<100;i++){const progress=await pass(owner.post(`/api/portability/exports/${exported.id}/advance`,{maxParts:16}));if(progress.phase==='complete'){archive=await pass(owner.get(`/api/portability/exports/${exported.id}/download`));break}}
  assert.ok(archive)
  const rows=archive.trim().split('\n').map(line=>JSON.parse(line)).filter(part=>part.kind==='part').flatMap(part=>part.items).filter(item=>item.kind==='row'),stored=rows.find(item=>item.table==='peg_local_rules'&&item.row.id===r.id)
  assert.equal(stored.row.enabled,0);assert.equal(stored.row.activation_id,null);assert.equal(stored.row.activated_by,null)
  const erasure=await pass(owner.post('/api/v1/data/erasure-preview',{type:'task',id:t.id}));assert.ok(erasure.selections?.some(s=>s.table==='peg_local_rule_runs')??JSON.stringify(erasure).includes('peg_local_rule_runs'))
  await pass(owner.post('/api/v1/data/erase',{type:'task',id:t.id,token:erasure.token,confirm:true}));assert.equal((await pass(owner.get(`/api/v1/projects/${p.id}/rules`))).runs.length,0)
  const projectErasure=await pass(owner.post('/api/v1/data/erasure-preview',{type:'project',id:p.id}));await pass(owner.post('/api/v1/data/erase',{type:'project',id:p.id,token:projectErasure.token,confirm:true}));await pass(owner.post(`/api/v1/rules/${r.id}/preview`,{}),404)
 })

 it('computes event-relative weeks, business days and clamped months across holiday and daylight-saving boundaries',async()=>{
  for(const [index,sourceDate,offset,unit,expected] of [[1,'2026-07-16',-2,'weeks','2026-07-02'],[2,'2026-03-31',-1,'months','2026-02-28'],[3,'2026-10-31',1,'months','2026-11-30'],[4,'2026-07-06',-1,'business_days','2026-07-02'],[5,'2026-03-07',2,'days','2026-03-09']]){
   const p=await pass(owner.post('/api/v1/projects',{name:`Event routing ${index}`}))
   await pass(owner.post(`/api/v1/projects/${p.id}/fields`,{key:'event_day',label:'Custom event date',type:'date'}))
   const rule=await save(p,{name:'Event-relative routing',source:'custom',sourceField:'event_day',offset,unit,actions:[{kind:'subtask',value:'Prepare meeting agenda'}]});const preview=await activate(rule.id);assert.ok(preview.policy.includes('clamp'))
   const t=await pass(owner.post('/api/v1/tasks',{projectId:p.id,title:'Prepare event agenda'}))
   await pass(owner.post(`/api/v1/tasks/${t.id}/fields`,{projectId:p.id,values:{event_day:sourceDate}}));await pass(owner.patch(`/api/v1/tasks/${t.id}`,{status:'doing'}))
   const current=await pass(owner.get(`/api/v1/tasks/${t.id}`));assert.equal(current.dueDate,expected);assert.equal(current.subtasks.length,1);assert.equal((await pass(owner.get(`/api/v1/tasks/${current.subtasks[0].id}`))).dueDate,expected)
   const view=await pass(owner.get(`/api/v1/projects/${p.id}/rules`)),run=view.runs.find(j=>j.task_id===t.id);assert.equal(run.source.customDate,sourceDate);assert.equal(run.computed.dueDate,expected)
  }
 })

})
