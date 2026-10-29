import assert from 'node:assert/strict'
import { restoreCanvasInstallation } from '../support/canvas-restore.mjs'

const pass=async(p,status=200)=>{const r=await p;assert.equal(r.status,status,JSON.stringify(r.body));return r.body}
const path=id=>`/api/v1/projects/${id}/rules`
const read=(client,id)=>pass(client.get(path(id)))
const audit=(client,rule,extra='')=>pass(client.get(`/api/v1/admin/audit?rule=${rule}&limit=500${extra}`)).then(r=>r.events)
const create=(client,projectId,name,extra={})=>pass(client.post(path(projectId),{name,trigger:'form',source:'task_start',offset:2,priority:'high',...extra}))
const activate=async(client,id)=>{const p=await pass(client.post(`/api/v1/rules/${id}/preview`,{}));return pass(client.post(`/api/v1/rules/${id}/activate`,{token:p.token}))}
const request=(client,projectId,n,extra={})=>pass(client.post(`/api/v1/projects/${projectId}/requests`,{title:`synthetic-pegboard-${n}`,requestKey:`synthetic-pegboard-${n}`,startDate:'2026-07-02',...extra}))
export { pass, path, read, audit, create, activate, request }

export function registerRuleAuditTests({test,context}){
 test('records exact local rule lifecycle and outcomes once through restart and replay, with redacted scoped append-only audit',async()=>{
  const w=context(),root=w.owner
  const member=await w.person(['synthetic-pegboard-5701','example.com'].join('@'),'synthetic-pegboard-5701')
  const project=await pass(root.post('/api/v1/projects',{name:'synthetic-pegboard-5702'}))
  await pass(root.post('/api/v1/grants',{objectType:'project',objectId:project.id,granteeId:member.id,level:'editor'}))
  const rule=await create(root,project.id,'synthetic-pegboard-5703',{actions:[{kind:'comment',value:'synthetic-pegboard-5704'}]})
  assert.deepEqual((await audit(root,rule.id)).map(e=>[e.action,e.actor_id,e.metadata.version]),[['rule.created',root.id,1]])
  const first=await activate(root,rule.id)
  const applied=await request(member,project.id,5705)
  let view=await read(root,project.id),run=view.runs.find(r=>r.task_id===applied.id)
  assert.equal(run.status,'applied');assert.ok(run.operation_id)
  let events=await audit(root,rule.id)
  assert.deepEqual(events.map(e=>e.action),['rule.created','rule.activated','rule.run_queued','rule.run_applied'])
  const queued=events[2],terminal=events[3]
  assert.equal(queued.actor_id,member.id);assert.equal(terminal.actor_id,root.id)
  for(const event of [queued,terminal]){
   assert.equal(event.metadata.ruleId,rule.id);assert.equal(event.metadata.version,1);assert.equal(event.metadata.activationId,first.activationId)
   assert.equal(event.metadata.runId,run.id);assert.equal(event.metadata.taskId,applied.id);assert.equal(event.metadata.triggerActorId,member.id);assert.equal(event.metadata.activatedById,root.id)
   assert.ok(Number.isSafeInteger(event.at)&&event.at>0)
  }
  assert.equal(terminal.result,'applied');assert.equal(terminal.metadata.operationId,run.operation_id);assert.equal(terminal.metadata.workCount,1)
  let task=await pass(root.get(`/api/v1/tasks/${applied.id}`));assert.equal(task.dueDate,'2026-07-04');assert.equal(task.priority,'high');assert.equal(task.comments.length,1)
  await w.restart();assert.equal((await request(member,project.id,5705)).id,applied.id)
  await pass(root.post(path(project.id)+'/process',{}));assert.deepEqual(await audit(root,rule.id),events)
  task=await pass(root.get(`/api/v1/tasks/${applied.id}`));assert.equal(task.comments.length,1)
  const noop=await request(member,project.id,5706,{startDate:null})
  run=(await read(root,project.id)).runs.find(r=>r.task_id===noop.id)
  assert.equal(run.status,'noop')
  const noops=await audit(root,rule.id,'&run='+run.id)
  assert.deepEqual(noops.map(e=>[e.action,e.result]),[['rule.run_queued','queued'],['rule.run_noop','noop']]);assert.equal(noops[1].metadata.outcome,'source_date_missing');assert.ok(!noops[1].metadata.operationId)
  assert.equal((await pass(root.get(`/api/v1/tasks/${noop.id}`))).comments.length,0)
  await pass(root.post(`/api/v1/rules/${rule.id}/deactivate`,{}))
  const disabled=await request(member,project.id,5707)
  run=(await read(root,project.id)).runs.find(r=>r.task_id===disabled.id)
  assert.equal(run.status,'pending');assert.equal(run.operation_id,null)
  const blocked=await audit(root,rule.id,'&run='+run.id)
  assert.deepEqual(blocked.map(e=>[e.action,e.result,e.metadata.outcome]),[['rule.run_blocked','blocked','inactive']])
  await pass(root.post(`/api/v1/rules/${rule.id}`,{name:'synthetic-pegboard-5708',version:1,trigger:'form',source:'task_start',offset:3}))
  const second=await activate(root,rule.id);assert.notEqual(second.activationId,first.activationId)
  const next=await request(member,project.id,5709)
  run=(await read(root,project.id)).runs.find(r=>r.task_id===next.id)
  assert.equal(run.version,2);assert.equal(run.activation_id,second.activationId);assert.equal((await pass(root.get(`/api/v1/tasks/${next.id}`))).dueDate,'2026-07-05')
  events=await audit(root,rule.id)
  assert.deepEqual(events.map(e=>e.action),['rule.created','rule.activated','rule.run_queued','rule.run_applied','rule.run_queued','rule.run_noop','rule.deactivated','rule.run_blocked','rule.edited','rule.activated','rule.run_queued','rule.run_applied'])
  assert.deepEqual((await audit(root,rule.id,'&activation='+second.activationId)).map(e=>e.metadata.version),[2,2,2])
  assert.deepEqual((await audit(root,rule.id,'&operation='+run.operation_id)).map(e=>e.metadata.runId),[run.id])
  await pass(root.patch(`/api/v1/tasks/${applied.id}`,{title:'synthetic-pegboard-5710'}))
  await pass(root.post(`/api/v1/rules/${rule.id}/deactivate`,{}))
  const after=await audit(root,rule.id);assert.deepEqual(after.slice(0,events.length),events)
  const exported=await pass(root.get(`/api/v1/admin/audit/export?rule=${rule.id}&limit=500`));assert.deepEqual(exported.events,after)
  for(const forbidden of [member.name,member.email,'synthetic-pegboard-5702','synthetic-pegboard-5703','synthetic-pegboard-5704','synthetic-pegboard-5708','synthetic-pegboard-5710'])assert.ok(!JSON.stringify(exported).includes(forbidden))
  assert.equal((await member.get(`/api/v1/admin/audit?rule=${rule.id}`)).status,403)
  assert.equal((await member.get(`/api/v1/admin/audit/export?rule=${rule.id}`)).status,403)
  for(const method of ['patch','delete'])assert.equal((await root[method](`/api/v1/admin/audit/${events[0].id}`,{})).status,404)
  await w.restart();await pass(root.post(path(project.id)+'/process',{}));assert.deepEqual(await audit(root,rule.id),after)
 },{timeout:180000})
 test('attributes background refusal to the former activating administrator and retains anonymized rule audit through native archive restore',async()=>{
  const w=context(),root=w.owner
  let admin=await w.person(['synthetic-pegboard-5711','example.com'].join('@'),'synthetic-pegboard-5711')
  await pass(root.post(`/api/v1/workspaces/ws_main/people/${admin.id}/account`,{role:'admin'}));admin=await w.signIn(admin.email,admin.name,admin.id)
  const project=await pass(root.post('/api/v1/projects',{name:'synthetic-pegboard-5712'}))
  const rule=await create(admin,project.id,'synthetic-pegboard-5713',{actions:[{kind:'comment',value:'synthetic-pegboard-5714'}]})
  const activation=await activate(admin,rule.id)
  const valid=await request(root,project.id,5715)
  assert.deepEqual((await pass(root.get(`/api/v1/tasks/${valid.id}`))).comments.map(c=>c.body),['synthetic-pegboard-5714'])
  await pass(root.post(`/api/v1/workspaces/ws_main/people/${admin.id}/account`,{status:'inactive'}))
  const refused=await request(root,project.id,5716)
  const run=(await read(root,project.id)).runs.find(r=>r.task_id===refused.id)
  assert.equal(run.status,'pending');assert.equal(run.outcome,'activating_admin_unavailable');assert.equal(run.operation_id,null)
  const events=await audit(root,rule.id),failure=events.find(e=>e.metadata.runId===run.id&&e.action==='rule.run_blocked')
  assert.equal(failure.actor_id,admin.id);assert.equal(failure.result,'blocked');assert.equal(failure.metadata.activationId,activation.activationId);assert.equal(failure.metadata.outcome,'activating_admin_unavailable');assert.equal(failure.metadata.triggerActorId,root.id)
  const task=await pass(root.get(`/api/v1/tasks/${refused.id}`));assert.equal(task.dueDate,null);assert.equal(task.priority,'normal');assert.deepEqual(task.comments,[])
  assert.equal((await admin.post(`/api/v1/rules/${rule.id}/activate`,{token:'synthetic-pegboard-5717'})).status,401)
  await w.restart();assert.equal((await request(root,project.id,5716)).id,refused.id);await pass(root.post(path(project.id)+'/process',{}));assert.deepEqual(await audit(root,rule.id),events)
  const preview=await pass(root.post('/api/v1/data/erasure-preview',{type:'person',id:admin.id}));assert.deepEqual(preview.blockers,[])
  const erased=await pass(root.post('/api/v1/data/erase',{type:'person',id:admin.id,token:preview.token,confirm:true}));assert.equal(erased.outcome,'partial');assert.ok(erased.retained.local_auth_material>0)
  assert.deepEqual((await pass(root.get(`/api/v1/tasks/${valid.id}`))).comments,[],'person erasure removes that actor’s comment content')
  await pass(root.post(`/api/v1/tasks/${valid.id}/comments`,{body:'synthetic-pegboard-5718'}))
  const anonymous=await audit(root,rule.id)
  for(const e of events){const row=anonymous.find(r=>r.id===e.id);assert.deepEqual({...row,actor:e.actor},e);if(row.actor_id===admin.id)assert.equal(row.actor,'Erased actor')}
  assert.ok(!JSON.stringify(anonymous).includes(admin.name)&&!JSON.stringify(anonymous).includes(admin.email))
  const copy=await restoreCanvasInstallation(root)
  try{
   assert.deepEqual(await audit(copy.worker.owner,rule.id),anonymous)
   await pass(copy.worker.owner.post(path(project.id)+'/process',{}));assert.deepEqual(await audit(copy.worker.owner,rule.id),anonymous)
   const restored=await read(copy.worker.owner,project.id);assert.ok(restored.rules.every(r=>!r.enabled&&!r.activation_id));assert.equal(restored.runs.find(r=>r.task_id===valid.id).status,'applied')
   assert.deepEqual((await pass(copy.worker.owner.get(`/api/v1/tasks/${valid.id}`))).comments.map(c=>c.body),['synthetic-pegboard-5718'],'native restore preserves the later comment without resurrecting erased rule content')
  }finally{await copy.stop()}
 },{timeout:240000})
}
