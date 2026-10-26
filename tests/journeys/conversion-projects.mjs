import assert from 'node:assert/strict'
import {expect} from '@playwright/test'
import {proofDocument} from '../support/worker.mjs'

export async function projectConversionJourney({w,page,proof,size,ok,producer}){
 const root=w.owner,source=ok(await root.post('/api/v1/projects',{name:`Autumn campaign intake ${size}`}))
 ok(await root.post('/api/v1/grants',{objectType:'project',objectId:source.id,granteeId:producer.id,level:'editor'}))
 ok(await root.post(`/api/v1/projects/${source.id}/prefix`,{prefix:`INT${size}`}))
 const intake=ok(await root.post('/api/v1/tasks',{projectId:source.id,title:'Brisbane launch request',ownerId:producer.id,kind:'approval',startDate:'2026-11-02',dueDate:'2026-11-06',estimateHours:4}))
 const child=ok(await producer.post('/api/v1/tasks',{parentId:intake.id,title:'Prepare store launch assets',estimateHours:6,dueDate:'2026-11-04'}))
 ok(await producer.post('/api/v1/tasks',{parentId:child.id,title:'Check print-ready artwork',estimateHours:2}))
 ok(await producer.post(`/api/v1/tasks/${intake.id}/comments`,{body:'Launch brief confirmed with regional retail team.'}))
 const file=ok(await producer.post(`/api/v1/tasks/${intake.id}/attachments?projectId=${source.id}&name=launch-brief.pdf`,proofDocument('Brisbane launch brief'),{'content-type':'application/pdf'}))
 const review=ok(await root.post(`/api/v1/tasks/${intake.id}/proofs`,{attachmentId:file.id}))
 const oldRef=ok(await root.get(`/api/v1/tasks/${intake.id}`)).ref
 const decision=ok(await root.get(`/api/v1/proofs/${review.id}/decision-preview`));ok(await root.post(`/api/v1/proofs/${review.id}/decisions`,{versionId:review.versionId,token:decision.token,action:'approve',reason:'Original brief reviewed'}))
 const nextFile=ok(await root.post(`/api/v1/tasks/${intake.id}/attachments?projectId=${source.id}&name=launch-brief-v2.pdf`,proofDocument('Brisbane launch brief, regional revision'),{'content-type':'application/pdf'}))
 ok(await root.post(`/api/v1/proofs/${review.id}/versions`,{attachmentId:nextFile.id,currentVersion:review.versionId}))
 const predecessor=ok(await root.post('/api/v1/tasks',{projectId:source.id,title:'Confirm retail launch budget'}));ok(await root.post('/api/v1/dependencies',{predecessor:predecessor.id,successor:intake.id,type:'fs',lag:1}))
 ok(await root.post(`/api/v1/projects/${source.id}/prefix`,{prefix:`BRI${size}`}))
 ok(await root.patch(`/api/v1/tasks/${intake.id}`,{collaborators:[producer.id]}))
 ok(await root.post(`/api/v1/projects/${source.id}/fields`,{key:'campaign_budget',label:'Campaign budget',type:'number'}));ok(await root.post(`/api/v1/tasks/${intake.id}/fields`,{projectId:source.id,values:{campaign_budget:12000}}))
 const sheet=ok(await root.post('/api/v1/timesheets',{startDate:'2026-11-02',endDate:'2026-11-02'}))
 ok(await root.post(`/api/v1/timesheets/${sheet.id}/entries`,{taskId:intake.id,projectId:source.id,date:'2026-11-02',seconds:1800,key:`synthetic-pegboard-${size}`,notes:'Regional launch planning'}))
 await page.goto(`${w.origin}/app/tasks/${intake.id}`);await proof('intake-source')
 await page.getByRole('link',{name:'Convert to linked project',exact:true}).click();await proof('task-project-choices')
 let form=page.getByRole('form',{name:'Preview work conversion'});await form.getByLabel('New project name').fill(`Brisbane retail launch ${size}`);await form.getByRole('button',{name:'Preview conversion',exact:true}).click()
 await page.getByText('Inspect retained records',{exact:true}).click();await proof('task-project-review')
 await page.getByRole('form',{name:'Apply reviewed conversion'}).getByRole('button',{name:'Apply reviewed conversion',exact:true}).click();await page.waitForURL(/\/app\/conversions\/conversion_/);await proof('task-project-result')
 const conversionId=new URL(page.url()).pathname.split('/').at(-1),converted=ok(await root.get(`/api/v1/conversions/${conversionId}`))
 assert.equal(converted.reconciliation.timeSeconds,1800);assert.equal(converted.reconciliation.proofVersions,2);assert.equal(converted.reconciliation.dependencies,1);assert.equal(ok(await root.get(`/api/v1/refs/${oldRef}`)).id,intake.id)
 await page.goto(`${w.origin}/app/tasks/${oldRef}`);await expect(page.getByRole('heading',{name:'Linked conversions',exact:true})).toBeVisible();await proof('linked-intake')
 await page.goto(`${w.origin}/app/projects/${converted.projectId}`);await expect(page.getByRole('link',{name:'Prepare store launch assets',exact:true})).toBeVisible();await proof('converted-project')
 assert.equal(ok(await root.get(`/api/v1/proofs/${review.id}`)).state,'pending')

 const project=ok(await root.post('/api/v1/projects',{name:`Quarterly campaign delivery ${size}`}))
 const selected=ok(await root.post('/api/v1/tasks',{projectId:project.id,title:'Build campaign assets',estimateHours:12,dueDate:'2026-11-13'})),retained=ok(await root.post('/api/v1/tasks',{projectId:project.id,title:'Retain agency reporting',estimateHours:3}))
 ok(await root.post('/api/v1/tasks',{parentId:selected.id,title:'Approve hero photography',kind:'approval',ownerId:producer.id}))
 ok(await root.post(`/api/v1/tasks/${selected.id}/comments`,{body:'Keep original delivery notes attached to this work.'}))
 const bundle=ok(await root.post('/api/v1/workflow-bundles',{name:`Campaign routing context ${size}`})),bundlePath=`/api/v1/workflow-bundles/${bundle.id}`
 for(const component of [{key:'campaign_rule',kind:'rule',name:'Urgent campaign routing',priority:'urgent'},{key:'campaign_report',kind:'view',name:'Open campaign work',status:'todo'}]){const current=ok(await root.get(bundlePath));ok(await root.post(bundlePath+'/versions',{version:current.current.version,...component}))}
 const plan=ok(await root.post(bundlePath+'/preview',{projectIds:[project.id]}));ok(await root.post(bundlePath+'/adopt',{projectIds:[project.id],keys:['campaign_rule','campaign_report'],revision:plan.token}))
 await page.goto(`${w.origin}/app/projects/${project.id}`);await proof('project-source');await page.getByRole('link',{name:'Convert to linked parent task',exact:true}).click()
 form=page.getByRole('form',{name:'Preview work conversion'});await form.getByLabel('New parent task name').fill('Quarterly launch delivery');await form.getByLabel('Retain agency reporting',{exact:true}).selectOption('retain');await proof('project-task-mapping');await form.getByRole('button',{name:'Preview conversion',exact:true}).click();await proof('project-task-review')
 await page.getByRole('form',{name:'Apply reviewed conversion'}).getByRole('button',{name:'Apply reviewed conversion',exact:true}).click();await proof('project-task-result')
 const id=new URL(page.url()).pathname.split('/').at(-1),result=ok(await root.get(`/api/v1/conversions/${id}`))
 assert.equal(ok(await root.get(`/api/v1/tasks/${selected.id}`)).parentId,result.taskId);assert.equal(ok(await root.get(`/api/v1/tasks/${retained.id}`)).parentId,null)
 await page.goto(`${w.origin}/app/tasks/${result.taskId}`);await proof('converted-parent')
 ok(await root.patch(`/api/v1/tasks/${selected.id}`,{title:'Build campaign assets — regional revision'}))
 await page.goto(`${w.origin}/app/conversions/${id}`);await page.getByRole('link',{name:'Review undo',exact:true}).click();await proof('project-task-undo-review')
 await page.getByRole('form',{name:'Undo unchanged conversion effects'}).getByRole('button',{name:'Undo unchanged structure',exact:true}).click();await proof('project-task-undone')
 const restored=ok(await root.get(`/api/v1/tasks/${selected.id}`));assert.equal(restored.parentId,null);assert.equal(restored.title,'Build campaign assets — regional revision')
 await page.goto(`${w.origin}/app/projects/${project.id}`);await proof('project-task-restored')
 return {project}
}
