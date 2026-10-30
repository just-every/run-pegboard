import assert from 'node:assert/strict'
import { describe,it } from 'node:test'
import { startWorker } from '../support/worker.mjs'

export const ok=async(promise,status=200)=>{const r=await promise;assert.equal(r.status,status,JSON.stringify(r.body));return r.body}
const address=n=>'synthetic-pegboard-'+n+String.fromCharCode(64)+'example.test'
export async function seedPortfolioCapacity(w) {
 const owner=w.owner,designer=await w.person(address(7801),'Drew Designer'),alternate=await w.person(address(7802),'Alex Alternate'),unqualified=await w.person(address(7803),'Taylor Writer'),reviewer=await w.person(address(7804),'Riley Reviewer')
 const api='/api/v1/workspaces/ws_main',week=[null,...Array.from({length:5},()=>({start:540,end:1020})),null]
 for(const [p,skills] of [[designer,'design'],[alternate,'design'],[unqualified,'writing']])await ok(owner.post(api+'/capacity-profile',{personId:p.id,zone:'UTC',week,skills}))
 const portfolio=await ok(owner.post('/api/v1/portfolios',{name:'Thirty project capacity'})),child=await ok(owner.post('/api/v1/portfolios',{name:'Nested work',parentId:portfolio.id}))
 await ok(owner.post('/api/v1/portfolios/'+portfolio.id+'/members',{operatorId:reviewer.id,level:'viewer'}))
 const projects=[],reviewerGrants=[],alternateGrants=[]
 for(let i=0;i<30;i++){
  const project=await ok(owner.post('/api/v1/projects',{name:i===2?'Locked client commitment':'Capacity project '+(i+1),visibility:i<3?'private':'workspace'}));projects.push(project)
  await ok(owner.post('/api/v1/portfolios/'+(i<15?portfolio.id:child.id)+'/projects',{projectId:project.id}))
  if(i<3)for(const p of [designer,alternate,unqualified,reviewer]){
   const grant=await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:project.id,granteeId:p.id,level:'editor'}))
   if(p.id===reviewer.id)reviewerGrants.push(grant)
   if(p.id===alternate.id)alternateGrants.push(grant)
  }
 }
 const tasks=[]
 for(let i=0;i<3;i++){
  const task=await ok(owner.post('/api/v1/tasks',{projectId:projects[i].id,title:['Campaign design','Launch design','Locked artwork'][i],ownerId:designer.id,estimateHours:i===2?2:8,startDate:i===2?'2026-11-03':'2026-11-02',dueDate:i===2?'2026-11-03':'2026-11-02'}));tasks.push(task)
  await ok(owner.post('/api/v1/tasks/'+task.id+'/capacity-commitment',{skills:'design',locked:i===2}))
 }
 await ok(owner.post('/api/v1/tasks/'+tasks[0].id+'/projects',{projectId:projects[1].id}))
 const path='/api/v1/portfolios/'+portfolio.id+'/capacity',period={from:'2026-11-02',days:2}
 const input={...period,alternatives:[{taskId:tasks[0].id,personId:alternate.id},{taskId:tasks[1].id,personId:alternate.id}]}
 return {owner,designer,alternate,unqualified,reviewer,portfolio,child,projects,tasks,reviewerGrants,alternateGrants,api,path,period,input}
}
export function portfolioCapacityScenarios(){
 describe('Human portfolio capacity',{concurrency:false},()=>{
  it('compares sourced alternatives across thirty projects and fences attributable application, replay and selective undo',{timeout:240000},async()=>{
   const w=await startWorker()
   try{
    const f=await seedPortfolioCapacity(w),{owner,designer,alternate,unqualified,reviewer,portfolio,child,projects,tasks,path,input,api}=f
    const task=id=>ok(owner.get('/api/v1/tasks/'+id)),view=()=>ok(owner.get(path+'?from=2026-11-02&days=2')),compare=(client=reviewer,body=input)=>ok(client.post(path+'/compare',body))
    const before=await view()
    assert.equal(before.projectCount,30)
    assert.deepEqual(before.tasks.map(t=>t.id).sort(),tasks.map(t=>t.id).sort())
    assert.deepEqual(before.people.find(p=>p.id===designer.id).days.map(d=>[d.hours,d.availableHours]),[[16,8],[2,8]],'independent person-day workload counts shared work once')
    let plan=await compare()
    assert.equal(plan.kind,'human-scenarios');assert.deepEqual(plan.alternatives.map(a=>a.taskId),tasks.slice(0,2).map(t=>t.id))
    assert.deepEqual(plan.alternatives.map(a=>a.feasible),[true,true])
    for(const a of plan.alternatives){
     assert.equal(a.hours,8)
     assert.deepEqual(a.after.find(p=>p.id===designer.id).days.map(d=>d.hours),[8,2])
     assert.deepEqual(a.after.find(p=>p.id===alternate.id).days.map(d=>d.hours),[8,0])
     assert.ok(a.after.every(p=>p.days.every(d=>d.overloadHours===0)))
     assert.equal(a.start,'2026-11-02');assert.equal(a.due,'2026-11-02')
    }
    assert.deepEqual(plan.locked.map(t=>[t.id,t.ownerId,t.start,t.due]),[[tasks[2].id,designer.id,'2026-11-03','2026-11-03']])
    // A changed estimate invalidates even a restored value; no write occurs.
    await ok(owner.patch('/api/v1/tasks/'+tasks[0].id,{estimateHours:9}))
    await ok(reviewer.post(path+'/apply',{...input,choice:0,token:plan.token}),409)
    assert.equal((await task(tasks[0].id)).owner.id,designer.id)
    await ok(owner.patch('/api/v1/tasks/'+tasks[0].id,{estimateHours:8}))
    await ok(reviewer.post(path+'/apply',{...input,choice:0,token:plan.token}),409)
    // Shared-task access through another home cannot replace a revoked required grant.
    for(const [person,grant] of [[reviewer,f.reviewerGrants[0]],[alternate,f.alternateGrants[0]]]){
     plan=await compare()
     await ok(owner.delete('/api/v1/grants/'+grant.id))
     await ok(reviewer.post(path+'/apply',{...input,choice:0,token:plan.token}),409)
     assert.equal((await task(tasks[0].id)).owner.id,designer.id)
     assert.equal((await compare()).alternatives[0].feasible,false)
     Object.assign(grant,await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:projects[0].id,granteeId:person.id,level:'editor'})))
    }
    plan=await compare()
    const leave=await ok(alternate.post(api+'/time-off',{start:'2026-11-02',end:'2026-11-02'}))
    await ok(reviewer.post(path+'/apply',{...input,choice:0,token:plan.token}),409)
    const shortage=await compare()
    assert.equal(shortage.shortage,true);assert.ok(shortage.alternatives.every(a=>!a.feasible&&a.reasons.some(r=>r.includes('unavailable'))))
    await ok(reviewer.post(path+'/apply',{...input,choice:0,token:shortage.token}),409)
    await ok(alternate.delete(api+'/time-off/'+leave.id))
    // Spare hours outside a fixed task interval cannot replace its unavailable hour.
    await ok(owner.patch('/api/v1/tasks/'+tasks[0].id,{estimateHours:1,startDate:'2026-11-02T09:00:00Z',dueDate:'2026-11-02T10:00:00Z'}))
    plan=await compare()
    assert.equal(plan.alternatives[0].feasible,true)
    const partialLeave=await ok(alternate.post(api+'/time-off',{start:'2026-11-02T09:00:00Z',end:'2026-11-02T10:00:00Z'}))
    await ok(reviewer.post(path+'/apply',{...input,choice:0,token:plan.token}),409)
    const timed=await compare(),receiving=timed.alternatives[0].after.find(p=>p.id===alternate.id).days[0]
    assert.deepEqual([receiving.hours,receiving.availableHours,receiving.overloadHours,receiving.unavailableHours],[1,7,0,1])
    assert.equal(timed.alternatives[0].feasible,false)
    await ok(reviewer.post(path+'/apply',{...input,choice:0,token:timed.token}),409)
    assert.deepEqual([(await task(tasks[0].id)).owner.id,(await task(tasks[0].id)).startDate,(await task(tasks[0].id)).dueDate],[designer.id,'2026-11-02T09:00:00Z','2026-11-02T10:00:00Z'])
    await ok(owner.patch('/api/v1/tasks/'+tasks[0].id,{startDate:'2026-11-02T10:00:00Z',dueDate:'2026-11-02T11:00:00Z'}))
    assert.equal((await compare()).alternatives[0].feasible,true,'the adjacent available interval remains usable')
    await ok(alternate.delete(api+'/time-off/'+partialLeave.id))
    // The unchanged instant must also fit the review dates in the alternate's timezone.
    await ok(owner.patch('/api/v1/tasks/'+tasks[0].id,{startDate:'2026-11-02T20:00:00Z',dueDate:'2026-11-02T21:00:00Z'}))
    await ok(owner.post(api+'/capacity-profile',{personId:alternate.id,zone:'Pacific/Auckland',week:[null,...Array.from({length:5},()=>({start:540,end:1020})),null],skills:'design'}))
    const narrowInput={...input,days:1},narrow=await compare(reviewer,narrowInput)
    assert.equal(narrow.alternatives[0].feasible,false)
    assert.ok(narrow.alternatives[0].reasons.some(r=>r.includes('Limited context')))
    await ok(reviewer.post(path+'/apply',{...narrowInput,choice:0,token:narrow.token}),409)
    const local=await compare()
    assert.equal(local.alternatives[0].feasible,true)
    assert.deepEqual(local.alternatives[0].after.find(p=>p.id===alternate.id).days.map(d=>d.hours),[0,1])
    await ok(owner.post(api+'/capacity-profile',{personId:alternate.id,zone:'UTC',week:[null,...Array.from({length:5},()=>({start:540,end:1020})),null],skills:'design'}))
    await ok(owner.patch('/api/v1/tasks/'+tasks[0].id,{estimateHours:8,startDate:'2026-11-02',dueDate:'2026-11-02'}))
    const bad=await compare(reviewer,{...input,alternatives:[{taskId:tasks[0].id,personId:unqualified.id},{taskId:tasks[2].id,personId:alternate.id}]})
    assert.ok(bad.alternatives[0].reasons.some(r=>r.includes('skill')));assert.ok(bad.alternatives[1].reasons.some(r=>r.includes('locked')))
    await ok(reviewer.post(path+'/apply',{...input,alternatives:[{taskId:tasks[0].id,personId:unqualified.id},{taskId:tasks[2].id,personId:alternate.id}],choice:0,token:bad.token}),409)
    // Portfolio membership changes and current project authority are review inputs.
    plan=await compare()
    await ok(owner.post('/api/v1/portfolios/'+f.child.id+'/projects/'+projects[29].id+'/remove',{}))
    await ok(reviewer.post(path+'/apply',{...input,choice:0,token:plan.token}),409)
    await ok(owner.post('/api/v1/portfolios/'+f.child.id+'/projects',{projectId:projects[29].id}))
    plan=await compare()
    await ok(owner.delete('/api/v1/grants/'+f.reviewerGrants[2].id))
    await ok(reviewer.post(path+'/apply',{...input,choice:0,token:plan.token}),409)
    const limited=await ok(reviewer.get(path+'?from=2026-11-02&days=2'))
    assert.equal(limited.limited,true)
    for(const hidden of [projects[2].id,tasks[2].id,'Locked artwork','Locked client commitment'])assert.ok(!JSON.stringify(limited).includes(hidden))
    assert.ok((await compare()).alternatives.every(a=>!a.feasible))
    await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:projects[2].id,granteeId:reviewer.id,level:'editor'}))
    // A hidden commitment on the receiving person cannot be omitted from feasibility.
    const secret=await ok(owner.post('/api/v1/projects',{name:'Undisclosed work'}))
    const hidden=await ok(owner.post('/api/v1/tasks',{projectId:secret.id,title:'Undisclosed title',ownerId:alternate.id,estimateHours:1,startDate:'2026-11-02',dueDate:'2026-11-02'}))
    const hiddenPlan=await compare()
    assert.ok(!hiddenPlan.alternatives[0].feasible);assert.ok(!JSON.stringify(hiddenPlan).includes(hidden.id));assert.ok(!JSON.stringify(hiddenPlan).includes('Undisclosed title'))
    await ok(owner.patch('/api/v1/tasks/'+hidden.id,{status:'done'}))
    // Persist an explicit source allocation and prove the transfer preserves source identity.
    const effort={source:'native',sourceItem:'synthetic-pegboard-7800',sourceMode:'split',people:[{personId:designer.id,sourcePerson:'synthetic-pegboard-designer'}]}
    const mapped=await ok(owner.post('/api/v1/tasks/'+tasks[0].id+'/effort/preview',effort))
    await ok(owner.post('/api/v1/tasks/'+tasks[0].id+'/effort/apply',{...effort,token:mapped.token}))
    plan=await compare()
    await w.restart()
    const applied=await ok(reviewer.post(path+'/apply',{...input,choice:0,token:plan.token}))
    await w.restart()
    const replay=await ok(reviewer.post(path+'/apply',{...input,choice:0,token:plan.token}))
    assert.equal(replay.id,applied.id);assert.equal(replay.replayed,true)
    const actual=await task(tasks[0].id),locked=await task(tasks[2].id)
    assert.equal(actual.owner.id,alternate.id)
    assert.equal(actual.history.filter(h=>h.kind==='capacity.portfolio_applied').length,1)
    assert.equal(actual.history.find(h=>h.kind==='capacity.portfolio_applied').actor,reviewer.name)
    assert.deepEqual([actual.startDate,actual.dueDate],['2026-11-02','2026-11-02'])
    assert.deepEqual([locked.owner.id,locked.startDate,locked.dueDate],[designer.id,'2026-11-03','2026-11-03'])
    let verified=await view()
    assert.deepEqual(verified.people.find(p=>p.id===designer.id).days.map(d=>d.hours),[8,2])
    assert.deepEqual(verified.people.find(p=>p.id===alternate.id).days.map(d=>d.hours),[8,0],'completed hidden work is excluded from committed workload')
    assert.equal(verified.tasks.find(t=>t.id===tasks[0].id).allocations[0].sourcePerson,'synthetic-pegboard-designer')
    await ok(owner.delete('/api/v1/grants/'+f.reviewerGrants[0].id))
    await ok(reviewer.post(path+'/apply',{...input,choice:0,token:plan.token}),403)
    assert.equal((await task(tasks[0].id)).owner.id,alternate.id)
    assert.equal((await task(tasks[0].id)).history.filter(h=>h.kind==='capacity.portfolio_applied').length,1)
    await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:projects[0].id,granteeId:reviewer.id,level:'editor'}))
    await ok(owner.patch('/api/v1/tasks/'+tasks[0].id,{title:'Later human title',priority:'high',estimateHours:6,startDate:'2026-11-03',dueDate:'2026-11-03'}))
    let undo=await ok(reviewer.get(path+'/'+applied.id+'/undo-preview'));assert.ok(undo.canUndo)
    await ok(reviewer.post(path+'/'+applied.id+'/undo',{token:undo.token}))
    const restored=await task(tasks[0].id)
    assert.equal(restored.owner.id,designer.id);assert.equal(restored.title,'Later human title');assert.equal(restored.priority,'high')
    assert.deepEqual([restored.estimateHours,restored.startDate,restored.dueDate],[6,'2026-11-03','2026-11-03'],'selective undo retains later estimates and dates')
    assert.deepEqual((await view()).tasks.find(t=>t.id===tasks[0].id).allocations.map(a=>[a.personId,a.hours]),[[designer.id,8]])
    await ok(reviewer.post(path+'/apply',{...input,choice:0,token:plan.token}))
    assert.equal((await task(tasks[0].id)).owner.id,designer.id,'replay after undo never reapplies')
    await ok(owner.patch('/api/v1/tasks/'+tasks[0].id,{estimateHours:8,startDate:'2026-11-02',dueDate:'2026-11-02'}))
    plan=await compare();const second=await ok(reviewer.post(path+'/apply',{...input,choice:1,token:plan.token}))
    await ok(owner.patch('/api/v1/tasks/'+tasks[1].id,{ownerId:unqualified.id}))
    await ok(owner.patch('/api/v1/tasks/'+tasks[1].id,{ownerId:alternate.id}))
    undo=await ok(reviewer.get(path+'/'+second.id+'/undo-preview'))
    assert.equal(undo.canUndo,false)
    await ok(reviewer.post(path+'/'+second.id+'/undo',{token:undo.token}),409)
    assert.equal((await task(tasks[1].id)).owner.id,alternate.id,'even restored later assignment is retained')
    await ok(owner.patch('/api/v1/tasks/'+tasks[1].id,{ownerId:designer.id}))
    plan=await compare()
    const allocationApplication=await ok(reviewer.post(path+'/apply',{...input,choice:0,token:plan.token}))
    // Later human allocation edits stay protected even when their values are restored.
    for(const sourcePerson of ['synthetic-pegboard-edited','synthetic-pegboard-designer']){
     const edited={...effort,people:[{personId:alternate.id,sourcePerson}]}
     const preview=await ok(owner.post('/api/v1/tasks/'+tasks[0].id+'/effort/preview',edited))
     await ok(owner.post('/api/v1/tasks/'+tasks[0].id+'/effort/apply',{...edited,token:preview.token}))
    }
    undo=await ok(reviewer.get(path+'/'+allocationApplication.id+'/undo-preview'))
    assert.equal(undo.canUndo,false)
    await ok(reviewer.post(path+'/'+allocationApplication.id+'/undo',{token:undo.token}),409)
    assert.equal((await task(tasks[0].id)).owner.id,alternate.id)
    assert.deepEqual((await view()).tasks.find(t=>t.id===tasks[0].id).allocations.map(a=>[a.personId,a.hours,a.sourcePerson]),[[alternate.id,8,'synthetic-pegboard-designer']])
    // Reverting a staffing change must not silently reopen a later human sign-off.
    const approval=await ok(owner.post('/api/v1/tasks',{projectId:projects[0].id,title:'Staffing sign-off',kind:'approval',ownerId:designer.id,estimateHours:6,startDate:'2026-11-03',dueDate:'2026-11-03'}))
    await ok(owner.post('/api/v1/tasks/'+approval.id+'/capacity-commitment',{skills:'design'}))
    const approvalInput={from:'2026-11-03',days:1,alternatives:[{taskId:approval.id,personId:alternate.id},{taskId:approval.id,personId:unqualified.id}]}
    const staffing=await compare(reviewer,approvalInput)
    assert.equal(staffing.alternatives[0].feasible,true)
    const approvalOperation=await ok(reviewer.post(path+'/apply',{...approvalInput,choice:0,token:staffing.token}))
    const pendingUndo=await ok(reviewer.get(path+'/'+approvalOperation.id+'/undo-preview'))
    assert.equal(pendingUndo.canUndo,true)
    const decision=await ok(owner.get('/api/v1/tasks/'+approval.id+'/decision-preview'))
    await ok(owner.post('/api/v1/tasks/'+approval.id+'/decision',{action:'approve',revision:decision.token,reason:'Reviewed staffing sign-off'}))
    const approved=await task(approval.id),signed=await ok(owner.get('/api/v1/tasks/'+approval.id+'/decision-preview'))
    await ok(reviewer.post(path+'/'+approvalOperation.id+'/undo',{token:pendingUndo.token}),409)
    undo=await ok(reviewer.get(path+'/'+approvalOperation.id+'/undo-preview'))
    assert.equal(undo.canUndo,false)
    assert.ok(undo.reasons.includes('Later approval completion is preserved.'))
    await ok(reviewer.post(path+'/'+approvalOperation.id+'/undo',{token:undo.token}),409)
    await w.restart()
    assert.deepEqual(await task(approval.id),approved,'refused undo changes no task data or history across restart')
    assert.deepEqual(await ok(owner.get('/api/v1/tasks/'+approval.id+'/decision-preview')),signed,'refused undo preserves the exact signed decision')
    await ok(owner.patch('/api/v1/tasks/'+tasks[0].id,{ownerId:designer.id}))
    // Erasing a prior non-owner participant removes undo snapshots; replay cannot resurrect them.
    const sharedEffort={source:'native',sourceItem:'synthetic-pegboard-7805',sourceMode:'per-person',people:[{personId:designer.id,sourcePerson:'synthetic-pegboard-designer',hours:6},{personId:unqualified.id,sourcePerson:'synthetic-pegboard-writer',hours:2}]}
    const sharedPreview=await ok(owner.post('/api/v1/tasks/'+tasks[0].id+'/effort/preview',sharedEffort))
    await ok(owner.post('/api/v1/tasks/'+tasks[0].id+'/effort/apply',{...sharedEffort,token:sharedPreview.token}))
    plan=await compare()
    const beforeErasure=await ok(reviewer.post(path+'/apply',{...input,choice:0,token:plan.token}))
    const removal=await ok(owner.get(api+'/people/'+unqualified.id+'/removal-preview'))
    await ok(owner.call('DELETE',api+'/people/'+unqualified.id,{token:removal.token,confirm:true,choices:{}}))
    const erasure=await ok(owner.post('/api/v1/data/erasure-preview',{type:'person',id:unqualified.id}))
    assert.deepEqual(erasure.blockers,[]);assert.ok(erasure.counts.peg_capacity_applications>=1)
    await ok(owner.post('/api/v1/data/erase',{type:'person',id:unqualified.id,token:erasure.token,confirm:true}))
    await ok(reviewer.get(path+'/'+beforeErasure.id+'/undo-preview'),404)
    await ok(reviewer.post(path+'/apply',{...input,choice:0,token:plan.token}),400)
    assert.ok(!(await view()).tasks.find(t=>t.id===tasks[0].id).allocations.some(a=>a.personId===unqualified.id))
    const guest=await w.person(address(7810),'Guest','guest'),agent=await w.person(address(7811),'Agent','agent')
    await ok(guest.get(path),404);await ok(agent.post(path+'/compare',input),404)
   }finally{await w.stop()}
  })
 })
}
