import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {expect} from '@playwright/test'
export async function workRulesJourney({w,page,proof:assertProof,size,ok}){
 const proof=async name=>{
  await assertProof(name)
  if(process.env.PEGBOARD_PROOF_DIR){
   await mkdir(process.env.PEGBOARD_PROOF_DIR,{recursive:true})
   const viewport=page.viewportSize()
   try{await page.setViewportSize({width:390,height:844});await page.screenshot({path:join(process.env.PEGBOARD_PROOF_DIR,`templates-${name}-390.jpg`),type:'jpeg',quality:75,fullPage:true})}
   finally{await page.setViewportSize(viewport)}
  }
 }
 const owner=w.owner,project=ok(await owner.post('/api/v1/projects',{name:`Regional design rules ${size}`})),designer=await w.person(`synthetic-pegboard-rule-${size}@example.com`,'Riley Designer')
 const target=ok(await owner.post('/api/v1/projects',{name:`Regional shared work ${size}`}))
 const tag=ok(await owner.post('/api/v1/tags',{projectId:project.id,name:`Design ready ${size}`,visibility:'project'}))
 ok(await owner.post('/api/v1/grants',{objectType:'project',objectId:target.id,granteeId:designer.id,level:'editor'}))
 ok(await owner.post('/api/v1/grants',{objectType:'project',objectId:project.id,granteeId:designer.id,level:'editor'}))
 await page.goto(`${w.origin}/app/projects/${project.id}/settings`);await proof('work-rules-settings');await page.getByRole('link',{name:'Conditional work rules',exact:true}).click()
 let form=page.getByRole('form',{name:'Create work rule'})
 await form.getByLabel('Rule name',{exact:true}).fill(`Design routing ${size}`)
 await form.getByLabel('Assign to',{exact:true}).selectOption(designer.id)
 await form.getByLabel('Set priority',{exact:true}).selectOption('high')
 await form.getByLabel('Due date source',{exact:true}).selectOption('task_start')
 await form.getByLabel('Date offset (negative moves earlier)',{exact:true}).fill('5')
 await form.getByLabel('Offset calendar',{exact:true}).selectOption('business_days')
 await form.getByText('Additional work actions',{exact:true}).click()
 await form.getByLabel('Complete an ordinary task (never an approval)').check()
 await form.getByLabel('Add comment',{exact:true}).fill('Production routing recorded.')
 await form.getByLabel('Add permitted collaborator',{exact:true}).selectOption(designer.id)
 await form.getByLabel('Add to project with the same reviewed audience',{exact:true}).selectOption(target.id)
 await form.getByLabel('Create subtask named',{exact:true}).fill('Prepare meeting agenda')
 await form.getByLabel('Add project tag',{exact:true}).selectOption(tag.id)
 await proof('work-rules-draft');await form.getByRole('button',{name:'Save rule draft',exact:true}).click()
 form=page.getByRole('form',{name:`Preview Design routing ${size}`});await form.getByLabel('Example source date').fill('2026-07-02');await form.getByRole('button',{name:'Preview activation'}).click()
 await expect(page.locator('main')).toContainText('2026-07-10');await expect(page.locator('main')).toContainText('US federal');await proof('work-rules-preview')
 await page.getByRole('form',{name:'Activate work rule'}).getByRole('button',{name:'Activate reviewed version'}).click();await proof('work-rules-activated')
 const t=ok(await owner.post('/api/v1/tasks',{projectId:project.id,title:'Austin launch artwork',startDate:'2026-07-02',dueDate:'2026-07-06'}))
 ok(await designer.patch(`/api/v1/tasks/${t.id}`,{status:'doing'}))
 await page.goto(`${w.origin}/app/projects/${project.id}/rules`);await expect(page.locator('main')).toContainText('Computed due 2026-07-10');await expect(page.locator('main')).toContainText('activated by Wes Holloway');await proof('work-rules-run')
 const applied=ok(await owner.get(`/api/v1/tasks/${t.id}`));assert.equal(applied.status,'done');assert.equal(applied.comments.length,1);assert.equal(applied.subtasks.length,1);assert.equal(applied.projects.length,2);assert.equal(applied.tags.length,1);assert.equal(applied.collaborators.length,1)
 await page.getByRole('link',{name:'Review scoped undo'}).click();await proof('work-rules-undo')
 const view=ok(await owner.get(`/api/v1/projects/${project.id}/rules`));assert.equal(view.runs.length,1);assert.equal(view.runs[0].status,'applied');assert.equal(view.runs[0].computed.ownerId,designer.id)

 // Configure the form and section triggers through the same Settings builder.
 await page.goto(`${w.origin}/app/projects/${project.id}/rules`)
 form=page.getByRole('form',{name:'Create work rule'});await form.getByLabel('Rule name',{exact:true}).fill(`Form intake ${size}`);await form.getByLabel('Trigger',{exact:true}).selectOption('form');await form.getByLabel('Assign to',{exact:true}).selectOption(designer.id);await form.getByLabel('Due date source',{exact:true}).selectOption('task_start');await form.getByLabel('Date offset (negative moves earlier)',{exact:true}).fill('5');await form.getByLabel('Offset calendar',{exact:true}).selectOption('business_days');await form.getByRole('button',{name:'Save rule draft',exact:true}).click()
 form=page.getByRole('form',{name:`Preview Form intake ${size}`});await form.getByLabel('Example source date').fill('2026-07-02');await form.getByRole('button',{name:'Preview activation'}).click();await proof('work-rules-form-preview');await page.getByRole('form',{name:'Activate work rule'}).getByRole('button',{name:'Activate reviewed version'}).click()
 await page.goto(`${w.origin}/app/projects/${project.id}/request`);await proof('work-rules-request');form=page.getByRole('form',{name:'Submit project request'});await form.getByLabel('Request title',{exact:true}).fill('San Diego retail artwork');await form.getByLabel('Requested start date',{exact:true}).fill('2026-07-02');await form.getByRole('button',{name:'Submit request',exact:true}).click();await proof('work-rules-request-created')
 const section=ok(await owner.post(`/api/v1/projects/${project.id}/sections`,{name:'Editorial preparation'}))
 await page.goto(`${w.origin}/app/projects/${project.id}/rules`);form=page.getByRole('form',{name:'Create work rule'});await form.getByLabel('Rule name',{exact:true}).fill(`Section routing ${size}`);await form.getByLabel('Trigger',{exact:true}).selectOption('section');await form.getByLabel('Matching section',{exact:true}).selectOption(section.id);await form.getByLabel('Assign to',{exact:true}).selectOption(owner.id);await form.getByLabel('Due date source',{exact:true}).selectOption('task_start');await form.getByLabel('Date offset (negative moves earlier)',{exact:true}).fill('2');await form.getByRole('button',{name:'Save rule draft',exact:true}).click()
 form=page.getByRole('form',{name:`Preview Section routing ${size}`});await form.getByLabel('Example source date').fill('2026-07-02');await form.getByRole('button',{name:'Preview activation'}).click();await proof('work-rules-section-preview');await page.getByRole('form',{name:'Activate work rule'}).getByRole('button',{name:'Activate reviewed version'}).click()
 const moved=ok(await owner.post('/api/v1/tasks',{projectId:project.id,title:'Denver editorial task',startDate:'2026-07-02'}));ok(await designer.post(`/api/v1/tasks/${moved.id}/section`,{projectId:project.id,sectionId:section.id}));assert.equal(ok(await owner.get(`/api/v1/tasks/${moved.id}`)).dueDate,'2026-07-04')
 await page.goto(`${w.origin}/app/projects/${project.id}/rules`);await expect(page.locator('main')).toContainText('Computed due 2026-07-04');await proof('work-rules-all-triggers')
 // An Editor can propose a rule, while configuration remains inaccessible.
 const context=page.context(),original=await context.cookies()
 await context.clearCookies();await context.addCookies(designer.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:w.origin})))
 await page.goto(`${w.origin}/app/projects/${project.id}/settings`);await expect(page.getByRole('link',{name:'Conditional work rules',exact:true})).toHaveCount(0);await page.getByRole('link',{name:'Ask your project Admin',exact:true}).click()
 await expect(page.locator('main')).toContainText('Wes Holloway');form=page.getByRole('form',{name:'Suggest a work rule'});await form.getByLabel('Rule suggestion').fill('Route new print reviews to the design team.');await form.getByRole('button',{name:'Submit suggestion'}).click();await expect(page.locator('main')).toContainText('submitted');await proof('work-rules-editor-suggestion')
 assert.equal((await designer.post(`/api/v1/projects/${project.id}/rules`,{name:'Disallowed'})).status,403)
 await context.clearCookies();await context.addCookies(original)
 await page.goto(`${w.origin}/app/projects/${project.id}/rule-suggestions`);await page.getByRole('button',{name:'Mark reviewed'}).click();await proof('work-rules-admin-response')
}
