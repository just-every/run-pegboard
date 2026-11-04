import assert from 'node:assert/strict'

export const pass = async (request, status = 200) => {
 const response = await request
 assert.equal(response.status, status, JSON.stringify(response.body))
 return response.body
}
const address = n => ['synthetic-pegboard-'+n, 'example.com'].join(String.fromCharCode(64))
export async function profileFixture(w) {
 const owner = w.owner
 const colleague = await w.person(address(6001), 'Profile colleague')
 const teammate = await w.person(address(6002), 'Profile teammate')
 const guest = await w.person(address(6003), 'Profile guest', 'guest')
 const agent = await w.person(address(6004), 'Profile agent', 'agent')
 const projects = []
 for (const name of ['Profile campaign', 'Profile launch', 'Confidential acquisition']) projects.push(await pass(owner.post('/api/v1/projects', {name})))
 const grant = (project, person, level = 'viewer') => pass(owner.post('/api/v1/grants', {objectType:'project',objectId:project.id,granteeId:person.id,level}))
 const colleagueGrants = [await grant(projects[0], colleague), await grant(projects[1], colleague)]
 const targetGrants = []
 for (const project of projects) targetGrants.push(await grant(project, teammate, 'editor'))
 await grant(projects[0], guest)
 const task = (title, extra = {}) => pass(owner.post('/api/v1/tasks', {title,projectId:projects[0].id,ownerId:teammate.id,...extra}))
 const shared = await task('Shared profile assignment', {estimateHours:4,startDate:'2026-03-09',dueDate:'2026-03-09'})
 await pass(owner.post('/api/v1/tasks/'+shared.id+'/projects', {projectId:projects[1].id}))
 await pass(owner.post('/api/v1/tasks/'+shared.id+'/projects', {projectId:projects[2].id}))
 const subtask = await task('Inherited profile subtask', {parentId:shared.id,projectId:undefined})
 const done = await task('Completed profile assignment', {status:'done'})
 const hidden = await task('Confidential assignment', {projectId:projects[2].id,estimateHours:777,startDate:'2026-03-09',dueDate:'2026-03-09'})
 const privateTask = await pass(teammate.post('/api/v1/tasks', {title:'Private no-project assignment',estimateHours:999,startDate:'2026-03-09',dueDate:'2026-03-09'}))
 const other = await task('Someone else owns this', {ownerId:owner.id})
 const workspace = await pass(owner.post('/api/v1/workspaces', {name:'Other profile workspace'}))
 const invited = await pass(owner.post('/api/v1/workspaces/'+workspace.id+'/people', {email:address(6005),displayName:'Outside workspace identity',role:'member'}))
 const outside = await w.signIn(address(6005), 'Outside workspace identity', invited.id)
 const week = [null, ...Array.from({length:5}, () => ({start:540,end:1020})), null]
 await pass(teammate.post('/api/v1/workspaces/ws_main/capacity-profile', {zone:'America/New_York',week}))
 await pass(teammate.post('/api/v1/workspaces/ws_main/time-off', {start:'2026-03-10',end:'2026-03-10'}))
 await pass(teammate.post('/api/v1/workspaces/ws_main/time-off', {zone:'America/New_York',localStart:'2026-03-11T09:00',localEnd:'2026-03-11T12:00'}))
 const path = '/api/v1/workspaces/ws_main/profiles/'+teammate.id+'?from=2026-03-09&days=7'
 return {owner,colleague,teammate,guest,agent,projects,colleagueGrants,targetGrants,shared,subtask,done,hidden,privateTask,other,workspace,outside,path,grant}
}
export function assertAssignments(view, f, projectIds = f.projects.slice(0,2).map(p=>p.id)) {
 assert.deepEqual(view.assignments.map(task=>task.id).sort(), [f.shared.id,f.subtask.id,f.done.id].sort())
 const shared = view.assignments.find(task=>task.id===f.shared.id)
 const subtask = view.assignments.find(task=>task.id===f.subtask.id)
 assert.deepEqual(shared.projects.map(project=>project.id).sort(), [...projectIds].sort())
 assert.deepEqual(subtask.projects.map(project=>project.id).sort(), [...projectIds].sort())
 assert.equal(subtask.parentId, f.shared.id)
 assert.equal(view.assignments.find(task=>task.id===f.done.id).status, 'done')
 const serialized = JSON.stringify(view)
 for (const forbidden of [f.hidden.id,f.privateTask.id,f.other.id,f.projects[2].id,'Confidential','Private no-project','internalNotes','email','baseRole','otherHours','overloadHours','unscheduledHours','taskCount','estimateHours']) assert.ok(!serialized.includes(forbidden), 'Profile excluded '+forbidden)
 assert.deepEqual(Object.keys(view.person).sort(), ['id','name'])
 assert.deepEqual(view.person, {id:f.teammate.id,name:'Profile teammate'})
}
export async function profileAssignmentsScenario(w) {
 const f = await profileFixture(w)
 const directory = await pass(f.colleague.get('/api/v1/workspaces/ws_main/profiles'))
 assert.deepEqual(directory.people.map(p=>p.id).sort(), [f.owner.id,f.colleague.id,f.teammate.id].sort())
 assert.ok(directory.people.every(p=>Object.keys(p).sort().join(',')==='id,name'))
 await pass(f.colleague.get('/api/v1/workspaces/ws_main/people'), 403)
 await pass(f.owner.get('/api/v1/workspaces/ws_main/people'))
 const view = await pass(f.colleague.get(f.path))
 assertAssignments(view, f)
 assert.deepEqual(view.availability, {zone:'America/New_York',from:'2026-03-09',days:[
  {date:'2026-03-09',availableHours:8,freshness:'current'},
  {date:'2026-03-10',availableHours:0,freshness:'current'},
  {date:'2026-03-11',availableHours:5,freshness:'current'},
  {date:'2026-03-12',availableHours:8,freshness:'current'},
  {date:'2026-03-13',availableHours:8,freshness:'current'},
  {date:'2026-03-14',availableHours:0,freshness:'current'},
  {date:'2026-03-15',availableHours:0,freshness:'current'}]})
 // Neither the owner nor the teammate may republish private no-project work here.
 for (const client of [f.owner,f.teammate]) assert.ok(!(await pass(client.get(f.path))).assignments.some(t=>t.id===f.privateTask.id))
 for (const client of [f.guest,f.agent,f.outside]) {
  await pass(client.get('/api/v1/workspaces/ws_main/profiles'), 404)
  await pass(client.get(f.path), 404)
 }
 for (const person of ['synthetic-pegboard-missing',f.outside.id,f.guest.id,f.agent.id]) await pass(f.colleague.get('/api/v1/workspaces/ws_main/profiles/'+person), 404)
 for (const workspace of [f.workspace.id,'synthetic-pegboard-missing']) await pass(f.colleague.get('/api/v1/workspaces/'+workspace+'/profiles/'+f.teammate.id), 404)
 await pass(f.colleague.post('/api/v1/grants', {objectType:'project',objectId:f.projects[2].id,granteeId:f.colleague.id,level:'viewer'}), 404)
 await pass(f.owner.delete('/api/v1/grants/'+f.colleagueGrants[1].id))
 assertAssignments(await pass(f.colleague.get(f.path)), f, [f.projects[0].id])
 await pass(f.owner.delete('/api/v1/grants/'+f.colleagueGrants[0].id))
 assert.deepEqual((await pass(f.colleague.get(f.path))).assignments, [])
 const renewed = await f.grant(f.projects[0],f.colleague)
 await pass(f.owner.delete('/api/v1/grants/'+f.targetGrants[0].id))
 await pass(f.owner.delete('/api/v1/grants/'+f.targetGrants[1].id))
 await pass(f.owner.delete('/api/v1/grants/'+f.targetGrants[2].id))
 assert.deepEqual((await pass(f.colleague.get(f.path))).assignments, [], 'An assignment does not restore target task access')
 await pass(f.owner.post('/api/v1/workspaces/ws_main/people/'+f.colleague.id+'/role', {role:'guest'}))
 await pass(f.colleague.get(f.path), 404)
 await pass(f.colleague.get('/api/v1/workspaces/ws_main/profiles'), 404)
 await pass(f.owner.post('/api/v1/workspaces/ws_main/people/'+f.colleague.id+'/role', {role:'member'}))
 await pass(f.owner.post('/api/v1/workspaces/ws_main/people/'+f.teammate.id+'/account', {status:'inactive'}))
 await pass(f.colleague.get(f.path), 404)
 assert.ok(!(await pass(f.colleague.get('/api/v1/workspaces/ws_main/profiles'))).people.some(p=>p.id===f.teammate.id))
 await w.restart()
 await pass(f.colleague.get(f.path), 404)
 await pass(f.owner.post('/api/v1/workspaces/ws_main/people/'+f.teammate.id+'/account', {status:'active'}))
 assert.deepEqual((await pass(f.colleague.get(f.path))).assignments, [])
 await pass(f.owner.post('/api/v1/workspaces/ws_main/people/'+f.colleague.id+'/account', {status:'inactive'}))
 await pass(f.colleague.get(f.path), 401)
 assert.ok(renewed.id)
 console.log('PROBE PEG-060 assignments: permitted task identities, shared-task deduplication, inherited subtasks and completed work -> exact IDs; private and hidden content excluded')
 console.log('PROBE PEG-060 authority: guest, agent, guessed and cross-workspace IDs, revoked grants, inactive actor and target, restart -> refused or no assignments; no grant created')
}
export async function profileAvailabilityScenario(w, services) {
 const f = await profileFixture(w)
 const feed = await pass(f.owner.post('/api/v1/workspaces/ws_main/capacity-feeds', {service:'willow',origin:'https://willow.example.com',mapping:{'synthetic-pegboard-6002':f.teammate.id}}))
 const read = () => pass(f.colleague.get(f.path))
 assert.ok((await read()).availability.days.every(day=>day.availableHours===null&&day.freshness==='unknown'))
 services.rows.willow.push({id:'synthetic-pegboard-6010',personId:'synthetic-pegboard-6002',startDate:'2026-03-11',endDate:'2026-03-11',status:'approved',reason:'Private medical reason'})
 const refresh = () => f.owner.post('/api/v1/workspaces/ws_main/capacity-feeds/'+feed.id+'/refresh', {credential:'synthetic-pegboard-1600',from:'2026-03-09',through:'2026-03-15'})
 await pass(refresh())
 const view = await read()
 assert.deepEqual(view.availability.days.map(day=>day.availableHours), [8,0,0,8,8,0,0], 'Overlapping self and approved leave is subtracted once')
 assert.ok(!JSON.stringify(view).includes('Private medical reason'))
 assert.ok(!JSON.stringify(view).includes(feed.id))
 assert.ok((await pass(f.colleague.get(f.path.replace('2026-03-09','2026-03-16')))).availability.days.every(day=>day.freshness==='unknown'&&day.availableHours===null))
 await w.sql(`UPDATE peg_capacity_feeds SET fetched_at=1 WHERE id='${feed.id}'`)
 assert.ok((await read()).availability.days.every(day=>day.availableHours===null))
 await pass(refresh())
 services.refused.add('willow')
 await pass(refresh(), 403)
 assert.ok((await read()).availability.days.every(day=>day.availableHours===null))
 services.refused.delete('willow')
 await pass(refresh())
 await pass(f.owner.post('/api/v1/workspaces/ws_main/capacity-feeds/'+feed.id+'/revoke', {}))
 await w.restart()
 assert.ok((await read()).availability.days.every(day=>day.freshness==='unknown'&&day.availableHours===null))
 console.log('PROBE PEG-060 availability: working week plus full and partial absence, overlapping approved leave -> [8,0,0,8,8,0,0]; stale, refused, uncovered or revoked source -> unknown without private reason')
}
