import assert from 'node:assert/strict'
import {expect} from '@playwright/test'
export async function projectDuplicateJourney({w,page,proof,size,ok,source,creative,reviewer}){
 const owner=w.owner
 ok(await owner.post('/api/v1/grants',{objectType:'project',objectId:source.id,granteeId:creative.id,level:'editor'}))
 const approval=source.tasks.find(t=>t.kind==='approval'),decision=ok(await owner.get(`/api/v1/tasks/${approval.id}/decision-preview`))
 ok(await owner.post(`/api/v1/tasks/${approval.id}/decision`,{revision:decision.token,action:'approve',reason:'Brisbane campaign assets approved'}))
 const root=source.tasks.find(t=>!t.parentId&&t.subtasks.length),child=source.tasks.find(t=>t.parentId===root.id)
 for(const include of [false,true]){
  await page.goto(`${w.origin}/app/projects/${source.id}/settings`);await page.getByRole('link',{name:'Duplicate project',exact:true}).click()
  let form=page.getByRole('form',{name:'Preview duplicate project'});await form.getByLabel('New project name').fill(`Brisbane ${include?'summer campaign':'creative subset'} ${size}`)
  for(const task of source.tasks)await form.locator(`input[name="taskIds[]"][value="${task.id}"]`).setChecked(include||[root.id,child.id].includes(task.id))
  if(include){
   await form.getByLabel('Keep current assignees').check();await form.getByLabel('Dates',{exact:true}).selectOption('relative');await form.getByLabel('New start date for relative dates').fill('2026-08-03')
   await form.getByText('Members to stage for a separate review',{exact:true}).click();await form.locator(`input[name="memberIds[]"][value="${creative.id}"]`).check()
   await form.getByText('Rules to stage for a separate review',{exact:true}).click();await form.locator('input[name="ruleIds[]"]').first().check()
  }
  await proof(include?'duplicate-selection':'duplicate-subset');await form.getByRole('button',{name:'Preview duplicate',exact:true}).click();await proof(include?'duplicate-relative-review':'duplicate-original-review')
  await page.getByRole('form',{name:'Create reviewed duplicate'}).getByRole('button',{name:'Create private duplicate'}).click();await page.waitForURL(/duplicate\?result=1/);await proof(include?'duplicate-staged-result':'duplicate-private-result')
  const id=new URL(page.url()).pathname.split('/')[3],result=ok(await owner.get(`/api/v1/projects/${id}/duplicate-result`))
  assert.ok(result.tasks.every(t=>!source.tasks.some(s=>s.id===t.id)));assert.equal((await creative.get(`/api/v1/projects/${id}`)).status,404)
  if(include){
   const newApproval=result.tasks.find(t=>t.sourceId===approval.id);assert.equal(ok(await owner.get(`/api/v1/tasks/${newApproval.id}/decision-preview`)).state,'pending')
   form=page.getByRole('form',{name:'Review staged activation'});for(const check of await form.locator('input[type="checkbox"]:not(:disabled)').all())await check.check();await form.getByRole('button',{name:'Review selected activation'}).click();await proof('duplicate-activation-review')
   await page.getByRole('form',{name:'Activate reviewed selections'}).getByRole('button',{name:'Activate reviewed selections',exact:true}).click();await proof('duplicate-activated-result')
   assert.equal(ok(await creative.get(`/api/v1/projects/${id}`)).level,'editor')
  }
 }
}
