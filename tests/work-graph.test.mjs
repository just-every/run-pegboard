// PEG-001, through the public doors (the JSON API and the forms that post to it): one task across projects, what a guest
// never learns, references that outlive a prefix change, and the PEG-083 join and request journeys on the same graph.
import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { startWorker } from './support/worker.mjs'

let w, owner, mia, gus, nina
const ok = async (promise, status = 200) => { const r = await promise; assert.equal(r.status, status, JSON.stringify(r.body)); return r.body }
const project = (name, extra = {}) => ok(owner.post('/api/v1/projects', { name, ...extra }))
// Independent CSV reader: quoted numeric cells and escaped text are both valid CSV.
function csvRecords(text) {
  const rows=[[]];let cell='',quoted=false
  for(let i=0;i<text.length;i++){
    const c=text[i]
    if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}
    else if(c===','&&!quoted){rows.at(-1).push(cell);cell=''}
    else if(c==='\n'&&!quoted){rows.at(-1).push(cell.replace(/\r$/,''));rows.push([]);cell=''}
    else cell+=c
  }
  if(cell||rows.at(-1).length)rows.at(-1).push(cell)
  return rows.filter(row=>row.some(value=>value.length))
}
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
    const project=await ok(owner.post('/api/v1/projects',{name:'Subtask export privacy'}))
    const grant=await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:project.id,granteeId:mia.id,level:'editor'}))
    const root=await ok(owner.post('/api/v1/tasks',{projectId:project.id,title:'Shared root'}))
    const child=await ok(mia.post('/api/v1/tasks',{parentId:root.id,title:'Editor-owned child'}))
    assert.equal((await ok(mia.get('/api/v1/export?format=json'))).tasks.filter(t=>t.id===child.id).length,1,'a project subtask is never duplicated as personal work')
    await ok(owner.delete(`/api/v1/grants/${grant.id}`))
    await ok(owner.patch(`/api/v1/tasks/${child.id}`,{title:'Hidden after project revocation'}))
    assert.equal((await mia.get(`/api/v1/tasks/${child.id}`)).status,404)
    assert.ok(!(await mia.get('/api/v1/export')).body.includes('Hidden after project revocation'),'entry ownership does not bypass current project access')
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
    assert.equal((await paz.post('/api/v1/tasks',{title:'Invalid deadline',dueDate:'2026-02-31T18:30:00Z'})).status,400)
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
    const child=await ok(owner.post('/api/v1/tasks',{title:'Field subtask',parentId:a.id}))
    await ok(owner.post(`/api/v1/tasks/${child.id}/fields`,{projectId:ps[0].id,values:{effort:1.5}}))
    assert.equal((await ok(owner.get(`/api/v1/projects/${ps[0].id}/field-report`))).rows.find(r=>r.id===child.id).fields.find(f=>f.key==='twice').value,3)
    assert.equal((await ok(owner.get(`/api/v1/projects/${ps[0].id}/rollup?field=twice`))).field.sum,17)
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
    const calculated=await define('calculated','formula',{expression:'amount * 2'})
    await define('secret','number',{visibility:'internal'});await define('derived','formula',{expression:'secret * 2'});await define('a','formula',{expression:'b + 1'});await define('b','formula',{expression:'a + 1'});await define('divide','formula',{expression:'amount / 0'});await define('missing','formula',{expression:'unknown + 1'})
    const t=await ok(owner.post('/api/v1/tasks',{title:'Safe calculation',projectId:p.id}))
    await ok(owner.post(`/api/v1/tasks/${t.id}/fields`,{projectId:p.id,values:{notes:'Retain these words',amount:3,secret:71}}))
    const fields=(await ok(owner.get(`/api/v1/tasks/${t.id}`))).projects[0].fields
    assert.equal(fields.find(f=>f.key==='a').error,'CYCLE');assert.equal(fields.find(f=>f.key==='divide').error,'DIVISION_BY_ZERO');assert.equal(fields.find(f=>f.key==='missing').error,'INPUT_UNAVAILABLE')
    const calculatedPreview=await ok(owner.get(`/api/v1/fields/${calculated.id}/change-preview?type=text`))
    assert.equal(calculatedPreview.affected,1);assert.equal(calculatedPreview.canApply,false)
    assert.equal((await owner.post(`/api/v1/fields/${calculated.id}/change`,{type:'text',previewRevision:calculatedPreview.token})).status,409,'calculated values cannot disappear in a type change')
    assert.equal((await ok(owner.get(`/api/v1/tasks/${t.id}`))).projects[0].fields.find(f=>f.key==='calculated').value,6)
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

