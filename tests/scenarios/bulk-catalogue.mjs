import assert from 'node:assert/strict'
const ok=async(p,status=200)=>{const r=await p;assert.equal(r.status,status,JSON.stringify(r.body));return r.body}
const identity=n=>['synthetic-pegboard-'+n,'example.test'].join(String.fromCharCode(64))
export async function catalogueFixture(w){
 const root=w.owner,editor=await w.person(identity(3181),'Bulk editor'),viewer=await w.person(identity(3182),'Bulk viewer')
 const p=await ok(root.post('/api/v1/projects',{name:'Production tasks'})),destination=await ok(root.post('/api/v1/projects',{name:'Delivery tasks'})),privateProject=await ok(root.post('/api/v1/projects',{name:'Restricted production'}))
 await ok(root.post(`/api/v1/projects/${destination.id}/prefix`,{prefix:'BLK'}))
 const grants=[]
 for(const project of [p,destination])grants.push(await ok(root.post('/api/v1/grants',{objectType:'project',objectId:project.id,granteeId:editor.id,level:'editor'})))
 await ok(root.post('/api/v1/grants',{objectType:'project',objectId:p.id,granteeId:viewer.id,level:'viewer'}))
 const a=await ok(root.post('/api/v1/tasks',{projectId:p.id,title:'Pack campaign cards'})),b=await ok(root.post('/api/v1/tasks',{projectId:p.id,title:'Review delivery lists'})),hidden=await ok(root.post('/api/v1/tasks',{projectId:privateProject.id,title:'Hidden campaign commitments'})),approval=await ok(root.post('/api/v1/tasks',{projectId:p.id,title:'Release approval',kind:'approval',ownerId:editor.id}))
 await ok(root.post(`/api/v1/projects/${p.id}/fields`,{key:'boxes',label:'Boxes',type:'number'}))
 for(const task of [a,b])await ok(root.post(`/api/v1/tasks/${task.id}/fields`,{projectId:p.id,values:{boxes:1}}))
 return {root,editor,viewer,p,destination,grants,a,b,hidden,approval}
}
async function apply(client,input){const p=await ok(client.post('/api/v1/recovery/catalogue/preview',input));return ok(client.post('/api/v1/recovery/catalogue',{...input,reviewRows:p.reviewRows,token:p.token}))}
export async function bulkCatalogueScenario(w){
 const f=await catalogueFixture(w),{root,editor,viewer,p,destination,grants,a,b,hidden,approval}=f
 const status={taskIds:[a.id,approval.id,hidden.id,'synthetic-pegboard-3183'],patch:{status:'done'}},statusPlan=await ok(editor.post('/api/v1/recovery/bulk/selection-preview',status))
 assert.equal(statusPlan.rows.find(r=>r.id===a.id).outcome,'ready');assert.equal(statusPlan.rows.find(r=>r.id===approval.id).outcome,'blocked');assert.equal(statusPlan.rows.find(r=>r.id===hidden.id).reason,'Unavailable or not permitted')
 const completed=await ok(editor.post('/api/v1/recovery/bulk/selection-apply',{...status,reviewRows:statusPlan.reviewRows,token:statusPlan.token}));assert.equal((await ok(root.get(`/api/v1/tasks/${a.id}`))).status,'done');assert.equal((await ok(root.get(`/api/v1/tasks/${approval.id}`))).status,'todo')
 let undo=await ok(editor.get(`/api/v1/recovery/bulk/${completed.operationId}/undo-preview`));await ok(editor.post(`/api/v1/recovery/bulk/${completed.operationId}/undo`,{token:undo.token}));assert.equal((await ok(root.get(`/api/v1/tasks/${a.id}`))).status,'todo')
 const fields={action:'fields',taskIds:[a.id,b.id,hidden.id,'synthetic-pegboard-3183'],projectId:p.id,fieldKey:'boxes',fieldValue:5},plan=await ok(editor.post('/api/v1/recovery/catalogue/preview',fields))
 assert.deepEqual(plan.rows.filter(r=>r.outcome==='ready').map(r=>r.id).sort(),[a.id,b.id].sort());assert.deepEqual(plan.rows.filter(r=>r.outcome==='unavailable').map(r=>r.reason),['Unavailable or not permitted','Unavailable or not permitted'])
 const denied=await ok(viewer.post('/api/v1/recovery/catalogue/preview',{...fields,taskIds:[a.id]}));assert.equal(denied.rows[0].outcome,'forbidden');assert.equal(denied.canApply,false)
 await ok(root.post(`/api/v1/tasks/${a.id}/fields`,{projectId:p.id,values:{boxes:3}}))
 await ok(editor.post('/api/v1/recovery/catalogue',{...fields,reviewRows:plan.reviewRows,token:plan.token}),409)
 const refreshed=await ok(editor.post('/api/v1/recovery/catalogue/preview',{...fields,reviewRows:plan.reviewRows}));assert.equal(refreshed.rows.find(r=>r.id===a.id).outcome,'stale')
 const changed=await ok(editor.post('/api/v1/recovery/catalogue',{...fields,reviewRows:plan.reviewRows,token:refreshed.token}));assert.deepEqual((await ok(editor.get(`/api/v1/recovery/catalogue/${changed.id}`))).rows.filter(r=>r.outcome==='applied').map(r=>r.id),[b.id])
 await ok(root.patch(`/api/v1/tasks/${b.id}`,{description:'Keep independent packing notes'}))
 undo=await ok(editor.get(`/api/v1/recovery/catalogue/${changed.id}/undo-preview`));assert.deepEqual(undo.restored.map(r=>r.id),[b.id]);await ok(editor.post(`/api/v1/recovery/catalogue/${changed.id}/undo`,{token:undo.token}))
 let task=await ok(root.get(`/api/v1/tasks/${b.id}`));assert.equal(task.description,'Keep independent packing notes');assert.equal(task.projects[0].fields.find(f=>f.key==='boxes').value,1)
 const later=await apply(editor,{...fields,taskIds:[b.id]});await ok(root.post(`/api/v1/tasks/${b.id}/fields`,{projectId:p.id,values:{boxes:7}}));undo=await ok(editor.get(`/api/v1/recovery/catalogue/${later.id}/undo-preview`));assert.deepEqual(undo.restored,[]);assert.equal(undo.conflicts[0].reason,'later_field_edit');await ok(editor.post(`/api/v1/recovery/catalogue/${later.id}/undo`,{token:undo.token}));assert.equal((await ok(root.get(`/api/v1/tasks/${b.id}`))).projects[0].fields.find(f=>f.key==='boxes').value,7)
 const moved=await apply(editor,{action:'move',taskIds:[a.id,b.id],fromProjectId:p.id,projectId:destination.id});assert.deepEqual((await ok(root.get(`/api/v1/projects/${destination.id}`))).columns.flatMap(c=>c.tasks).map(t=>t.id).sort(),[a.id,b.id].sort())
 await ok(root.patch(`/api/v1/tasks/${b.id}`,{description:'Keep delivery instruction in the destination'}))
 undo=await ok(editor.get(`/api/v1/recovery/catalogue/${moved.id}/undo-preview`));assert.deepEqual(undo.restored.map(r=>r.id),[a.id]);assert.ok(undo.conflicts.some(r=>r.id===b.id));await ok(editor.post(`/api/v1/recovery/catalogue/${moved.id}/undo`,{token:undo.token}));assert.equal((await ok(root.get(`/api/v1/tasks/${a.id}`))).projects[0].id,p.id);assert.equal((await ok(root.get(`/api/v1/tasks/${b.id}`))).projects[0].id,destination.id)
 const copies=await apply(editor,{action:'duplicate',taskIds:[a.id,b.id,approval.id],projectId:destination.id}),receipt=await ok(editor.get(`/api/v1/recovery/catalogue/${copies.id}`)),copyIds=receipt.rows.map(r=>r.resultId),copied=[]
 for(const id of copyIds)copied.push(await ok(editor.get(`/api/v1/tasks/${id}`)))
 assert.equal(new Set(copied.map(t=>t.ref)).size,3);assert.ok(copied.every(t=>t.comments.length===0&&t.attachments.length===0));const fresh=copied.find(t=>t.kind==='approval');assert.equal((await ok(root.get(`/api/v1/tasks/${fresh.id}/decision-preview`))).state,'pending')
 await ok(root.post(`/api/v1/tasks/${copyIds[0]}/comments`,{body:'Keep new human work on this copy'}));undo=await ok(editor.get(`/api/v1/recovery/catalogue/${copies.id}/undo-preview`));assert.equal(undo.restored.length,2);await ok(editor.post(`/api/v1/recovery/catalogue/${copies.id}/undo`,{token:undo.token}));assert.equal((await editor.get(`/api/v1/tasks/${copyIds[0]}`)).status,200);for(const id of copyIds.slice(1))assert.equal((await editor.get(`/api/v1/tasks/${id}`)).status,404)
 const archived=await apply(editor,{action:'archive',taskIds:[a.id]});assert.equal((await editor.get(`/api/v1/tasks/${a.id}`)).status,404);undo=await ok(editor.get(`/api/v1/recovery/catalogue/${archived.id}/undo-preview`));await ok(editor.post(`/api/v1/recovery/catalogue/${archived.id}/undo`,{token:undo.token}));assert.equal((await editor.get(`/api/v1/tasks/${a.id}`)).status,200)
 const stale=await ok(editor.post('/api/v1/recovery/catalogue/preview',{action:'archive',taskIds:[a.id]}));await ok(root.post(`/api/v1/grants/${grants[0].id}/revoke`,{}));await ok(editor.post('/api/v1/recovery/catalogue',{action:'archive',taskIds:[a.id],reviewRows:stale.reviewRows,token:stale.token}),409);assert.equal((await root.get(`/api/v1/tasks/${a.id}`)).status,200)
 await w.restart();assert.equal((await ok(root.get(`/api/v1/tasks/${b.id}`))).description,'Keep delivery instruction in the destination')
 return f
}
