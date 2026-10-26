import assert from 'node:assert/strict'
import {expect} from '@playwright/test'

export async function templateGalleryJourney({w,page,proof,size,ok}){
 const owner=w.owner,creative=await w.person(`synthetic-pegboard-6301-${size}@example.com`,'Maya Creative'),reviewer=await w.person(`synthetic-pegboard-6302-${size}@example.com`,'Leo Review')
 const gallery=ok(await owner.get('/api/v1/templates')).templates.filter(t=>t.template.created_by==='gallery')
 await page.goto(`${w.origin}/app/projects`);await proof('projects');await page.getByRole('link',{name:'New project from a template',exact:true}).click();await proof('gallery')
 let source
 for(const entry of gallery){
  const name=`${entry.template.name} — Brisbane ${size}`
  await page.getByRole('link',{name:entry.template.name,exact:true}).click()
  let form=page.getByRole('form',{name:'Review template work'})
  await form.getByLabel('Project or work name').fill(name);await form.getByLabel('Start date',{exact:true}).fill('2026-07-02')
  for(const [i,role] of entry.definition.roles.entries())if(i!==2)await form.getByLabel(role,{exact:true}).selectOption(i===0?owner.id:creative.id)
  if(entry.template.family==='marketing'){
   await form.getByRole('button',{name:'Preview work and dates'}).click();await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByRole('form',{name:'Apply reviewed template'})).toHaveCount(0);await proof('missing-role')
   form=page.getByRole('form',{name:'Review template work'})
  }
  await form.getByLabel(entry.definition.roles[2],{exact:true}).selectOption(reviewer.id)
  await form.getByRole('button',{name:'Preview work and dates'}).click()
  await expect(page.getByRole('heading',{name:'Review concrete work',exact:true})).toBeVisible();await expect(page.locator('main')).toContainText('2026-07-06');await proof(`${entry.template.family}-preview`)
  await page.getByRole('form',{name:'Apply reviewed template'}).getByRole('button',{name:'Approve and create this exact work'}).click()
  await page.getByRole('link',{name,exact:true}).first().click();await page.waitForURL(/\/app\/projects\/prj_/);await proof(`${entry.template.family}-project`)
  const projectId=new URL(page.url()).pathname.split('/').pop(),application=ok(await owner.get(`/api/v1/projects/${projectId}/template-applications`)).applications[0]
  const tasks=await Promise.all(application.result.taskIds.map(async id=>ok(await owner.get(`/api/v1/tasks/${id}`))))
  const approval=tasks.find(t=>t.kind==='approval');await page.goto(`${w.origin}/app/tasks/${approval.id}`);await expect(page.locator('main')).toContainText(approval.title);await proof(`${entry.template.family}-approval`)
  assert.equal(ok(await owner.get(`/api/v1/tasks/${approval.id}/decision-preview`)).state,'pending')
  if(!source)source={id:projectId,name,application,tasks,entry}
  await page.goto(`${w.origin}/app/templates`)
 }
 // Author a reusable version from the actual gallery definition and instantiate it through the same review form.
 await page.getByRole('link',{name:source.entry.template.name,exact:true}).click()
 let form=page.getByRole('form',{name:'Save template definition'});await form.getByLabel('Template name',{exact:true}).fill(`Regional campaign standard ${size}`);await form.getByRole('button',{name:'Save new template',exact:true}).click()
 await page.getByRole('link',{name:`Regional campaign standard ${size}`,exact:true}).click();await proof('custom-definition')
 const customId=new URL(page.url()).searchParams.get('templateId')
 form=page.getByRole('form',{name:'Review template work'});await form.getByLabel('Project or work name').fill(`Regional standard application ${size}`);await form.getByLabel('Start date',{exact:true}).fill('2026-07-02')
 for(const [i,role]of source.entry.definition.roles.entries())await form.getByLabel(role,{exact:true}).selectOption([owner.id,creative.id,reviewer.id][i])
 await form.getByRole('button',{name:'Preview work and dates'}).click();await page.getByRole('form',{name:'Apply reviewed template'}).getByRole('button').click();await page.getByRole('link',{name:`Regional standard application ${size}`,exact:true}).first().click()
 const projectId=new URL(page.url()).pathname.split('/').pop(),application=ok(await owner.get(`/api/v1/projects/${projectId}/template-applications`)).applications[0]
 ok(await owner.patch(`/api/v1/tasks/${application.result.taskIds[1]}`,{title:'Human-owned regional audience research'}))
 await page.goto(`${w.origin}/app/templates?templateId=${customId}`)
 const next=structuredClone(source.entry.definition);next.tasks[0].title='Revised regional campaign brief';next.tasks[1].title='Updated audience research'
 form=page.getByRole('form',{name:'Save template definition'});await form.getByLabel('Template definition JSON').fill(JSON.stringify(next));await proof('version-author');await form.getByRole('button',{name:'Save immutable next version'}).click()
 assert.equal(ok(await owner.get(`/api/v1/tasks/${application.result.taskIds[0]}`)).title,source.entry.definition.tasks[0].title)
 await page.goto(`${w.origin}/app/templates?applicationId=${application.id}`);form=page.getByRole('form',{name:'Preview template update'});await form.getByLabel('New template version').fill('2');await form.getByRole('button',{name:'Preview version adoption'}).click()
 await expect(page.locator('main')).toContainText('Later human edit preserved');await proof('adoption-review');await page.getByRole('form',{name:'Adopt selected template changes'}).getByRole('button').click();await proof('adoption-result')
 assert.equal(ok(await owner.get(`/api/v1/tasks/${application.result.taskIds[0]}`)).title,'Revised regional campaign brief');assert.equal(ok(await owner.get(`/api/v1/tasks/${application.result.taskIds[1]}`)).title,'Human-owned regional audience research')
 // Capture both a project and one root task using named source selectors.
 for(const taskOnly of [false,true]){
  await page.goto(`${w.origin}/app/templates`);form=page.getByRole('form',{name:'Choose template source'});await form.getByLabel('Source project').selectOption(source.id);await form.getByRole('button',{name:'Choose source'}).click()
  form=page.getByRole('form',{name:'Preview reusable template'});if(taskOnly)await form.getByLabel('Source work').selectOption(source.tasks.find(t=>!t.parentId&&t.subtasks.length).id)
  await form.getByLabel('Template name',{exact:true}).fill(`${taskOnly?'Brief checklist':'Campaign structure'} ${size}`);await form.getByRole('button',{name:'Preview reusable structure'}).click();await proof(taskOnly?'task-capture-review':'project-capture-review');await page.getByRole('form',{name:'Save reviewed template'}).getByRole('button',{name:'Save this template'}).click();await proof(taskOnly?'task-captured':'project-captured')
 }
 await page.goto(`${w.origin}/app/templates?applicationId=${source.application.id}`);await page.getByRole('link',{name:'Review this rule',exact:true}).click();await proof('retained-rule-review');await page.getByRole('form',{name:'Activate reviewed rule'}).getByRole('button',{name:'Activate this exact rule'}).click();await proof('retained-rule-active')
 await page.goto(`${w.origin}/app/projects/${source.id}/settings`);await proof('project-settings')
 return {source,creative,reviewer,customId}
}