// Independent domains use independent installations; native invitation limits remain unchanged.
describe('Work planning time, recurrence and decisions', { concurrency: false }, () => {
  before(async () => {
    w = await startWorker(); owner = w.owner
    mia = await w.person('mia@example.com', 'Mia Member')
    gus = await w.person('gus@example.com', 'Gus Guest', 'guest')
    nina = await w.person('nina@example.com', 'Nina Newcomer')
  }, { timeout: 120000 })
  after(() => w?.stop())

  it('keeps one durable timer per person and reconnects without duplicate intent or entries', async () => {
    const timerPerson=await w.person('timer@example.com','Timer Person'),p=await ok(timerPerson.post('/api/v1/projects',{name:'Timed work'})),a=await ok(timerPerson.post('/api/v1/tasks',{title:'First timed task',projectId:p.id,estimateHours:2})),b=await ok(timerPerson.post('/api/v1/tasks',{title:'Second timed task',projectId:p.id,estimateHours:1}))
    const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
    const sheet=await ok(timerPerson.post('/api/v1/timesheets',{startDate:day,endDate:day})),input={taskId:a.id,key:'synthetic-pegboard-101',notes:'Draft the brief'}
    const timer=await ok(timerPerson.post(`/api/v1/timesheets/${sheet.id}/timer`,input))
    await w.restart()
    const reconnected=await w.signIn('timer@example.com','Timer Person',timerPerson.id)
    assert.equal((await ok(reconnected.post(`/api/v1/timesheets/${sheet.id}/timer`,input))).id,timer.id)
    assert.equal((await timerPerson.post(`/api/v1/timesheets/${sheet.id}/timer`,{taskId:b.id,key:'synthetic-pegboard-102'})).status,409)
    // Advance only the timer's clock, retaining the public-created durable record.
    await w.sql(`UPDATE peg_time_entries SET start_ms=start_ms-5000 WHERE id='${timer.id}'`)
    const stopped=await ok(reconnected.post(`/api/v1/time/${timer.id}/stop`,{}))
    assert.ok(stopped.seconds>=5)
    assert.equal((await ok(reconnected.post(`/api/v1/time/${timer.id}/stop`,{}))).seconds,stopped.seconds)
    const manual={taskId:b.id,key:'synthetic-pegboard-103',date:day,seconds:1800,notes:'Review the brief'}
    const entry=await ok(reconnected.post(`/api/v1/timesheets/${sheet.id}/entries`,manual));assert.equal((await ok(reconnected.post(`/api/v1/timesheets/${sheet.id}/entries`,manual))).id,entry.id)
    const race=await Promise.all(['synthetic-pegboard-104','synthetic-pegboard-105'].map(key=>reconnected.post(`/api/v1/timesheets/${sheet.id}/timer`,{taskId:b.id,key})))
    assert.deepEqual(race.map(r=>r.status).sort(),[200,409],'two tabs cannot create overlapping timers')
    const extraStop=await ok(reconnected.post(`/api/v1/time/${race.find(r=>r.status===200).body.id}/stop`,{}))
    const view=await ok(reconnected.get(`/api/v1/timesheets/${sheet.id}`))
    assert.equal(view.entries.length,3);assert.equal(view.totalSeconds,stopped.seconds+1800+extraStop.seconds);assert.equal(view.estimateHours,3);assert.ok(view.entries.every(e=>e.person_id===timerPerson.id&&e.timezone==='America/New_York'))
  })

  it('submits, returns, corrects and locks an exact timesheet, retaining attributed later adjustments and exact CSV', async () => {
    const person=await w.person('time-review@example.com','Time Reviewer Subject'),p=await ok(person.post('/api/v1/projects',{name:'Approved effort'})),a=await ok(person.post('/api/v1/tasks',{title:'Time one',projectId:p.id})),b=await ok(person.post('/api/v1/tasks',{title:'Time two',projectId:p.id}))
    const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
    const sheet=await ok(person.post('/api/v1/timesheets',{startDate:day,endDate:day}))
    const entry=await ok(person.post(`/api/v1/timesheets/${sheet.id}/entries`,{taskId:a.id,date:day,seconds:3600,key:'synthetic-pegboard-111'}))
    const stale=await ok(person.get(`/api/v1/timesheets/${sheet.id}`))
    await ok(person.post(`/api/v1/timesheets/${sheet.id}/entries`,{taskId:b.id,date:day,seconds:1200,key:'synthetic-pegboard-112'}))
    assert.equal((await person.post(`/api/v1/timesheets/${sheet.id}/decision`,{action:'submit',revision:stale.token})).status,409,'changed time requires a fresh exact review')
    const decide=async(client,action,extra={})=>client.post(`/api/v1/timesheets/${sheet.id}/decision`,{action,revision:(await ok(client.get(`/api/v1/timesheets/${sheet.id}`))).token,...extra})
    await ok(decide(person,'submit'))
    assert.equal((await person.post(`/api/v1/time/${entry.id}/correct`,{seconds:100})).status,409)
    assert.equal((await decide(person,'approve')).status,403,'a person cannot approve their own time')
    assert.equal((await nina.get(`/api/v1/timesheets/${sheet.id}`)).status,404)
    await ok(decide(owner,'return',{reason:'Include the final review'}))
    await ok(person.post(`/api/v1/time/${entry.id}/correct`,{seconds:3900,notes:'Includes final review'}))
    await ok(decide(person,'submit'));await ok(decide(owner,'approve'))
    assert.equal((await person.post(`/api/v1/time/${entry.id}/correct`,{seconds:4})).status,409)
    let view=await ok(person.get(`/api/v1/timesheets/${sheet.id}`));assert.equal(view.sheet.status,'approved');assert.equal(view.totalSeconds,5100);assert.ok(view.history.some(h=>h.action==='return'&&h.actor_id===owner.id));assert.ok(view.history.some(h=>h.action==='entry_corrected'&&h.detail.from.seconds===3600))
    const csv=await person.get(`/api/v1/timesheets/${sheet.id}/export.csv`);assert.equal(csv.status,200);assert.ok(csv.body.includes(entry.id)&&csv.body.includes(a.id)&&csv.body.includes(p.id)&&csv.body.includes('3900'));assert.equal((await person.get(`/api/v1/timesheets/${sheet.id}/export.csv`)).body,csv.body)
    await ok(person.post('/api/v1/my-tasks/settings',{timezone:'America/Los_Angeles'}))
    const correctionSheet=await ok(person.post('/api/v1/timesheets',{startDate:day,endDate:day})),adjustment=await ok(person.post(`/api/v1/time/${entry.id}/adjust`,{sheetId:correctionSheet.id,date:day,seconds:-300,reason:'Remove double-counted review',key:'synthetic-pegboard-113'}))
    assert.equal((await ok(person.get(`/api/v1/timesheets/${sheet.id}`))).totalSeconds,5100,'the approved original is unchanged')
    const correction=await ok(person.get(`/api/v1/timesheets/${correctionSheet.id}`));assert.equal(correction.entries[0].adjustment_of,entry.id);assert.equal(correction.entries[0].seconds,-300);assert.equal(correction.entries[0].timezone,'America/Los_Angeles');assert.equal(correction.entries[0].id,adjustment.id)
    await ok(person.post(`/api/v1/timesheets/${correctionSheet.id}/decision`,{action:'submit',revision:correction.token}))
    const preview=await ok(owner.get(`/api/v1/timesheets/${correctionSheet.id}`));await ok(owner.post(`/api/v1/timesheets/${correctionSheet.id}/decision`,{action:'approve',revision:preview.token}))
    const adjustedCsv=csvRecords((await person.get(`/api/v1/timesheets/${correctionSheet.id}/export.csv`)).body)
    assert.equal(Number(adjustedCsv[1][adjustedCsv[0].indexOf('seconds')]),-300,'an imported adjustment is numeric, not escaped spreadsheet text')
    assert.equal(adjustedCsv[1][adjustedCsv[0].indexOf('external_id')],adjustment.id)
    assert.equal(view.totalSeconds+(await ok(person.get(`/api/v1/timesheets/${correctionSheet.id}`))).totalSeconds,4800)
  })

  it('prepares approved time service packets and reconciles official-schema readbacks without sending', async () => {
    const person=await w.person('time-packets@example.com','Time packet owner'),p=await ok(person.post('/api/v1/projects',{name:'Client campaign effort'})),a=await ok(person.post('/api/v1/tasks',{title:'Campaign planning',projectId:p.id})),b=await ok(person.post('/api/v1/tasks',{title:'Campaign review',projectId:p.id}))
    const day='2026-10-22',sheet=await ok(person.post('/api/v1/timesheets',{startDate:day,endDate:day}))
    const e1=await ok(person.post(`/api/v1/timesheets/${sheet.id}/entries`,{taskId:a.id,date:day,seconds:3600,key:'synthetic-pegboard-901'})),e2=await ok(person.post(`/api/v1/timesheets/${sheet.id}/entries`,{taskId:b.id,date:day,seconds:72,key:'synthetic-pegboard-902'}))
    const mapping={people:{[person.id]:101},projects:{[p.id]:201},tasks:{[a.id]:301,[b.id]:302},jobcodes:{[`${p.id}/${a.id}`]:401,[`${p.id}/${b.id}`]:402}}
    const packet=(service,extra={})=>person.post(`/api/v1/timesheets/${sheet.id}/provider-packet`,{service,mapping,...extra})
    assert.equal((await packet('harvest')).status,409,'draft time never enters a packet')
    let view=await ok(person.get(`/api/v1/timesheets/${sheet.id}`));await ok(person.post(`/api/v1/timesheets/${sheet.id}/decision`,{action:'submit',revision:view.token}))
    view=await ok(owner.get(`/api/v1/timesheets/${sheet.id}`));await ok(owner.post(`/api/v1/timesheets/${sheet.id}/decision`,{action:'approve',revision:view.token}))
    assert.equal((await nina.post(`/api/v1/timesheets/${sheet.id}/provider-packet`,{service:'harvest',mapping})).status,404)
    assert.equal((await packet('unknown')).status,400)
    const anonymous=new owner.constructor(w.origin,'','Signed out')
    assert.equal((await anonymous.post(`/api/v1/timesheets/${sheet.id}/provider-packet`,{service:'harvest',mapping})).status,401)
    assert.equal((await person.call('POST',`/api/v1/timesheets/${sheet.id}/provider-packet`,{service:'harvest',mapping},{origin:'https://elsewhere.example'})).status,403)
    for(const service of ['harvest','quickbooks-time']){
      const missing=await ok(packet(service,{mapping:{}}));assert.equal(missing.rows.length,0);assert.equal(missing.pending.length,2);assert.equal(missing.requests.length,0)
      const expected=await ok(packet(service));assert.equal(expected.delivery,'not_sent');assert.equal(expected.totalSeconds,3672);assert.equal(expected.exportableSeconds,3672);assert.equal(expected.pending.length,0)
      assert.deepEqual((await ok(packet(service))).requests,expected.requests,'replay keeps external identities and never submits requests')
      let response
      if(service==='harvest'){
        assert.deepEqual(expected.requests.map(r=>[r.method,r.url,r.body.user_id,r.body.project_id,r.body.task_id,r.body.spent_date,r.body.hours,r.body.external_reference.id]),[
          ['POST','https://api.harvestapp.com/v2/time_entries',101,201,301,day,1,e1.id],['POST','https://api.harvestapp.com/v2/time_entries',101,201,302,day,0.02,e2.id]])
        response={time_entries:[{id:501,user:{id:101},project:{id:201},task:{id:301},spent_date:day,hours:1,is_running:false,external_reference:{id:e1.id,group_id:sheet.id}},{id:502,user:{id:101},project:{id:201},task:{id:302},spent_date:day,hours:0.02,is_running:false,external_reference:{id:e2.id,group_id:sheet.id}}],next_page:null,total_pages:1}
      }else{
        assert.equal(expected.requests.length,1);assert.equal(expected.requests[0].url,'https://rest.tsheets.com/api/v1/timesheets')
        assert.deepEqual(expected.requests[0].body.data,[{user_id:101,jobcode_id:401,type:'manual',date:day,duration:3600,notes:`[Pegboard:${e1.id}] `},{user_id:101,jobcode_id:402,type:'manual',date:day,duration:72,notes:`[Pegboard:${e2.id}] `}])
        response={results:{timesheets:{501:{id:501,user_id:101,jobcode_id:401,type:'manual',date:day,duration:3600,notes:`[Pegboard:${e1.id}] `},502:{id:502,user_id:101,jobcode_id:402,type:'manual',date:day,duration:72,notes:`[Pegboard:${e2.id}] `}}},more:false}
      }
      const reconcile=(receipt,revision=expected.revision)=>person.post(`/api/v1/timesheets/${sheet.id}/provider-reconciliation`,{service,mapping,revision,response:receipt})
      const result=await ok(reconcile(response));assert.equal(result.reconciled,true);assert.equal(result.matchedSeconds,3672);assert.equal(result.receiptAuthority,'user_supplied_unverified');assert.equal(result.delivery,'not_sent')
      assert.deepEqual(await ok(reconcile(response)),result,'reconciliation is repeatable and writes no provider or local time entries')
      const changed=structuredClone(response),row=service==='harvest'?changed.time_entries[1]:changed.results.timesheets[502]
      if(service==='harvest')row.hours=0.03;else row.duration=108
      assert.equal((await ok(reconcile(changed))).reconciled,false,'rounding is never accepted as exact')
      if(service==='harvest')row.hours=0.02;else row.duration=72
      if(service==='harvest')row.task.id=999;else row.jobcode_id=999
      assert.equal((await ok(reconcile(changed))).reconciled,false,'incorrect task/job mapping is visible')
      const duplicate=structuredClone(response)
      if(service==='harvest')duplicate.time_entries.push({...response.time_entries[0],id:503});else duplicate.results.timesheets[503]={...response.results.timesheets[501],id:503}
      const duplicated=await ok(reconcile(duplicate));assert.equal(duplicated.reconciled,false);assert.ok(duplicated.issues.some(i=>i.reason==='duplicate_external_id'))
      const sameId=structuredClone(response)
      if(service==='harvest')sameId.time_entries[1].id=501;else sameId.results.timesheets[502].id=501
      assert.equal((await ok(reconcile(sameId))).reconciled,false,'two sources cannot claim one provider entry')
      const absent=structuredClone(response)
      if(service==='harvest')absent.time_entries.pop();else delete absent.results.timesheets[502]
      assert.equal((await ok(reconcile(absent))).reconciled,false)
      if(service==='quickbooks-time'){
        const refused=structuredClone(response);refused.results.timesheets[502]._status_code=417
        assert.equal((await ok(reconcile(refused))).reconciled,false,'provider validation failures never reconcile')
      }
      const paged=structuredClone(response);if(service==='harvest')paged.next_page=2;else paged.more=true
      assert.equal((await reconcile(paged)).status,400)
      assert.equal((await reconcile(response,'synthetic-pegboard-stale')).status,409)
    }
    // Unsupported adjustments and sub-hundredth durations remain in an exportable repair packet, never silently rounded.
    const correction=await ok(person.post('/api/v1/timesheets',{startDate:day,endDate:day})),adjustment=await ok(person.post(`/api/v1/time/${e1.id}/adjust`,{sheetId:correction.id,date:day,seconds:-36,reason:'Overcounted review',key:'synthetic-pegboard-903'}))
    await ok(person.post(`/api/v1/timesheets/${correction.id}/entries`,{taskId:b.id,date:day,seconds:1,key:'synthetic-pegboard-904'}))
    view=await ok(person.get(`/api/v1/timesheets/${correction.id}`));await ok(person.post(`/api/v1/timesheets/${correction.id}/decision`,{action:'submit',revision:view.token}));view=await ok(owner.get(`/api/v1/timesheets/${correction.id}`));await ok(owner.post(`/api/v1/timesheets/${correction.id}/decision`,{action:'approve',revision:view.token}))
    const held=await ok(person.post(`/api/v1/timesheets/${correction.id}/provider-packet`,{service:'quickbooks-time',mapping}));assert.equal(held.totalSeconds,-35);assert.equal(held.rows.length,0);assert.equal(held.pending.find(e=>e.externalId===adjustment.id).adjustmentOf,e1.id);assert.deepEqual(held.pending.map(e=>e.reason).sort(),['adjustment_requires_reviewed_provider_correction','provider_rounds_manual_duration'])
    assert.equal((await ok(person.get(`/api/v1/timesheets/${sheet.id}`))).totalSeconds,3672)
    // A retained owner sheet no longer discloses a removed project's references, notes or mappings.
    const moved=await ok(person.post('/api/v1/projects',{name:'Later work home'}));await ok(person.post(`/api/v1/tasks/${a.id}/projects`,{projectId:moved.id}))
    await ok(person.delete(`/api/v1/tasks/${a.id}/projects/${p.id}`))
    assert.equal((await packet('harvest')).status,403)
  })

  it('fences stale time review and keeps private no-project work out of ordinary administrator review', async () => {
    const person=await w.person('private-time@example.com','Private Time'),t=await ok(person.post('/api/v1/tasks',{title:'Private planning'}))
    const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
    const sheet=await ok(person.post('/api/v1/timesheets',{startDate:day,endDate:day}))
    await ok(person.post(`/api/v1/timesheets/${sheet.id}/entries`,{taskId:t.id,date:day,seconds:600,key:'synthetic-pegboard-121'}))
    const view=await ok(person.get(`/api/v1/timesheets/${sheet.id}`))
    assert.equal((await person.post(`/api/v1/timesheets/${sheet.id}/decision`,{action:'submit',revision:view.token})).status,409)
    assert.equal((await owner.get(`/api/v1/timesheets/${sheet.id}`)).status,404)
    assert.ok(!(await ok(owner.get('/api/v1/timesheets'))).sheets.some(s=>s.id===sheet.id))
    const p=await ok(person.post('/api/v1/projects',{name:'Reviewed time scope'})),preview=await ok(person.get(`/api/v1/tasks/${t.id}/visibility-preview?projectId=${p.id}`))
    await ok(person.post(`/api/v1/tasks/${t.id}/share-personal`,{projectId:p.id,previewRevision:preview.token}))
    const a=await project('Time scope A'),b=await project('Time scope B'),shared=await ok(owner.post('/api/v1/tasks',{title:'Shared time scope',projectId:a.id}))
    await ok(owner.post(`/api/v1/tasks/${shared.id}/projects`,{projectId:b.id}))
    const grant=await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:a.id,granteeId:person.id,level:'editor'}))
    await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:b.id,granteeId:person.id,level:'editor'}))
    const scoped=await ok(person.post('/api/v1/timesheets',{startDate:day,endDate:day}))
    await ok(person.post(`/api/v1/timesheets/${scoped.id}/entries`,{taskId:shared.id,projectId:a.id,date:day,seconds:300,key:'synthetic-pegboard-122'}))
    await ok(owner.delete(`/api/v1/grants/${grant.id}`))
    const revoked=await ok(person.get(`/api/v1/timesheets/${scoped.id}`));assert.equal(revoked.entries[0].available,false)
    assert.equal((await person.post(`/api/v1/timesheets/${scoped.id}/decision`,{action:'submit',revision:revoked.token})).status,409,'another project does not bypass the recorded project scope')
    // Existing private time remains private: a share does not retroactively attach its time entry to a project.
    assert.equal((await person.post(`/api/v1/timesheets/${sheet.id}/decision`,{action:'submit',revision:view.token})).status,409)
  })

  it('reviews whole sheets with delegated authority, refuses stale grants and withdraws unavailable returned entries without disclosure', async () => {
    const logger=await w.person('review-logger@example.com','Review logger'),admin=await w.person('project-reviewer@example.com','Project reviewer'),manager=await w.person('time-manager@example.com','Time manager','manager'),agent=await w.person('time-agent@example.com','Time agent','agent')
    const a=await project('Review project A'),b=await project('Review project B')
    const taskA=await ok(owner.post('/api/v1/tasks',{title:'Hidden review A',projectId:a.id})),taskB=await ok(owner.post('/api/v1/tasks',{title:'Review B',projectId:b.id}))
    const grant=async(person,p,level)=>ok(owner.post('/api/v1/grants',{objectType:'project',objectId:p.id,granteeId:person.id,level}))
    const loggerA=await grant(logger,a,'editor');await grant(logger,b,'editor');const adminB=await grant(admin,b,'admin')
    await grant(manager,a,'viewer');await grant(manager,b,'viewer');await grant(agent,b,'editor')
    const day='2026-10-22';let serial=200
    const sheet=async(person,tasks)=>{
      const s=await ok(person.post('/api/v1/timesheets',{startDate:day,endDate:day}))
      for(const task of tasks)await ok(person.post(`/api/v1/timesheets/${s.id}/entries`,{taskId:task.id,date:day,seconds:300,key:`synthetic-pegboard-${++serial}`,notes:task.id===taskA.id?'Hidden note A':'Review work'}))
      await decision(person,s,'submit');return s
    }
    const view=(person,s)=>ok(person.get(`/api/v1/timesheets/${s.id}`))
    const decision=async(person,s,action)=>ok(person.post(`/api/v1/timesheets/${s.id}/decision`,{action,reason:'Please correct',revision:(await view(person,s)).token}))
    const single=await sheet(logger,[taskB])
    const effects=async()=>JSON.parse(await w.sql('SELECT (SELECT COUNT(*) FROM peg_inbox) inbox, (SELECT COUNT(*) FROM rer_mail_development_outbox) mail'))[0].results
    const beforeEffects=await effects()
    await decision(admin,single,'approve')
    assert.deepEqual(await effects(),beforeEffects,'approval queues no notification or provider mail')
    const managerSheet=await sheet(logger,[taskA,taskB]);await decision(manager,managerSheet,'approve')
    const mixed=await sheet(logger,[taskA,taskB])
    assert.equal((await admin.get(`/api/v1/timesheets/${mixed.id}`)).status,404)
    assert.ok(!(await ok(admin.get('/api/v1/timesheets'))).sheets.some(s=>s.id===mixed.id))
    assert.equal((await agent.get(`/api/v1/timesheets/${mixed.id}`)).status,404)
    assert.equal((await agent.post(`/api/v1/timesheets/${mixed.id}/decision`,{action:'approve',revision:(await view(manager,mixed)).token})).status,404)
    await decision(manager,mixed,'return')
    await ok(owner.delete(`/api/v1/grants/${loggerA.id}`))
    const lost=await view(logger,mixed),entry=lost.entries.find(e=>!e.available)
    assert.ok(entry);assert.ok(!JSON.stringify(lost).includes('Hidden review A'));assert.ok(!JSON.stringify(lost).includes('Hidden note A'))
    assert.equal(entry.task_id,null);assert.equal(entry.project_id,null)
    assert.equal((await admin.post(`/api/v1/time/${entry.id}/withdraw`,{revision:lost.token})).status,404)
    await ok(logger.post(`/api/v1/time/${entry.id}/withdraw`,{revision:lost.token}))
    const withdrawn=await view(logger,mixed)
    assert.equal(withdrawn.entries.length,1);assert.equal(withdrawn.totalSeconds,300)
    assert.ok(withdrawn.history.some(h=>h.action==='entry_withdrawn'&&h.actor_id===logger.id))
    await decision(logger,mixed,'submit')
    const scoped=await view(admin,mixed)
    assert.ok(!JSON.stringify(scoped).includes('Hidden note A'));assert.ok(!JSON.stringify(scoped).includes(taskA.id))
    const stale=await view(admin,mixed)
    await ok(owner.delete(`/api/v1/grants/${adminB.id}`))
    assert.equal((await admin.post(`/api/v1/timesheets/${mixed.id}/decision`,{action:'approve',revision:stale.token})).status,404)
    await grant(admin,b,'admin')
    assert.equal((await admin.post(`/api/v1/timesheets/${mixed.id}/decision`,{action:'approve',revision:stale.token})).status,409)
    await decision(manager,mixed,'approve')
    assert.equal((await logger.post(`/api/v1/time/${entry.id}/withdraw`,{revision:(await view(logger,mixed)).token})).status,409)
    const soleProject=await project('Sole owner review'),soleTask=await ok(owner.post('/api/v1/tasks',{title:'Only owner can review',projectId:soleProject.id}))
    const ownerSheet=await sheet(owner,[soleTask]),self=await view(owner,ownerSheet)
    assert.equal(self.canReview,false)
    assert.equal((await owner.post(`/api/v1/timesheets/${ownerSheet.id}/decision`,{action:'approve',revision:self.token})).status,403)
    assert.match((await owner.get(`/app/time/${ownerSheet.id}`)).body,/awaiting another reviewer/)
    // The logger loses authority after the review preview, then a fresh decision also refuses approval.
    const memberSheet=await sheet(logger,[taskB]),before=await view(manager,memberSheet)
    await ok(owner.patch(`/api/v1/workspaces/ws_main/people/${logger.id}`,{role:'analyst'}))
    assert.equal((await manager.post(`/api/v1/timesheets/${memberSheet.id}/decision`,{action:'approve',revision:before.token})).status,409)
    assert.equal((await manager.post(`/api/v1/timesheets/${memberSheet.id}/decision`,{action:'approve',revision:(await view(manager,memberSheet)).token})).status,409)
    const guest=await w.person('time-guest@example.com','Time guest','guest')
    await grant(guest,b,'editor')
    const guestTask=await ok(owner.post('/api/v1/tasks',{title:'Guest assigned time',projectId:b.id,ownerId:guest.id}))
    const guestSheet=await sheet(guest,[guestTask]);await decision(admin,guestSheet,'approve')
    const team=await ok(owner.post('/api/v1/teams',{name:'Review team',privacy:'private'})),teamAdmin=await w.person('time-team@example.com','Team admin')
    await ok(owner.post('/api/v1/grants',{objectType:'team',objectId:team.id,granteeId:teamAdmin.id,level:'admin'}))
    const teamProject=await project('Team review project',{teamId:team.id,visibility:'team',teamLevel:'viewer'})
    const teamTask=await ok(owner.post('/api/v1/tasks',{title:'Team work',projectId:teamProject.id}))
    const teamSheet=await sheet(owner,[teamTask]);await decision(teamAdmin,teamSheet,'approve')
    const expiryPerson=await w.person('time-expiry@example.com','Expiring reviewer')
    await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:b.id,granteeId:expiryPerson.id,level:'admin',expiresAt:Date.now()+3000}))
    const expirySheet=await sheet(owner,[taskB]),expiryView=await view(expiryPerson,expirySheet)
    await new Promise(resolve=>setTimeout(resolve,3100))
    assert.equal((await expiryPerson.post(`/api/v1/timesheets/${expirySheet.id}/decision`,{action:'approve',revision:expiryView.token})).status,404)
  })

  it('attributes every existing sign-off reopening door to its writer without inventing a reopen for a no-op', async () => {
    const worker=await w.person('reopen-writer@example.com','Sign-off writer'),p=await project('Attributed sign-off'),q=await project('Second sign-off home')
    for(const home of [p,q])await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:home.id,granteeId:worker.id,level:'editor'}))
    const field=await ok(owner.post(`/api/v1/projects/${p.id}/fields`,{key:'review_context',label:'Review context',type:'text'})),tag=await ok(owner.post('/api/v1/tags',{projectId:p.id,name:'Review scope'})),sections=(await ok(owner.get(`/api/v1/projects/${p.id}`))).columns.filter(c=>c.section).map(c=>c.section)
    const cases=[
      ['task_edit',worker,t=>worker.patch(`/api/v1/tasks/${t.id}`,{description:'Changed work under review'})],
      ['comment',worker,t=>worker.post(`/api/v1/tasks/${t.id}/comments`,{body:'New review evidence'})],
      ['attachment',worker,t=>worker.post(`/api/v1/tasks/${t.id}/attachments?projectId=${p.id}&name=review.txt`,'synthetic-pegboard-901',{'content-type':'text/plain'})],
      ['field_value',worker,t=>worker.post(`/api/v1/tasks/${t.id}/fields`,{projectId:p.id,values:{review_context:'Revised context'}})],
      ['field_value',worker,t=>worker.post(`/api/v1/tasks/${t.id}/fields`,{projectId:p.id,values:{review_context:null}}),'delete'],
      ['field_definition',owner,async t=>{const change={label:'Revised review definition'},preview=await ok(owner.get(`/api/v1/fields/${field.id}/change-preview?label=${encodeURIComponent(change.label)}`));return owner.post(`/api/v1/fields/${field.id}/change`,{...change,previewRevision:preview.token})}],
      ['collaborators',worker,t=>worker.patch(`/api/v1/tasks/${t.id}`,{collaborators:[nina.id]})],
      ['tag',worker,t=>worker.post(`/api/v1/tasks/${t.id}/tags`,{tagId:tag.id})],
      ['tag',worker,t=>worker.post(`/api/v1/tasks/${t.id}/tags`,{tagId:tag.id,remove:true}),'remove'],
      ['project_membership',worker,t=>worker.post(`/api/v1/tasks/${t.id}/projects`,{projectId:q.id})],
      ['project_membership',worker,t=>worker.post(`/api/v1/tasks/${t.id}/move`,{from:p.id,to:q.id})],
      ['project_membership',worker,t=>worker.delete(`/api/v1/tasks/${t.id}/projects/${q.id}`),'remove_home'],
      ['project_membership',worker,t=>worker.post(`/api/v1/tasks/${t.id}/section`,{projectId:p.id,sectionId:sections.find(s=>s.mapsTo==='doing'||s.maps_to==='doing').id})],
    ]
    for(const [cause,actor,mutate,setup] of cases){
      const task=await ok(owner.post('/api/v1/tasks',{title:'Approval '+cause+(setup??''),kind:'approval',projectId:p.id,ownerId:worker.id}))
      if(setup==='delete')await ok(worker.post(`/api/v1/tasks/${task.id}/fields`,{projectId:p.id,values:{review_context:'Original'}}))
      if(setup==='remove')await ok(worker.post(`/api/v1/tasks/${task.id}/tags`,{tagId:tag.id}))
      if(setup==='remove_home')await ok(worker.post(`/api/v1/tasks/${task.id}/projects`,{projectId:q.id}))
      const preview=await ok(owner.get(`/api/v1/tasks/${task.id}/decision-preview`))
      await ok(owner.post(`/api/v1/tasks/${task.id}/decision`,{action:'approve',revision:preview.token,reason:'Reviewed exact current work'}))
      await ok(mutate(task))
      const view=await ok(owner.get(`/api/v1/tasks/${task.id}`)),reopens=view.history.filter(h=>h.kind==='decision.reopened')
      assert.notEqual(view.status,'done',cause);assert.equal(reopens.length,1,cause);assert.equal(reopens[0].actor,actor.name,cause);assert.equal(reopens[0].detail.cause,cause)
      assert.equal((await ok(owner.get(`/api/v1/tasks/${task.id}/decision-preview`))).state,'reopened')
    }
    const task=await ok(owner.post('/api/v1/tasks',{title:'No-op does not invent sign-off changes',kind:'approval',projectId:p.id,ownerId:worker.id}))
    await ok(worker.post(`/api/v1/tasks/${task.id}/tags`,{tagId:tag.id}))
    const pv=await ok(owner.get(`/api/v1/tasks/${task.id}/decision-preview`));await ok(owner.post(`/api/v1/tasks/${task.id}/decision`,{action:'approve',revision:pv.token,reason:'Current tag included'}))
    await ok(worker.post(`/api/v1/tasks/${task.id}/tags`,{tagId:tag.id}))
    const unchanged=await ok(owner.get(`/api/v1/tasks/${task.id}`));assert.equal(unchanged.status,'done');assert.equal(unchanged.history.filter(h=>h.kind==='decision.reopened').length,0)
  })

  it('pins recurring work templates and generates one occurrence across restart, DST, exceptions and concurrent runners', async () => {
    const p=await project('Recurring onboarding'),person=await w.person('recurrence-worker@example.com','Recurring worker')
    const task=await ok(owner.post('/api/v1/tasks',{title:'Weekly review',projectId:p.id,ownerId:person.id,kind:'approval'}))
    const child=await ok(owner.post('/api/v1/tasks',{title:'Review checklist',parentId:task.id}))
    await ok(owner.post(`/api/v1/projects/${p.id}/fields`,{key:'planned_count',label:'Planned count',type:'number'}))
    await ok(owner.post(`/api/v1/tasks/${task.id}/fields`,{projectId:p.id,values:{planned_count:12}}))
    const decide=await ok(owner.get(`/api/v1/tasks/${task.id}/decision-preview`))
    await ok(owner.post(`/api/v1/tasks/${task.id}/decision`,{action:'approve',revision:decide.token,reason:'Reviewed exact work'}))
    const input={sourceType:'task',sourceId:task.id,mode:'calendar',timezone:'America/New_York',unit:'week',interval:1,start:'2026-03-08',count:1,exceptions:['2026-03-08']}
    let preview=await ok(owner.post('/api/v1/recurrences/preview',input))
    assert.deepEqual(preview.occurrences,['2026-03-15'])
    await ok(owner.patch(`/api/v1/tasks/${task.id}`,{description:'Revised recurring instructions'}))
    assert.equal((await owner.post('/api/v1/recurrences',{...input,revision:preview.token})).status,409)
    preview=await ok(owner.post('/api/v1/recurrences/preview',input))
    const schedule=await ok(owner.post('/api/v1/recurrences',{...input,revision:preview.token}))
    const raced=await Promise.all([owner.post(`/api/v1/recurrences/${schedule.id}/run`,{}),owner.post(`/api/v1/recurrences/${schedule.id}/run`,{})])
    assert.ok(raced.some(r=>r.status===200&&r.body.state==='generated'))
    await w.restart();await ok(owner.post(`/api/v1/recurrences/${schedule.id}/run`,{}))
    const view=await ok(owner.get(`/api/v1/recurrences/${schedule.id}`))
    assert.equal(view.occurrences.length,1);assert.equal(view.occurrences[0].local_date,'2026-03-15')
    const copy=await ok(owner.get(`/api/v1/tasks/${view.occurrences[0].object_id}`))
    assert.equal(copy.kind,'approval');assert.equal(copy.status,'todo');assert.equal(copy.subtasks.length,1);assert.equal(copy.projects[0].fields.find(f=>f.key==='planned_count').value,12)
    assert.equal((await ok(owner.get(`/api/v1/tasks/${copy.id}/decision-preview`))).decisions.length,0)
    assert.ok(copy.history.some(h=>h.detail.templateId===schedule.templateId))
    assert.equal((await person.get(`/api/v1/recurrences/${schedule.id}`)).status,403)
    const projectInput={...input,sourceType:'project',sourceId:p.id,start:'2026-11-01',end:'2026-11-30',exceptions:[]}
    const dst=await ok(owner.post('/api/v1/recurrences/preview',projectInput));assert.deepEqual(dst.occurrences,['2026-11-01'])
    projectInput.start='2026-03-01';projectInput.end='2026-03-31'
    const pp=await ok(owner.post('/api/v1/recurrences/preview',projectInput)),projectSchedule=await ok(owner.post('/api/v1/recurrences',{...projectInput,revision:pp.token}))
    const interrupted=owner.post(`/api/v1/recurrences/${projectSchedule.id}/run`,{}).catch(()=>null)
    await w.restart();await interrupted
    await ok(owner.post(`/api/v1/recurrences/${projectSchedule.id}/run`,{}))
    const projectResult=await ok(owner.get(`/api/v1/recurrences/${projectSchedule.id}`));assert.equal(projectResult.occurrences.length,1)
    const generated={id:projectResult.occurrences[0].object_id}
    const board=await ok(owner.get(`/api/v1/projects/${generated.id}`)),sourceBoard=await ok(owner.get(`/api/v1/projects/${p.id}`));assert.equal(board.counts.tasks,sourceBoard.counts.tasks)
    assert.equal((await person.get(`/api/v1/projects/${generated.id}`)).status,404,'project recurrence copies no grants')
    const completionInput={...input,sourceType:'task',sourceId:child.id,mode:'completion',start:'2026-03-01',exceptions:[]}
    assert.equal((await owner.post('/api/v1/recurrences/preview',completionInput)).status,400,'recurrence is rooted, not detached from its parent')
    const normal=await ok(owner.post('/api/v1/tasks',{title:'Completion-based recurring task',projectId:p.id}))
    completionInput.sourceId=normal.id
    const cp=await ok(owner.post('/api/v1/recurrences/preview',completionInput)),cs=await ok(owner.post('/api/v1/recurrences',{...completionInput,revision:cp.token}))
    assert.equal((await ok(owner.post(`/api/v1/recurrences/${cs.id}/run`,{}))).state,'awaiting_completion')
    await ok(owner.patch(`/api/v1/tasks/${normal.id}`,{status:'done'}))
    await w.sql(`UPDATE peg_tasks SET completed_at=completed_at-8*86400000 WHERE id='${normal.id}'`)
    const next=await ok(owner.post(`/api/v1/recurrences/${cs.id}/run`,{}));assert.equal(next.state,'generated')
    await ok(owner.post(`/api/v1/recurrences/${cs.id}/stop`,{}));assert.equal((await ok(owner.post(`/api/v1/recurrences/${cs.id}/run`,{}))).state,'finished')
  })

  it('reviews one standing internal recurring audience, names unreachable assignees and applies it once across restart and replay', async () => {
    const member=await w.person('recurring-team@example.com','Recurring teammate'),editor=await w.person('recurring-editor@example.com','Recurring editor'),outsider=await w.person('recurring-outside@example.com','Unreachable assignee'),guest=await w.person('recurring-guest@example.com','Recurring guest','guest')
    const team=await ok(owner.post('/api/v1/teams',{name:'Recurring onboarding team',privacy:'private'}))
    for(const person of [member,guest])await ok(owner.post('/api/v1/grants',{objectType:'team',objectId:team.id,granteeId:person.id,level:'viewer'}))
    const p=await project('Monthly onboarding',{teamId:team.id,visibility:'team',teamLevel:'commenter'})
    await ok(owner.post('/api/v1/tasks',{title:'Unreachable onboarding task',projectId:p.id,ownerId:outsider.id}))
    const direct=await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:p.id,granteeId:editor.id,level:'editor'}))
    const external=await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:p.id,granteeId:guest.id,level:'viewer'}))
    const chosenTeam=await ok(owner.post('/api/v1/teams',{name:'Chosen recurring team',privacy:'private'}))
    for(const person of [editor,guest])await ok(owner.post('/api/v1/grants',{objectType:'team',objectId:chosenTeam.id,granteeId:person.id,level:'viewer'}))
    const teamGrant=await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:p.id,granteeType:'team',granteeId:chosenTeam.id,level:'viewer'}))
    const input={sourceType:'project',sourceId:p.id,unit:'month',start:'2026-01-01',count:1,grantIds:[direct.id,teamGrant.id]}
    const preview=await ok(owner.post('/api/v1/recurrences/preview',input))
    assert.equal(preview.audience.project.visibility,'team');assert.equal(preview.audience.project.team_level,'commenter')
    assert.deepEqual(preview.audience.grants.map(g=>g.id).sort(),[direct.id,teamGrant.id].sort());assert.ok(!preview.choices.some(g=>g.id===external.id))
    assert.deepEqual(preview.unreachableAssignees.map(a=>a.name),['Unreachable assignee'])
    assert.equal((await owner.post('/api/v1/recurrences/preview',{...input,grantIds:[external.id]})).status,400)
    const schedule=await ok(owner.post('/api/v1/recurrences',{...input,revision:preview.token}))
    const raced=await Promise.all([owner.post(`/api/v1/recurrences/${schedule.id}/run`,{}),owner.post(`/api/v1/recurrences/${schedule.id}/run`,{})])
    assert.ok(raced.some(r=>r.status===200&&r.body.state==='generated'))
    await w.restart();await ok(owner.post(`/api/v1/recurrences/${schedule.id}/run`,{}))
    const view=await ok(owner.get(`/api/v1/recurrences/${schedule.id}`));assert.equal(view.occurrences.length,1)
    const occurrence=view.occurrences[0]
    assert.deepEqual(occurrence.unreachableAssignees.map(a=>a.name),['Unreachable assignee'])
    assert.equal((await ok(member.get(`/api/v1/projects/${occurrence.object_id}`))).level,'commenter')
    assert.equal((await ok(editor.get(`/api/v1/projects/${occurrence.object_id}`))).level,'editor')
    for(const person of [guest,outsider])assert.equal((await person.get(`/api/v1/projects/${occurrence.object_id}`)).status,404)
    const grants=(await ok(owner.get(`/api/v1/grants?objectType=project&objectId=${occurrence.object_id}`))).grants
    assert.equal(grants.length,2);assert.ok(grants.some(g=>g.grantee_id===editor.id));assert.ok(grants.some(g=>g.grantee_id===chosenTeam.id))
    await ok(owner.patch(`/api/v1/workspaces/ws_main/people/${editor.id}`,{role:'guest'}))
    assert.equal((await editor.get(`/api/v1/projects/${occurrence.object_id}`)).status,404,'an internal standing share never becomes an unreviewed guest share')
  })

  it('holds changed recurring audiences and lost authority without sharing, retains oversight and requires a fresh reviewed audience', async () => {
    const activator=await w.person('recurring-activator@example.com','Schedule activator'),admin=await w.person('recurring-admin@example.com','Project schedule admin'),reader=await w.person('recurring-reader@example.com','Standing reader')
    const p=await project('Held onboarding'),leadGrant=await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:p.id,granteeId:activator.id,level:'admin'}))
    await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:p.id,granteeId:admin.id,level:'admin'}))
    const direct=await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:p.id,granteeId:reader.id,level:'editor'}))
    await ok(owner.post('/api/v1/tasks',{title:'Held work',projectId:p.id}))
    const input={sourceType:'project',sourceId:p.id,unit:'month',start:'2026-01-01',count:2,grantIds:[direct.id]}
    const activate=async()=>{const v=await ok(activator.post('/api/v1/recurrences/preview',input));return ok(activator.post('/api/v1/recurrences',{...input,revision:v.token}))}
    const schedule=await activate()
    await ok(owner.delete(`/api/v1/grants/${direct.id}`))
    assert.equal((await ok(activator.post(`/api/v1/recurrences/${schedule.id}/run`,{}))).state,'held')
    let view=await ok(admin.get(`/api/v1/recurrences/${schedule.id}`));assert.equal(view.schedule.held,1);assert.equal(view.occurrences.length,0);assert.equal(view.owner,'Schedule activator');assert.ok(view.schedule.last_error)
    assert.ok((await ok(owner.get('/api/v1/recurrences'))).recurrences.some(r=>r.schedule.id===schedule.id))
    const review=await ok(activator.post(`/api/v1/recurrences/${schedule.id}/audience-preview`,{grantIds:[]}))
    await ok(activator.post(`/api/v1/recurrences/${schedule.id}/audience`,{grantIds:[],revision:review.token}))
    await ok(activator.post(`/api/v1/recurrences/${schedule.id}/run`,{}))
    view=await ok(admin.get(`/api/v1/recurrences/${schedule.id}`));assert.equal(view.occurrences.length,1)
    assert.equal((await reader.get(`/api/v1/projects/${view.occurrences[0].object_id}`)).status,404)
    await ok(owner.delete(`/api/v1/grants/${leadGrant.id}`))
    assert.equal((await ok(activator.post(`/api/v1/recurrences/${schedule.id}/run`,{}))).state,'held')
    view=await ok(activator.get(`/api/v1/recurrences/${schedule.id}`));assert.equal(view.audience,null);assert.equal(view.occurrences.length,1);assert.equal(view.schedule.last_error,'source_or_target_authority_lost')
    assert.ok((await ok(admin.get('/api/v1/recurrences'))).recurrences.some(r=>r.schedule.id===schedule.id))
    await ok(admin.post(`/api/v1/recurrences/${schedule.id}/stop`,{}))
    assert.equal((await ok(owner.get(`/api/v1/recurrences/${schedule.id}`))).schedule.active,0)
  })

  it('attributes approval-task decisions to the reviewed revision and refuses copied, stale, self and agent sign-off', async () => {
    const person=await w.person('decision-subject@example.com','Decision subject'),agent=await w.person('decision-agent@example.com','Decision agent','agent'),p=await project('Decision work')
    await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:p.id,granteeId:person.id,level:'editor'}))
    await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:p.id,granteeId:agent.id,level:'editor'}))
    const task=await ok(owner.post('/api/v1/tasks',{title:'Approve launch brief',projectId:p.id,kind:'approval',ownerId:person.id}))
    const preview=()=>ok(owner.get(`/api/v1/tasks/${task.id}/decision-preview`))
    let v=await preview();await ok(owner.post(`/api/v1/tasks/${task.id}/decision`,{action:'changes',revision:v.token,reason:'Add evidence'}))
    const stale=await preview();await ok(person.patch(`/api/v1/tasks/${task.id}`,{description:'Evidence added'}))
    assert.equal((await owner.post(`/api/v1/tasks/${task.id}/decision`,{action:'approve',revision:stale.token,reason:'Stale'})).status,409)
    v=await preview();await ok(owner.post(`/api/v1/tasks/${task.id}/decision`,{action:'approve',revision:v.token,reason:'Evidence accepted'}))
    assert.equal((await ok(owner.get(`/api/v1/tasks/${task.id}`))).status,'done')
    await ok(person.patch(`/api/v1/tasks/${task.id}`,{description:'Changed after approval'}))
    assert.equal((await ok(owner.get(`/api/v1/tasks/${task.id}`))).status,'todo')
    assert.equal((await person.patch(`/api/v1/tasks/${task.id}`,{status:'done'})).status,409)
    const own=await ok(person.get(`/api/v1/tasks/${task.id}/decision-preview`))
    assert.equal((await person.post(`/api/v1/tasks/${task.id}/decision`,{action:'approve',revision:own.token,reason:'Self'})).status,403)
    assert.equal((await agent.post(`/api/v1/tasks/${task.id}/decision`,{action:'approve',revision:own.token,reason:'Agent'})).status,403)
    const tag=await ok(owner.post('/api/v1/tags',{projectId:p.id,name:'Decision context'})),beforeTag=await preview()
    await ok(person.post(`/api/v1/tasks/${task.id}/tags`,{tagId:tag.id}))
    assert.equal((await owner.post(`/api/v1/tasks/${task.id}/decision`,{action:'approve',revision:beforeTag.token,reason:'Stale tag review'})).status,409)
    v=await preview();await ok(owner.post(`/api/v1/tasks/${task.id}/decision`,{action:'reject',revision:v.token,reason:'Superseded'}))
    const history=(await preview()).decisions
    assert.deepEqual(history.map(d=>d.action),['changes','approve','reject']);assert.ok(history.every(d=>d.actor_id===owner.id&&d.at&&d.revision&&d.reason))
  })

  it('never lets an approval task\'s owner, former owner or an approve-only grant decide it, says why it waits and notifies no one', async () => {
    const worker=mia,reader=nina,p=await project('Decision boundary')
    await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:p.id,granteeId:worker.id,level:'editor'}))
    await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:p.id,granteeId:reader.id,level:'viewer',scope:'approve'}))
    const task=await ok(owner.post('/api/v1/tasks',{title:'Sign off vendor terms',projectId:p.id,kind:'approval'}))
    const preview=client=>ok(client.get(`/api/v1/tasks/${task.id}/decision-preview`)),decide=async(client,action='approve')=>client.post(`/api/v1/tasks/${task.id}/decision`,{action,revision:(await preview(client)).token,reason:'Reviewed exact terms'})
    const effects=async()=>JSON.parse(await w.sql('SELECT (SELECT COUNT(*) FROM peg_inbox) inbox, (SELECT COUNT(*) FROM rer_mail_development_outbox) mail'))[0].results
    // The only administrator owns the task: it waits, says so, and nothing approves it.
    let v=await preview(owner);assert.equal(v.canDecide,false);assert.equal(v.waiting,'you_own_or_owned_this');assert.equal(v.anotherDeciderNeeded,true)
    assert.equal((await preview(worker)).waiting,'another_decider_needed')
    assert.equal((await decide(owner)).status,403);assert.equal((await decide(worker)).status,403)
    assert.equal((await ok(owner.get(`/api/v1/tasks/${task.id}`))).status,'todo')
    // An approve-scoped grant reads the task but cannot decide it yet.
    assert.equal((await preview(reader)).canDecide,false);assert.equal((await decide(reader)).status,403)
    // Reassigning to an administrator does not launder sign-off: the administrator owner and the former owner are both refused.
    const invited=[await w.person('decision-admin-a@example.com','Decision admin A'),await w.person('decision-admin-b@example.com','Decision admin B')]
    for(const a of invited)await ok(owner.post(`/api/v1/workspaces/ws_main/people/${a.id}/account`,{role:'admin'}))
    const [adminA,adminB]=await Promise.all(invited.map(a=>w.signIn(a.email,a.name,a.id)))
    await ok(owner.patch(`/api/v1/tasks/${task.id}`,{ownerId:adminA.id}))
    for(const client of [owner,adminA]){v=await preview(client);assert.equal(v.canDecide,false);assert.equal(v.waiting,'you_own_or_owned_this');assert.equal((await decide(client)).status,403)}
    assert.equal((await preview(adminB)).canDecide,true)
    const before=await effects()
    await ok(decide(adminB))
    assert.deepEqual(await effects(),before,'a decision queues no notification or provider mail')
    assert.equal((await ok(owner.get(`/api/v1/tasks/${task.id}`))).status,'done')
    // After that decision the earlier owner may review the next revision; the owner at the decision may not.
    await ok(worker.patch(`/api/v1/tasks/${task.id}`,{description:'Revised terms'}))
    assert.equal((await preview(adminA)).waiting,'you_own_or_owned_this');assert.equal((await preview(owner)).canDecide,true)
    // A personal approval task cannot be decided by anyone until a reviewed share places it in a project.
    const personal=await ok(worker.post('/api/v1/tasks',{title:'Private sign-off',kind:'approval'}))
    v=await ok(worker.get(`/api/v1/tasks/${personal.id}/decision-preview`));assert.equal(v.canDecide,false);assert.equal(v.waiting,'personal_share_required')
    assert.equal((await owner.get(`/api/v1/tasks/${personal.id}/decision-preview`)).status,404)
  })

  it('writes a recurring task only into projects where its activator still holds authority', async () => {
    const lead=await w.person('recurrence-lead@example.com','Recurrence lead'),a=await project('Recurring home A'),b=await project('Recurring home B')
    for(const p of [a,b])await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:p.id,granteeId:lead.id,level:'admin'}))
    const task=await ok(owner.post('/api/v1/tasks',{title:'Monthly vendor check',projectId:a.id}));await ok(owner.post(`/api/v1/tasks/${task.id}/projects`,{projectId:b.id}))
    const input={sourceType:'task',sourceId:task.id,mode:'calendar',timezone:'America/New_York',unit:'week',interval:1,start:'2026-03-01',count:2}
    const pv=await ok(lead.post('/api/v1/recurrences/preview',input)),schedule=await ok(lead.post('/api/v1/recurrences',{...input,revision:pv.token}))
    const tasksIn=async p=>(await ok(owner.get(`/api/v1/projects/${p.id}`))).counts.tasks
    assert.equal((await ok(lead.post(`/api/v1/recurrences/${schedule.id}/run`,{}))).state,'generated');assert.equal(await tasksIn(a),2);assert.equal(await tasksIn(b),2)
    // The source leaves B and the activator then loses authority there: the pinned template must not write into B.
    await ok(owner.delete(`/api/v1/tasks/${task.id}/projects/${b.id}`))
    const grant=(await ok(owner.get(`/api/v1/grants?objectType=project&objectId=${b.id}`))).grants.find(g=>g.grantee_id===lead.id)
    await ok(owner.delete(`/api/v1/grants/${grant.id}`))
    assert.equal((await ok(lead.post(`/api/v1/recurrences/${schedule.id}/run`,{}))).state,'held')
    assert.equal((await ok(lead.get(`/api/v1/recurrences/${schedule.id}`))).occurrences.length,1);assert.equal(await tasksIn(b),1);assert.equal(await tasksIn(a),2)
    // The recorded workspace audience is inherited; an unselected direct grant is not copied.
    const reader=nina,shared=await project('Recurring shared source',{visibility:'workspace',workspaceLevel:'editor'})
    await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:shared.id,granteeId:reader.id,level:'editor'}));await ok(owner.post('/api/v1/tasks',{title:'Shared source task',projectId:shared.id}))
    const projectInput={sourceType:'project',sourceId:shared.id,mode:'calendar',timezone:'America/New_York',unit:'month',interval:1,start:'2026-03-01',count:1}
    const pp=await ok(owner.post('/api/v1/recurrences/preview',projectInput)),ps=await ok(owner.post('/api/v1/recurrences',{...projectInput,revision:pp.token}))
    await ok(owner.post(`/api/v1/recurrences/${ps.id}/run`,{}))
    const generated=(await ok(owner.get(`/api/v1/recurrences/${ps.id}`))).occurrences[0].object_id
    assert.equal((await reader.get(`/api/v1/projects/${shared.id}`)).status,200);assert.equal((await reader.get(`/api/v1/projects/${generated}`)).status,200)
    assert.equal((await ok(owner.get(`/api/v1/grants?objectType=project&objectId=${generated}`))).grants.length,0,'an unselected direct grant is not carried')
  })

})

