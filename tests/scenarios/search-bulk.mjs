import assert from 'node:assert/strict'
const ok=async(p,status=200)=>{const r=await p;assert.equal(r.status,status,JSON.stringify(r.body));return r.body}
const identity=n=>['synthetic-pegboard-'+n,'example.test'].join(String.fromCharCode(64))
export async function searchBulkFixture(w){
 const root=w.owner,editor=await w.person(identity(3101),'Search editor'),guest=await w.person(identity(3102),'Search guest','guest')
 const p=await ok(root.post('/api/v1/projects',{name:'Approval archive'})),q=await ok(root.post('/api/v1/projects',{name:'Private research'})),read=await ok(root.post('/api/v1/projects',{name:'Read only work'}))
 const grant=await ok(root.post('/api/v1/grants',{objectType:'project',objectId:p.id,granteeId:editor.id,level:'editor'}))
 await ok(root.post('/api/v1/grants',{objectType:'project',objectId:read.id,granteeId:editor.id,level:'viewer'}))
 await ok(root.post('/api/v1/grants',{objectType:'project',objectId:p.id,granteeId:guest.id,level:'commenter'}))
 const create=(project,title,kind='task')=>ok(root.post('/api/v1/tasks',{projectId:project.id,title,kind,dueDate:'2026-12-10',ownerId:root.id}))
 const approval=await create(p,'Old print approval','approval'),later=await create(p,'Packing instructions'),stale=await create(p,'Concurrent production'),viewer=await create(read,'Read only approval','approval'),hidden=await create(q,'Hidden approval','approval')
 for(const t of [approval,later,stale,viewer,hidden])await ok(root.post(`/api/v1/tasks/${t.id}/comments`,{body:'synthetic-pegboard-310 archived approval note'}))
 await ok(root.post(`/api/v1/tasks/${later.id}/comments`,{body:'synthetic-pegboard-311 internal confidential comment',internalOnly:true}))
 await ok(root.post(`/api/v1/tasks/${approval.id}/projects`,{projectId:q.id}))
 await ok(root.post(`/api/v1/tasks/${approval.id}/attachments?projectId=${q.id}&name=synthetic-pegboard-312-hidden.txt`,'hidden metadata',{'content-type':'text/plain'}))
 await ok(root.post(`/api/v1/tasks/${approval.id}/attachments?projectId=${p.id}&name=synthetic-pegboard-313-permitted.txt`,'permitted metadata',{'content-type':'text/plain'}))
 return {root,editor,guest,p,q,read,grant,approval,later,stale,viewer,hidden}
}
export async function searchBulkScenario(w){
 const f=await searchBulkFixture(w),{root,editor,guest,p,grant,approval,later,stale,viewer,hidden}=f
 const search='/api/v1/search?q=synthetic-pegboard-310',result=await ok(editor.get(search)),expected=[approval.id,later.id,stale.id,viewer.id].sort()
 assert.deepEqual(result.results.map(r=>r.id).sort(),expected);assert.equal(result.count,4)
 assert.deepEqual((await ok(editor.get(search+'&kind=approval'))).results.map(r=>r.id).sort(),[approval.id,viewer.id].sort())
 assert.deepEqual((await ok(guest.get('/api/v1/search?q=synthetic-pegboard-311'))).results,[])
 for(const query of ['synthetic-pegboard-312','Hidden approval']){const r=await ok(editor.get('/api/v1/search?q='+query));assert.equal(r.count,0);assert.deepEqual(r.suggestions,[])}
 assert.deepEqual((await ok(editor.get('/api/v1/search?q=synthetic-pegboard-313'))).results.map(r=>r.id),[approval.id])
 await ok(root.post(`/api/v1/projects/${p.id}/brief`,{text:'synthetic-pegboard-314 current brief',version:0}))
 assert.deepEqual((await ok(editor.get('/api/v1/search?q=synthetic-pegboard-314&kind=brief'))).results.map(r=>r.id),[p.id])
 assert.deepEqual((await ok(editor.get('/api/v1/search?q=Approval%20archive&kind=project'))).results.map(r=>r.id),[p.id])
 const saved=await ok(editor.post('/api/v1/search/saved',{q:'synthetic-pegboard-310',kind:'approval',status:'todo',name:'Archived approvals'}))
 assert.equal((await ok(editor.get('/api/v1/search/saved'))).searches.find(r=>r.id===saved.id).filters.kind,'approval')
 assert.deepEqual((await ok(guest.get('/api/v1/search/saved'))).searches,[])
 // A mixed-home task cannot use one editor grant to change the other project's work.
 const input={taskIds:[approval.id,later.id,stale.id,viewer.id,hidden.id,'synthetic-pegboard-399'],patch:{priority:'high',dueDate:'2026-12-15'}}
 let plan=await ok(editor.post('/api/v1/recovery/bulk/selection-preview',input))
 assert.deepEqual(Object.fromEntries(plan.rows.map(r=>[r.id,r.outcome])),{[approval.id]:'forbidden',[later.id]:'ready',[stale.id]:'ready',[viewer.id]:'forbidden',[hidden.id]:'unavailable','synthetic-pegboard-399':'unavailable'})
 assert.deepEqual(plan.rows.find(r=>r.id===hidden.id),{id:hidden.id,outcome:'unavailable',reason:'Unavailable or not permitted',effects:[]})
 await ok(root.patch(`/api/v1/tasks/${stale.id}`,{priority:'urgent',description:'Keep this concurrent instruction'}))
 const old={...input,reviewRows:plan.reviewRows,token:plan.token}
 const failed=await ok(editor.post('/api/v1/recovery/bulk/selection-apply',old),409)
 assert.equal(failed.rows.find(r=>r.id===stale.id).outcome,'stale');assert.equal((await ok(root.get(`/api/v1/tasks/${later.id}`))).priority,'normal')
 plan=await ok(editor.post('/api/v1/recovery/bulk/selection-preview',old))
 assert.equal(plan.rows.find(r=>r.id===stale.id).outcome,'stale')
 const applied=await ok(editor.post('/api/v1/recovery/bulk/selection-apply',{...old,token:plan.token}))
 assert.equal(applied.outcomes.filter(r=>r.outcome==='applied').length,1)
 assert.equal((await ok(root.get(`/api/v1/tasks/${stale.id}`))).priority,'urgent');assert.equal((await ok(root.get(`/api/v1/tasks/${hidden.id}`))).priority,'normal')
 await ok(root.patch(`/api/v1/tasks/${later.id}`,{priority:'urgent',description:'Keep later human packing instructions'}))
 const undo=await ok(editor.get(`/api/v1/recovery/bulk/${applied.operationId}/undo-preview`))
 assert.deepEqual(undo.restored.map(e=>e.field),['due_date']);assert.deepEqual(undo.conflicts.map(e=>e.field),['priority'])
 await ok(editor.post(`/api/v1/recovery/bulk/${applied.operationId}/undo`,{token:undo.token}))
 const kept=await ok(root.get(`/api/v1/tasks/${later.id}`));assert.equal(kept.dueDate,'2026-12-10');assert.equal(kept.priority,'urgent');assert.equal(kept.description,'Keep later human packing instructions')
 await ok(root.post(`/api/v1/grants/${grant.id}/revoke`,{}))
 const after=await ok(editor.get(search));assert.deepEqual(after.results.map(r=>r.id),[viewer.id]);assert.equal(after.count,1);assert.deepEqual(after.suggestions.map(r=>r.id),[viewer.id])
 assert.deepEqual((await ok(editor.get('/api/v1/search/export?q=synthetic-pegboard-310'))).results.map(r=>r.id),[viewer.id])
 const receipt=await ok(editor.get(`/api/v1/recovery/bulk/receipts/${applied.id}`));assert.ok(!JSON.stringify(receipt).includes('Packing instructions'))
 assert.deepEqual((await ok(editor.get('/api/v1/search/saved'))).searches.map(r=>r.id),[saved.id])
 await w.restart();assert.equal((await ok(editor.get('/api/v1/search/saved'))).searches[0].id,saved.id)
 return f
}
