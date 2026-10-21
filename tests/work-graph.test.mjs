// PEG-001, through the public doors (the JSON API and the forms that post to it): one task across projects, what a guest
// never learns, references that outlive a prefix change, and the PEG-083 join and request journeys on the same graph.
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { startWorker } from './support/worker.mjs'

let w, owner, mia, gus, nina
const ok = async (promise, status = 200) => { const r = await promise; assert.equal(r.status, status, JSON.stringify(r.body)); return r.body }
const project = (name, extra = {}) => ok(owner.post('/api/v1/projects', { name, ...extra }))
let campaign, launch, shared, mkt

describe('PEG-001 one work graph', { concurrency: false }, () => {
  before(async () => {
    w = await startWorker()
    owner = w.owner
    mia = await w.person('mia@example.com', 'Mia Member')
    gus = await w.person('gus@example.com', 'Gus Guest', 'guest')
    nina = await w.person('nina@example.com', 'Nina Newcomer')
  }, { timeout: 120000 })
  after(() => w?.stop())

  it('builds a campaign and a launch project, multi-homes one task and keeps one history', async () => {
    campaign = await project('Spring campaign'); launch = await project('Spring launch')
    await ok(owner.post(`/api/v1/projects/${campaign.id}/prefix`, { prefix: 'mkt' }))
    await ok(owner.post(`/api/v1/projects/${launch.id}/fields`, { key: 'launch_budget', label: 'Launch budget', type: 'number' }))
    await ok(owner.post(`/api/v1/projects/${campaign.id}/fields`, { key: 'agency_code', label: 'Agency code', type: 'text', visibility: 'internal' }))
    shared = await ok(owner.post('/api/v1/tasks', { title: 'Photograph the hero shot', projectId: campaign.id, estimateHours: 8 }))
    const subtask = await ok(owner.post('/api/v1/tasks', { title: 'Scout locations', parentId: shared.id, estimateHours: 2 }))
    // Move it into the launch project, then hang it in the campaign again: one record in both.
    await ok(owner.post(`/api/v1/tasks/${shared.id}/move`, { from: campaign.id, to: launch.id }))
    await ok(owner.post(`/api/v1/tasks/${shared.id}/projects`, { projectId: campaign.id }))
    await ok(owner.post(`/api/v1/tasks/${shared.id}/fields`, { projectId: launch.id, values: { launch_budget: 4200 } }))
    await ok(owner.post(`/api/v1/tasks/${shared.id}/fields`, { projectId: campaign.id, values: { agency_code: 'AG-77' } }))
    await ok(owner.post(`/api/v1/tasks/${shared.id}/comments`, { body: 'Shot list attached.' }))
    await ok(owner.patch(`/api/v1/tasks/${subtask.id}`, { status: 'done' }))
    const boards = await Promise.all([campaign, launch].map(p => ok(owner.get(`/api/v1/projects/${p.id}`))))
    for (const b of boards) {
      const cards = b.columns.flatMap(c => c.tasks)
      assert.equal(cards.filter(c => c.id === shared.id).length, 1, 'the task hangs once in each board')
      assert.equal(cards.find(c => c.id === shared.id).subtasks.done, 1)
    }
    const view = await ok(owner.get(`/api/v1/tasks/${shared.id}`))
    assert.deepEqual(view.projects.map(p => p.id).sort(), [campaign.id, launch.id].sort())
    assert.equal(view.subtasks[0].status, 'done')
    // One history: created once, moved once, added once, whatever view reads it.
    assert.equal(view.history.filter(e => e.kind === 'created').length, 1)
    assert.equal(view.history.filter(e => e.kind === 'project.added').length, 2)
    assert.equal(view.ref, 'MKT-1')
    // Effort is counted once across both projects, and the same task through its reference.
    const roll = await ok(owner.get(`/api/v1/rollup?projects=${campaign.id},${launch.id}`))
    assert.equal(roll.tasks, 2); assert.equal(roll.estimateHours, 10)
    assert.equal((await ok(owner.get('/api/v1/refs/mkt-1'))).id, shared.id)
  })

  it('shows a guest on one project nothing of the other, through the API, exports and files', async () => {
    await ok(owner.post('/api/v1/grants', { objectType: 'project', objectId: campaign.id, granteeId: gus.id, level: 'commenter' }))
    await ok(owner.post(`/api/v1/tasks/${shared.id}/attachments?projectId=${launch.id}&name=launch-plan.txt`, 'launch plan: embargoed', { 'content-type': 'text/plain' }))
    await ok(owner.post(`/api/v1/tasks/${shared.id}/attachments?projectId=${campaign.id}&name=shots.txt`, 'shots', { 'content-type': 'text/plain' }))
    const launchOnly = await ok(owner.post('/api/v1/tasks', { title: 'Embargoed press list', projectId: launch.id }))
    const internal = await ok(owner.post('/api/v1/tasks', { title: 'Agency margin notes', projectId: campaign.id, internalOnly: true }))
    assert.equal((await gus.get(`/api/v1/projects/${launch.id}`)).status, 404)
    assert.deepEqual((await ok(gus.get('/api/v1/projects'))).projects.map(p => p.name), ['Spring campaign'])
    const seen = await ok(gus.get(`/api/v1/tasks/${shared.id}`))
    assert.deepEqual(seen.projects.map(p => p.name), ['Spring campaign'])
    assert.ok(!JSON.stringify(seen).includes('Spring launch') && !JSON.stringify(seen).includes('launch_budget') && !JSON.stringify(seen).includes('4200'))
    assert.ok(!seen.projects[0].fields.some(f => f.key === 'agency_code'), 'internal field hidden from a guest')
    assert.deepEqual(seen.attachments.map(a => a.name), ['shots.txt'])
    assert.ok(!seen.history.some(e => e.projectId === launch.id))
    const hidden = (await owner.get(`/api/v1/tasks/${shared.id}`)).body.attachments.find(a => a.name === 'launch-plan.txt')
    assert.equal((await gus.get(`/api/v1/attachments/${hidden.id}`)).status, 404)
    assert.equal((await gus.get(`/api/v1/tasks/${launchOnly.id}`)).status, 404)
    assert.equal((await gus.get(`/api/v1/tasks/${internal.id}`)).status, 404)
    assert.equal((await gus.get(`/api/v1/projects/${launch.id}/export`)).status, 404)
    const csv = (await gus.get(`/api/v1/projects/${campaign.id}/export`)).body
    assert.ok(csv.includes('Photograph the hero shot') && !csv.includes('Embargoed') && !csv.includes('Agency margin') && !csv.includes('Launch budget') && !csv.includes('Agency code'))
    assert.ok(!(await gus.get('/api/v1/export')).body.includes('Embargoed'))
    assert.equal((await gus.get(`/api/v1/projects/${campaign.id}/rollup`)).body.tasks, 2, 'the hero shot and its subtask, not the internal one')
    assert.equal((await gus.get(`/api/v1/rollup?projects=${campaign.id},${launch.id}`)).status, 404)
  })

  it('keeps a personal task private and resolves every reference a task has had, to those allowed only', async () => {
    const mine = await ok(mia.post('/api/v1/tasks', { title: 'Mia private plan' }))
    for (const reader of [owner, gus, nina]) assert.equal((await reader.get(`/api/v1/tasks/${mine.id}`)).status, 404)
    assert.ok(!(await owner.get('/api/v1/export')).body.includes('Mia private'))
    assert.ok((await ok(mia.get('/api/v1/my-tasks'))).tasks.some(t => t.id === mine.id && t.personal))
    assert.equal((await mia.post(`/api/v1/tasks/${mine.id}/projects`, { projectId: campaign.id })).status, 409, 'a personal task is not quietly shared into a project')
    // MKT-1 moves between projects keeping its number; the project's prefix changes; both references find it.
    assert.equal((await ok(owner.post(`/api/v1/projects/${launch.id}/prefix`, { prefix: 'MKT' }), 409)).error, 'prefix_taken')
    await ok(owner.post(`/api/v1/projects/${campaign.id}/prefix`, { prefix: 'GROW' }))
    const next = await ok(owner.post('/api/v1/tasks', { title: 'Second task', projectId: campaign.id }))
    for (const ref of ['MKT-1', 'GROW-1', 'grow-1']) assert.equal((await ok(owner.get(`/api/v1/refs/${ref}`))).id, shared.id, ref)
    const view = await ok(owner.get(`/api/v1/tasks/${shared.id}`))
    assert.equal(view.ref, 'GROW-1'); assert.deepEqual(view.aliases, ['MKT-1'])
    assert.equal((await ok(owner.get(`/api/v1/tasks/${next.id}`))).ref, 'GROW-4', 'after MKT-1 to MKT-3, numbering carries on under the new prefix')
    // A reference nobody holds, and one held by work this person cannot open, answer the same.
    const unknown = await nina.get('/api/v1/refs/GROW-99'), refused = await nina.get('/api/v1/refs/MKT-1')
    assert.equal(refused.status, 404); assert.deepEqual(refused.body, unknown.body)
    assert.equal((await gus.get('/api/v1/refs/MKT-1')).status, 200, 'the guest on the campaign still reaches it by the old reference')
    assert.equal((await mia.get('/api/v1/refs/MKT-1')).status, 404)
  })

  it('runs the PEG-083 public-team join and private-link request journeys on this graph', async () => {
    const team = await ok(owner.post('/api/v1/teams', { name: 'Brand', privacy: 'public', defaultLevel: 'viewer' }))
    await ok(owner.patch(`/api/v1/projects/${launch.id}`, { visibility: 'team', teamId: team.id, teamLevel: 'commenter', previewRevision: (await ok(owner.get(`/api/v1/projects/${launch.id}/share-preview?visibility=team&teamId=${team.id}&teamLevel=commenter`))).revision }))
    // A newcomer browses, joins at the team's Viewer default and opens the team's project at the project's stated default.
    const found = await ok(nina.get('/api/v1/teams?q=brand'))
    assert.deepEqual(found.teams.map(t => [t.name, t.action]), [['Brand', 'join']])
    assert.equal((await nina.get(`/api/v1/projects/${launch.id}`)).status, 404, 'before joining the team project is not hers')
    const joined = await ok(nina.post(`/api/v1/teams/${team.id}/join`, {}))
    assert.equal(joined.level, 'viewer')
    const opened = await ok(nina.get(`/api/v1/projects/${launch.id}`))
    assert.equal(opened.level, 'commenter'); assert.ok(!opened.capabilities.includes('edit') && !opened.capabilities.includes('manage_settings'))
    assert.equal((await nina.get(`/api/v1/projects/${campaign.id}`)).status, 404, 'a team-visible project does not open the private one')
    // A private link: the refusal is the same for the real project and an invented one, and the ask reaches its owner.
    const real = await ok(nina.post('/api/v1/access-requests', { targetId: campaign.id, level: 'commenter', message: 'For the shoot' }))
    const invented = await ok(nina.post('/api/v1/access-requests', { targetId: 'prj_00000000000000000000', level: 'commenter' }))
    assert.deepEqual(real, invented)
    const waiting = (await ok(owner.get('/api/v1/access-requests'))).toDecide
    assert.equal(waiting.length, 1); assert.equal(waiting[0].requester.name, 'Nina Newcomer')
    const decided = await ok(owner.post(`/api/v1/access-requests/${waiting[0].id}/decision`, { decision: 'approve', level: 'commenter', revision: waiting[0].revision }))
    assert.equal(decided.level, 'commenter')
    const reads = await ok(nina.get(`/api/v1/projects/${campaign.id}`))
    assert.equal(reads.level, 'commenter')
    await ok(nina.post(`/api/v1/tasks/${shared.id}/comments`, { body: 'On my way.' }))
    assert.equal((await nina.patch(`/api/v1/tasks/${shared.id}`, { title: 'Renamed' })).status, 403)
    assert.equal((await nina.patch(`/api/v1/projects/${campaign.id}`, { name: 'Renamed' })).status, 403)
  })
  it('keeps personal work and sections owner-only through lists, ID search, reads and writes', async () => {
    const mine=await ok(mia.post('/api/v1/tasks',{title:'synthetic-pegboard-1'}))
    const section=await ok(mia.post('/api/v1/my-tasks/sections',{name:'My focus',position:7}))
    await ok(mia.post(`/api/v1/my-tasks/${mine.id}/layout`,{sectionId:section.id,position:3,today:true}))
    for(const reader of [owner,nina,gus]) {
      for(const path of [`/api/v1/tasks/${mine.id}`,`/api/v1/refs/${mine.id}`,`/app/tasks/${mine.id}`]) assert.equal((await reader.get(path)).status,404)
      assert.ok(!JSON.stringify((await ok(reader.get('/api/v1/my-tasks')))).includes(mine.id))
      assert.equal((await reader.patch(`/api/v1/tasks/${mine.id}`,{title:'leak'})).status,404)
      assert.equal((await reader.post('/api/v1/my-tasks/sections',{id:section.id,name:'stolen'})).status,404)
    }
    await ok(mia.patch(`/api/v1/tasks/${mine.id}`,{title:'My private next step'}))
    assert.equal((await ok(mia.get(`/api/v1/refs/${mine.id}`))).title,'My private next step')
    assert.equal((await mia.patch(`/api/v1/tasks/${mine.id}`,{collaborators:[nina.id]})).status,409)
  })

  it('orders the local day by group, due instant, priority, creation time and immutable ID', async () => {
    const paz=await w.person('paz@example.com','Paz Personal')
    await ok(paz.post('/api/v1/my-tasks/settings',{timezone:'America/New_York',sort:'default'}))
    const make=async(title,dueDate,priority='normal')=>ok(paz.post('/api/v1/tasks',{title,dueDate,priority}))
    const later=await make('No date',null), upcoming=await make('Next seven days','2026-03-15'), high=await make('High today','2026-03-08','high'), urgent=await make('Urgent today','2026-03-08','urgent'), overdue=await make('Overdue','2026-03-07','low'), manual=await make('Manual today','2026-04-01'), instant=await make('Before end of day','2026-03-09T03:59:59Z'), outside=await make('Eighth day','2026-03-16')
    await ok(paz.post(`/api/v1/my-tasks/${manual.id}/layout`,{today:true}))
    await ok(paz.post(`/api/v1/my-tasks/${overdue.id}/layout`,{today:true}))
    const day=(await ok(paz.get('/api/v1/my-tasks?on=2026-03-08'))).tasks
    assert.deepEqual(day.map(t=>t.id),[overdue.id,instant.id,urgent.id,high.id,manual.id,upcoming.id,outside.id,later.id])
    assert.deepEqual(day.map(t=>t.group),['Overdue','Today','Today','Today','Today','Upcoming','Later','Later'])
    const equalA=await make('Equal A','2026-03-08'),equalB=await make('Equal B','2026-03-08')
    // Force the final tie only; the task fixtures themselves all came through the public create door.
    await w.sql(`UPDATE peg_tasks SET created_at=1 WHERE id IN ('${equalA.id}','${equalB.id}')`)
    const tied=(await ok(paz.get('/api/v1/my-tasks?on=2026-03-08'))).tasks.filter(t=>[equalA.id,equalB.id].includes(t.id))
    assert.deepEqual(tied.map(t=>t.id),[equalA.id,equalB.id].sort())
    for(const [dayBefore,dayAfter,due] of [['2026-03-07','2026-03-08','2026-03-08'],['2026-10-31','2026-11-01','2026-11-01']]) {
      const task=await make(`DST ${due}`,due)
      assert.equal((await ok(paz.get(`/api/v1/my-tasks?on=${dayBefore}`))).tasks.find(t=>t.id===task.id).group,'Upcoming')
      for(let n=0;n<2;n++)assert.equal((await ok(paz.get(`/api/v1/my-tasks?on=${dayAfter}`))).tasks.find(t=>t.id===task.id).group,'Today')
      assert.equal((await ok(paz.get(`/api/v1/tasks/${task.id}`))).dueDate,due)
    }
    assert.equal((await paz.post('/api/v1/my-tasks/settings',{timezone:'invalid'})).status,400)
  })

  it('persists manual section/task ranks on reconnect and logs reversible deduplicated section rules', async () => {
    const pri=await w.person('pri@example.com','Pri Personal'), a=await ok(pri.post('/api/v1/tasks',{title:'Rank A'})), b=await ok(pri.post('/api/v1/tasks',{title:'Rank B'}))
    const section=await ok(pri.post('/api/v1/my-tasks/sections',{name:'Focus',position:9}))
    await ok(pri.post('/api/v1/my-tasks/settings',{sort:'manual'}))
    await ok(pri.post(`/api/v1/my-tasks/${a.id}/layout`,{sectionId:section.id,position:5}))
    await ok(pri.post(`/api/v1/my-tasks/${b.id}/layout`,{sectionId:section.id,position:1}))
    const reconnected=await w.signIn('pri@example.com','Pri Personal',pri.id)
    let view=await ok(reconnected.get('/api/v1/my-tasks'))
    assert.deepEqual(view.tasks.map(t=>t.id),[b.id,a.id]);assert.equal(view.sections[0].position,9)
    await ok(pri.post('/api/v1/my-tasks/sections',{id:section.id,name:'Focus',position:0}))
    const target=await ok(pri.post('/api/v1/my-tasks/sections',{name:'Later work',position:1}))
    await ok(pri.post('/api/v1/my-tasks/rules',{group:'Later',sectionId:target.id}))
    for(let n=0;n<2;n++)await ok(pri.get('/api/v1/my-tasks'))
    view=await ok(pri.get('/api/v1/my-tasks'));assert.equal(view.moves.length,2);assert.ok(view.tasks.every(t=>t.sectionId===target.id))
    await ok(pri.post(`/api/v1/my-tasks/moves/${view.moves.find(m=>m.task_id===b.id).id}/undo`,{}))
    view=await ok(pri.get('/api/v1/my-tasks'));assert.equal(view.tasks.find(t=>t.id===b.id).sectionId,section.id,'undo does not immediately replay the same rule')
    assert.equal(view.moves.filter(m=>m.undone).length,1)
    assert.equal((await nina.post(`/api/v1/my-tasks/moves/${view.moves[0].id}/undo`,{})).status,409)
  })

  it('shares personal work only against the reviewed current project audience and content', async () => {
    const p=await ok(mia.post('/api/v1/projects',{name:'Reviewed project'}))
    await ok(mia.post('/api/v1/grants',{objectType:'project',objectId:p.id,granteeId:nina.id,level:'viewer'}))
    const task=await ok(mia.post('/api/v1/tasks',{title:'Personal release plan'}))
    await ok(mia.post('/api/v1/tasks',{title:'Private child',parentId:task.id}))
    const file=await ok(mia.post(`/api/v1/tasks/${task.id}/attachments?name=personal.txt`,'private file',{'content-type':'text/plain'}))
    await ok(mia.post(`/api/v1/tasks/${task.id}/comments`,{body:'Review this conversation too'}))
    const url=`/api/v1/tasks/${task.id}/visibility-preview?projectId=${p.id}`
    const preview=await ok(mia.get(url))
    assert.ok(preview.audience.some(a=>a.id===nina.id&&a.level==='viewer'));assert.equal(preview.content.length,2)
    assert.equal((await mia.post(`/api/v1/tasks/${task.id}/share-personal`,{projectId:p.id})).status,409)
    await ok(mia.patch(`/api/v1/tasks/${task.id}`,{title:'Revised personal plan'}))
    assert.equal((await mia.post(`/api/v1/tasks/${task.id}/share-personal`,{projectId:p.id,previewRevision:preview.token})).status,409)
    const fresh=await ok(mia.get(url))
    await ok(mia.post(`/api/v1/tasks/${task.id}/share-personal`,{projectId:p.id,previewRevision:fresh.token}))
    const shown=await ok(nina.get(`/api/v1/tasks/${task.id}`));assert.equal(shown.personal,false);assert.equal(shown.comments.length,1);assert.equal(shown.attachments.length,0)
    assert.equal((await nina.patch(`/api/v1/tasks/${task.id}`,{title:'Forbidden'})).status,403)
    assert.equal((await nina.get(`/api/v1/attachments/${file.id}`)).status,404)
    assert.equal((await mia.get(`/api/v1/attachments/${file.id}`)).status,200)
    assert.equal((await gus.get(`/api/v1/tasks/${task.id}`)).status,404)
    assert.ok((await ok(mia.get(`/api/v1/tasks/${task.id}`))).history.some(e=>e.kind==='personal.shared'))
  })

  it('creates all typed fields, shared identities and consistent task/report/API calculations', async () => {
    const ps=await Promise.all(['Field campaign','Field launch','Field review'].map(name=>project(name)))
    const define=async(key,type,extra={})=>ok(owner.post(`/api/v1/projects/${ps[0].id}/fields`,{key,label:key,type,...extra}))
    const library=await define('effort','number',{units:'hours'})
    for(const p of ps.slice(1))await ok(owner.post(`/api/v1/projects/${p.id}/fields/adopt`,{fieldId:library.id}))
    for(const [key,type,extra] of [['brief','text',{}],['budget','currency',{}],['deadline','date',{}],['reviewers','people',{}],['channel','single',{options:'Web,Email'}],['audiences','multi',{options:'Retail,Wholesale'}],['checked','checkbox',{}],['twice','formula',{expression:'effort * 2'}],['related','rollup',{sourceKey:'twice'}]])await define(key,type,extra)
    const a=await ok(owner.post('/api/v1/tasks',{title:'Field inputs',projectId:ps[0].id})),b=await ok(owner.post('/api/v1/tasks',{title:'Relationship sum',projectId:ps[0].id}))
    for(const p of ps.slice(1))await ok(owner.post(`/api/v1/tasks/${a.id}/projects`,{projectId:p.id}))
    await ok(owner.post(`/api/v1/tasks/${a.id}/fields`,{projectId:ps[0].id,values:{effort:3,brief:'Launch brief',budget:12.25,deadline:'2026-11-01',reviewers:[nina.id],channel:'Web',audiences:['Retail','Wholesale'],checked:false,related:[]}}))
    await ok(owner.post(`/api/v1/tasks/${b.id}/fields`,{projectId:ps[0].id,values:{effort:4,related:[a.id]}}))
    let view=await ok(owner.get(`/api/v1/tasks/${a.id}`))
    assert.deepEqual(view.projects.map(p=>p.fields.find(f=>f.key==='effort').id),[library.id,library.id,library.id])
    const fields=Object.fromEntries(view.projects.find(p=>p.id===ps[0].id).fields.map(f=>[f.key,f]))
    assert.equal(fields.budget.units,'USD');assert.equal(fields.budget.value,12.25);assert.equal(fields.checked.value,false);assert.deepEqual(fields.reviewers.value,[nina.id]);assert.deepEqual(fields.audiences.value,['Retail','Wholesale']);assert.equal(fields.deadline.value,'2026-11-01');assert.equal(fields.channel.value,'Web');assert.equal(fields.twice.value,6)
    const report=await ok(owner.get(`/api/v1/projects/${ps[0].id}/field-report`))
    assert.equal(report.rows.find(r=>r.id===b.id).fields.find(f=>f.key==='related').value,6)
    assert.equal((await ok(owner.get(`/api/v1/projects/${ps[0].id}/rollup?field=twice`))).field.sum,14)
    await ok(owner.post(`/api/v1/tasks/${a.id}/fields`,{projectId:ps[1].id,values:{effort:8}}))
    view=await ok(owner.get(`/api/v1/tasks/${a.id}`));assert.ok(view.projects.every(p=>p.fields.find(f=>f.key==='effort').value===8))
    assert.equal(view.projects.find(p=>p.id===ps[0].id).fields.find(f=>f.key==='twice').value,16)
    assert.ok((await owner.get(`/api/v1/projects/${ps[0].id}/export`)).body.includes('16'))
    await ok(owner.post(`/api/v1/projects/${ps[0].id}/statuses`,{name:'Awaiting review',mapsTo:'doing'}))
    const board=await ok(owner.get(`/api/v1/projects/${ps[0].id}`)),status=board.columns.find(c=>c.section.name==='Awaiting review').section
    await ok(owner.post(`/api/v1/tasks/${a.id}/section`,{projectId:ps[0].id,sectionId:status.id}))
    assert.equal((await ok(owner.get(`/api/v1/tasks/${a.id}`))).status,'doing')
    assert.equal((await owner.post(`/api/v1/tasks/${a.id}/fields`,{projectId:ps[0].id,values:{budget:1.001}})).status,400)
    assert.equal((await owner.post(`/api/v1/tasks/${a.id}/fields`,{projectId:ps[0].id,values:{channel:'Other'}})).status,400)
  })

  it('explains cycles, missing and hidden inputs and refuses lossy or stale type changes', async () => {
    const p=await project('Safe field changes'),define=async(key,type,extra={})=>ok(owner.post(`/api/v1/projects/${p.id}/fields`,{key,label:key,type,...extra}))
    const text=await define('notes','text'),amount=await define('amount','number')
    await define('secret','number',{visibility:'internal'});await define('derived','formula',{expression:'secret * 2'});await define('a','formula',{expression:'b + 1'});await define('b','formula',{expression:'a + 1'});await define('divide','formula',{expression:'amount / 0'});await define('missing','formula',{expression:'unknown + 1'})
    const t=await ok(owner.post('/api/v1/tasks',{title:'Safe calculation',projectId:p.id}))
    await ok(owner.post(`/api/v1/tasks/${t.id}/fields`,{projectId:p.id,values:{notes:'Retain these words',amount:3,secret:71}}))
    const fields=(await ok(owner.get(`/api/v1/tasks/${t.id}`))).projects[0].fields
    assert.equal(fields.find(f=>f.key==='a').error,'CYCLE');assert.equal(fields.find(f=>f.key==='divide').error,'DIVISION_BY_ZERO');assert.equal(fields.find(f=>f.key==='missing').error,'INPUT_UNAVAILABLE')
    const preview=await ok(owner.get(`/api/v1/fields/${text.id}/change-preview?type=number`));assert.equal(preview.canApply,false);assert.equal(preview.affected,1)
    assert.equal((await owner.post(`/api/v1/fields/${text.id}/change`,{type:'number',previewRevision:preview.token})).status,409)
    let compatible=await ok(owner.get(`/api/v1/fields/${amount.id}/change-preview?type=currency`))
    await ok(owner.post(`/api/v1/tasks/${t.id}/fields`,{projectId:p.id,values:{amount:4}}))
    assert.equal((await owner.post(`/api/v1/fields/${amount.id}/change`,{type:'currency',previewRevision:compatible.token})).status,409)
    compatible=await ok(owner.get(`/api/v1/fields/${amount.id}/change-preview?type=currency`));await ok(owner.post(`/api/v1/fields/${amount.id}/change`,{type:'currency',previewRevision:compatible.token}))
    const kept=(await ok(owner.get(`/api/v1/tasks/${t.id}`))).projects[0].fields
    assert.equal(kept.find(f=>f.key==='notes').value,'Retain these words');assert.equal(kept.find(f=>f.key==='amount').value,4)
    await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:p.id,granteeId:gus.id,level:'viewer'}))
    const guest=await ok(gus.get(`/api/v1/tasks/${t.id}`));assert.equal(guest.projects[0].fields.find(f=>f.key==='derived').error,'INPUT_UNAVAILABLE');assert.ok(!guest.projects[0].fields.some(f=>f.key==='secret'));assert.equal(guest.projects[0].fields.find(f=>f.key==='derived').value,null);assert.ok(!JSON.stringify(guest.history).includes('secret'));assert.ok(!JSON.stringify((await ok(gus.get(`/api/v1/projects/${p.id}/fields`)))).includes('secret'))
    const hiddenReport=await ok(gus.get(`/api/v1/projects/${p.id}/field-report`));assert.ok(!hiddenReport.rows.flatMap(r=>r.fields).some(f=>f.key==='secret'||f.value===71||f.value===142))
  })

  it('keeps free-form campaign tags distinct, renames once and filters three projects without hidden counts', async () => {
    const ps=await Promise.all(['Tagged one','Tagged two','Tagged three'].map(name=>project(name))),tag=await ok(owner.post('/api/v1/tags',{projectId:ps[0].id,name:'Campaign',color:'#287bc1'}))
    for(const p of ps.slice(1))await ok(owner.post(`/api/v1/tags/${tag.id}`,{projectId:p.id}))
    const tasks=[]
    for(const p of ps){const t=await ok(owner.post('/api/v1/tasks',{title:`Tagged ${p.id}`,projectId:p.id}));tasks.push(t);await ok(owner.post(`/api/v1/tasks/${t.id}/tags`,{tagId:tag.id}))}
    await ok(owner.post(`/api/v1/tags/${tag.id}`,{name:'Autumn campaign',color:'#ff4433'}))
    const filter=await ok(owner.get(`/api/v1/tags/${tag.id}/tasks`));assert.equal(filter.tag.name,'Autumn campaign');assert.equal(filter.tasks.length,3)
    for(const t of tasks)assert.equal((await ok(owner.get(`/api/v1/tasks/${t.id}`))).tags[0].name,'Autumn campaign')
    await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:ps[0].id,granteeId:nina.id,level:'viewer'}))
    assert.equal((await ok(nina.get(`/api/v1/tags/${tag.id}/tasks`))).tasks.length,1)
    assert.equal((await ok(nina.get('/api/v1/tags'))).tags.find(t=>t.id===tag.id).count,1)
    await ok(owner.post('/api/v1/tags',{name:'Owner personal tag'}))
    await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:ps[0].id,granteeId:gus.id,level:'viewer'}))
    const guestTags=JSON.stringify(await ok(gus.get('/api/v1/tags')));assert.ok(!guestTags.includes('Autumn campaign')&&!guestTags.includes('Owner personal tag'))
    assert.equal((await nina.post(`/api/v1/tasks/${tasks[0].id}/tags`,{tagId:tag.id,remove:true})).status,403)
    await ok(owner.post(`/api/v1/tags/${tag.id}`,{archived:true}));assert.equal((await owner.post(`/api/v1/tasks/${tasks[0].id}/tags`,{tagId:tag.id})).status,400)
    assert.equal((await ok(owner.get(`/api/v1/tasks/${tasks[0].id}`))).tags[0].archived,true)
  })

  it('enforces Viewer values and tagging denial and Editor definition denial on every field/status door', async () => {
    const p=await project('Field roles'),f=await ok(owner.post(`/api/v1/projects/${p.id}/fields`,{key:'count',label:'Count',type:'number'})),t=await ok(owner.post('/api/v1/tasks',{projectId:p.id,title:'Role checks'}))
    await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:p.id,granteeId:nina.id,level:'viewer'}));await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:p.id,granteeId:mia.id,level:'editor'}))
    assert.equal((await nina.post(`/api/v1/tasks/${t.id}/fields`,{projectId:p.id,values:{count:5}})).status,403)
    for(const client of [mia,nina]){
      assert.equal((await client.post(`/api/v1/projects/${p.id}/fields`,{key:'blocked',label:'Blocked',type:'text'})).status,403)
      assert.equal((await client.post(`/api/v1/projects/${p.id}/statuses`,{name:'Blocked',mapsTo:'done'})).status,403)
      assert.equal((await client.get(`/api/v1/fields/${f.id}/change-preview?type=text`)).status,403)
      assert.equal((await client.post(`/api/v1/fields/${f.id}/change`,{type:'text'})).status,403)
    }
    await ok(mia.post(`/api/v1/tasks/${t.id}/fields`,{projectId:p.id,values:{count:5}}));assert.equal((await ok(nina.get(`/api/v1/tasks/${t.id}`))).projects[0].fields[0].value,5)
  })

})