// Independent domains use independent installations; native invitation limits remain unchanged.
describe('Goal visibility and accountability', { concurrency: false }, () => {
  before(async () => {
    w = await startWorker(); owner = w.owner
    mia = await w.person('mia@example.com', 'Mia Member')
    gus = await w.person('gus@example.com', 'Gus Guest', 'guest')
    nina = await w.person('nina@example.com', 'Nina Newcomer')
  }, { timeout: 120000 })
  after(() => w?.stop())

  it('tracks company, team and personal goals with weighted deduplicated execution, numeric freshness and attributed overrides', async () => {
    const person=await w.person('goal-owner@example.com','Goal owner'),other=await w.person('goal-reader@example.com','Goal reader'),team=await ok(owner.post('/api/v1/teams',{name:'Goal team',privacy:'private'})),p=await project('Goal work'),q=await project('Shared goal work')
    const a=await ok(owner.post('/api/v1/tasks',{title:'Goal complete task',projectId:p.id})),b=await ok(owner.post('/api/v1/tasks',{title:'Goal pending task',projectId:p.id}))
    await ok(owner.post(`/api/v1/tasks/${a.id}/projects`,{projectId:q.id}))
    await ok(owner.patch(`/api/v1/tasks/${a.id}`,{status:'done'}))
    const create=async(client,extra={})=>ok(client.post('/api/v1/goals',{title:'Delivery objective',scope:'personal',kind:'objective',periodStart:'2026-10-01',periodEnd:'2026-12-31',mode:'work',unit:'completed work',...extra}))
    const company=await create(owner,{scope:'company'}),teamGoal=await create(owner,{scope:'team',teamId:team.id}),numeric=await create(owner,{mode:'numeric',kind:'key_result',unit:'qualified leads',target:20,staleAfterSeconds:60}),manual=await create(person,{mode:'manual'})
    assert.equal((await person.post('/api/v1/goals',{scope:'company'})).status,403)
    const link=async(goal,type,id,weight=1)=>ok(owner.post(`/api/v1/goals/${goal.id}/links`,{sourceType:type,sourceId:id,weight}))
    await link(company,'project',p.id);await link(company,'project',q.id);await link(company,'task',a.id)
    let view=await ok(owner.get(`/api/v1/goals/${company.id}`));assert.equal(view.sourceCount,2);assert.equal(view.progress,50)
    await link(teamGoal,'goal',company.id,2)
    assert.equal((await owner.post(`/api/v1/goals/${company.id}/links`,{sourceType:'goal',sourceId:teamGoal.id})).status,409)
    await ok(owner.patch(`/api/v1/tasks/${b.id}`,{status:'done'}));assert.equal((await ok(owner.get(`/api/v1/goals/${teamGoal.id}`))).progress,100)
    const parentPreview=await ok(owner.get(`/api/v1/goals/${company.id}`))
    await ok(owner.post(`/api/v1/goals/${company.id}/checkins`,{revision:parentPreview.token,note:'Known work needs final review',percent:80}))
    assert.equal((await ok(owner.get(`/api/v1/goals/${teamGoal.id}`))).progress,80)
    const observedAt=Date.now(),event={key:'synthetic-pegboard-401',value:10,observedAt}
    await ok(owner.post(`/api/v1/goals/${numeric.id}/numeric-events`,event))
    assert.equal((await ok(owner.post(`/api/v1/goals/${numeric.id}/numeric-events`,event))).replayed,true)
    assert.equal((await owner.post(`/api/v1/goals/${numeric.id}/numeric-events`,{...event,value:11})).status,409)
    view=await ok(owner.get(`/api/v1/goals/${numeric.id}`));assert.equal(view.progress,50);assert.equal(view.events.length,1);assert.equal(view.unit,'qualified leads')
    await ok(owner.post(`/api/v1/goals/${numeric.id}/numeric-events`,{key:'synthetic-pegboard-403',value:20,observedAt:observedAt-1000}))
    view=await ok(owner.get(`/api/v1/goals/${numeric.id}`));assert.equal(view.progress,50,'an older late arrival cannot overwrite the latest observation')
    await ok(owner.post(`/api/v1/goals/${numeric.id}/checkins`,{revision:view.token,note:'Reviewed an explicit adjustment',percent:75}))
    view=await ok(owner.get(`/api/v1/goals/${numeric.id}`));assert.equal(view.progress,75);assert.equal(view.overridden,true);assert.ok(view.checkins.some(c=>c.actor_id===owner.id&&c.detail.overrideTo===75))
    await ok(owner.post(`/api/v1/goals/${numeric.id}/checkins`,{revision:view.token,note:'Return to observed data',clearOverride:true}))
    view=await ok(owner.get(`/api/v1/goals/${numeric.id}`));assert.equal(view.progress,50)
    const staleGoal=await create(owner,{mode:'numeric',staleAfterSeconds:30})
    await ok(owner.post(`/api/v1/goals/${staleGoal.id}/numeric-events`,{key:'synthetic-pegboard-402',value:100,observedAt:Date.now()-60000}))
    const stale=await ok(owner.get(`/api/v1/goals/${staleGoal.id}`));assert.equal(stale.progress,null);assert.ok(stale.states.includes('stale_input'))
    await ok(owner.post(`/api/v1/goals/${staleGoal.id}/numeric-events`,{key:'synthetic-pegboard-402',value:100,observedAt:stale.events[0].observed_at}))
    assert.equal((await ok(owner.get(`/api/v1/goals/${staleGoal.id}`))).progress,null,'replay cannot freshen an old observation')
    const missing=await create(owner,{mode:'numeric'});assert.ok((await ok(owner.get(`/api/v1/goals/${missing.id}`))).states.includes('missing_numeric_input'))
    const mv=await ok(person.get(`/api/v1/goals/${manual.id}`));await ok(person.post(`/api/v1/goals/${manual.id}/checkins`,{revision:mv.token,note:'First check-in',percent:40}))
    assert.equal((await ok(person.get(`/api/v1/goals/${manual.id}`))).progress,40)
    for(const client of [owner,other])assert.equal((await client.get(`/api/v1/goals/${manual.id}`)).status,404,'personal goals stay owner-only')
    const grant=await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:p.id,granteeId:person.id,level:'viewer'})),privateRollup=await create(person)
    await ok(person.post(`/api/v1/goals/${privateRollup.id}/links`,{sourceType:'project',sourceId:p.id}))
    const before=await ok(person.get(`/api/v1/goals/${privateRollup.id}`));assert.equal(before.progress,100)
    await ok(owner.delete(`/api/v1/grants/${grant.id}`))
    const restricted=await ok(person.get(`/api/v1/goals/${privateRollup.id}`));assert.equal(restricted.progress,null);assert.ok(restricted.states.includes('restricted_input'));assert.equal(restricted.links.length,0);assert.ok(!JSON.stringify(restricted).includes('Goal complete task'))
    assert.equal((await person.post(`/api/v1/goals/${privateRollup.id}/checkins`,{revision:before.token,note:'Stale check-in',percent:100})).status,409)
    assert.equal((await other.post(`/api/v1/goals/${numeric.id}/numeric-events`,event)).status,404)
  })

  it('lets a named company-goal owner check in and record observations, refuses agent, guest and analyst owners and never yields progress from an override over a flagged input', async () => {
    const named=await w.person('goal-named-owner@example.com','Goal named owner'),peer=mia,agent=await w.person('goal-agent@example.com','Goal agent','agent'),guest=gus
    const create=(client,extra={})=>client.post('/api/v1/goals',{title:'Pipeline key result',scope:'company',kind:'key_result',periodStart:'2026-10-01',periodEnd:'2026-12-31',mode:'numeric',unit:'qualified leads',target:20,...extra})
    for(const who of [agent,guest])assert.equal((await create(owner,{ownerId:who.id})).status,400,'company goal owners are active internal humans')
    const goal=await ok(create(owner,{ownerId:named.id})),restriction=await ok(owner.post(`/api/v1/goals/${goal.id}/audience-preview`,{visibility:'restricted'}))
    await ok(owner.post(`/api/v1/goals/${goal.id}/audience`,{...restriction.plan,revision:restriction.token}))
    const observation={key:'synthetic-pegboard-501',value:10,observedAt:Date.now()}
    await ok(named.post(`/api/v1/goals/${goal.id}/numeric-events`,observation))
    let view=await ok(named.get(`/api/v1/goals/${goal.id}`));assert.equal(view.progress,50)
    await ok(named.post(`/api/v1/goals/${goal.id}/checkins`,{revision:view.token,note:'Owner check-in',percent:60}))
    assert.ok((await ok(named.get('/api/v1/goals'))).goals.some(g=>g.goal.id===goal.id))
    assert.equal((await named.post(`/api/v1/goals/${goal.id}/links`,{sourceType:'goal',sourceId:goal.id})).status,403,'the named owner does not manage links')
    for(const who of [peer,agent,guest]){
      assert.equal((await who.get(`/api/v1/goals/${goal.id}`)).status,404)
      assert.equal((await who.post(`/api/v1/goals/${goal.id}/numeric-events`,{...observation,key:'synthetic-pegboard-502'})).status,404)
      assert.equal((await who.post(`/api/v1/goals/${goal.id}/checkins`,{revision:view.token,note:'No access',percent:1})).status,404)
      assert.equal((await who.post(`/api/v1/goals/${goal.id}/links`,{sourceType:'goal',sourceId:goal.id})).status,404)
      assert.ok(!(await ok(who.get('/api/v1/goals'))).goals.some(g=>g.goal.id===goal.id))
    }
    for(const who of [agent,guest])assert.equal((await create(who,{scope:'personal'})).status,403)
    assert.equal((await owner.patch(`/api/v1/workspaces/ws_main/people/${named.id}`,{role:'analyst'})).status,409,'transfer a company goal before removing its accountable owner')
    const transfer=await ok(owner.post(`/api/v1/goals/${goal.id}/audience-preview`,{visibility:'restricted',ownerId:owner.id}))
    await ok(owner.post(`/api/v1/goals/${goal.id}/audience`,{...transfer.plan,revision:transfer.token}))
    await ok(owner.patch(`/api/v1/workspaces/ws_main/people/${named.id}`,{role:'analyst'}))
    assert.equal((await named.get(`/api/v1/goals/${goal.id}`)).status,404,'a demoted owner no longer reads the goal')
    assert.equal((await create(owner,{ownerId:named.id})).status,400,'an analyst cannot be named owner')
    // An override never turns a stale, missing or restricted input into success.
    const stale=await ok(create(owner,{ownerId:owner.id,staleAfterSeconds:30})),missing=await ok(create(owner,{ownerId:owner.id}))
    await ok(owner.post(`/api/v1/goals/${stale.id}/numeric-events`,{key:'synthetic-pegboard-503',value:20,observedAt:Date.now()-60000}))
    const p=await project('Override restricted work'),reader=nina;await ok(owner.post('/api/v1/tasks',{title:'Restricted override task',projectId:p.id}))
    const access=await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:p.id,granteeId:reader.id,level:'viewer'})),mine=await ok(create(reader,{scope:'personal',mode:'work'}))
    await ok(reader.post(`/api/v1/goals/${mine.id}/links`,{sourceType:'project',sourceId:p.id}));await ok(owner.delete(`/api/v1/grants/${access.id}`))
    for(const [client,id,state] of [[owner,stale.id,'stale_input'],[owner,missing.id,'missing_numeric_input'],[reader,mine.id,'restricted_input']]){
      view=await ok(client.get(`/api/v1/goals/${id}`));await ok(client.post(`/api/v1/goals/${id}/checkins`,{revision:view.token,note:'Override over a flagged input',percent:100}))
      view=await ok(client.get(`/api/v1/goals/${id}`));assert.equal(view.overridden,true);assert.equal(view.progress,null);assert.ok(view.states.includes(state))
    }
  })

  it('reads company defaults and current team goals, restricts named audiences and gives team Admins and managers only their goal management authority', async () => {
    const member=await w.person('visible-goal-member@example.com','Visible member'),outsider=await w.person('visible-goal-outsider@example.com','Outside member'),analyst=await w.person('visible-goal-analyst@example.com','Visible analyst','analyst'),agent=await w.person('visible-goal-agent@example.com','Visible agent','agent'),guest=await w.person('visible-goal-guest@example.com','Visible guest','guest'),manager=await w.person('visible-goal-manager@example.com','Workspace manager','manager')
    const create=(client,extra={})=>ok(client.post('/api/v1/goals',{title:'Visible company goal',scope:'company',mode:'work',periodStart:'2026-01-01',periodEnd:'2026-12-31',...extra}))
    const p=await project('Permitted company work',{visibility:'workspace'}),task=await ok(owner.post('/api/v1/tasks',{title:'Permitted goal title',projectId:p.id}))
    const company=await create(owner);await ok(owner.post(`/api/v1/goals/${company.id}/links`,{sourceType:'task',sourceId:task.id}))
    for(const reader of [member,outsider,analyst,manager]){
      const v=await ok(reader.get(`/api/v1/goals/${company.id}`));assert.equal(v.links[0].title,'Permitted goal title');assert.equal(v.sourceCount,1)
    }
    const team=await ok(owner.post('/api/v1/teams',{name:'Current goal team',privacy:'private'}))
    const membership=await ok(owner.post('/api/v1/grants',{objectType:'team',objectId:team.id,granteeId:member.id,level:'admin'}))
    const teamGoal=await create(member,{scope:'team',teamId:team.id,title:'Team goal',ownerId:member.id})
    await ok(member.get(`/api/v1/goals/${teamGoal.id}`));assert.equal((await outsider.get(`/api/v1/goals/${teamGoal.id}`)).status,404)
    assert.equal((await ok(manager.get(`/api/v1/goals/${teamGoal.id}`))).canManage,true)
    assert.equal((await member.post('/api/v1/goals',{scope:'company'})).status,403)
    let preview=await ok(owner.post(`/api/v1/goals/${company.id}/audience-preview`,{visibility:'restricted',teams:[team.id]}))
    await ok(owner.post(`/api/v1/goals/${company.id}/audience`,{...preview.plan,revision:preview.token}))
    await ok(member.get(`/api/v1/goals/${company.id}`))
    for(const reader of [outsider,analyst,guest,agent])assert.equal((await reader.get(`/api/v1/goals/${company.id}`)).status,404)
    await ok(owner.delete(`/api/v1/grants/${membership.id}`))
    assert.equal((await member.get(`/api/v1/goals/${company.id}`)).status,404);assert.equal((await member.get(`/api/v1/goals/${teamGoal.id}`)).status,200,'the accountable owner keeps their own team goal')
    assert.equal((await ok(member.get(`/api/v1/goals/${teamGoal.id}`))).canManage,false)
  })

  it('reviews company goal ownership and editors, permits their observations and check-ins, and refuses invalid or stale authority', async () => {
    const named=await w.person('accountable-goal-owner@example.com','Accountable owner'),editor=await w.person('accountable-goal-editor@example.com','Named goal editor'),other=await w.person('accountable-goal-other@example.com','Unnamed goal member'),analyst=await w.person('accountable-goal-analyst@example.com','Goal analyst','analyst'),guest=await w.person('accountable-goal-guest@example.com','Goal guest','guest'),agent=await w.person('accountable-goal-agent@example.com','Goal agent','agent')
    const input={title:'Accountable key result',scope:'company',kind:'key_result',mode:'numeric',periodStart:'2026-01-01',periodEnd:'2026-12-31',target:20}
    const goal=await ok(owner.post('/api/v1/goals',input))
    let v=await ok(owner.get(`/api/v1/goals/${goal.id}`));await ok(owner.post(`/api/v1/goals/${goal.id}/checkins`,{revision:v.token,note:'Ownership disclosure note'}))
    const plan={ownerId:named.id,visibility:'restricted',editors:[editor.id]}
    let preview=await ok(owner.post(`/api/v1/goals/${goal.id}/audience-preview`,plan))
    await ok(owner.post(`/api/v1/goals/${goal.id}/audience`,{...plan,revision:preview.token}))
    for(const role of ['guest','agent','analyst'])assert.equal((await owner.patch(`/api/v1/workspaces/ws_main/people/${named.id}`,{role})).status,409)
    assert.equal((await owner.post('/api/v1/workspaces/ws_main/people',{email:named.email,role:'guest'})).status,409)
    assert.equal((await owner.delete(`/api/v1/workspaces/ws_main/people/${named.id}`)).status,409)
    assert.equal((await owner.post(`/api/v1/workspaces/ws_main/people/${named.id}/account`,{status:'inactive'})).status,409)
    assert.equal((await ok(named.get(`/api/v1/goals/${goal.id}`))).canCheckIn,true)
    const event={key:'synthetic-pegboard-601',value:10,observedAt:Date.now()}
    for(const person of [named,editor]){
      await ok(person.post(`/api/v1/goals/${goal.id}/numeric-events`,{...event,key:event.key+person.id}))
      v=await ok(person.get(`/api/v1/goals/${goal.id}`));await ok(person.post(`/api/v1/goals/${goal.id}/checkins`,{revision:v.token,note:'Accountable check-in'}))
      assert.equal((await person.post(`/api/v1/goals/${goal.id}/links`,{sourceType:'goal',sourceId:goal.id})).status,403)
    }
    assert.equal((await other.post(`/api/v1/goals/${goal.id}/numeric-events`,event)).status,404)
    v=await ok(owner.get(`/api/v1/goals/${goal.id}`));assert.equal((await owner.post(`/api/v1/goals/${goal.id}/checkins`,{revision:v.token,note:'Manager is not an editor'})).status,403)
    for(const person of [analyst,guest,agent]){
      assert.equal((await owner.post('/api/v1/goals',{...input,ownerId:person.id})).status,400)
      assert.equal((await owner.post(`/api/v1/goals/${goal.id}/audience-preview`,{ownerId:person.id})).status,400)
    }
    // A preview cannot survive a change to the named editor's role.
    preview=await ok(owner.post(`/api/v1/goals/${goal.id}/audience-preview`,{ownerId:named.id,visibility:'restricted',editors:[editor.id]}))
    await ok(owner.patch(`/api/v1/workspaces/ws_main/people/${editor.id}`,{role:'guest'}))
    assert.equal((await owner.post(`/api/v1/goals/${goal.id}/audience`,{...preview.plan,revision:preview.token})).status,400)
    assert.equal((await editor.get(`/api/v1/goals/${goal.id}`)).status,404)
    assert.equal((await editor.post(`/api/v1/goals/${goal.id}/numeric-events`,event)).status,404)
    assert.equal((await editor.post(`/api/v1/goals/${goal.id}/checkins`,{revision:v.token,note:'Revoked editor'})).status,404)
  })

  it('previews personal goal notes and permitted titles before sharing, revokes ordinary manager access and fences check-ins without hidden source metadata', async () => {
    const person=await w.person('personal-goal-person@example.com','Personal goal owner'),manager=await w.person('personal-goal-manager@example.com','Personal goal reader','manager'),sourceOwner=await w.person('personal-goal-source@example.com','Restricted source owner')
    const project=await ok(owner.post('/api/v1/projects',{name:'Restricted goal source'})),task=await ok(owner.post('/api/v1/tasks',{title:'Hidden goal input title',projectId:project.id,ownerId:sourceOwner.id}))
    const access=await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:project.id,granteeId:person.id,level:'viewer'}))
    await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:project.id,granteeId:manager.id,level:'viewer'}))
    const goal=await ok(person.post('/api/v1/goals',{title:'Private personal objective',scope:'personal',mode:'work',periodStart:'2026-01-01',periodEnd:'2026-12-31'}))
    await ok(person.post(`/api/v1/goals/${goal.id}/links`,{sourceType:'task',sourceId:task.id}))
    let v=await ok(person.get(`/api/v1/goals/${goal.id}`));await ok(person.post(`/api/v1/goals/${goal.id}/checkins`,{revision:v.token,note:'Personal note to review'}))
    assert.equal((await manager.get(`/api/v1/goals/${goal.id}`)).status,404);assert.equal((await owner.get(`/api/v1/goals/${goal.id}`)).status,404)
    let preview=await ok(person.post(`/api/v1/goals/${goal.id}/audience-preview`,{people:[manager.id]}))
    assert.deepEqual(preview.newlyRevealed.map(p=>({name:p.name,notes:p.notes,titles:p.linkedTitles})),[{name:'Personal goal reader',notes:['Personal note to review'],titles:['Hidden goal input title']}])
    assert.equal((await person.post(`/api/v1/goals/${goal.id}/audience`,{people:[manager.id]})).status,409)
    await ok(person.post(`/api/v1/goals/${goal.id}/audience`,{...preview.plan,revision:preview.token}))
    assert.equal((await ok(manager.get(`/api/v1/goals/${goal.id}`))).checkins[0].note,'Personal note to review')
    assert.equal((await owner.get(`/api/v1/goals/${goal.id}`)).status,404)
    preview=await ok(person.post(`/api/v1/goals/${goal.id}/audience-preview`,{}))
    await ok(person.post(`/api/v1/goals/${goal.id}/audience`,{...preview.plan,revision:preview.token}))
    assert.equal((await manager.get(`/api/v1/goals/${goal.id}`)).status,404)
    v=await ok(person.get(`/api/v1/goals/${goal.id}`))
    await ok(owner.delete(`/api/v1/grants/${access.id}`))
    assert.equal((await person.post(`/api/v1/goals/${goal.id}/checkins`,{revision:v.token,note:'Stale after revocation'})).status,409)
    const restricted=await ok(person.get(`/api/v1/goals/${goal.id}`))
    assert.equal(restricted.progress,null);assert.equal(restricted.sourceCount,null);assert.equal(restricted.freshness,null);assert.equal(restricted.links.length,0)
    assert.ok(restricted.states.includes('restricted_input'))
    for(const hidden of ['Hidden goal input title',sourceOwner.id,task.id])assert.ok(!JSON.stringify(restricted).includes(hidden))
  })

  it('authorizes a single-goal numeric integration without a session, fences its sponsor and revocation, and never grants a data read', async () => {
    const goal=await ok(owner.post('/api/v1/goals',{title:'Scoped metric',scope:'company',mode:'numeric',periodStart:'2026-01-01',periodEnd:'2026-12-31'}))
    const source=await ok(owner.post(`/api/v1/goals/${goal.id}/sources`,{kind:'api',name:'Authorized metric integration',consent:true}))
    const anonymous=new owner.constructor(w.origin,'','Metric provider'),headers={authorization:'Bearer '+source.token},event={key:'synthetic-pegboard-701',value:35,observedAt:Date.now()}
    assert.equal((await anonymous.post(`/api/v1/metric-sources/${source.id}/events`,event)).status,401)
    assert.equal((await anonymous.call('POST',`/api/v1/metric-sources/${source.id}/events`,{key:event.key,value:'',observedAt:event.observedAt},headers)).status,400)
    await ok(anonymous.call('POST',`/api/v1/metric-sources/${source.id}/events`,event,headers))
    assert.equal((await ok(anonymous.call('POST',`/api/v1/metric-sources/${source.id}/events`,event,headers))).replayed,true)
    assert.equal((await anonymous.call('POST',`/api/v1/metric-sources/${source.id}/events`,{...event,value:90},headers)).status,409)
    const view=await ok(owner.get(`/api/v1/goals/${goal.id}`));assert.equal(view.progress,35);assert.equal(view.events.length,1);assert.equal(view.events[0].source_id,source.id)
    assert.equal((await anonymous.call('GET',`/api/v1/goals/${goal.id}`,undefined,headers)).status,401)
    assert.ok(!JSON.stringify(await ok(owner.get(`/api/v1/goals/${goal.id}/sources`))).includes(source.token))
    assert.equal((await mia.post(`/api/v1/goals/${goal.id}/sources`,{kind:'api',name:'Not the owner',consent:true})).status,403)
    // A person's own key never collides with a source's: the same key coexists as a separate observation.
    await ok(owner.post(`/api/v1/goals/${goal.id}/numeric-events`,{key:event.key,value:10,observedAt:event.observedAt-5000}))
    assert.equal((await ok(owner.get(`/api/v1/goals/${goal.id}`))).events.length,2)
    // A credential is the source's own: it names no person, and cannot publish through any other source.
    const other=await ok(owner.post(`/api/v1/goals/${(await ok(owner.post('/api/v1/goals',{title:'Other metric',scope:'company',mode:'numeric',periodStart:'2026-01-01',periodEnd:'2026-12-31'}))).id}/sources`,{kind:'api',name:'Other source',consent:true}))
    assert.equal((await anonymous.call('POST',`/api/v1/metric-sources/${other.id}/events`,event,headers)).status,401)
    assert.ok(!JSON.stringify((await ok(owner.get(`/api/v1/goals/${goal.id}`))).events).includes('"actor_id"'))
    const overridden=await ok(owner.get(`/api/v1/goals/${goal.id}`));await ok(owner.post(`/api/v1/goals/${goal.id}/checkins`,{revision:overridden.token,note:'Holding the line',percent:80}))
    await ok(owner.post(`/api/v1/metric-sources/${source.id}/revoke`,{}))
    const refused=await anonymous.call('POST',`/api/v1/metric-sources/${source.id}/events`,event,headers);assert.equal(refused.status,403);assert.equal(refused.body.cause,'revoked')
    // An ended API source gives no progress (not even under an override), names its cause and keeps its history visible.
    const ended=await ok(owner.get(`/api/v1/goals/${goal.id}`))
    assert.equal(ended.progress,null);assert.ok(ended.states.includes('source_ended'));assert.ok(!ended.states.includes('restricted_input'));assert.deepEqual(ended.endCauses,['revoked']);assert.equal(ended.overrideHeld,true)
    const history=ended.events.find(e=>e.source);assert.equal(history.source.name,'Authorized metric integration');assert.equal(history.source.ended,true);assert.equal(history.source.endCause,'revoked');assert.equal(history.source.authorizedBy,'Wes Holloway');assert.equal(history.recordedBy,null)
    assert.equal((await ok(mia.get(`/api/v1/goals/${goal.id}`))).events.length,2,'any reader keeps the history')
    // Ownership loss ends a source for good, whichever way the seat moves afterwards.
    const next=await ok(owner.post(`/api/v1/goals/${goal.id}/sources`,{kind:'api',name:'Sponsored source',consent:true,expiresInDays:3}))
    assert.equal(Math.round((next.expiresAt-Date.now())/86400000),3)
    assert.equal((await owner.post(`/api/v1/goals/${goal.id}/sources`,{kind:'api',name:'Forever',consent:true,expiresInDays:31})).status,400)
    assert.equal((await owner.post(`/api/v1/goals/${goal.id}/sources`,{kind:'api',name:'Both',consent:true,expiresInDays:2,expiresAt:Date.now()+9e6})).status,400)
    await ok(anonymous.call('POST',`/api/v1/metric-sources/${next.id}/events`,{...event,key:'synthetic-pegboard-702',value:50},{authorization:'Bearer '+next.token}))
    assert.equal((await ok(owner.get(`/api/v1/goals/${goal.id}`))).progress,80,'a fresh source observation again lets the override stand')
    const transfer=await ok(owner.post(`/api/v1/goals/${goal.id}/audience-preview`,{ownerId:mia.id,visibility:'default'}))
    await ok(owner.post(`/api/v1/goals/${goal.id}/audience`,{...transfer.plan,revision:transfer.token}))
    const lost=await anonymous.call('POST',`/api/v1/metric-sources/${next.id}/events`,{...event,key:'synthetic-pegboard-703'},{authorization:'Bearer '+next.token});assert.equal(lost.status,403);assert.equal(lost.body.cause,'ownership_changed')
    assert.deepEqual((await ok(mia.get(`/api/v1/goals/${goal.id}`))).endCauses,['ownership_changed'])
    const back=await ok(owner.post(`/api/v1/goals/${goal.id}/audience-preview`,{ownerId:owner.id,visibility:'default'}));await ok(owner.post(`/api/v1/goals/${goal.id}/audience`,{...back.plan,revision:back.token}))
    assert.equal((await anonymous.call('POST',`/api/v1/metric-sources/${next.id}/events`,{...event,key:'synthetic-pegboard-703'},{authorization:'Bearer '+next.token})).status,403,'an ended source never resumes when ownership returns')
    assert.equal((await ok(owner.get(`/api/v1/goals/${goal.id}/sources`))).sources.find(s=>s.id===next.id).endCause,'ownership_changed')
    await ok(owner.post(`/api/v1/metric-sources/${next.id}/revoke`,{}))
    assert.equal((await ok(owner.get(`/api/v1/goals/${goal.id}/sources`))).sources.find(s=>s.id===next.id).endCause,'ownership_changed','revoking an ended source keeps its first cause')
    const expiring=await ok(owner.post(`/api/v1/goals/${goal.id}/sources`,{kind:'api',name:'Expiring source',consent:true,expiresAt:Date.now()+2000}))
    await ok(anonymous.call('POST',`/api/v1/metric-sources/${expiring.id}/events`,{...event,key:'synthetic-pegboard-704',observedAt:Date.now()},{authorization:'Bearer '+expiring.token}))
    await new Promise(resolve=>setTimeout(resolve,2100))
    const late=await anonymous.call('POST',`/api/v1/metric-sources/${expiring.id}/events`,event,{authorization:'Bearer '+expiring.token});assert.equal(late.status,403);assert.equal(late.body.cause,'expired')
    assert.deepEqual((await ok(mia.get(`/api/v1/goals/${goal.id}`))).endCauses,['expired'])
  })

  it('reviews a documented numeric CSV atomically, reconciles keyed replays and changed rows, and preserves stale observation times', async () => {
    const goal=await ok(nina.post('/api/v1/goals',{title:'CSV metric',mode:'numeric',periodStart:'2026-01-01',periodEnd:'2026-12-31',staleAfterSeconds:30}))
    assert.equal((await nina.post(`/api/v1/goals/${goal.id}/sources`,{kind:'csv',name:'No consent'})).status,400)
    const source=await ok(nina.post(`/api/v1/goals/${goal.id}/sources`,{kind:'csv',name:'Reviewed metric CSV',consent:true}))
    const at=Date.now()-60000,csv=`event_key,value,observed_at\nsynthetic-pegboard-711,40,${at}\nsynthetic-pegboard-712,75,${at+1}`
    const preview=()=>ok(nina.post(`/api/v1/metric-sources/${source.id}/csv-preview`,{csv}))
    let p=await preview();assert.equal(p.added,2)
    assert.equal((await nina.post(`/api/v1/metric-sources/${source.id}/csv`,{csv})).status,409)
    await ok(nina.post(`/api/v1/metric-sources/${source.id}/csv`,{csv,revision:p.token}))
    let view=await ok(nina.get(`/api/v1/goals/${goal.id}`));assert.equal(view.events.length,2);assert.equal(view.progress,null);assert.ok(view.states.includes('stale_input'))
    p=await preview();assert.equal(p.added,0);assert.equal(p.replayed,2)
    await ok(nina.post(`/api/v1/metric-sources/${source.id}/csv`,{csv,revision:p.token}))
    view=await ok(nina.get(`/api/v1/goals/${goal.id}`));assert.equal(view.events.length,2);assert.equal(view.progress,null);assert.equal(view.events[0].observed_at,at+1)
    const changed=`event_key,value,observed_at\nsynthetic-pegboard-713,100,${Date.now()}\nsynthetic-pegboard-711,99,${at}`
    assert.equal((await nina.post(`/api/v1/metric-sources/${source.id}/csv-preview`,{csv:changed})).status,409)
    assert.equal((await ok(nina.get(`/api/v1/goals/${goal.id}`))).events.length,2,'a later bad row writes none of the earlier new rows')
    p=await preview();await ok(nina.post(`/api/v1/metric-sources/${source.id}/revoke`,{}))
    assert.equal((await nina.post(`/api/v1/metric-sources/${source.id}/csv`,{csv,revision:p.token})).status,403)
    // Reviewed rows were checked by a person, so they outlast their source: still counted, with the ended source named in the history.
    const kept=await ok(nina.post('/api/v1/goals',{title:'Kept CSV metric',mode:'numeric',periodStart:'2026-01-01',periodEnd:'2026-12-31'}))
    const keptSource=await ok(nina.post(`/api/v1/goals/${kept.id}/sources`,{kind:'csv',name:'Short CSV',consent:true,expiresInDays:1}))
    const keptCsv=`event_key,value,observed_at\nsynthetic-pegboard-714,40,${Date.now()-1000}`,keptPreview=await ok(nina.post(`/api/v1/metric-sources/${keptSource.id}/csv-preview`,{csv:keptCsv}))
    await ok(nina.post(`/api/v1/metric-sources/${keptSource.id}/csv`,{csv:keptCsv,revision:keptPreview.token}))
    await ok(nina.post(`/api/v1/metric-sources/${keptSource.id}/revoke`,{}))
    const after=await ok(nina.get(`/api/v1/goals/${kept.id}`));assert.equal(after.progress,40);assert.deepEqual(after.states,[]);assert.equal(after.events[0].source.endCause,'revoked')
  })

})
