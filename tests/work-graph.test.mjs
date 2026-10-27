import {registerPublicApiTests,startWebhookEdge} from './scenarios/public-api.mjs'
// PEG-001, through the public doors (the JSON API and the forms that post to it): one task across projects, what a guest
// never learns, references that outlive a prefix change, and the PEG-083 join and request journeys on the same graph.
import assert from 'node:assert/strict'
import {execFileSync,spawnSync} from 'node:child_process'
import {mkdtemp,readFile,writeFile,mkdir,symlink,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import { after, before, describe, it } from 'node:test'
import { startWorker,proofDocument } from './support/worker.mjs'
import {startMeetingServices} from './support/meeting-services.mjs'
import { startEngineeringServices, vectorTodo, vectorDone } from './support/engineering-services.mjs'
import { startTimeServices } from './support/time-services.mjs'
import { restoreCanvasInstallation } from './support/canvas-restore.mjs'
import {registerConversionTests} from './scenarios/conversions.mjs'

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

describe('Work conversions through reviewed public doors',{concurrency:false},()=>{
 let worker,root,peer,guest
 before(async()=>{worker=await startWorker();root=worker.owner;peer=await worker.person('conversion-member@example.com','Mia Studio');guest=await worker.person('conversion-guest@example.com','Gus Client','guest')},{timeout:120000})
 after(()=>worker?.stop())
 registerConversionTests({test:it,api:()=>({root,peer,guest,worker})})
})

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
  let services
  before(async () => {
    services = await startTimeServices()
    w = await startWorker({ settings: { PEGBOARD_LOCAL_TIME_SERVICE_ORIGINS: services.origins } }); owner = w.owner
    mia = await w.person('mia@example.com', 'Mia Member')
    gus = await w.person('gus@example.com', 'Gus Guest', 'guest')
    nina = await w.person('nina@example.com', 'Nina Newcomer')
  }, { timeout: 120000 })
  after(async () => { await w?.stop(); await services?.stop() })

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

  it('sends reviewed approved time once to each official-schema time service, repairs a rejected job code, reads back a lost response and corrects exactly', async () => {
    const person=await w.person('time-delivery@example.com','Time delivery owner'),p=await ok(person.post('/api/v1/projects',{name:'Retainer delivery'})),a=await ok(person.post('/api/v1/tasks',{title:'Retainer planning',projectId:p.id})),b=await ok(person.post('/api/v1/tasks',{title:'Retainer review',projectId:p.id}))
    const day='2026-10-21',approve=async sheet=>{let v=await ok(person.get(`/api/v1/timesheets/${sheet}`));await ok(person.post(`/api/v1/timesheets/${sheet}/decision`,{action:'submit',revision:v.token}));v=await ok(owner.get(`/api/v1/timesheets/${sheet}`));await ok(owner.post(`/api/v1/timesheets/${sheet}/decision`,{action:'approve',revision:v.token}));return (await ok(owner.get(`/api/v1/timesheets/${sheet}`))).token}
    const sheet=await ok(person.post('/api/v1/timesheets',{startDate:day,endDate:day}))
    const e1=await ok(person.post(`/api/v1/timesheets/${sheet.id}/entries`,{taskId:a.id,date:day,seconds:5400,key:'synthetic-pegboard-951'})),e2=await ok(person.post(`/api/v1/timesheets/${sheet.id}/entries`,{taskId:b.id,date:day,seconds:1800,key:'synthetic-pegboard-952'}))
    const {harvest,qbt}=services,mapping={people:{[person.id]:harvest.user},projects:{[p.id]:harvest.project},tasks:{[a.id]:harvest.tasks[0],[b.id]:harvest.tasks[1]},jobcodes:{[`${p.id}/${a.id}`]:qbt.jobcodes[0],[`${p.id}/${b.id}`]:999999}}
    const send=(client,id,revision,service,extra={})=>client.post(`/api/v1/timesheets/${id}/provider-delivery`,{service,mapping,revision,confirm:'reviewed-exact-packet',credential:services.token(service),account:harvest.account,...extra})
    assert.equal((await send(person,sheet.id,'synthetic-pegboard-954','harvest')).status,409,'unapproved time is never sent');assert.equal((await send(owner,sheet.id,'synthetic-pegboard-954','harvest')).status,404,'a draft stays its owner\'s')
    const revision=await approve(sheet.id)
    // Only a workspace owner/admin with every entry in reach sends the exact reviewed packet with a credential that answers.
    assert.equal((await send(person,sheet.id,revision,'harvest')).status,403)
    assert.equal((await send(nina,sheet.id,revision,'harvest')).status,404)
    assert.equal((await send(owner,sheet.id,'synthetic-pegboard-955','harvest')).status,409)
    assert.equal((await send(owner,sheet.id,revision,'harvest',{confirm:undefined})).status,400)
    for(const service of ['harvest','quickbooks-time'])assert.equal((await send(owner,sheet.id,revision,service,{credential:'synthetic-pegboard-956'})).status,400,'a refused credential writes nothing')
    assert.deepEqual(services.requests.filter(r=>r.method!=='GET'),[])
    // Harvest: one acknowledged provider entry per approved entry, with exact hours; a replay creates nothing.
    const sent=await ok(send(owner,sheet.id,revision,'harvest'))
    assert.deepEqual(sent.rows.map(r=>[r.externalId,r.state,r.seconds,r.providerSeconds,r.reason]),[[e1.id,'acknowledged',5400,5400,null],[e2.id,'acknowledged',1800,1800,null]])
    assert.equal(sent.complete,true);assert.equal(sent.acknowledgedSeconds,7200);assert.equal(sent.receiptAuthority,'provider_response')
    const creates=()=>services.requests.filter(r=>r.method==='POST').length,before=creates()
    assert.deepEqual((await ok(send(owner,sheet.id,revision,'harvest'))).rows.map(r=>r.providerId),sent.rows.map(r=>r.providerId),'replay acknowledges the same entries')
    assert.equal(creates(),before);for(const e of [e1,e2])assert.equal(services.entries('harvest',e.id).length,1)
    // QuickBooks Time: the unknown job code is refused visibly, repaired and resent alone; its lost response is read back.
    let qb=await ok(send(owner,sheet.id,revision,'quickbooks-time'))
    const refused=qb.rows.find(r=>r.externalId===e2.id)
    assert.equal(qb.rows.find(r=>r.externalId===e1.id).state,'acknowledged');assert.equal(refused.state,'rejected');assert.equal(refused.statusCode,417);assert.match(refused.reason,/jobcode/);assert.equal(qb.complete,false)
    const failedAudit=(await ok(owner.get('/api/v1/admin/audit?subject='+sheet.id))).events
    assert.ok(failedAudit.some(e=>e.action==='time.provider_delivery'&&e.result==='failure'&&e.metadata.rejected===1))
    assert.ok(!JSON.stringify(failedAudit).includes(services.token('quickbooks-time')))
    mapping.jobcodes[`${p.id}/${b.id}`]=qbt.jobcodes[1];services.loseNext()
    qb=await ok(send(owner,sheet.id,revision,'quickbooks-time'));assert.equal(qb.rows.find(r=>r.externalId===e2.id).state,'uncertain')
    qb=await ok(send(owner,sheet.id,revision,'quickbooks-time'))
    assert.deepEqual(qb.rows.map(r=>[r.state,r.providerSeconds]),[['acknowledged',5400],['acknowledged',1800]]);assert.equal(qb.complete,true)
    for(const e of [e1,e2])assert.equal(services.entries('quickbooks-time',e.id).length,1,'one provider entry per approved entry')
    // A later approved adjustment corrects the acknowledged entry once, from its exact prior total, and stays traceable.
    const later=await ok(person.post('/api/v1/timesheets',{startDate:day,endDate:day}))
    const adjustment=await ok(person.post(`/api/v1/time/${e1.id}/adjust`,{sheetId:later.id,date:day,seconds:-1800,reason:'Client call ended early',key:'synthetic-pegboard-957'}))
    const laterRevision=await approve(later.id)
    for(const service of ['harvest','quickbooks-time']){
      const fixed=await ok(send(owner,later.id,laterRevision,service)),row=fixed.rows[0]
      assert.deepEqual([row.externalId,row.kind,row.correctionOf,row.state,row.seconds,row.providerSeconds],[adjustment.id,'correction',e1.id,'acknowledged',-1800,3600]);assert.equal(fixed.complete,true)
      assert.deepEqual((await ok(send(owner,later.id,laterRevision,service))).rows,fixed.rows,'a replayed correction changes nothing')
      assert.deepEqual(services.entries(service,e1.id).map(e=>e.seconds),[3600])
    }
    // A provider-side edit after acknowledgment is never overwritten by a correction.
    const third=await ok(person.post('/api/v1/timesheets',{startDate:day,endDate:day}))
    await ok(person.post(`/api/v1/time/${e2.id}/adjust`,{sheetId:third.id,date:day,seconds:360,reason:'Review ran over',key:'synthetic-pegboard-958'}))
    const thirdRevision=await approve(third.id),[edited]=services.entries('harvest',e2.id);services.edit('harvest',edited.id,2700)
    const changed=await ok(send(owner,third.id,thirdRevision,'harvest'))
    assert.equal(changed.rows[0].state,'rejected');assert.equal(changed.rows[0].reason,'provider_value_changed');assert.deepEqual(services.entries('harvest',e2.id).map(e=>e.seconds),[2700])
    // An entry the provider files under other references is acknowledged once, never resent, and stays unreconciled.
    const fourth=await ok(person.post('/api/v1/timesheets',{startDate:day,endDate:day})),e4=await ok(person.post(`/api/v1/timesheets/${fourth.id}/entries`,{taskId:a.id,date:day,seconds:720,key:'synthetic-pegboard-959'}))
    const fourthRevision=await approve(fourth.id);services.misfileNext()
    const misfiled=await ok(send(owner,fourth.id,fourthRevision,'harvest'))
    assert.deepEqual([misfiled.rows[0].state,misfiled.rows[0].reason,misfiled.complete],['acknowledged','provider_fields_differ',false])
    assert.equal((await ok(send(owner,fourth.id,fourthRevision,'harvest'))).rows[0].providerId,misfiled.rows[0].providerId);assert.equal(services.entries('harvest',e4.id).length,1)
    // The ledger and history name every outcome without the credential; no invoice, rate or payroll door is ever called.
    const ledger=await ok(owner.get(`/api/v1/timesheets/${sheet.id}/provider-deliveries`))
    assert.deepEqual(ledger.rows.map(r=>[r.service,r.account,r.state]).sort(),[['harvest',harvest.account,'acknowledged'],['harvest',harvest.account,'acknowledged'],['quickbooks-time',qbt.client,'acknowledged'],['quickbooks-time',qbt.client,'acknowledged']])
    assert.equal(ledger.canSend,true);assert.equal((await ok(person.get(`/api/v1/timesheets/${sheet.id}/provider-deliveries`))).canSend,false)
    const history=(await ok(person.get(`/api/v1/timesheets/${sheet.id}`))).history.filter(h=>h.action==='provider_delivery')
    assert.equal(history.length,5);assert.ok(history.every(h=>h.actor_id===owner.id&&['harvest','quickbooks-time'].includes(h.detail.service)));for(const secret of [harvest.token,qbt.token])assert.ok(!JSON.stringify([ledger,history]).includes(secret))
    assert.deepEqual([...new Set(services.requests.map(r=>`${r.method} ${r.path.replace(/\d+$/,':id')}`))].sort(),['GET /api/v1/current_user','GET /api/v1/timesheets','GET /v2/time_entries/:id','GET /v2/users/me','PATCH /v2/time_entries/:id','POST /api/v1/timesheets','POST /v2/time_entries','PUT /api/v1/timesheets'])
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
    const sharedField=await ok(owner.post(`/api/v1/projects/${p.id}/fields`,{key:'planned_count',label:'Planned count',type:'number'}))
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
    projectInput.start='2026-03-01';projectInput.end='2026-03-31';projectInput.count=2
    const pp=await ok(owner.post('/api/v1/recurrences/preview',projectInput)),projectSchedule=await ok(owner.post('/api/v1/recurrences',{...projectInput,revision:pp.token}))
    const interrupted=owner.post(`/api/v1/recurrences/${projectSchedule.id}/run`,{}).catch(()=>null)
    await w.restart();await interrupted
    await ok(owner.post(`/api/v1/recurrences/${projectSchedule.id}/run`,{}))
    const projectResult=await ok(owner.get(`/api/v1/recurrences/${projectSchedule.id}`));assert.equal(projectResult.occurrences.length,1)
    const generated={id:projectResult.occurrences[0].object_id}
    const board=await ok(owner.get(`/api/v1/projects/${generated.id}`)),sourceBoard=await ok(owner.get(`/api/v1/projects/${p.id}`));assert.equal(board.counts.tasks,sourceBoard.counts.tasks)
    assert.equal((await person.get(`/api/v1/projects/${generated.id}`)).status,404,'project recurrence copies no grants')
    // A recurring project adopts the original library definition; its values belong to its fresh tasks.
    const fields=await ok(owner.get(`/api/v1/projects/${generated.id}/fields`))
    assert.equal(fields.fields.find(f=>f.key==='planned_count').id,sharedField.id,'recurrence retains the shared field identity')
    let report=await ok(owner.get(`/api/v1/projects/${generated.id}/field-report`))
    const generatedTask=report.rows.find(r=>r.title==='Weekly review')
    assert.equal(generatedTask.fields.find(f=>f.id===sharedField.id).value,12)
    await ok(owner.post(`/api/v1/tasks/${generatedTask.id}/fields`,{projectId:generated.id,values:{planned_count:18}}))
    report=await ok(owner.get(`/api/v1/projects/${generated.id}/field-report`))
    assert.equal(report.rows.find(r=>r.id===generatedTask.id).fields.find(f=>f.id===sharedField.id).value,18)
    assert.equal((await ok(owner.get(`/api/v1/tasks/${task.id}`))).projects[0].fields.find(f=>f.id===sharedField.id).value,12)
    const change={label:'Planned people'},changePreview=await ok(owner.get(`/api/v1/fields/${sharedField.id}/change-preview?label=Planned%20people`))
    assert.ok(changePreview.projects.includes(generated.id),'definition changes cover the occurrence too')
    await ok(owner.post(`/api/v1/fields/${sharedField.id}/change`,{...change,previewRevision:changePreview.token}))
    for(const home of [p,generated])assert.equal((await ok(owner.get(`/api/v1/projects/${home.id}/fields`))).fields.find(f=>f.id===sharedField.id).label,change.label)
    const held=await ok(owner.post(`/api/v1/recurrences/${projectSchedule.id}/run`,{}))
    assert.equal(held.state,'held');assert.equal(held.cause,'template_definition_changed')
    assert.equal((await ok(owner.get(`/api/v1/recurrences/${projectSchedule.id}`))).occurrences.length,1,'a changed definition cannot create a differently interpreted pinned occurrence')

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

// Public-door custody behavior shares the existing work graph test budget.
describe('Data custody', {concurrency:false},()=>{
  let server,chief,member,admin
  const pass=async(p,status=200)=>{const r=await p;assert.equal(r.status,status,JSON.stringify(r.body));return r.body}
  const makeProject=()=>pass(chief.post('/api/v1/projects',{name:'synthetic-pegboard-601'}))
  const makeTask=(projectId,extra={})=>pass(chief.post('/api/v1/tasks',{projectId,title:'synthetic-pegboard-602',...extra}))
  const retention=async(name,days)=>{const p=await pass(chief.post('/api/v1/data/retention-preview',{class:name,days}));return pass(chief.post('/api/v1/data/retention',{class:name,days,token:p.token,confirm:true}))}
  const review=(type,id)=>pass(chief.post('/api/v1/data/erasure-preview',{type,id}))
  const eraseReview=p=>chief.post('/api/v1/data/erase',{type:p.type,id:p.id,token:p.token,confirm:true})
  const allAudit=async()=>{let rows=[],after=0;for(;;){const page=await pass(chief.get('/api/v1/admin/audit?limit=500&after='+after));rows.push(...page.events);if(page.next===null)return rows;after=page.next}}
  before(async()=>{
    server=await startWorker();chief=server.owner
    member=await server.person('synthetic-pegboard-603@example.com','synthetic-pegboard-603')
    admin=await server.person('synthetic-pegboard-604@example.com','synthetic-pegboard-604')
    await pass(chief.post(`/api/v1/workspaces/ws_main/people/${admin.id}/account`,{role:'admin'}))
    admin=await server.signIn('synthetic-pegboard-604@example.com','synthetic-pegboard-604',admin.id)
  },{timeout:120000})
  after(()=>server?.stop())

  it('keeps permanent audit redacted and append-only across public changes, searches and exports',async()=>{
    const p=await makeProject(),t=await makeTask(p.id,{title:'Planted Name synthetic-pegboard-605'})
    await pass(chief.post('/api/v1/grants',{objectType:'project',objectId:p.id,granteeId:member.id,level:'editor'}))
    await pass(member.post(`/api/v1/tasks/${t.id}/comments`,{body:'planted@example.com synthetic-pegboard-606 asset body'}))
    await pass(member.patch(`/api/v1/tasks/${t.id}`,{description:'synthetic-pegboard-607'}))
    await pass(chief.post(`/api/v1/tasks/${t.id}/attachments?name=synthetic-pegboard-608.txt`,'synthetic-pegboard-609',{ 'content-type':'text/plain'}))
    await pass(chief.get(`/api/v1/projects/${p.id}/export`))
    await pass(chief.post(`/api/v1/workspaces/ws_main/people/${member.id}/role`,{role:'manager'}))
    assert.equal((await member.get('/api/v1/admin/audit')).status,403)
    assert.equal((await member.get('/api/v1/admin/audit/export')).status,403)
    const personal=await pass(chief.post('/api/v1/tasks',{title:'synthetic-pegboard-625'})),section=await pass(chief.post('/api/v1/my-tasks/sections',{name:'synthetic-pegboard-626'}))
    await pass(chief.post('/api/v1/my-tasks/rules',{group:'Later',sectionId:section.id}));await pass(chief.get('/api/v1/my-tasks'))
    assert.ok((await pass(chief.get('/api/v1/admin/audit?subject='+personal.id))).events.some(e=>e.action==='rule.personal_effect'))
    assert.ok(!(await pass(admin.get('/api/v1/admin/audit?subject='+personal.id))).events.length,'another administrator cannot read personal audit')
    const privateTask=await pass(member.post('/api/v1/tasks',{title:'synthetic-pegboard-668'})),privateSheet=await pass(member.post('/api/v1/timesheets',{startDate:'2026-10-21',endDate:'2026-10-21'}))
    await pass(member.post(`/api/v1/timesheets/${privateSheet.id}/entries`,{taskId:privateTask.id,date:'2026-10-21',seconds:300,key:'synthetic-pegboard-669'}))
    assert.deepEqual((await pass(chief.get('/api/v1/admin/audit?subject='+privateSheet.id))).events,[],'workspace audit cannot reveal another person’s draft timesheet')
    const native=await server.person('synthetic-pegboard-665@example.com','synthetic-pegboard-665')
    await pass(chief.post('/auth/operator/role',{operatorId:native.id,role:'admin'}))
    const nativeEvents=await pass(chief.get('/api/v1/admin/audit?action=authentication.role_changed'));assert.ok(nativeEvents.events.some(e=>e.target_id===native.id&&e.actor_id===chief.id&&e.metadata.role==='admin'))
    const anonymous=new chief.constructor(server.origin,'','anonymous')
    await pass(anonymous.post('/auth/confirm',{token:'synthetic-pegboard-660'}),400)
    const events=await allAudit(),raw=JSON.stringify(events)
    assert.ok(events.some(e=>e.action==='authentication.refused'&&e.result==='failure'));assert.ok(events.some(e=>e.action==='authentication.signed_in'))
    for(const forbidden of ['synthetic-pegboard-660','Planted Name','planted@example.com','synthetic-pegboard-606','synthetic-pegboard-607','synthetic-pegboard-609',chief.cookie])assert.ok(!raw.includes(forbidden),forbidden)
    assert.ok(events.some(e=>e.action==='person.role_changed'&&e.subject_id===member.id))
    assert.ok(events.some(e=>e.action==='task.comment.added'&&e.actor_id===member.id))
    assert.ok(events.some(e=>e.action.includes('/projects/:id/export')&&e.result==='success'))
    const filtered=await pass(chief.get('/api/v1/admin/audit?subject='+t.id+'&limit=1'))
    assert.equal(filtered.events.length,1);assert.ok(filtered.next)
    const exported=await pass(chief.get('/api/v1/admin/audit/export?subject='+t.id))
    assert.ok(exported.events.every(e=>e.target_id===t.id))
    const before=(await allAudit()).filter(e=>e.target_id===t.id)
    await pass(member.patch(`/api/v1/tasks/${t.id}`,{title:'synthetic-pegboard-610'}))
    const after=await allAudit();for(const event of before)assert.deepEqual(after.find(e=>e.id===event.id),event)
    for(const verb of ['patch','delete'])assert.equal((await chief[verb]('/api/v1/admin/audit/'+before[0].id,{})).status,404)
    assert.ok((await pass(admin.get('/api/v1/admin/audit'))).events.every(e=>!e.action.startsWith('authentication.')||e.actor_id===admin.id))
    const foreign=await pass(chief.post('/api/v1/workspaces',{name:'synthetic-pegboard-611'}))
    await pass(chief.post('/api/v1/projects',{name:'synthetic-pegboard-612',workspaceId:foreign.id}))
    assert.ok(!(await allAudit()).some(e=>e.workspace_id===foreign.id))
  })

  it('reviews graph erasure, honors holds and stale previews, and retains only disclosed shared work',async()=>{
    const p=await makeProject(),other=await makeProject(),t=await makeTask(p.id,{title:'synthetic-pegboard-640',ownerId:member.id}),child=await makeTask(undefined,{parentId:t.id}),shared=await makeTask(p.id)
    await pass(chief.post(`/api/v1/tasks/${shared.id}/projects`,{projectId:other.id}))
    await pass(chief.post(`/api/v1/tasks/${t.id}/comments`,{body:'synthetic-pegboard-613'}))
    const file=await pass(chief.post(`/api/v1/tasks/${t.id}/attachments?name=synthetic-pegboard-614.pdf`,proofDocument('synthetic-pegboard-615'),{'content-type':'application/pdf'}))
    const proof=await pass(chief.post(`/api/v1/tasks/${t.id}/proofs`,{attachmentId:file.id})),v2File=await pass(chief.post(`/api/v1/tasks/${t.id}/attachments?name=synthetic-pegboard-653.pdf`,proofDocument('synthetic-pegboard-654'),{'content-type':'application/pdf'}))
    const v2=await pass(chief.post(`/api/v1/proofs/${proof.id}/versions`,{attachmentId:v2File.id,currentVersion:proof.versionId})),proofDecision=await pass(chief.get(`/api/v1/proofs/${proof.id}/decision-preview`))
    await pass(chief.post(`/api/v1/proofs/${proof.id}/decisions`,{versionId:v2.versionId,token:proofDecision.token,action:'approve',reason:'synthetic-pegboard-655'}))
    const agent=await server.person('synthetic-pegboard-656@example.com','synthetic-pegboard-656','agent')
    await pass(chief.post('/api/v1/grants',{objectType:'project',objectId:p.id,granteeId:agent.id,level:'editor',scopes:['read','edit']}))
    await pass(chief.post('/api/v1/data/processors',{processor:'synthetic-pegboard-657',approved:true,sharing:false,training:false,confirm:true}))
    const intake={projectId:p.id,processor:'synthetic-pegboard-657',body:'synthetic-pegboard-658',key:'synthetic-pegboard-659'},output=await pass(agent.post(`/api/v1/tasks/${t.id}/agent-outputs`,intake))
    assert.ok((await pass(chief.get('/api/v1/search?q=synthetic-pegboard-640'))).results.some(r=>r.id===t.id));assert.deepEqual((await pass(member.get('/api/v1/search?q=synthetic-pegboard-640'))).results,[])
    await pass(chief.post(`/api/v1/projects/${p.id}/prefix`,{prefix:'CUSTODY'}))
    assert.equal((await member.post('/api/v1/data/erasure-preview',{type:'project',id:p.id})).status,403)
    assert.equal((await admin.post('/api/v1/data/erasure-preview',{type:'project',id:p.id})).status,403)
    let preview=await review('project',p.id)
    assert.equal(preview.counts.peg_tasks,2);assert.equal(preview.counts.peg_comments,1);assert.equal(preview.counts.peg_attachments,2);assert.equal(preview.counts.peg_proof_versions,2);assert.equal(preview.counts.peg_search_records,2);assert.equal(preview.counts.peg_agent_retrieval,1);assert.equal(preview.retained.shared_tasks,1)
    await pass(chief.patch(`/api/v1/tasks/${t.id}`,{description:'synthetic-pegboard-616'}))
    assert.equal((await eraseReview(preview)).status,409)
    const hold=await pass(chief.post('/api/v1/data/holds',{type:'task',id:t.id,authority:'synthetic-pegboard-617',expiresAt:Date.now()+86400000}))
    preview=await review('project',p.id);assert.ok(preview.blockers.includes('active_legal_hold'))
    const retained=await pass(eraseReview(preview));assert.equal(retained.outcome,'retained');assert.deepEqual(retained.counts,{})
    assert.equal((await chief.get(`/api/v1/attachments/${file.id}`)).status,200)
    await pass(chief.post(`/api/v1/data/holds/${hold.id}/release`,{confirm:true}))
    preview=await review('project',p.id)
    const receipt=await pass(eraseReview(preview));assert.equal(receipt.outcome,'partial');assert.ok(receipt.retained.legacy_access_activity>0);assert.equal(receipt.counts.peg_tasks,2);assert.match(receipt.externalLimits,/outside recipients/)
    for(const path of [`/api/v1/projects/${p.id}`,`/api/v1/tasks/${t.id}`,`/api/v1/tasks/${child.id}`,`/api/v1/attachments/${file.id}`,'/api/v1/refs/CUSTODY-1'])assert.equal((await chief.get(path)).status,404,path)
    for(const path of [`/api/v1/proofs/${proof.id}`,`/api/v1/agent-outputs/${output.id}`,`/api/v1/agent-outputs/${output.id}/retrieval`,`/api/v1/attachments/${v2File.id}`])assert.equal((await chief.get(path)).status,404)
    assert.deepEqual((await pass(chief.get('/api/v1/search?q=synthetic-pegboard-640'))).results,[])
    assert.equal((await agent.post(`/api/v1/tasks/${t.id}/agent-outputs`,intake)).status,404)
    assert.equal((await chief.patch(`/api/v1/tasks/${t.id}`,{title:'stale'})).status,404)
    assert.equal((await chief.post(`/api/v1/tasks/${t.id}/comments`,{body:'replay'})).status,404)
    assert.equal((await chief.post(`/api/v1/tasks/${shared.id}/projects`,{projectId:p.id})).status,404)
    assert.equal((await chief.get(`/api/v1/tasks/${shared.id}`)).status,200)
    assert.deepEqual((await pass(chief.get(`/api/v1/tasks/${shared.id}`))).projects.map(p=>p.id),[other.id])
    assert.ok(!(await pass(chief.get('/api/v1/export'))).includes('synthetic-pegboard-616'))
    const journal=await pass(chief.get('/api/v1/data/journal'));assert.ok(journal.epoch>0&&journal.journal.length>3)
    await server.restart()
    const data=await pass(chief.get('/api/v1/data'));assert.ok(data.receipts.some(r=>r.id===receipt.id&&r.outcome==='partial'))
    const saved=await pass(chief.get('/api/v1/data/receipts/'+receipt.id));assert.equal(saved.outcome,'partial');assert.deepEqual(saved.counts,receipt.counts)
    assert.equal((await member.get('/api/v1/data/receipts/'+receipt.id)).status,403)
    assert.equal((await chief.get('/api/v1/data/receipts/missing')).status,404)

    assert.equal((await chief.get(`/api/v1/tasks/${t.id}`)).status,404)
    const audit=await pass(chief.get('/api/v1/admin/audit?subject='+p.id));assert.ok(audit.events.some(e=>e.action==='data.erasure'&&e.result==='partial'))
    const home=await makeProject(),remaining=await makeProject(),signoff=await makeTask(home.id,{kind:'approval',ownerId:member.id})
    await pass(chief.post(`/api/v1/tasks/${signoff.id}/projects`,{projectId:remaining.id}))
    const decision=await pass(chief.get(`/api/v1/tasks/${signoff.id}/decision-preview`))
    await pass(chief.post(`/api/v1/tasks/${signoff.id}/decision`,{revision:decision.token,action:'approve',reason:'synthetic-pegboard-627'}))
    const otherHold=await pass(chief.post('/api/v1/data/holds',{type:'project',id:remaining.id,authority:'synthetic-pegboard-628',expiresAt:Date.now()+86400000}))
    assert.ok((await review('task',signoff.id)).blockers.includes('active_legal_hold'),'a task cannot evade its other project hold')
    await pass(chief.post(`/api/v1/data/holds/${otherHold.id}/release`,{confirm:true}))
    const scope=await review('project',home.id);assert.deepEqual(scope.reopenTasks,[signoff.id])
    await pass(eraseReview(scope))
    const reopened=await pass(chief.get(`/api/v1/tasks/${signoff.id}`));assert.equal(reopened.status,'todo');assert.ok(reopened.history.some(e=>e.kind==='decision.reopened'&&e.actor==='Wes Holloway'&&e.detail.cause==='custody_erasure'))

  })

  it('expires only reviewed eligible stores while keeping held content and independent class policies',async()=>{
    const p=await makeProject(),held=await makeTask(p.id),eligible=await makeTask(p.id)
    for(const task of [held,eligible])await pass(chief.post(`/api/v1/tasks/${task.id}/attachments?name=synthetic-pegboard-618.txt`,'synthetic-pegboard-619',{'content-type':'text/plain'}))
    await retention('attachments_proofs',1);await retention('product_history',90)
    const state=await pass(chief.get('/api/v1/data'));assert.equal(state.classes.find(c=>c.name==='attachments_proofs').days,1);assert.equal(state.classes.find(c=>c.name==='product_history').days,90)
    await pass(chief.post('/api/v1/data/holds',{type:'task',id:held.id,authority:'synthetic-pegboard-620',expiresAt:Date.now()+86400000}))
    // The only direct store operation moves the clock; selection and deletion use public review/commit doors.
    await server.sql(`UPDATE peg_attachments SET created_at=${Date.now()-3*86400000} WHERE task_id IN ('${held.id}','${eligible.id}')`)
    const impact=await pass(chief.post('/api/v1/data/retention-preview',{class:'attachments_proofs',days:1}));assert.equal(impact.impact.counts.peg_attachments,1);assert.equal(impact.impact.held,1)
    const input={class:'attachments_proofs'},preview=await pass(chief.post('/api/v1/data/expiry-preview',input))
    assert.equal(preview.counts.peg_attachments,1);assert.equal(preview.held,1)
    const done=await pass(chief.post('/api/v1/data/expire',{...input,cutoff:preview.cutoff,token:preview.token,confirm:true}));assert.equal(done.held,1)
    assert.equal((await pass(chief.get(`/api/v1/tasks/${held.id}`))).attachments.length,1)
    assert.equal((await pass(chief.get(`/api/v1/tasks/${eligible.id}`))).attachments.length,0)
    assert.equal((await member.post('/api/v1/data/retention-preview',{class:'product_history',days:1})).status,403)
    assert.equal((await chief.post('/api/v1/data/retention',{class:'product_history',days:1,confirm:true})).status,409)
    assert.equal((await chief.post('/api/v1/data/processors',{processor:'synthetic-pegboard-621',training:true,confirm:true})).status,400)
    await pass(chief.post('/api/v1/data/processors',{processor:'synthetic-pegboard-621',approved:true,sharing:false,training:false,confirm:true}))
    const updated=await pass(chief.get('/api/v1/data'));assert.equal(updated.processors.find(p=>p.processor==='synthetic-pegboard-621').training,0)
    assert.ok(updated.receipts.some(r=>r.id===done.id&&r.outcome==='partial'))
    await retention('provider_logs',1)
    const retainedLogs=await pass(chief.post('/api/v1/data/expiry-preview',{class:'provider_logs'}))
    assert.equal(retainedLogs.supported,false);assert.match(retainedLogs.limits,/immutable and retained/);assert.deepEqual(retainedLogs.counts,{})
    assert.equal((await chief.post('/api/v1/data/expire',{class:'provider_logs',cutoff:retainedLogs.cutoff,token:retainedLogs.token,confirm:true})).status,409)
  })


  it('pins actual proof bytes and accepts only a current independent human decision',async()=>{
    const p=await makeProject(),q=await makeProject(),task=await makeTask(p.id,{ownerId:member.id,kind:'approval'})
    await pass(chief.post(`/api/v1/tasks/${task.id}/projects`,{projectId:q.id}))
    await pass(chief.post('/api/v1/grants',{objectType:'project',objectId:p.id,granteeId:member.id,level:'editor'}))
    const file=await pass(chief.post(`/api/v1/tasks/${task.id}/attachments?projectId=${p.id}&name=synthetic-pegboard-642.pdf`,proofDocument('synthetic-pegboard-643'),{'content-type':'application/pdf'}))
    const approveWork=async()=>{const d=await pass(chief.get(`/api/v1/tasks/${task.id}/decision-preview`));await pass(chief.post(`/api/v1/tasks/${task.id}/decision`,{revision:d.token,action:'approve',reason:'synthetic-pegboard-666'}))}
    await approveWork()
    const proof=await pass(chief.post(`/api/v1/tasks/${task.id}/proofs`,{attachmentId:file.id}))
    const reopened=await pass(chief.get(`/api/v1/tasks/${task.id}`));assert.equal(reopened.status,'todo');assert.ok(reopened.history.some(e=>e.kind==='decision.reopened'&&e.detail.cause==='proof_version'&&e.actor==='Wes Holloway'))
    const expected=await import('node:crypto').then(c=>c.createHash('sha256').update(proofDocument('synthetic-pegboard-643')).digest('hex'));assert.equal(proof.digest,expected)
    let preview=await pass(chief.get(`/api/v1/proofs/${proof.id}/decision-preview`))
    assert.equal((await member.post(`/api/v1/proofs/${proof.id}/decisions`,{versionId:proof.versionId,token:preview.token,action:'approve',reason:'synthetic-pegboard-644'})).status,403)
    await pass(chief.post(`/api/v1/proofs/${proof.id}/decisions`,{versionId:proof.versionId,token:preview.token,action:'approve',reason:'planted-proof-reason@example.com'}))
    assert.equal((await pass(chief.get(`/api/v1/proofs/${proof.id}`))).state,'approve')
    const nextFile=await pass(chief.post(`/api/v1/tasks/${task.id}/attachments?projectId=${q.id}&name=synthetic-pegboard-645.pdf`,proofDocument('synthetic-pegboard-646'),{'content-type':'application/pdf'}))
    await approveWork()
    const next=await pass(chief.post(`/api/v1/proofs/${proof.id}/versions`,{attachmentId:nextFile.id,currentVersion:proof.versionId}))
    assert.equal((await pass(chief.get(`/api/v1/tasks/${task.id}`))).status,'todo')
    assert.equal((await pass(chief.get(`/api/v1/proofs/${proof.id}`))).state,'pending')
    assert.equal((await chief.post(`/api/v1/proofs/${proof.id}/decisions`,{versionId:proof.versionId,token:preview.token,action:'approve',reason:'stale'})).status,409)
    assert.equal((await chief.post(`/api/v1/proofs/${proof.id}/versions`,{attachmentId:file.id,currentVersion:next.versionId})).status,409)
    assert.equal((await member.get(`/api/v1/proofs/${proof.id}`)).status,404,'a visible task does not reveal a private current proof version')
    const events=await pass(chief.get('/api/v1/admin/audit?subject='+proof.id));assert.ok(events.events.some(e=>e.action==='proof.approve'));assert.ok(!JSON.stringify(events).includes('planted-proof-reason@example.com'))
    const hold=await pass(chief.post('/api/v1/data/holds',{type:'proof',id:proof.id,authority:'synthetic-pegboard-647',expiresAt:Date.now()+86400000}))
    assert.ok((await review('proof',proof.id)).blockers.includes('active_legal_hold'))
    await pass(chief.post(`/api/v1/data/holds/${hold.id}/release`,{confirm:true}))
    await pass(eraseReview(await review('proof',proof.id)))
    for(const path of [`/api/v1/proofs/${proof.id}`,`/api/v1/attachments/${file.id}`,`/api/v1/attachments/${nextFile.id}`])assert.equal((await chief.get(path)).status,404)
    assert.equal((await chief.get(`/api/v1/tasks/${task.id}`)).status,200)
  })

  it('expires proof versions together only after every version is eligible and no proof hold remains',async()=>{
    const p=await makeProject(),task=await makeTask(p.id,{ownerId:member.id})
    const upload=async n=>pass(chief.post(`/api/v1/tasks/${task.id}/attachments?name=synthetic-pegboard-${n}.pdf`,proofDocument('synthetic-pegboard-'+n),{'content-type':'application/pdf'}))
    const a=await upload(661),proof=await pass(chief.post(`/api/v1/tasks/${task.id}/proofs`,{attachmentId:a.id})),b=await upload(662)
    const v2=await pass(chief.post(`/api/v1/proofs/${proof.id}/versions`,{attachmentId:b.id,currentVersion:proof.versionId})),d=await pass(chief.get(`/api/v1/proofs/${proof.id}/decision-preview`))
    await pass(chief.post(`/api/v1/proofs/${proof.id}/decisions`,{versionId:v2.versionId,token:d.token,action:'approve',reason:'synthetic-pegboard-663'}))
    await retention('attachments_proofs',1)
    await server.sql(`UPDATE peg_attachments SET created_at=${Date.now()-3*86400000} WHERE id='${a.id}'`)
    const input={class:'attachments_proofs'},mixed=await pass(chief.post('/api/v1/data/expiry-preview',input))
    assert.equal(mixed.retainedDependencies,1);assert.ok(!mixed.counts.peg_proof_versions);assert.equal(mixed.counts.peg_attachments,0)
    await server.sql(`UPDATE peg_attachments SET created_at=${Date.now()-3*86400000} WHERE id='${b.id}'`)
    const heldBefore=(await pass(chief.post('/api/v1/data/expiry-preview',input))).held
    const hold=await pass(chief.post('/api/v1/data/holds',{type:'proof',id:proof.id,authority:'synthetic-pegboard-664',expiresAt:Date.now()+86400000})),held=await pass(chief.post('/api/v1/data/expiry-preview',input))
    assert.equal(held.held,heldBefore+2);assert.ok(!held.counts.peg_proof_versions)
    await pass(chief.post(`/api/v1/data/holds/${hold.id}/release`,{confirm:true}))
    const reviewed=await pass(chief.post('/api/v1/data/expiry-preview',input));assert.equal(reviewed.counts.peg_proof_versions,2);assert.equal(reviewed.counts.peg_proof_decisions,1)
    const done=await pass(chief.post('/api/v1/data/expire',{...input,cutoff:reviewed.cutoff,token:reviewed.token,confirm:true}));assert.equal(done.counts.peg_attachments,2)
    for(const path of [`/api/v1/proofs/${proof.id}`,`/api/v1/attachments/${a.id}`,`/api/v1/attachments/${b.id}`])assert.equal((await chief.get(path)).status,404)
    assert.equal((await chief.get(`/api/v1/tasks/${task.id}`)).status,200)
  })

  it('fences scoped agent output custody on processor revocation, retention holds and replay after expiry',async()=>{
    const agent=await server.person('synthetic-pegboard-648@example.com','synthetic-pegboard-648','agent'),p=await makeProject(),task=await makeTask(p.id,{kind:'approval',ownerId:member.id})
    await pass(chief.post('/api/v1/grants',{objectType:'project',objectId:p.id,granteeId:agent.id,level:'editor',scopes:['read','edit']}))
    const approveWork=async()=>{const d=await pass(chief.get(`/api/v1/tasks/${task.id}/decision-preview`));await pass(chief.post(`/api/v1/tasks/${task.id}/decision`,{revision:d.token,action:'approve',reason:'synthetic-pegboard-667'}))};await approveWork()
    const input={projectId:p.id,processor:'synthetic-pegboard-649',body:'synthetic-pegboard-650',key:'synthetic-pegboard-651'}
    assert.equal((await agent.post(`/api/v1/tasks/${task.id}/agent-outputs`,input)).status,403)
    assert.equal((await pass(chief.get(`/api/v1/tasks/${task.id}`))).status,'done')
    await pass(chief.post('/api/v1/data/processors',{processor:input.processor,approved:true,sharing:false,training:false,confirm:true}))
    assert.equal((await chief.post(`/api/v1/tasks/${task.id}/agent-outputs`,input)).status,403,'a human cannot plant an agent identity')
    const output=await pass(agent.post(`/api/v1/tasks/${task.id}/agent-outputs`,input));assert.equal((await pass(agent.post(`/api/v1/tasks/${task.id}/agent-outputs`,input))).id,output.id)
    const work=await pass(chief.get(`/api/v1/tasks/${task.id}`));assert.equal(work.status,'todo');assert.ok(work.history.some(e=>e.kind==='decision.reopened'&&e.detail.cause==='agent_output'&&e.actor==='synthetic-pegboard-648'))
    assert.equal((await pass(chief.get(`/api/v1/agent-outputs/${output.id}`))).body,'synthetic-pegboard-650');assert.equal((await pass(agent.get(`/api/v1/agent-outputs/${output.id}/retrieval`))).body,'synthetic-pegboard-650')
    assert.equal((await member.get(`/api/v1/agent-outputs/${output.id}`)).status,404)
    await pass(chief.post('/api/v1/data/processors',{processor:input.processor,approved:false,confirm:true}))
    assert.equal((await agent.get(`/api/v1/agent-outputs/${output.id}/retrieval`)).status,403);assert.equal((await chief.get(`/api/v1/agent-outputs/${output.id}`)).status,200)
    await pass(chief.post('/api/v1/data/processors',{processor:input.processor,approved:true,sharing:false,training:false,confirm:true}));await retention('agent_prompts_outputs',1)
    await server.sql(`UPDATE peg_agent_outputs SET created_at=${Date.now()-3*86400000} WHERE id='${output.id}'`)
    const hold=await pass(chief.post('/api/v1/data/holds',{type:'task',id:task.id,authority:'synthetic-pegboard-652',expiresAt:Date.now()+86400000}))
    const expiry={class:'agent_prompts_outputs'},held=await pass(chief.post('/api/v1/data/expiry-preview',expiry));assert.equal(held.held,1);assert.ok(!held.counts.peg_agent_outputs)
    await pass(chief.post(`/api/v1/data/holds/${hold.id}/release`,{confirm:true}))
    await approveWork()
    const preview=await pass(chief.post('/api/v1/data/expiry-preview',expiry));assert.equal(preview.counts.peg_agent_outputs,1);assert.equal(preview.counts.peg_agent_retrieval,1)
    const done=await pass(chief.post('/api/v1/data/expire',{...expiry,cutoff:preview.cutoff,token:preview.token,confirm:true}));assert.equal(done.counts.peg_agent_retrieval,1)
    assert.equal(done.processorRequests,1);const followups=await pass(chief.get('/api/v1/data'));assert.ok(followups.processorDeletions.some(r=>r.subject_id===output.id&&r.state==='needs_owner_action'));assert.ok(followups.receipts.some(r=>r.id===done.id&&r.outcome==='partial'))
    assert.equal((await chief.get(`/api/v1/agent-outputs/${output.id}`)).status,404);assert.equal((await chief.get(`/api/v1/agent-outputs/${output.id}/retrieval`)).status,404)
    assert.equal((await agent.post(`/api/v1/tasks/${task.id}/agent-outputs`,input)).status,409,'the original intake key cannot resurrect an expired output')
    const expiredWork=await pass(chief.get(`/api/v1/tasks/${task.id}`));assert.equal(expiredWork.status,'todo');assert.ok(expiredWork.history.some(e=>e.kind==='decision.reopened'&&e.detail.cause==='retention_expiry'&&e.actor==='Wes Holloway'))
  })

  it('cleans expired local authentication separately from held work retention',async()=>{
    const person=await server.person('synthetic-pegboard-629@example.com','synthetic-pegboard-629')
    const p=await makeProject(),task=await makeTask(p.id)
    const hold=await pass(chief.post('/api/v1/data/holds',{type:'task',id:task.id,authority:'synthetic-pegboard-630',expiresAt:Date.now()+86400000}))
    await retention('transient_credentials_sessions',1)
    await server.sql(`UPDATE oa_sessions SET expires_at=${Date.now()-3*86400000} WHERE operator_id='${person.id}'`)
    assert.equal((await person.get('/api/v1/me')).status,401)
    const input={class:'transient_credentials_sessions'},preview=await pass(chief.post('/api/v1/data/expiry-preview',input))
    assert.equal(preview.counts.oa_sessions,1);assert.equal(preview.held,0,'a task hold does not retain expired authentication')
    const result=await pass(chief.post('/api/v1/data/expire',{...input,cutoff:preview.cutoff,token:preview.token,confirm:true}))
    assert.equal(result.counts.oa_sessions,1)
    const remaining=await pass(chief.post('/api/v1/data/expiry-preview',{...input,cutoff:preview.cutoff}));assert.ok(!remaining.counts.oa_sessions)
    assert.equal((await chief.get(`/api/v1/tasks/${task.id}`)).status,200)
    assert.equal((await review('task',task.id)).blockers.includes('active_legal_hold'),true)
    await pass(chief.post(`/api/v1/data/holds/${hold.id}/release`,{confirm:true}))
  })

  it('anonymizes an erased inactive actor without losing the permanent audit chain',async()=>{
    const person=await server.person('synthetic-pegboard-622@example.com','Planted Actor synthetic-pegboard-622')
    const p=await makeProject(),t=await makeTask(p.id)
    await pass(chief.post('/api/v1/grants',{objectType:'project',objectId:p.id,granteeId:person.id,level:'commenter'}))
    await pass(person.post(`/api/v1/tasks/${t.id}/comments`,{body:'synthetic-pegboard-623'}))
    const before=(await allAudit()).filter(e=>e.actor_id===person.id);assert.ok(before.length>0)
    let preview=await review('person',person.id);assert.ok(preview.blockers.includes('deactivate_person_before_erasure'))
    await pass(chief.post(`/api/v1/workspaces/ws_main/people/${person.id}/account`,{status:'inactive'}))
    preview=await review('person',person.id);assert.deepEqual(preview.blockers,[])
    const receipt=await pass(eraseReview(preview));assert.equal(receipt.outcome,'partial');assert.ok(receipt.retained.local_auth_material>0)
    const after=await allAudit();for(const event of before){const row=after.find(e=>e.id===event.id);assert.ok(row);assert.equal(row.actor,'Erased actor');assert.equal(row.actor_id,person.id)}
    assert.ok(!JSON.stringify(after).includes('Planted Actor')&&!JSON.stringify(after).includes('synthetic-pegboard-622@example.com'))
    assert.equal((await person.get(`/api/v1/tasks/${t.id}`)).status,401)
    const ownerPreview=await review('person',chief.id);assert.ok(ownerPreview.blockers.includes('owner_requires_explicit_installation_reset_or_replacement'))
  })
  it('preserves permanent audit through native archive restore and refuses an old archive with the later erasure journal',async()=>{
    const archive=async()=>{
      const created=await pass(chief.post('/api/portability/exports',{}),201)
      for(let page=0;page<100;page++){
        const status=await pass(chief.post(`/api/portability/exports/${created.id}/advance`,{maxParts:16}))
        if(status.phase==='complete')return pass(chief.get(`/api/portability/exports/${created.id}/download`))
      }
      assert.fail('archive did not complete')
    }
    const p=await makeProject(),t=await makeTask(p.id)
    await pass(chief.post(`/api/v1/tasks/${t.id}/comments`,{body:'synthetic-pegboard-624'}))
    const kept=await makeProject(),keptTask=await makeTask(kept.id,{ownerId:member.id}),pdf=proofDocument('synthetic-pegboard-670'),keptFile=await pass(chief.post(`/api/v1/tasks/${keptTask.id}/attachments?name=synthetic-pegboard-670.pdf`,pdf,{'content-type':'application/pdf'})),keptProof=await pass(chief.post(`/api/v1/tasks/${keptTask.id}/proofs`,{attachmentId:keptFile.id})),keptDecision=await pass(chief.get(`/api/v1/proofs/${keptProof.id}/decision-preview`))
    await pass(chief.post(`/api/v1/proofs/${keptProof.id}/decisions`,{versionId:keptProof.versionId,token:keptDecision.token,action:'approve',reason:'synthetic-pegboard-671'}))
    const archivedActor=await server.person('synthetic-pegboard-672@example.com','synthetic-pegboard-672')
    await pass(chief.post('/api/v1/grants',{objectType:'project',objectId:kept.id,granteeId:archivedActor.id,level:'commenter'}))
    await pass(archivedActor.post(`/api/v1/tasks/${keptTask.id}/comments`,{body:'synthetic-pegboard-673'}))
    await pass(chief.post(`/api/v1/workspaces/ws_main/people/${archivedActor.id}/account`,{status:'inactive'}))
    await pass(eraseReview(await review('person',archivedActor.id)))
    const archiveAgent=await server.person('synthetic-pegboard-674@example.com','synthetic-pegboard-674','agent')
    await pass(chief.post('/api/v1/grants',{objectType:'project',objectId:p.id,granteeId:archiveAgent.id,level:'editor',scopes:['read','edit']}))
    await pass(chief.post('/api/v1/data/processors',{processor:'synthetic-pegboard-675',approved:true,sharing:false,training:false,confirm:true}))
    const archivedOutput=await pass(archiveAgent.post(`/api/v1/tasks/${t.id}/agent-outputs`,{projectId:p.id,processor:'synthetic-pegboard-675',body:'synthetic-pegboard-676',key:'synthetic-pegboard-677'}))
    let meetingArchive=await pass(chief.post('/api/v1/meetings',{service:'zoom',sourceId:'synthetic-pegboard-978',content:'WEBVTT\n\n1\n00:00:01.000 --> 00:00:05.000\nAction: Synthetic archive source context\n',sourceAuthority:true,organizerConsent:true,participantConsent:true}))
    const proposalArchive=meetingArchive.proposals[0]
    meetingArchive=await pass(chief.post(`/api/v1/meeting-proposals/${proposalArchive.id}/revise`,{version:proposalArchive.version,title:'Synthetic reviewed archive action',ownerId:member.id,dateResolved:true}))
    const meetingTaskArchive=await pass(chief.post(`/api/v1/meeting-proposals/${proposalArchive.id}/adopt`,{projectId:kept.id,version:meetingArchive.proposals[0].version,confirm:true}))
    const old=await archive()
    assert.ok((await pass(chief.get('/api/v1/admin/audit?action=archive.export'))).events.length>0)
    assert.deepEqual((await pass(admin.get('/api/v1/admin/audit?action=archive.export'))).events,[])
    assert.deepEqual((await pass(admin.get('/api/v1/admin/audit?action=archive.exported'))).events,[])
    assert.equal((await member.post('/api/portability/exports',{})).status,403)
    const before=(await allAudit()).filter(e=>e.target_id===p.id)
    await pass(eraseReview(await review('project',p.id)))
    const followups=(await pass(chief.get('/api/v1/data'))).processorDeletions;assert.ok(followups.some(r=>r.subject_id===archivedOutput.id))
    const later=await archive(),records=later.trim().split('\n').map(line=>JSON.parse(line))
    const archivedEvents=records.filter(r=>r.kind==='part').flatMap(r=>r.items).filter(r=>r.kind==='row'&&r.table==='peg_permanent_audit').map(r=>r.row)
    for(const event of before)assert.ok(archivedEvents.some(row=>row.id===event.id&&row.action===event.action))
    const scratch=await mkdtemp(join(tmpdir(),'pegboard-custody-archive-'))
    try{
      // Native public CLI restore into an empty installation of the exact committed product tree.
      execFileSync('git',['archive','--output',join(scratch,'product.tar'),'HEAD']);execFileSync('tar',['-xf',join(scratch,'product.tar'),'-C',scratch],{stdio:'pipe'})
      await symlink(join(process.cwd(),'node_modules'),join(scratch,'node_modules'),'dir')
      await mkdir(join(scratch,'exports'),{recursive:true})
      await writeFile(join(scratch,'exports/old.rer'),old,{mode:0o600});await writeFile(join(scratch,'exports/later.rer'),later,{mode:0o600})
      const rer=join(process.cwd(),'node_modules/@runeditrun/rer/global/rer.mjs')
      const cli=(...args)=>spawnSync(process.execPath,[rer,...args],{cwd:scratch,encoding:'utf8',env:{...process.env,CI:'1',WRANGLER_SEND_METRICS:'false'}})
      const refused=cli('import','--input','exports/old.rer','--journal','exports/later.rer','--yes')
      assert.equal(refused.status,4,refused.stdout+refused.stderr);assert.match(refused.stdout+refused.stderr,/erasure_epoch|erased_row/)
      const restored=cli('import','--input','exports/later.rer','--yes');assert.equal(restored.status,0,restored.stdout+restored.stderr)
      const exported=cli('export','--output','exports/restored.rer');assert.equal(exported.status,0,exported.stdout+exported.stderr)
      const result=(await readFile(join(scratch,'exports/restored.rer'),'utf8')).trim().split('\n').map(line=>JSON.parse(line)),items=result.filter(r=>r.kind==='part').flatMap(r=>r.items)
      const audit=items.filter(r=>r.kind==='row'&&r.table==='peg_permanent_audit').map(r=>r.row)
      for(const event of archivedEvents)assert.deepEqual(audit.find(row=>row.id===event.id),event)
      const inactiveMeeting=items.find(r=>r.kind==='row'&&r.table==='peg_meetings'&&r.row.id===meetingArchive.meeting.id)?.row
      assert.ok(inactiveMeeting?.revoked_at);assert.equal(inactiveMeeting.segments,'[]')
      assert.ok(items.some(r=>r.kind==='row'&&r.table==='peg_meeting_adoptions'&&r.row.task_id===meetingTaskArchive.taskId))
      const inactiveProposal=items.find(r=>r.kind==='row'&&r.table==='peg_meeting_proposals'&&r.row.id===proposalArchive.id)?.row
      assert.equal(inactiveProposal?.title,'');assert.equal(inactiveProposal?.owner_id,null)

      assert.ok(!items.some(r=>r.kind==='row'&&r.table==='peg_tasks'&&r.row.id===t.id))
      assert.ok(items.some(r=>r.kind==='row'&&r.table==='peg_data_receipts'&&r.row.target_id===p.id))
      const copy=await startWorker({restoredPersist:join(scratch,'.wrangler/state')})
      try{
        const restoredActor=await pass(copy.owner.get('/api/v1/admin/audit?actor='+archivedActor.id))
        assert.ok(restoredActor.events.length>0);assert.ok(restoredActor.events.every(e=>e.actor==='Erased actor'));assert.ok((await pass(copy.owner.get('/api/v1/admin/audit?action=archive.restored'))).events.length>0)
        assert.equal((await copy.owner.get('/api/v1/tasks/'+t.id)).status,404)
        const pinned=await pass(copy.owner.get('/api/v1/proofs/'+keptProof.id));assert.equal(pinned.state,'approve');assert.equal(pinned.versions[0].digest,keptProof.digest)
        assert.equal(await pass(copy.owner.get('/api/v1/attachments/'+keptFile.id)),Buffer.from(pdf).toString())
        const restoredData=await pass(copy.owner.get('/api/v1/data'));for(const row of followups)assert.ok(restoredData.processorDeletions.some(r=>r.id===row.id&&r.state==='needs_owner_action'))

      }finally{await copy.stop()}

      assert.ok(items.filter(r=>r.kind==='row'&&r.table==='peg_grants').every(r=>r.row.revoked_at!==null))
      assert.ok(items.filter(r=>r.kind==='row'&&r.table==='peg_recurrences').every(r=>r.row.active===0))
    }finally{await rm(scratch,{recursive:true,force:true})}
  },{timeout:180000})


})


describe('Engineering handoff', {concurrency:false},()=>{
  let runtime,edge,admin,member,guest,task,projectId
  const credential='synthetic-pegboard-800'
  const settings=()=>({PEGBOARD_VECTOR_ORIGIN:'https://vector.example.com',PEGBOARD_LOCAL_ENGINEERING_ORIGINS:edge.origins})
  before(async()=>{
    edge=await startEngineeringServices();runtime=await startWorker({settings:settings()});admin=runtime.owner
    member=await runtime.person('synthetic-pegboard-803@example.com','Synthetic task owner');guest=await runtime.person('synthetic-pegboard-804@example.com','Synthetic guest','guest')
    projectId=(await ok(admin.post('/api/v1/projects',{name:'Synthetic engineering campaign'}))).id
    task=await ok(admin.post('/api/v1/tasks',{projectId,title:'Synthetic launch approval',kind:'approval',ownerId:member.id}))
    await ok(admin.post('/api/v1/grants',{objectType:'project',objectId:projectId,granteeId:member.id,level:'editor'}))
    await ok(admin.post('/api/v1/grants',{objectType:'project',objectId:projectId,granteeId:guest.id,level:'viewer'}))
  },{timeout:120000})
  after(async()=>{await runtime?.stop();await edge?.stop()})
  it('reconciles mapped issues at all three official boundaries without satisfying business acceptance',async()=>{
    for(const service of ['vector','jira','github']){
      const state=edge.services[service],todo=service==='vector'?vectorTodo:service==='jira'?'100':'open',done=service==='vector'?vectorDone:service==='jira'?'200':'closed'
      const input={service,origin:'https://synthetic-pegboard-1.atlassian.net',locator:service==='github'?['synthetic-pegboard-1','synthetic-pegboard-2','issues','1'].join('/'):'SYN-1',mappings:{[todo]:'todo',[done]:'done'},ownerMappings:{[service==='github'?'801':state.owner]:member.id},direction:'both',consent:true,credential}
      const link=await ok(admin.post(`/api/v1/tasks/${task.id}/engineering`,input));assert.equal(link.mapped_owner,member.id)
      const duplicates=await Promise.all([1,2].map(()=>ok(admin.post(`/api/v1/tasks/${task.id}/engineering`,input))));assert.ok(duplicates.every(l=>l.id===link.id))
      assert.equal((await admin.post(`/api/v1/engineering/${link.id}/backlink`,{credential})).status,400)
      state.lose=true
      const linked=await ok(admin.post(`/api/v1/engineering/${link.id}/backlink`,{credential,confirm:true}));assert.equal(linked.backlink_state,'posted')
      await ok(admin.post(`/api/v1/engineering/${link.id}/backlink`,{credential,confirm:true}));assert.equal(state.commentWrites,1)
      state.change(done)
      let current=await ok(admin.post(`/api/v1/engineering/${link.id}/refresh`,{credential}));assert.equal(current.indicator,'done')
      assert.equal((await ok(admin.get(`/api/v1/tasks/${task.id}`))).status,'todo')
      const decision=await ok(admin.get(`/api/v1/tasks/${task.id}/decision-preview`));assert.equal(decision.state,'pending')
      assert.equal((await admin.post(`/api/v1/engineering/${link.id}/update`,{credential,version:current.version,sourceStatus:'unmapped',confirm:true})).status,409)
      state.change(todo);current=await ok(admin.post(`/api/v1/engineering/${link.id}/refresh`,{credential}))
      const approval={credential,version:current.version,sourceStatus:done,transitionId:'31',confirm:true}
      assert.equal((await admin.post(`/api/v1/engineering/${link.id}/update`,{...approval,confirm:false})).status,400)
      state.lose=true
      current=await ok(admin.post(`/api/v1/engineering/${link.id}/update`,approval));assert.equal(current.indicator,'done');assert.equal(state.writes,1)
      assert.equal((await admin.post(`/api/v1/engineering/${link.id}/update`,approval)).status,409);assert.equal(state.writes,1)
      state.change('synthetic-pegboard-805');current=await ok(admin.post(`/api/v1/engineering/${link.id}/refresh`,{credential}));assert.equal(current.state,'stale');assert.equal(current.indicator,null)
      state.change(done);await ok(admin.post(`/api/v1/engineering/${link.id}/refresh`,{credential}))
      state.outage=true;current=await ok(admin.post(`/api/v1/engineering/${link.id}/refresh`,{credential}));assert.equal(current.state,'stale');assert.equal(current.cause,'engineering_source_unavailable');state.outage=false
      current=await ok(admin.post(`/api/v1/engineering/${link.id}/refresh`,{credential}));assert.equal(current.state,'current')
      state.refused=true;assert.equal((await admin.post(`/api/v1/tasks/${task.id}/engineering`,input)).status,403)
      current=(await ok(admin.get(`/api/v1/tasks/${task.id}/engineering`))).links.find(row=>row.id===link.id);assert.ok(current.revoked_at);assert.equal(current.source_owner,null);assert.equal(current.source_status,null);assert.equal(current.mapped_owner,null)
      state.refused=false;assert.equal((await admin.post(`/api/v1/engineering/${link.id}/refresh`,{credential})).status,409)
      assert.equal((await ok(admin.post(`/api/v1/tasks/${task.id}/engineering`,input))).id,link.id)
      assert.equal((await ok(admin.get(`/api/v1/tasks/${task.id}`))).status,'todo')
    }
    const gh=edge.services.github
    const pr=await ok(admin.post(`/api/v1/tasks/${task.id}/engineering`,{service:'github',locator:['synthetic-pegboard-1','synthetic-pegboard-2','pulls','1'].join('/'),mappings:{open:'todo',closed:'doing',merged:'done'},direction:'both',consent:true,credential}))
    assert.notEqual(pr.external_id,'10001');gh.merged=true
    const merged=await ok(admin.post(`/api/v1/engineering/${pr.id}/refresh`,{credential}));assert.equal(merged.indicator,'done')
    assert.equal((await admin.post(`/api/v1/engineering/${pr.id}/update`,{credential,version:merged.version,sourceStatus:'closed',confirm:true})).status,400)
    const rows=(await ok(admin.get(`/api/v1/tasks/${task.id}/engineering`))).links;assert.equal(rows.length,4)
    assert.ok(!JSON.stringify(rows).includes(credential));const audit=await ok(admin.get('/api/v1/admin/audit'));assert.ok(!JSON.stringify(audit).includes(credential))
  })
  it('denies unapproved source capture, foreign writes, private context and stale reviewed returns',async()=>{
    const input={service:'vector',locator:'SYN-1',mappings:{[vectorTodo]:'todo',[vectorDone]:'done'},direction:'both',credential}
    const another=await ok(admin.post('/api/v1/tasks',{projectId,title:'Synthetic engineering dependency'}))
    assert.equal((await admin.post(`/api/v1/tasks/${another.id}/engineering`,input)).status,400)
    assert.equal((await member.post(`/api/v1/tasks/${another.id}/engineering`,{...input,consent:true})).status,403)
    for(const caller of [member,guest]){assert.equal((await caller.get(`/api/v1/tasks/${task.id}/engineering`)).status,403);assert.equal((await caller.get(`/app/engineering/${task.id}`)).status,403)}
    assert.equal((await admin.post(`/api/v1/tasks/${another.id}/engineering`,{...input,consent:true},{origin:'https://foreign.example.com'})).status,403)
    edge.services.vector.change(vectorTodo)
    let l=await ok(admin.post(`/api/v1/tasks/${another.id}/engineering`,{...input,consent:true}))
    edge.services.vector.change(vectorDone)
    assert.equal((await admin.post(`/api/v1/engineering/${l.id}/update`,{credential,confirm:true,version:l.version,sourceStatus:vectorDone})).status,409)
    edge.services.vector.commentOutage=true
    assert.equal((await admin.post(`/api/v1/engineering/${l.id}/backlink`,{credential,confirm:true})).status,503)
    let failed=(await ok(admin.get(`/api/v1/tasks/${another.id}/engineering`))).links[0]
    assert.equal(failed.state,'stale');assert.equal(failed.source_status,null);assert.equal(failed.indicator,null)
    edge.services.vector.commentOutage=false
    failed=await ok(admin.post(`/api/v1/engineering/${l.id}/refresh`,{credential}))
    edge.services.vector.refused=true
    const writes=edge.services.vector.writes
    assert.equal((await admin.post(`/api/v1/engineering/${l.id}/update`,{credential,confirm:true,version:failed.version,sourceStatus:vectorTodo})).status,403)
    failed=(await ok(admin.get(`/api/v1/tasks/${another.id}/engineering`))).links[0]
    assert.ok(failed.revoked_at);assert.equal(failed.source_owner,null);assert.equal(failed.source_status,null);assert.equal(failed.mapped_owner,null);assert.equal(edge.services.vector.writes,writes)
    edge.services.vector.refused=false
    const before=edge.services.vector.requests.length
    await ok(admin.post(`/api/v1/engineering/${l.id}/revoke`,{}))
    assert.equal((await admin.post(`/api/v1/engineering/${l.id}/refresh`,{credential})).status,409);assert.equal(edge.services.vector.requests.length,before)
    await runtime.restart();assert.equal((await ok(admin.get(`/api/v1/tasks/${another.id}/engineering`))).links.length,1)
    assert.equal((await admin.post(`/api/v1/engineering/${l.id}/update`,{credential,confirm:true,version:l.version,sourceStatus:vectorDone})).status,409)
  })
})


describe('Meeting review',{concurrency:false},()=>{
  let runtime,edge,admin,member,projectId
  const vtt='WEBVTT\n\n1\n00:00:01.000 --> 00:00:05.000\nAction: Synthetic campaign follow-up with uncertain owner and date\n\n2\n00:00:05.000 --> 00:00:09.000\nDecision: Synthetic launch sign-off still needs a human\n'
  const artifact=service=>({service,sourceId:'synthetic-pegboard-901',content:service==='meet'?{transcriptEntries:[{name:'synthetic-pegboard-902',participant:'synthetic-pegboard-903',startTime:'2026-10-23T12:00:01Z',endTime:'2026-10-23T12:00:05Z',text:'Action: Synthetic campaign follow-up with uncertain owner and date'},{name:'synthetic-pegboard-904',participant:'synthetic-pegboard-903',startTime:'2026-10-23T12:00:05Z',endTime:'2026-10-23T12:00:09Z',text:'Decision: Synthetic launch sign-off still needs a human'}]}:vtt,sourceAuthority:true,organizerConsent:true,participantConsent:true})
  before(async()=>{edge=await startMeetingServices();runtime=await startWorker({settings:{PEGBOARD_LOCAL_MEETING_ORIGINS:edge.origins}});admin=runtime.owner;member=await runtime.person('synthetic-pegboard-905@example.com','Synthetic meeting participant');projectId=(await ok(admin.post('/api/v1/projects',{name:'Synthetic meeting campaign'}))).id},{timeout:120000})
  after(async()=>{await runtime?.stop();await edge?.stop()})
  it('imports authorized provider transcript exports and adopts each resolved cited action once',async()=>{
    for(const service of ['zoom','meet','teams']){
      let meeting=await ok(admin.post('/api/v1/meetings',artifact(service)))
      assert.equal(meeting.meeting.segments.length,2);assert.equal(meeting.proposals.length,2)
      assert.equal((await ok(admin.post('/api/v1/meetings',artifact(service)))).meeting.id,meeting.meeting.id)
      let proposal=meeting.proposals[0]
      const adopt=(extra={})=>admin.post(`/api/v1/meeting-proposals/${proposal.id}/adopt`,{projectId,version:proposal.version,confirm:true,...extra})
      assert.equal((await adopt()).status,409)
      const revision={version:proposal.version,title:'Reviewed synthetic delivery action',ownerId:member.id,dueDate:'2026-11-03',dateResolved:true}
      assert.equal((await admin.post(`/api/v1/meeting-proposals/${proposal.id}/revise`,{...revision,dateResolved:false})).status,400)
      meeting=await ok(admin.post(`/api/v1/meeting-proposals/${proposal.id}/revise`,revision));proposal=meeting.proposals[0]
      assert.equal((await adopt({version:1})).status,409);assert.equal((await adopt({confirm:false})).status,400)
      const adopted=await Promise.all([1,2].map(()=>ok(adopt())));assert.equal(adopted[0].taskId,adopted[1].taskId)
      const task=await ok(admin.get(`/api/v1/tasks/${adopted[0].taskId}`));assert.equal(task.title,revision.title);assert.equal(task.owner.id,member.id);assert.equal(task.dueDate,'2026-11-03');assert.ok(task.description.includes(meeting.meeting.id));assert.deepEqual(task.meetingCitations,[{meetingId:meeting.meeting.id,segmentIndex:0}]);assert.ok(!task.description.includes('uncertain owner'))
      assert.equal((await ok(admin.get(`/api/v1/projects/${projectId}`))).columns.flatMap(c=>c.tasks).filter(t=>t.id===task.id).length,1)
      const decision=meeting.proposals[1]
      meeting=await ok(admin.post(`/api/v1/meeting-proposals/${decision.id}/revise`,{version:decision.version,title:decision.title,ownerId:member.id,dueDate:'',dateResolved:true}))
      const d=meeting.proposals[1],signoff=await ok(admin.post(`/api/v1/meeting-proposals/${d.id}/adopt`,{projectId,version:d.version,confirm:true}))
      assert.equal((await ok(admin.get(`/api/v1/tasks/${signoff.taskId}/decision-preview`))).state,'pending')
      const revoked=await ok(admin.post(`/api/v1/meetings/${meeting.meeting.id}/revoke`,{}));assert.deepEqual(revoked.meeting.segments,[]);assert.ok(revoked.proposals.every(p=>p.title===''&&p.owner_id===null))
      assert.deepEqual((await ok(admin.get(`/api/v1/meetings/${meeting.meeting.id}/context`))).meeting.segments,[])
      assert.equal((await admin.post(`/api/v1/meeting-proposals/${proposal.id}/adopt`,{projectId,version:proposal.version,confirm:true})).status,409)
      assert.equal((await ok(admin.get(`/api/v1/tasks/${task.id}`))).title,revision.title);assert.deepEqual((await ok(admin.get(`/api/v1/tasks/${task.id}`))).meetingCitations,[])
      assert.ok((await ok(admin.post('/api/v1/meetings',artifact(service)))).meeting.revoked_at)
    }
  })
  it('reads all three official provider boundaries and clears revoked source context',async()=>{
    for(const service of ['zoom','meet','teams']){
      const sourceId=(service==='zoom'?['meetings','synthetic-pegboard-951','recordings','synthetic-pegboard-952']:service==='meet'?['conferenceRecords','synthetic-pegboard-951','transcripts','synthetic-pegboard-952']:['users','synthetic-pegboard-951','onlineMeetings','synthetic-pegboard-952','transcripts','synthetic-pegboard-953']).join('/')
      const input={...artifact(service),sourceId,content:'',credential:'synthetic-pegboard-950'},m=await ok(admin.post('/api/v1/meetings',input))
      assert.equal(m.meeting.segments.length,1);assert.equal(m.proposals.length,1)
      const credential={credential:'synthetic-pegboard-950'}
      await ok(admin.post(`/api/v1/meetings/${m.meeting.id}/refresh`,credential))
      edge.state.outage.add(service)
      assert.equal((await admin.post(`/api/v1/meetings/${m.meeting.id}/refresh`,credential)).status,503)
      edge.state.outage.delete(service)
      edge.state.changed.add(service)
      assert.equal((await admin.post(`/api/v1/meetings/${m.meeting.id}/refresh`,credential)).status,409)
      assert.deepEqual((await ok(admin.get(`/api/v1/meetings/${m.meeting.id}/context`))).meeting.segments,[])
      assert.equal((await admin.post(`/api/v1/meeting-proposals/${m.proposals[0].id}/adopt`,{projectId,version:1,confirm:true})).status,409)
      edge.state.changed.delete(service)
      assert.equal((await admin.post(`/api/v1/meetings/${m.meeting.id}/refresh`,credential)).status,409)
      const fresh=await ok(admin.post('/api/v1/meetings',{...input,sourceId:sourceId.replace('synthetic-pegboard-951','synthetic-pegboard-956')}))
      edge.state.refused.add(service)
      const revoked=await ok(admin.post(`/api/v1/meetings/${fresh.meeting.id}/refresh`,credential));assert.ok(revoked.meeting.revoked_at);assert.deepEqual(revoked.meeting.segments,[])
      assert.ok(!JSON.stringify(await ok(admin.get(`/api/v1/meetings/${fresh.meeting.id}/context`))).includes('Synthetic provider follow-up'))
      assert.ok(!JSON.stringify(await ok(admin.get('/api/v1/admin/audit'))).includes(credential.credential))
    }
  })
  it('requires capture consent and source authority, fences changed exports and keeps context private after restart',async()=>{
    for(const flag of ['sourceAuthority','organizerConsent','participantConsent'])assert.equal((await admin.post('/api/v1/meetings',{...artifact('zoom'),[flag]:false})).status,400)
    assert.equal((await member.post('/api/v1/meetings',artifact('zoom'))).status,403)
    const input={...artifact('zoom'),sourceId:'synthetic-pegboard-906'},meeting=await ok(admin.post('/api/v1/meetings',input))
    assert.equal((await member.get(`/api/v1/meetings/${meeting.meeting.id}`)).status,404)
    const agent=await runtime.person('synthetic-pegboard-907@example.com','Synthetic scoped agent','agent')
    await ok(admin.post('/api/v1/grants',{objectType:'project',objectId:projectId,granteeId:agent.id,level:'editor'}))
    assert.equal((await agent.get(`/api/v1/meetings/${meeting.meeting.id}/context`)).status,404)
    assert.equal((await admin.post('/api/v1/meetings',{...input,content:vtt.replace('campaign','changed')})).status,409)
    const prepared=await ok(admin.post(`/api/v1/meetings/${meeting.meeting.id}/proposals`,{segmentIndex:1,title:'Synthetic participant clarification',kind:'followup'}));assert.equal(prepared.proposals.length,3)
    await runtime.restart();assert.equal((await ok(admin.get(`/api/v1/meetings/${meeting.meeting.id}`))).proposals.length,3)
    await ok(admin.post(`/api/v1/meetings/${meeting.meeting.id}/revoke`,{}))
    assert.equal((await admin.post(`/api/v1/meetings/${meeting.meeting.id}/proposals`,{segmentIndex:0,title:'Synthetic stale action'})).status,409)
    assert.equal((await ok(admin.get(`/api/v1/meetings/${meeting.meeting.id}/context`))).meeting.segments.length,0)
    await runtime.restart()
    assert.equal((await agent.get(`/api/v1/meetings/${meeting.meeting.id}/context`)).status,404)
    assert.equal((await ok(admin.get(`/api/v1/meetings/${meeting.meeting.id}/context`))).meeting.segments.length,0)
  })
})

describe('Analyst exports', {concurrency:false}, () => {
  let w, owner, mia
  const project = name => ok(owner.post('/api/v1/projects', {name}))
  before(async () => { w=await startWorker();owner=w.owner;mia=await w.person('analyst-member@example.com','Analyst member') }, {timeout:120000})
  after(() => w?.stop())
  it('reconciles scoped analyst snapshots and incremental removals across three projects', async () => {
    const projects = await Promise.all(['Analytics one','Analytics two','Analytics three'].map(name => project(name)))
    const tasks = []
    for (const [i,p] of projects.entries()) tasks.push(await ok(owner.post('/api/v1/tasks', {projectId:p.id,title:'Analytics work '+i,estimateHours:i+1,internalNotes:'Never expose this note'})))
    await ok(owner.post(`/api/v1/tasks/${tasks[0].id}/projects`, {projectId:projects[1].id}))
    const child = await ok(owner.post('/api/v1/tasks', {parentId:tasks[0].id,title:'Analytics child',estimateHours:0.5}))
    await ok(owner.post('/api/v1/tasks', {title:'Private analyst distraction'}))
    const outside = await project('Outside analyst scope')
    await ok(owner.post('/api/v1/tasks', {projectId:outside.id,title:'Outside analyst distraction'}))
    const person = await w.person('analyst-time@example.com','Analyst time contributor')
    await ok(owner.post('/api/v1/grants', {objectType:'project',objectId:projects[0].id,granteeId:person.id,level:'editor'}))
    const sheet = await ok(person.post('/api/v1/timesheets', {startDate:'2026-10-22',endDate:'2026-10-22'}))
    await ok(person.post(`/api/v1/timesheets/${sheet.id}/entries`, {taskId:tasks[0].id,projectId:projects[0].id,date:'2026-10-22',seconds:3723,key:'synthetic-pegboard-4401'}))
    await ok(person.post(`/api/v1/timesheets/${sheet.id}/decision`, {action:'submit',revision:(await ok(person.get(`/api/v1/timesheets/${sheet.id}`))).token}))
    await ok(owner.post(`/api/v1/timesheets/${sheet.id}/decision`, {action:'approve',revision:(await ok(owner.get(`/api/v1/timesheets/${sheet.id}`))).token}))
    const key = await ok(owner.post('/api/v1/analytics/keys', {name:'Reviewed analyst access',projects:projects.map(p=>p.id),fields:{Projects:['id','name','status'],Tasks:['id','title','status','estimateHours'],TaskProjects:['id','taskId','projectId'],TimeEntries:['id','taskId','projectId','sheetId','seconds','adjustmentOf']},expiresAt:Date.now()+86400000,consent:true}))
    const read = async(path, extra={}) => {
      const response = await fetch(new URL(path,w.origin), {headers:{authorization:'Basic '+Buffer.from(key.id+':'+key.secret).toString('base64'),prefer:'odata.maxpagesize=2',...extra}})
      return {status:response.status,body:response.headers.get('content-type').includes('xml')?await response.text():await response.json(),headers:response.headers}
    }
    assert.equal((await read(key.servicePath)).body.value.length,4)
    const metadata = await read(key.servicePath+'/$metadata')
    assert.equal(metadata.status,200);assert.match(metadata.body,/EntityType Name="Tasks"/);assert.ok(!metadata.body.includes('internal_notes'))
    const first = await read(key.servicePath+'/Tasks?$count=true')
    assert.equal(first.status,200);assert.equal(first.body['@odata.count'],4);assert.equal(first.body.value.length,2)
    assert.equal(first.headers.get('cache-control'),'private, no-store')
    const snapshot = first.body['@pegboard.snapshot']
    await ok(owner.patch(`/api/v1/tasks/${tasks[0].id}`,{status:'doing'}))
    let page = first.body, records = [...page.value]
    while (page['@odata.nextLink']) { page = (await read(page['@odata.nextLink'])).body;records.push(...page.value) }
    assert.equal(new Set(records.map(t=>t.id)).size,4);assert.equal(records.find(t=>t.id===tasks[0].id).status,'todo')
    assert.ok(page['@pegboard.stale']);assert.ok(!JSON.stringify(records).includes('distraction'));assert.ok(!JSON.stringify(records).includes('Never expose'))
    const native = await ok(owner.get('/api/v1/rollup?projects='+projects.map(p=>p.id).join(',')))
    assert.equal(records.length,native.tasks);assert.equal(records.reduce((n,t)=>n+t.estimateHours,0),native.estimateHours)
    const time = await read(key.servicePath+'/TimeEntries?snapshot='+snapshot)
    assert.equal(time.body.value.reduce((n,t)=>n+t.seconds,0),(await ok(owner.get(`/api/v1/timesheets/${sheet.id}`))).totalSeconds)
    const placements=[];let membership=(await read(key.servicePath+'/TaskProjects?snapshot='+snapshot)).body
    for(;;){placements.push(...membership.value);if(!membership['@odata.nextLink'])break;membership=(await read(membership['@odata.nextLink'])).body}
    assert.equal(placements.filter(p=>p.taskId===tasks[0].id).length,2);assert.equal(placements.filter(p=>p.taskId===child.id).length,2)
    assert.equal((await read(key.servicePath+'/Tasks?$select=internal_notes')).status,400)
    assert.equal((await read(key.servicePath+'/Tasks?$filter=title')).status,400)
    const erase = await ok(owner.post('/api/v1/data/erasure-preview',{type:'task',id:tasks[2].id}))
    await ok(owner.post('/api/v1/data/erase',{type:'task',id:tasks[2].id,token:erase.token,confirm:true}))
    assert.equal((await read(first.body['@odata.nextLink'])).status,410,'an erased payload is unavailable even from a saved page')
    const delta = await read(page['@odata.deltaLink'])
    assert.equal(delta.status,200);assert.equal(delta.body.value.length,2)
    assert.equal(delta.body.value.find(t=>t.id===tasks[0].id).status,'doing')
    assert.ok(delta.body.value.some(t=>t.reason==='deleted'&&t.id.includes(tasks[2].id)))
    assert.deepEqual((await read(delta.body['@odata.deltaLink'])).body.value,[],'a repeated refresh has no duplicate changes')
    await w.restart()
    assert.equal((await read(key.servicePath+'/Tasks')).body.value.length,2,'durable credential survives restart and still pages')
    await ok(owner.post(`/api/v1/analytics/keys/${key.id}/revoke`,{}))
    for(const path of [key.servicePath,key.servicePath+'/$metadata',page['@odata.deltaLink'],first.body['@odata.nextLink']])assert.equal((await read(path)).status,401)
  })

  it('denies analyst scope escalation and fences cached work after movement or credential expiry', async () => {
    const p=await project('Analyst credential boundary'),outside=await project('Beyond analyst credential')
    const task=await ok(owner.post('/api/v1/tasks',{projectId:p.id,title:'Scoped before movement'}))
    const input={name:'Limited analyst',projects:[p.id],fields:{Tasks:['id','status']},expiresAt:Date.now()+86400000,consent:true}
    assert.equal((await mia.post('/api/v1/analytics/keys',input)).status,403)
    assert.equal((await owner.post('/api/v1/analytics/keys',{...input,consent:false})).status,400)
    assert.equal((await owner.post('/api/v1/analytics/keys',{...input,fields:{Tasks:['description']}})).status,400)
    const key=await ok(owner.post('/api/v1/analytics/keys',input)),other=await ok(owner.post('/api/v1/analytics/keys',input))
    const read=async(path,secret=key.secret)=>{const response=await fetch(new URL(path,w.origin),{headers:{authorization:'Bearer '+secret}});return {status:response.status,body:await response.json()}}
    const page=await read(key.servicePath+'/Tasks')
    assert.deepEqual(Object.keys(page.body.value[0]).sort(),['id','status'])
    assert.equal((await read(key.servicePath+'/Projects')).status,404)
    assert.equal((await read(key.servicePath+'/Tasks',other.secret)).status,401)
    assert.equal((await read(other.servicePath+'/Tasks?snapshot='+page.body['@pegboard.snapshot'],other.secret)).status,410)
    const listed=JSON.stringify(await ok(owner.get('/api/v1/analytics/keys')))
    assert.ok(!listed.includes(key.secret));assert.ok(!listed.includes('token_hash'))
    await ok(owner.post(`/api/v1/tasks/${task.id}/move`,{from:p.id,to:outside.id}))
    assert.equal((await read(key.servicePath+'/Tasks?snapshot='+page.body['@pegboard.snapshot'])).status,410)
    assert.equal((await read(page.body['@odata.deltaLink'])).body.value[0].reason,'deleted')
    await w.sql(`UPDATE peg_analytics_keys SET expires_at=1 WHERE id='${key.id}'`)
    assert.equal((await read(key.servicePath+'/Tasks')).status,401)
    let admin=await w.person('analyst-admin@example.com','Analyst administrator')
    await ok(owner.post('/api/v1/workspaces/ws_main/people/'+admin.id+'/account',{role:'admin'}))
    admin=await w.signIn(admin.email,admin.name,admin.id)
    const delegated=await ok(admin.post('/api/v1/analytics/keys',input))
    await ok(owner.post('/api/v1/workspaces/ws_main/people/'+admin.id+'/account',{role:'member'}))
    assert.equal((await read(delegated.servicePath+'/Tasks',delegated.secret)).status,401)
  })

  it('keeps analyst credentials and cached export payloads out of native archives', async () => {
    const p=await project('Archived analyst authority')
    await ok(owner.post('/api/v1/tasks',{projectId:p.id,title:'Archived ordinary task'}))
    const key=await ok(owner.post('/api/v1/analytics/keys',{name:'Archive exclusion',projects:[p.id],fields:{Tasks:['id','title']},expiresAt:Date.now()+86400000,consent:true}))
    const feed=await fetch(new URL(key.servicePath+'/Tasks',w.origin),{headers:{authorization:'Bearer '+key.secret}})
    assert.equal(feed.status,200)
    const snapshot=(await feed.json())['@pegboard.snapshot']
    const created=await ok(owner.post('/api/portability/exports',{}),201)
    let archive
    for(let page=0;page<100;page++){
      const status=await ok(owner.post(`/api/portability/exports/${created.id}/advance`,{maxParts:16}))
      if(status.phase==='complete'){archive=await ok(owner.get(`/api/portability/exports/${created.id}/download`));break}
    }
    assert.ok(archive,'native archive completes')
    assert.ok(!archive.includes(key.secret),'the once-shown credential cannot travel')
    assert.ok(!archive.includes(snapshot),'the export cache cannot travel')
    const rows=archive.trim().split('\n').map(line=>JSON.parse(line)).filter(part=>part.kind==='part').flatMap(part=>part.items).filter(item=>item.kind==='row')
    assert.ok(rows.some(item=>item.table==='peg_tasks'&&item.row.title==='Archived ordinary task'))
    assert.ok(!rows.some(item=>item.table.startsWith('peg_analytics_')),'neither credential hashes nor temporary material travel')
  })

})

// Native planning uses the same task records as List, and the same archive as the installation.
describe('Project planning canvas', {concurrency:false},()=>{
 let server,chief,member,guest,projectId,phase,note,taskId,privateNote
 const pass=async call=>{const r=await call;assert.equal(r.status,200,JSON.stringify(r.body));return r.body}
 const path=()=>`/api/v1/projects/${projectId}/canvas`
 before(async()=>{
  server=await startWorker();chief=server.owner
  member=await server.person('synthetic-pegboard-1101@example.com','Mia Alvarez')
  guest=await server.person('synthetic-pegboard-1102@example.com','Casey Client','guest')
  projectId=(await pass(chief.post('/api/v1/projects',{name:'Spring product launch'}))).id
  for(const [person,level] of [[member,'editor'],[guest,'viewer']])await pass(chief.post('/api/v1/grants',{objectType:'project',objectId:projectId,granteeId:person.id,level}))
 },{timeout:120000})
 after(()=>server?.stop())
 it('collaborates on a planning canvas and promotes a reviewed note once into the native List task',async()=>{
  phase=(await pass(chief.post(path()+'/nodes',{title:'Launch preparation',kind:'phase'}))).id
  note=(await pass(member.post(path()+'/nodes',{title:'Prepare the launch brief',parentId:phase,position:1}))).id
  privateNote=(await pass(chief.post(path()+'/nodes',{title:'Internal pricing negotiation',internalOnly:true,parentId:phase,position:2}))).id
  const child=(await pass(chief.post(path()+'/nodes',{title:'Channel checklist',parentId:note}))).id
  await pass(member.post(path()+`/nodes/${note}/update`,{version:1,parentId:null,position:3}))
  assert.equal((await chief.post(path()+`/nodes/${note}/update`,{version:1,parentId:phase})).status,409)
  assert.equal((await chief.post(path()+`/nodes/${note}/update`,{version:2,parentId:child})).status,409)
  assert.equal((await member.post(path()+`/nodes/${note}/promote`,{version:2,ownerId:member.id})).status,400)
  const results=await Promise.all([chief,member].map(person=>person.post(path()+`/nodes/${note}/promote`,{version:2,ownerId:member.id,confirm:true})))
  for(const result of results)assert.equal(result.status,200,JSON.stringify(result.body))
  taskId=results[0].body.taskId;assert.equal(results[1].body.taskId,taskId)
  await pass(member.patch(`/api/v1/tasks/${taskId}`,{title:'Reviewed launch brief',status:'doing',ownerId:chief.id,dueDate:'2027-03-08'}))
  const task=await pass(chief.get(`/api/v1/tasks/${taskId}`));assert.equal(task.history.filter(h=>h.kind==='created').length,1)
  await pass(member.post(path()+`/nodes/${note}/update`,{version:3,parentId:phase,position:0}))
  assert.equal((await pass(chief.get(`/api/v1/tasks/${taskId}`))).dueDate,'2027-03-08','moving a representation never changes the date')
  let view=await pass(chief.get(path())),linked=view.nodes.find(n=>n.id===note)
  assert.equal(linked.task.id,taskId);assert.equal(linked.task.status,'doing');assert.equal(linked.task.owner.id,chief.id);assert.equal(linked.title,'Reviewed launch brief');assert.equal(linked.parentId,phase)
  const list=await pass(member.get(`/app/projects/${projectId}?view=list`));assert.ok(list.includes('Reviewed launch brief')&&list.includes(taskId))
  await server.restart();view=await pass(member.get(path()));assert.equal(view.nodes.find(n=>n.id===note).task.id,taskId)
  const guestView=await pass(guest.get(path()));assert.ok(!JSON.stringify(guestView).includes(privateNote));assert.ok(!JSON.stringify(guestView).includes('Internal pricing negotiation'));assert.deepEqual(guestView.people,[])
  assert.ok(!(await pass(guest.get(`/app/projects/${projectId}/canvas`))).includes('Internal pricing negotiation'))
  assert.equal((await guest.post(path()+'/nodes',{title:'Cannot edit'})).status,403)
  const guestEditor=await server.person('synthetic-pegboard-1104@example.com','Scoped client editor','guest')
  await pass(chief.post('/api/v1/grants',{objectType:'project',objectId:projectId,granteeId:guestEditor.id,level:'editor'}))
  const visible=await pass(guestEditor.post(path()+'/nodes',{title:'Client launch checklist',parentId:phase}))
  assert.equal((await guestEditor.post(path()+'/nodes',{title:'Hidden child',parentId:privateNote})).status,404)
  assert.equal((await guestEditor.post(path()+`/nodes/${privateNote}/update`,{version:1,title:'Cannot overwrite'})).status,404)
  assert.equal((await guestEditor.post(path()+'/nodes',{title:'Internal injection',internalOnly:true})).status,403)
  const guestExport=await pass(guestEditor.get(path()+'/export'));assert.ok(!JSON.stringify(guestExport).includes(privateNote));assert.ok(guestExport.nodes.some(n=>n.id===visible.id))
  await pass(chief.patch('/api/v1/workspaces/ws_main/settings',{exportMinLevel:'admin'}))
  assert.equal((await guestEditor.get(path()+'/export')).status,403)
  assert.equal((await pass(guestEditor.get(path()))).canExport,false)
  const stranger=await server.person('synthetic-pegboard-1103@example.com','Unshared member');assert.equal((await stranger.get(path())).status,404)
 },{timeout:120000})
 it('restores exported canvas relationships and native task identity through the installation archive',async()=>{
  const before=await pass(chief.get(path())),download=await pass(chief.get(path()+'/export'))
  assert.deepEqual(download.nodes,before.nodes)
  const restored=await restoreCanvasInstallation(chief)
  try{
   const after=await pass(restored.worker.owner.get(path()))
   assert.deepEqual(after.nodes,before.nodes)
   assert.equal((await pass(restored.worker.owner.get(`/api/v1/tasks/${taskId}`))).title,'Reviewed launch brief')
   const inactiveGuest=await restored.worker.signIn(guest.email,guest.name,guest.id)
   assert.equal((await inactiveGuest.get(path())).status,404,'archives do not reactivate old project grants')
  }finally{await restored.stop()}
 },{timeout:240000})
})

describe('PEG-064 retained graph recovery', {concurrency:false},()=>{
 let worker,chief,member,outsider
 const pass=async promise=>{const response=await promise;assert.ok(response.status>=200&&response.status<300,JSON.stringify(response.body));return response.body}
 const preview=input=>pass(chief.post('/api/v1/recovery/preview',input))
 const apply=async input=>{const reviewed=await preview(input);return pass(chief.post('/api/v1/recovery/apply',{...input,token:reviewed.token}))}
 before(async()=>{
  worker=await startWorker();chief=worker.owner
  member=await worker.person('recovery-member@example.com','Recovery collaborator')
  outsider=await worker.person('recovery-outsider@example.com','Recovery outsider')
 },{timeout:120000})
 after(()=>worker?.stop())

 it('restores retained project, task and proof graphs while fencing stale review and erased content',async()=>{
  const p=await pass(chief.post('/api/v1/projects',{name:'Retained recovery project'})),q=await pass(chief.post('/api/v1/projects',{name:'Other task home'}))
  for(const project of [p,q])await pass(chief.post('/api/v1/grants',{objectType:'project',objectId:project.id,granteeId:member.id,level:'editor'}))
  const root=await pass(chief.post('/api/v1/tasks',{projectId:p.id,title:'One shared recovery task'}))
  await pass(chief.post(`/api/v1/tasks/${root.id}/projects`,{projectId:q.id}))
  const child=await pass(chief.post('/api/v1/tasks',{parentId:root.id,title:'Retained nested work'}))
  await pass(member.post(`/api/v1/tasks/${root.id}/comments`,{body:'Keep the original collaborator context'}))
  await pass(member.patch(`/api/v1/tasks/${root.id}`,{description:'Current human instructions',priority:'high'}))
  const independent=await pass(chief.post('/api/v1/tasks',{projectId:q.id,title:'Independent later work'}))
  const before=await pass(chief.get(`/api/v1/tasks/${root.id}`))
  await apply({type:'project',id:p.id,action:'archive'})
  assert.ok(!(await pass(chief.get('/api/v1/projects'))).projects.some(project=>project.id===p.id))
  assert.equal((await chief.get(`/api/v1/projects/${p.id}`)).status,200,'an archived project retains its direct authorized graph')
  await apply({type:'project',id:p.id,action:'restore'})
  assert.ok((await pass(chief.get('/api/v1/projects'))).projects.some(project=>project.id===p.id))

  await apply({type:'task',id:root.id,action:'trash'})
  for(const client of [chief,member])for(const id of [root.id,child.id])assert.equal((await client.get(`/api/v1/tasks/${id}`)).status,404)
  assert.ok(!(await pass(outsider.get('/api/v1/recovery'))).records.some(row=>row.object_id===root.id))
  const restoring={type:'task',id:root.id,action:'restore'},stale=await preview(restoring)
  assert.equal((await outsider.post('/api/v1/recovery/apply',{...restoring,token:stale.token})).status,404)
  await pass(member.patch(`/api/v1/tasks/${independent.id}`,{description:'Later independent human edit'}))
  assert.equal((await chief.post('/api/v1/recovery/apply',{...restoring,token:stale.token})).status,409)
  assert.equal((await chief.get(`/api/v1/tasks/${root.id}`)).status,404)
  await apply(restoring)
  const after=await pass(chief.get(`/api/v1/tasks/${root.id}`))
  assert.deepEqual(after.projects,before.projects)
  assert.deepEqual(after.comments,before.comments)
  assert.deepEqual(after.history,before.history)
  assert.equal(after.description,'Current human instructions');assert.equal(after.priority,'high')
  assert.equal((await pass(chief.get(`/api/v1/tasks/${child.id}`))).parentId,root.id)
  assert.equal((await pass(chief.get(`/api/v1/tasks/${independent.id}`))).description,'Later independent human edit')

  const bytes=proofDocument('Recovery retains the exact current proof bytes')
  const file=await pass(chief.post(`/api/v1/tasks/${root.id}/attachments?projectId=${p.id}&name=recovery.pdf`,bytes,{'content-type':'application/pdf'}))
  const proof=await pass(chief.post(`/api/v1/tasks/${root.id}/proofs`,{attachmentId:file.id}))
  const byteBefore=await pass(chief.get(`/api/v1/attachments/${file.id}`))
  await apply({type:'proof_version',id:proof.versionId,action:'trash'})
  assert.equal((await chief.get(`/api/v1/proofs/${proof.id}`)).status,404)
  assert.equal((await chief.get(`/api/v1/attachments/${file.id}`)).status,404)
  await apply({type:'proof_version',id:proof.versionId,action:'restore'})
  const restoredProof=await pass(chief.get(`/api/v1/proofs/${proof.id}`))
  assert.equal(restoredProof.versions.find(version=>version.id===proof.versionId).digest,proof.digest)
  assert.equal(await pass(chief.get(`/api/v1/attachments/${file.id}`)),byteBefore)

  const firstBrief=await pass(chief.post(`/api/v1/projects/${p.id}/brief`,{version:0,text:'Original production brief'}))
  await pass(member.post(`/api/v1/projects/${p.id}/brief`,{version:firstBrief.version,text:'Revised production brief'}))
  const comparison=await pass(chief.get(`/api/v1/projects/${p.id}/brief?fromVersion=1&toVersion=2`))
  assert.equal(comparison.comparison.from.text,'Original production brief');assert.equal(comparison.comparison.to.text,'Revised production brief')
  assert.equal((await outsider.post(`/api/v1/projects/${p.id}/brief/restore`,{version:2,fromVersion:1})).status,404)
  assert.equal((await chief.post(`/api/v1/projects/${p.id}/brief/restore`,{version:1,fromVersion:1})).status,409)
  const restoredBrief=await pass(chief.post(`/api/v1/projects/${p.id}/brief/restore`,{version:2,fromVersion:1}))
  assert.equal(restoredBrief.text,'Original production brief');assert.equal((await pass(chief.get(`/api/v1/projects/${p.id}/brief`))).versions.length,3)
  assert.equal((await pass(chief.get(`/api/v1/tasks/${independent.id}`))).description,'Later independent human edit')
  const erasedProject=await pass(chief.post('/api/v1/projects',{name:'Brief erasure project'}))
  await pass(chief.post(`/api/v1/projects/${erasedProject.id}/brief`,{version:0,text:'synthetic-pegboard-brief-erasure-1'}))
  const erasedField=await pass(chief.post(`/api/v1/projects/${erasedProject.id}/fields`,{key:'erased_field',label:'synthetic-pegboard-field-erasure-1',type:'text'}))
  const eraseProject=await pass(chief.post('/api/v1/data/erasure-preview',{type:'project',id:erasedProject.id}))
  await pass(chief.post('/api/v1/data/erase',{type:'project',id:erasedProject.id,token:eraseProject.token,confirm:true}))
  assert.equal((await chief.get(`/api/v1/projects/${erasedProject.id}/brief`)).status,404)
  assert.equal((await chief.get(`/api/v1/fields/${erasedField.id}/revisions`)).status,404)
  const marker='Recovery erased payload must never travel in metadata'
  const erased=await pass(chief.post('/api/v1/tasks',{projectId:p.id,title:'Reviewed irreversible removal',description:marker}))
  await apply({type:'task',id:erased.id,action:'trash'})
  const oldRestore=await preview({type:'task',id:erased.id,action:'restore'})
  await apply({type:'task',id:erased.id,action:'restore'})
  const erasure=await pass(chief.post('/api/v1/data/erasure-preview',{type:'task',id:erased.id}))
  await pass(chief.post('/api/v1/data/erase',{type:'task',id:erased.id,token:erasure.token,confirm:true}))
  assert.equal((await chief.post('/api/v1/recovery/apply',{type:'task',id:erased.id,action:'restore',token:oldRestore.token})).status,404)
  assert.equal((await chief.get(`/api/v1/tasks/${erased.id}`)).status,404)
  assert.ok(!(await pass(chief.get('/api/v1/recovery'))).records.some(row=>row.object_id===erased.id))
  const job=await pass(chief.post('/api/portability/exports',{}));let archive
  for(let count=0;count<100;count++){
   const progress=await pass(chief.post(`/api/portability/exports/${job.id}/advance`,{maxParts:16}))
   if(progress.phase==='complete'){archive=await pass(chief.get(`/api/portability/exports/${job.id}/download`));break}
  }
  assert.equal(typeof archive,'string','the public archive export completes')
  assert.ok(!archive.includes(marker),'recovery metadata cannot retain an erased content snapshot')
  assert.ok(!archive.includes('synthetic-pegboard-brief-erasure-1'),'project erasure removes every brief revision from archives')
  assert.ok(!archive.includes('synthetic-pegboard-field-erasure-1'),'project erasure removes every field revision from archives')
 })
 it('undoes unchanged bulk effects while preserving later human fields and independent approvals',async()=>{
  const project=await pass(chief.post('/api/v1/projects',{name:'Bulk production review'}))
  await pass(chief.post('/api/v1/grants',{objectType:'project',objectId:project.id,granteeId:member.id,level:'editor'}))
  const a=await pass(chief.post('/api/v1/tasks',{projectId:project.id,title:'Print launch cards',startDate:'2026-12-01',dueDate:'2026-12-10'}))
  const b=await pass(chief.post('/api/v1/tasks',{projectId:project.id,title:'Pack launch kits',startDate:'2026-12-01',dueDate:'2026-12-10'}))
  const input={taskIds:[a.id,b.id],patch:{ownerId:member.id,dueDate:'2026-12-15',priority:'high'}}
  assert.equal((await outsider.post('/api/v1/recovery/bulk/preview',input)).status,404)
  let plan=await pass(chief.post('/api/v1/recovery/bulk/preview',input))
  await pass(member.patch(`/api/v1/tasks/${a.id}`,{description:'A human note before the exact review'}))
  assert.equal((await chief.post('/api/v1/recovery/bulk/apply',{...input,token:plan.token})).status,409)
  plan=await pass(chief.post('/api/v1/recovery/bulk/preview',input))
  const applied=await pass(chief.post('/api/v1/recovery/bulk/apply',{...input,token:plan.token}))
  await pass(member.patch(`/api/v1/tasks/${b.id}`,{priority:'urgent',dueDate:'2026-12-16',description:'Keep the later packing instructions'}))
  const undoPath=`/api/v1/recovery/bulk/${applied.id}`
  assert.equal((await outsider.get(undoPath+'/undo-preview')).status,404)
  let undo=await pass(chief.get(undoPath+'/undo-preview'))
  assert.ok(undo.conflicts.some(effect=>effect.taskId===b.id&&effect.field==='priority'))
  assert.ok(undo.conflicts.some(effect=>effect.taskId===b.id&&effect.field==='due_date'))
  await pass(member.patch(`/api/v1/tasks/${a.id}`,{description:'Keep another later human instruction'}))
  assert.equal((await chief.post(undoPath+'/undo',{token:undo.token})).status,409)
  undo=await pass(chief.get(undoPath+'/undo-preview'))
  const result=await pass(chief.post(undoPath+'/undo',{token:undo.token}))
  assert.equal(result.conflicts.length,2)
  const restored=await pass(chief.get(`/api/v1/tasks/${a.id}`)),preserved=await pass(chief.get(`/api/v1/tasks/${b.id}`))
  assert.equal(restored.owner.id,chief.id);assert.equal(restored.dueDate,'2026-12-10');assert.equal(restored.priority,'normal');assert.equal(restored.description,'Keep another later human instruction')
  assert.equal(preserved.owner.id,chief.id);assert.equal(preserved.dueDate,'2026-12-16');assert.equal(preserved.priority,'urgent');assert.equal(preserved.description,'Keep the later packing instructions')
  assert.equal((await chief.post(undoPath+'/undo',{token:undo.token})).status,409)
  const approval=await pass(chief.post('/api/v1/tasks',{projectId:project.id,title:'Independent bulk sign-off',kind:'approval',ownerId:member.id}))
  const single={taskIds:[approval.id],patch:{priority:'high'}},singlePreview=await pass(chief.post('/api/v1/recovery/bulk/preview',single))
  const signoffBulk=await pass(chief.post('/api/v1/recovery/bulk/apply',{...single,token:singlePreview.token}))
  const signoff=await pass(chief.get(`/api/v1/tasks/${approval.id}/decision-preview`))
  await pass(chief.post(`/api/v1/tasks/${approval.id}/decision`,{revision:signoff.token,action:'approve',reason:'Independent approval after the bulk edit'}))
  const decisionBefore=await pass(chief.get(`/api/v1/tasks/${approval.id}/decision-preview`)),decisionUndo=await pass(chief.get(`/api/v1/recovery/bulk/${signoffBulk.id}/undo-preview`))
  assert.equal(decisionUndo.restored.length,0);assert.ok(decisionUndo.conflicts.every(effect=>effect.reason==='later_human_decision'))
  await pass(chief.post(`/api/v1/recovery/bulk/${signoffBulk.id}/undo`,{token:decisionUndo.token}))
  const decisionAfter=await pass(chief.get(`/api/v1/tasks/${approval.id}/decision-preview`))
  assert.equal(decisionAfter.state,'approved');assert.deepEqual(decisionAfter.decisions,decisionBefore.decisions)
  const erased=await pass(chief.post('/api/v1/data/erasure-preview',{type:'task',id:a.id}))
  await pass(chief.post('/api/v1/data/erase',{type:'task',id:a.id,token:erased.token,confirm:true}))
  assert.ok(!(await pass(chief.get('/api/v1/recovery/bulk'))).operations.some(operation=>operation.id===applied.id))
  assert.equal((await chief.get(undoPath+'/undo-preview')).status,404)
 })

 it('restores standalone attachment bytes and scope while fencing stale review, proof reuse and erasure',async()=>{
  const p=await pass(chief.post('/api/v1/projects',{name:'synthetic-pegboard-910'})),q=await pass(chief.post('/api/v1/projects',{name:'synthetic-pegboard-911'}))
  const reader=await pass(chief.post('/api/v1/grants',{objectType:'project',objectId:p.id,granteeId:member.id,level:'viewer'}))
  await pass(chief.post('/api/v1/grants',{objectType:'project',objectId:q.id,granteeId:member.id,level:'editor'}))
  const task=await pass(chief.post('/api/v1/tasks',{projectId:p.id,title:'synthetic-pegboard-912'}))
  await pass(chief.post(`/api/v1/tasks/${task.id}/projects`,{projectId:q.id}))
  const child=await pass(chief.post('/api/v1/tasks',{parentId:task.id,title:'synthetic-pegboard-913'}))
  const bytes=proofDocument('synthetic-pegboard-914'),file=await pass(chief.post(`/api/v1/tasks/${task.id}/attachments?projectId=${p.id}&name=synthetic-pegboard-914.pdf`,bytes,{'content-type':'application/pdf'}))
  const before=await pass(chief.get(`/api/v1/tasks/${task.id}`)),body=await pass(chief.get(`/api/v1/attachments/${file.id}`))
  const trash={type:'attachment',id:file.id,action:'trash'},restore={...trash,action:'restore'}
  assert.ok((await pass(chief.get('/api/v1/recovery'))).choices.some(choice=>choice.value==='attachment.'+file.id))
  assert.equal((await outsider.post('/api/v1/recovery/preview',trash)).status,404)
  assert.equal((await member.post('/api/v1/recovery/preview',trash)).status,403,'an editor in another home cannot change this file scope')
  await pass(chief.delete(`/api/v1/grants/${reader.id}`))
  const editor=await pass(chief.post('/api/v1/grants',{objectType:'project',objectId:p.id,granteeId:member.id,level:'editor'}))
  await apply(trash)
  assert.equal((await chief.get(`/api/v1/attachments/${file.id}`)).status,404)
  assert.ok(!(await pass(chief.get(`/api/v1/tasks/${task.id}`))).attachments.some(row=>row.id===file.id))
  assert.equal((await chief.post(`/api/v1/tasks/${task.id}/proofs`,{attachmentId:file.id})).status,404,'trash cannot become a readable proof')
  assert.ok(!(await pass(outsider.get('/api/v1/recovery'))).records.some(row=>row.object_id===file.id))
  await apply({type:'task',id:task.id,action:'trash'})
  const blocked=await preview(restore)
  assert.equal(blocked.canApply,false);assert.ok(blocked.conflicts.includes('task_in_trash'))
  assert.equal((await chief.post('/api/v1/recovery/apply',{...restore,token:blocked.token})).status,409)
  await apply({type:'task',id:task.id,action:'restore'})
  const stale=await preview(restore)
  await pass(member.patch(`/api/v1/tasks/${task.id}`,{description:'synthetic-pegboard-915'}))
  const later=await pass(chief.post(`/api/v1/tasks/${task.id}/attachments?projectId=${q.id}&name=synthetic-pegboard-916.txt`,'synthetic-pegboard-916',{'content-type':'text/plain'}))
  assert.equal((await chief.post('/api/v1/recovery/apply',{...restore,token:stale.token})).status,409)
  const revoked=await pass(member.post('/api/v1/recovery/preview',restore))
  await pass(chief.delete(`/api/v1/grants/${editor.id}`))
  assert.equal((await member.post('/api/v1/recovery/apply',{...restore,token:revoked.token})).status,404)
  assert.ok(!(await pass(member.get('/api/v1/recovery'))).records.some(row=>row.object_id===file.id))
  await apply(restore)
  const after=await pass(chief.get(`/api/v1/tasks/${task.id}`))
  assert.equal(await pass(chief.get(`/api/v1/attachments/${file.id}`)),body)
  assert.deepEqual(after.attachments.find(row=>row.id===file.id),before.attachments.find(row=>row.id===file.id))
  assert.deepEqual(after.projects,before.projects);assert.deepEqual(after.subtasks,before.subtasks)
  assert.equal((await pass(chief.get(`/api/v1/tasks/${child.id}`))).parentId,task.id)
  assert.equal(after.description,'synthetic-pegboard-915');assert.ok(after.attachments.some(row=>row.id===later.id))
  assert.equal((await member.get(`/api/v1/attachments/${file.id}`)).status,404,'restoration retains the original file scope')
  const proof=await pass(chief.post(`/api/v1/tasks/${task.id}/proofs`,{attachmentId:file.id}))
  assert.equal((await chief.post('/api/v1/recovery/preview',trash)).status,400,'proof-backed files use version recovery')
  assert.ok(!(await pass(chief.get('/api/v1/recovery'))).choices.some(choice=>choice.value==='attachment.'+file.id))
  await apply({type:'proof_version',id:proof.versionId,action:'trash'})
  assert.equal((await chief.post('/api/v1/recovery/preview',restore)).status,400,'attachment recovery cannot bypass a removed proof version')
  await apply({type:'proof_version',id:proof.versionId,action:'restore'})
  await apply({type:'attachment',id:later.id,action:'trash'})
  const erasedRestore=await preview({type:'attachment',id:later.id,action:'restore'})
  const erase=await pass(chief.post('/api/v1/data/erasure-preview',{type:'attachment',id:later.id}))
  await pass(chief.post('/api/v1/data/erase',{type:'attachment',id:later.id,token:erase.token,confirm:true}))
  assert.equal((await chief.get(`/api/v1/attachments/${later.id}`)).status,404)
  assert.equal((await chief.post('/api/v1/recovery/apply',{type:'attachment',id:later.id,action:'restore',token:erasedRestore.token})).status,404)
  assert.ok(!(await pass(chief.get('/api/v1/recovery'))).records.some(row=>row.object_id===later.id))
  const job=await pass(chief.post('/api/portability/exports',{}));let archive
  for(let count=0;count<100;count++){
   const progress=await pass(chief.post(`/api/portability/exports/${job.id}/advance`,{maxParts:16}))
   if(progress.phase==='complete'){archive=await pass(chief.get(`/api/portability/exports/${job.id}/download`));break}
  }
  assert.equal(typeof archive,'string')
  assert.ok(!archive.split('\n').filter(Boolean).map(line=>JSON.parse(line)).filter(record=>record.kind==='part').flatMap(record=>record.items).some(record=>record.kind==='row'&&record.table==='peg_attachments'&&record.row.id===later.id),'erased bytes are absent from installation archives')
 })

 it('restores a shared field revision as new history while retaining later values and refusing incompatible or stale restoration',async()=>{
  const p=await pass(chief.post('/api/v1/projects',{name:'Shared production definitions'})),q=await pass(chief.post('/api/v1/projects',{name:'Regional production definitions'}))
  for(const project of [p,q])await pass(chief.post('/api/v1/grants',{objectType:'project',objectId:project.id,granteeId:member.id,level:'editor'}))
  const field=await pass(chief.post(`/api/v1/projects/${p.id}/fields`,{key:'production_stage',label:'Original production stage',type:'single',options:'Retail'}));await pass(chief.post(`/api/v1/projects/${q.id}/fields/adopt`,{fieldId:field.id}))
  const t=await pass(chief.post('/api/v1/tasks',{projectId:p.id,title:'Preserve print commitments'}));await pass(chief.post(`/api/v1/tasks/${t.id}/fields`,{projectId:p.id,values:{production_stage:'Retail'}}))
  const change=await pass(chief.get(`/api/v1/fields/${field.id}/change-preview?label=Later%20production%20stage&options=Retail,Print`));await pass(chief.post(`/api/v1/fields/${field.id}/change`,{label:'Later production stage',options:'Retail,Print',previewRevision:change.token}))
  await pass(member.post(`/api/v1/tasks/${t.id}/fields`,{projectId:p.id,values:{production_stage:'Print'}}));await pass(member.patch(`/api/v1/tasks/${t.id}`,{description:'Preserve the later print schedule'}))
  const root=`/api/v1/fields/${field.id}/revisions`,input={fromVersion:1};assert.equal((await outsider.get(root)).status,404);assert.equal((await member.post(root+'/preview',input)).status,403)
  let preview=await pass(chief.post(root+'/preview',input));assert.equal(preview.canApply,false);assert.equal((await chief.post(root+'/restore',{...input,token:preview.token})).status,409)
  await pass(member.post(`/api/v1/tasks/${t.id}/fields`,{projectId:p.id,values:{production_stage:'Retail'}}));preview=await pass(chief.post(root+'/preview',input));assert.equal(preview.canApply,true)
  await pass(member.patch(`/api/v1/tasks/${t.id}`,{description:'Preserve this newer print schedule'}));assert.equal((await chief.post(root+'/restore',{...input,token:preview.token})).status,409)
  preview=await pass(chief.post(root+'/preview',input));await pass(chief.post(root+'/restore',{...input,token:preview.token}));const versions=await pass(chief.get(root));assert.equal(versions.versions.length,3);assert.equal(versions.current.label,'Original production stage');assert.equal(versions.versions[1].snapshot.label,'Later production stage');assert.equal((await pass(chief.get(`/api/v1/tasks/${t.id}`))).description,'Preserve this newer print schedule')
  for(const project of [p,q])assert.equal((await pass(chief.get(`/api/v1/projects/${project.id}`))).fields.find(f=>f.id===field.id).label,'Original production stage')
  assert.equal((await pass(chief.get(`/api/v1/tasks/${t.id}`))).projects[0].fields.find(f=>f.key==='production_stage').value,'Retail')
 })

 it('repairs only reviewed dangling dependencies while preserving live links and refusing a stale repair',async()=>{
  const p=await pass(chief.post('/api/v1/projects',{name:'Reviewed graph repair'})),gone=await pass(chief.post('/api/v1/tasks',{projectId:p.id,title:'Erased predecessor'})),live=await pass(chief.post('/api/v1/tasks',{projectId:p.id,title:'Retained predecessor'})),task=await pass(chief.post('/api/v1/tasks',{projectId:p.id,title:'Restore with current dependencies'}))
  for(const before of [gone,live])await pass(chief.post('/api/v1/dependencies',{predecessor:before.id,successor:task.id,type:'fs'}))
  const erase=await pass(chief.post('/api/v1/data/erasure-preview',{type:'task',id:gone.id}));await pass(chief.post('/api/v1/data/erase',{type:'task',id:gone.id,token:erase.token,confirm:true}));await apply({type:'task',id:task.id,action:'trash'})
  const input={type:'task',id:task.id,action:'restore'},blocked=await preview(input);assert.equal(blocked.canApply,false);assert.ok(blocked.conflicts.includes('missing_dependency'));assert.equal((await chief.post('/api/v1/recovery/apply',{...input,token:blocked.token})).status,409)
  const selected={...input,repair:'detach_missing_dependencies'};let reviewed=await preview(selected);assert.equal(reviewed.repairs.length,1);assert.equal(reviewed.canApply,true);assert.equal((await outsider.post('/api/v1/recovery/apply',{...selected,token:reviewed.token})).status,404)
  await pass(chief.patch(`/api/v1/tasks/${live.id}`,{description:'Keep newer predecessor instructions'}));assert.equal((await chief.post('/api/v1/recovery/apply',{...selected,token:reviewed.token})).status,409);reviewed=await preview(selected);const result=await pass(chief.post('/api/v1/recovery/apply',{...selected,token:reviewed.token}));assert.equal(result.repaired,1)
  const links=await pass(chief.get(`/api/v1/tasks/${task.id}/dependencies`));assert.equal(links.dependencies.length,1);assert.equal((await chief.get(`/api/v1/tasks/${gone.id}`)).status,404);assert.equal((await pass(chief.get(`/api/v1/tasks/${live.id}`))).description,'Keep newer predecessor instructions');assert.equal((await preview({...input,action:'trash'})).canApply,true)
 })

})

describe('Direct project duplication through reviewed public doors', { concurrency: false }, () => {
  let worker, human, creative, guest, source, brief, child, approval, bundle, ruleId, sourceGrant, observer, noticesBefore
  const call = async (promise, status = 200) => { const response = await promise; assert.equal(response.status, status, JSON.stringify(response.body)); return response.body }
  before(async () => {
    worker = await startWorker(); human = worker.owner
    creative = await worker.person('synthetic-pegboard-6101@example.com', 'Maya Production')
    guest = await worker.person('synthetic-pegboard-6102@example.com', 'Client reviewer', 'guest')
    source = await call(human.post('/api/v1/projects', { name: 'Austin spring campaign', startDate: '2026-06-01', dueDate: '2026-06-12' }))
    sourceGrant = await call(human.post('/api/v1/grants', { objectType: 'project', objectId: source.id, granteeId: creative.id, level: 'editor' }))
    await call(human.post('/api/v1/grants', { objectType: 'project', objectId: source.id, granteeId: guest.id, level: 'commenter' }))
    brief = await call(human.post('/api/v1/tasks', { projectId: source.id, title: 'Produce campaign creative', ownerId: creative.id, startDate: '2026-06-01', dueDate: '2026-06-05', estimateHours: 12, internalNotes: 'Private supplier negotiation' }))
    child = await call(human.post('/api/v1/tasks', { parentId: brief.id, title: 'Prepare print artwork', ownerId: creative.id, startDate: '2026-06-02', dueDate: '2026-06-03', estimateHours: 3 }))
    approval = await call(human.post('/api/v1/tasks', { projectId: source.id, title: 'Approve campaign artwork', kind: 'approval', ownerId: creative.id, startDate: '2026-06-08', dueDate: '2026-06-08' }))
    await call(human.post('/api/v1/dependencies', { predecessor: brief.id, successor: approval.id, type: 'fs' }))
    await call(human.post(`/api/v1/projects/${source.id}/fields`, { key: 'campaign_code', label: 'Campaign code', type: 'text' }))
    await call(human.post(`/api/v1/tasks/${brief.id}/fields`, { projectId: source.id, values: { campaign_code: 'Austin spring' } }))
    await call(human.post(`/api/v1/tasks/${brief.id}/comments`, { body: 'Source-only negotiation notes' }))
    const file = await call(human.post(`/api/v1/tasks/${brief.id}/attachments?name=synthetic-pegboard-6103.pdf`, proofDocument('Reviewed campaign artwork'), { 'content-type': 'application/pdf' }))
    const proof = await call(human.post(`/api/v1/tasks/${brief.id}/proofs`, { attachmentId: file.id }))
    const proofReview = await call(human.get(`/api/v1/proofs/${proof.id}/decision-preview`))
    await call(human.post(`/api/v1/proofs/${proof.id}/decisions`, { versionId: proof.versionId, token: proofReview.token, action: 'approve', reason: 'Regional artwork approved' }))
    assert.equal((await call(human.get(`/api/v1/proofs/${proof.id}`))).state, 'approve')
    const decision = await call(human.get(`/api/v1/tasks/${approval.id}/decision-preview`))
    await call(human.post(`/api/v1/tasks/${approval.id}/decision`, { revision: decision.token, action: 'approve', reason: 'Regional artwork approved' }))
    bundle = await call(human.post('/api/v1/workflow-bundles', { name: 'Campaign routing' }))
    await call(human.post(`/api/v1/workflow-bundles/${bundle.id}/versions`, { version: 1, key: 'priority', kind: 'rule', name: 'Production priority', priority: 'high' }))
    const activation = await call(human.post(`/api/v1/workflow-bundles/${bundle.id}/preview`, { projectIds: [source.id] }))
    await call(human.post(`/api/v1/workflow-bundles/${bundle.id}/adopt`, { projectIds: [source.id], keys: ['priority'], revision: activation.token }))
    ruleId = `${bundle.id}:priority`
    observer = await worker.person('synthetic-pegboard-6104@example.com', 'Campaign observer')
    await call(observer.post('/api/v1/access-requests', { targetId: source.id, level: 'viewer', message: 'Read campaign progress' }))
    const request = (await call(observer.get('/api/v1/access-requests'))).mine[0]
    const requestReview = await call(human.get(`/api/v1/access-requests/${request.id}`))
    await call(human.post(`/api/v1/access-requests/${request.id}/decision`, { decision: 'approve', level: 'viewer', scope: 'full', revision: requestReview.revision }))
    noticesBefore = (await call(observer.get('/api/v1/access-requests'))).notices
    assert.equal(noticesBefore.length, 1)
  }, { timeout: 120000 })
  after(() => worker?.stop())

  it('duplicates only selected work with fresh identities and provenance, concrete original or relative dates, and no copied approvals, private context or active authority', async () => {
    for (const selected of [false, true]) {
      const input = { name: selected ? 'Denver summer campaign' : 'Austin selected work', taskIds: selected ? [brief.id, child.id, approval.id] : [brief.id, child.id], includeAssignees: selected, dateMode: selected ? 'relative' : 'original', ...(selected ? { startDate: '2026-07-06', memberIds: [creative.id], ruleIds: [ruleId] } : {}) }
      const preview = await call(human.post(`/api/v1/projects/${source.id}/duplicate/preview`, input))
      assert.equal(preview.audience.visibility, 'private'); assert.ok(preview.capacity.some(row => row.addedHours > 0))
      const copied = await call(human.post(`/api/v1/projects/${source.id}/duplicate`, { ...input, revision: preview.token }))
      assert.deepEqual(await call(human.post(`/api/v1/projects/${source.id}/duplicate`, { ...input, revision: preview.token })), copied)
      assert.notEqual(copied.project.id, source.id); assert.equal(copied.project.visibility, 'private'); assert.equal(copied.tasks.length, input.taskIds.length)
      assert.deepEqual(new Set(copied.tasks.map(t => t.sourceId)), new Set(input.taskIds))
      for (const item of copied.tasks) {
        assert.ok(!input.taskIds.includes(item.id)); const row = await call(human.get(`/api/v1/tasks/${item.id}`)), original = await call(human.get(`/api/v1/tasks/${item.sourceId}`))
        assert.equal(row.title, original.title); assert.equal(row.owner.id, selected ? original.owner.id : human.id)
        assert.equal(row.startDate, selected ? ({ [brief.id]: '2026-07-06', [child.id]: '2026-07-07', [approval.id]: '2026-07-13' })[item.sourceId] : original.startDate)
        assert.equal(row.internalNotes, ''); assert.deepEqual(row.comments, []); assert.deepEqual(row.attachments, [])
        assert.equal(row.projects.length, 1); assert.equal(row.projects[0].id, copied.project.id)
        if (item.sourceId === child.id) assert.equal(row.parentId, copied.tasks.find(t => t.sourceId === brief.id).id)
        if (item.sourceId === approval.id) { const decision = await call(human.get(`/api/v1/tasks/${item.id}/decision-preview`)); assert.equal(decision.state, 'pending'); assert.deepEqual(decision.decisions, []); assert.equal(original.status, 'done') }
        if (item.sourceId === brief.id) assert.equal(row.projects[0].fields.find(f => f.key === 'campaign_code').value, 'Austin spring')
      }
      await call(creative.get(`/api/v1/projects/${copied.project.id}`), 404); await call(guest.get(`/api/v1/projects/${copied.project.id}`), 404)
      assert.equal((await call(human.get(`/api/v1/projects/${copied.project.id}/bundle-configuration`))).length, 0)
      if (selected) {
        assert.equal(copied.staged.length, 2); assert.ok(copied.staged.every(s => s.activated_at === null))
        const stageIds = copied.staged.map(s => s.id), review = await call(human.post(`/api/v1/projects/${copied.project.id}/duplicate-review/preview`, { stageIds }))
        assert.equal(review.members[0].id, creative.id); assert.equal(review.rules.length, 1)
        await call(human.post(`/api/v1/projects/${copied.project.id}/duplicate-review/activate`, { stageIds, revision: review.token }))
        assert.equal((await call(creative.get(`/api/v1/projects/${copied.project.id}`))).level, 'editor')
        await call(guest.get(`/api/v1/projects/${copied.project.id}`), 404)
        const configuration = await call(human.get(`/api/v1/projects/${copied.project.id}/bundle-configuration`))
        const active = configuration.find(c => c.kind === 'rule'); assert.ok(active.enabled)
        assert.equal((await call(human.get(`/api/v1/workflow-bundles/${active.bundle_id}`))).jobs.length, 0, 'activation sends no copied-task jobs or duplicate effects')
        const future = await call(human.post('/api/v1/tasks', { projectId: copied.project.id, title: 'New Denver print run' }))
        await call(human.post(`/api/v1/workflow-bundles/${active.bundle_id}/jobs/process`, {}))
        assert.equal((await call(human.get(`/api/v1/tasks/${future.id}`))).priority, 'high')
      } else assert.deepEqual(copied.staged, [])
      assert.deepEqual((await call(observer.get('/api/v1/access-requests'))).notices, noticesBefore, 'copying and activation produce no duplicated source decision notification')
    }
  })

  it('preserves approve-only, restricted and assignee memberships when their staged grants are explicitly activated', async () => {
    const approveOnly = await worker.person('synthetic-pegboard-6111@example.com', 'Limited reviewer')
    const restricted = await worker.person('synthetic-pegboard-6112@example.com', 'Comment-only producer')
    const assignee = await worker.person('synthetic-pegboard-6113@example.com', 'Assigned artwork producer')
    const expiresAt = Date.now() + 3600000
    for (const grant of [{ granteeId: approveOnly.id, scope: 'approve' }, { granteeId: restricted.id, scopes: ['read', 'comment'] }, { granteeId: assignee.id, scope: 'assignee' }]) await call(human.post('/api/v1/grants', { objectType: 'project', objectId: source.id, level: 'editor', expiresAt, ...grant }))
    await call(human.patch(`/api/v1/tasks/${brief.id}`, { ownerId: assignee.id }))
    const input = { name: 'Preserve scoped campaign memberships', taskIds: [brief.id, child.id, approval.id], includeAssignees: true, memberIds: [approveOnly.id, restricted.id, assignee.id] }
    const preview = await call(human.post(`/api/v1/projects/${source.id}/duplicate/preview`, input))
    const copy = await call(human.post(`/api/v1/projects/${source.id}/duplicate`, { ...input, revision: preview.token }))
    const stageIds = copy.staged.map(s => s.id), review = await call(human.post(`/api/v1/projects/${copy.project.id}/duplicate-review/preview`, { stageIds }))
    assert.ok(review.members.every(m => m.paths.every(p => p.expiresAt === expiresAt)))
    await call(human.post(`/api/v1/projects/${copy.project.id}/duplicate-review/activate`, { stageIds, revision: review.token }))
    const root = copy.tasks.find(t => t.sourceId === brief.id), nested = copy.tasks.find(t => t.sourceId === child.id), signoff = copy.tasks.find(t => t.sourceId === approval.id)
    await call(approveOnly.get(`/api/v1/tasks/${root.id}`))
    await call(approveOnly.patch(`/api/v1/tasks/${root.id}`, { title: 'Must not edit' }), 403)
    await call(approveOnly.post(`/api/v1/tasks/${root.id}/comments`, { body: 'Must not comment' }), 403)
    await call(restricted.get(`/api/v1/tasks/${root.id}`))
    await call(restricted.post(`/api/v1/tasks/${root.id}/comments`, { body: 'Permitted restricted comment' }))
    await call(restricted.patch(`/api/v1/tasks/${root.id}`, { title: 'Must not edit' }), 403)
    await call(assignee.get(`/api/v1/projects/${copy.project.id}`), 404)
    await call(assignee.patch(`/api/v1/tasks/${root.id}`, { description: 'Only the assigned artwork' }))
    await call(assignee.get(`/api/v1/tasks/${nested.id}`), 404)
    await call(assignee.get(`/api/v1/tasks/${signoff.id}`), 404)
  })

  it('refuses detached children, stale previews and revoked source membership at copy and activation time', async () => {
    await call(guest.post(`/api/v1/projects/${source.id}/duplicate/preview`, { taskIds: [brief.id] }), 403)
    await call(human.post(`/api/v1/projects/${source.id}/duplicate/preview`, { taskIds: [child.id] }), 400)
    const input = { name: 'Stale review must not copy', taskIds: [brief.id, child.id], memberIds: [creative.id], includeAssignees: true }
    let preview = await call(human.post(`/api/v1/projects/${source.id}/duplicate/preview`, input))
    await call(human.patch(`/api/v1/tasks/${brief.id}`, { description: 'Later reviewed creative direction' }))
    await call(human.post(`/api/v1/projects/${source.id}/duplicate`, { ...input, revision: preview.token }), 409)
    preview = await call(human.post(`/api/v1/projects/${source.id}/duplicate/preview`, input))
    const copy = await call(human.post(`/api/v1/projects/${source.id}/duplicate`, { ...input, revision: preview.token }))
    const stageIds = copy.staged.map(s => s.id), review = await call(human.post(`/api/v1/projects/${copy.project.id}/duplicate-review/preview`, { stageIds }))
    await call(human.post(`/api/v1/grants/${sourceGrant.id}/revoke`, {}))
    await call(human.post(`/api/v1/projects/${copy.project.id}/duplicate-review/activate`, { stageIds, revision: review.token }), 409)
    await call(creative.get(`/api/v1/projects/${copy.project.id}`), 404)
    const result = await call(human.get(`/api/v1/projects/${copy.project.id}/duplicate-result`)); assert.ok(result.staged.every(s => s.activated_at === null))
  })
})

 describe('Public API and MCP', {concurrency:false}, () => {
 let worker,root,peer,guest,webhookEdge
 before(async()=>{webhookEdge=await startWebhookEdge();worker=await startWorker({settings:{PEGBOARD_LOCAL_WEBHOOK_ORIGIN:webhookEdge.origin}});root=worker.owner;peer=await worker.person('api-member@example.com','API Member');guest=await worker.person('api-guest@example.com','API Guest','guest')},{timeout:120000})
 after(async()=>{await worker?.stop();await webhookEdge?.stop()})
 registerPublicApiTests({test:it,api:()=>({worker,root,peer,guest,webhookEdge})})
 })

describe('Approval routing custody', {concurrency:false},()=>{
 let worker,root,author,internal,external,delegate,stranger,agent
 const pass=async promise=>{const r=await promise;assert.equal(r.status,200,JSON.stringify(r.body));return r.body}
 before(async()=>{worker=await startWorker();root=worker.owner;author=await worker.person('synthetic-pegboard-7201@example.com','Creative author');internal=await worker.person('synthetic-pegboard-7202@example.com','Internal reviewer');external=await worker.person('synthetic-pegboard-7203@example.com','External reviewer','guest');delegate=await worker.person('synthetic-pegboard-7204@example.com','Review delegate','guest');stranger=await worker.person('synthetic-pegboard-7205@example.com','Uninvited reviewer');agent=await worker.person('synthetic-pegboard-7206@example.com','Review agent','agent')},{timeout:120000})
 after(()=>worker?.stop())
 const fixture=async(kind='proof')=>{
 const project=await pass(root.post('/api/v1/projects',{name:'Creative approval work'}))
 await pass(root.post('/api/v1/grants',{objectType:'project',objectId:project.id,granteeId:author.id,level:'editor'}))
 const task=await pass(root.post('/api/v1/tasks',{projectId:project.id,title:'Review creative work',ownerId:author.id,...(kind==='task'?{kind:'approval'}:{})}))
 for(const person of [internal,external,delegate])await pass(root.post('/api/v1/grants',{objectType:'task',objectId:task.id,granteeId:person.id,level:'viewer',scope:'approve'}))
 let subject=task.id,proof
 if(kind==='proof'){const f=await pass(root.post(`/api/v1/tasks/${task.id}/attachments?name=synthetic-pegboard-7207.pdf`,proofDocument('Reviewed PDF v1'),{'content-type':'application/pdf'}));proof=await pass(root.post(`/api/v1/tasks/${task.id}/proofs`,{attachmentId:f.id}));subject=proof.id}
 return {project,task,subject,proof,kind}
 }
 const configure=async(f,config)=>{const p=await pass(root.post(`/api/v1/approval-routing/${f.kind}/${f.subject}/preview`,config));return pass(root.post(`/api/v1/approval-routing/${f.kind}/${f.subject}`,{...config,token:p.token}))}
 const view=(person,route)=>pass(person.get('/api/v1/approvals/'+route.id))
 const decide=async(person,route,action='approve',stale)=>{const v=stale??await view(person,route);return person.post(`/api/v1/approvals/${route.id}/decision`,{token:v.token,version:v.version,action,reason:'Reviewed exact shared material'})}
 const share=async(route,recipient=external)=>{const v=await view(root,route);return pass(root.post(`/api/v1/approvals/${route.id}/share`,{recipientId:recipient.id,token:v.token,expiresAt:Date.now()+3600000}))}
 it('routes ordered proof stages with independent named humans, delegates, and binds expiring revoked links to the exact replacement bytes',async()=>{
 const f=await fixture(),route=await configure(f,{mode:'ordered',stages:[{name:'Internal review',people:[internal.id],quorum:1},{name:'Client review',people:[external.id],quorum:1}]})
 assert.equal((await view(external,route)).canDecide,false)
 assert.equal((await decide(external,route)).status,403)
 assert.equal((await stranger.get('/api/v1/approvals/'+route.id)).status,404)
 const link=await share(route)
 assert.equal((await stranger.get('/api/v1/proof-reviews/'+link.id)).status,404)
 assert.equal((await root.get('/api/v1/proof-reviews/'+link.id)).status,404,'a forwarded link does not impersonate its recipient')
 assert.equal((await pass(external.get('/api/v1/proof-reviews/'+link.id))).state,'pending')
 assert.ok((await external.get(`/api/v1/proof-reviews/${link.id}/material`)).body.includes('Reviewed PDF v1'))
 assert.equal((await external.get('/api/v1/projects/'+f.project.id)).status,404)
 assert.equal((await external.get('/api/v1/proofs/'+f.subject)).status,404,'ordinary proof listing cannot reveal unshared versions')
 const first=await pass(decide(internal,route));assert.equal(first.state,'pending')
 const stale=await view(external,route),management=await view(root,route)
 await pass(root.post(`/api/v1/approvals/${route.id}/change`,{token:management.token,action:'delegate',stage:1,from:external.id,to:delegate.id}))
 assert.equal((await external.get('/api/v1/proof-reviews/'+link.id)).status,404)
 assert.equal((await decide(external,route,'approve',stale)).status,403)
 const delegatedLink=await share(route,delegate),d=await view(delegate,route)
 await pass(delegate.post(`/api/v1/proof-reviews/${delegatedLink.id}/decision`,{token:d.token,version:d.version,action:'changes',reason:'Adjust the heading'}))
 assert.equal((await view(root,route)).state,'changes_requested')
 const votes=(await view(root,route)).votes;assert.deepEqual(votes.map(v=>[v.actor_id,v.action,v.version]),[[internal.id,'approve',f.proof.versionId],[delegate.id,'changes',f.proof.versionId]]);assert.ok(votes.every(v=>v.at>0))
 const file=await pass(root.post(`/api/v1/tasks/${f.task.id}/attachments?name=synthetic-pegboard-7208.pdf`,proofDocument('Reviewed PDF v2'),{'content-type':'application/pdf'}))
 const version=await pass(root.post(`/api/v1/proofs/${f.subject}/versions`,{attachmentId:file.id,currentVersion:f.proof.versionId}))
 assert.equal((await delegate.get('/api/v1/proof-reviews/'+delegatedLink.id)).status,404)
 assert.equal((await decide(delegate,route,'approve',d)).status,403)
 const next=await configure(f,{mode:'parallel',stages:[{name:'Client review',people:[external.id,delegate.id],quorum:2}]})
 const expires=await share(next),revoked=await share(next,delegate)
 await worker.sql(`UPDATE peg_approval_links SET expires_at=1 WHERE id='${expires.id}'`)
 assert.equal((await external.get('/api/v1/proof-reviews/'+expires.id)).status,404)
 await pass(root.post(`/api/v1/proof-reviews/${revoked.id}/revoke`,{}))
 assert.equal((await delegate.get('/api/v1/proof-reviews/'+revoked.id)).status,404)
 assert.equal((await view(root,next)).version,version.versionId)
 const old=await pass(root.get(`/api/v1/proofs/${f.subject}/decision-preview`))
 assert.equal((await root.post(`/api/v1/proofs/${f.subject}/decisions`,{token:old.token,versionId:version.versionId,action:'approve',reason:'Bypass'})).status,409)
 })
 it('requires quorum on an approval task, refuses current and prior owners and agents, and never lets the old decision door bypass named capability checks',async()=>{
 const f=await fixture('task')
 const bad={mode:'parallel',stages:[{name:'Review',people:[author.id],quorum:1}]}
 assert.equal((await root.post(`/api/v1/approval-routing/task/${f.subject}/preview`,bad)).status,403)
 await pass(root.patch(`/api/v1/tasks/${f.task.id}`,{ownerId:internal.id}))
 await pass(root.patch(`/api/v1/tasks/${f.task.id}`,{ownerId:author.id}))
 assert.equal((await root.post(`/api/v1/approval-routing/task/${f.subject}/preview`,{...bad,stages:[{name:'Review',people:[internal.id],quorum:1}]})).status,403,'prior owners cannot be nominated')
 const route=await configure(f,{mode:'parallel',stages:[{name:'Client quorum',people:[external.id,delegate.id],quorum:2}]})
 const wrong=await pass(root.get(`/api/v1/tasks/${f.task.id}/decision-preview`))
 assert.equal((await root.post(`/api/v1/tasks/${f.task.id}/decision`,{revision:wrong.token,action:'approve',reason:'Bypass'})).status,409)
 const first=await pass(decide(external,route));assert.equal(first.state,'pending');assert.equal((await pass(root.get(`/api/v1/tasks/${f.task.id}`))).status,'todo')
 assert.equal((await decide(external,route)).status,403,'one person cannot supply quorum twice')
 const second=await pass(decide(delegate,route));assert.equal(second.state,'approved');assert.equal((await pass(root.get(`/api/v1/tasks/${f.task.id}`))).status,'done')
 assert.equal((await view(root,route)).state,'approved');assert.deepEqual((await view(root,route)).votes.map(v=>v.actor_id),[external.id,delegate.id])
 await pass(author.patch(`/api/v1/tasks/${f.task.id}`,{description:'Replacement brief'}))
 assert.equal((await view(root,route)).state,'stale');assert.equal((await decide(delegate,route)).status,403)
 })
 it('sends a reviewed PDF-v2 reminder once through the mail seam without comments or an implicit approval and respects muted preferences',async()=>{
 const f=await fixture(),file=await pass(root.post(`/api/v1/tasks/${f.task.id}/attachments?name=synthetic-pegboard-7209.pdf`,proofDocument('Reviewed PDF v2 reminder'),{'content-type':'application/pdf'}))
 await pass(root.post(`/api/v1/proofs/${f.subject}/versions`,{attachmentId:file.id,currentVersion:f.proof.versionId}))
 await pass(root.post(`/api/v1/tasks/${f.task.id}/comments`,{body:'Hidden internal comment',internalOnly:true}))
 const route=await configure(f,{mode:'parallel',stages:[{name:'Client',people:[external.id,delegate.id],quorum:1}],reminderAt:Date.now()+600000}),link=await share(route),mutedLink=await share(route,delegate)
 assert.equal((await pass(root.post(`/api/v1/approvals/${route.id}/reminders`,{}))).sent,0)
 await pass(delegate.post('/api/v1/notices/readiness/preferences',{muted:true}))
 await worker.sql(`UPDATE peg_approval_routes SET reminder_at=1 WHERE id='${route.id}'`)
 assert.equal((await pass(root.post(`/api/v1/approvals/${route.id}/reminders`,{}))).sent,1)
 assert.equal((await pass(root.post(`/api/v1/approvals/${route.id}/reminders`,{}))).sent,0)
 const receipts=JSON.parse(await worker.sql(`SELECT link_id,state FROM peg_approval_reminders WHERE link_id IN ('${link.id}','${mutedLink.id}')`))[0].results
 assert.deepEqual(receipts.map(r=>r.link_id),[link.id]);assert.ok(receipts[0].state)
 const review=await pass(external.get('/api/v1/proof-reviews/'+link.id));assert.equal(review.material.version,2);assert.equal(review.state,'pending');assert.ok(!JSON.stringify(review).includes('Hidden internal comment'))
 })
})
