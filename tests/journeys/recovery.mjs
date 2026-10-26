import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {expect} from '@playwright/test'
import {proofDocument} from '../support/worker.mjs'
export async function recoveryJourney({w,browser,sizes,ok}) {
 for(const [size,viewport] of sizes) {
  const owner=w.owner,p=ok(await owner.post('/api/v1/projects',{name:`Autumn recovery campaign ${size}`})),task=ok(await owner.post('/api/v1/tasks',{projectId:p.id,title:`Restore print production ${size}`}))
  const member=await w.person(`recovery-journey-${size}@example.com`,'Maya Production')
  ok(await owner.post('/api/v1/grants',{objectType:'project',objectId:p.id,granteeId:member.id,level:'editor'}))
  const child=ok(await owner.post('/api/v1/tasks',{parentId:task.id,title:'Review final artwork'}))
  ok(await member.post(`/api/v1/tasks/${task.id}/comments`,{body:'Keep the final production notes'}))
  const file=ok(await owner.post(`/api/v1/tasks/${task.id}/attachments?projectId=${p.id}&name=production-proof.pdf`,proofDocument('Final artwork for production'),{'content-type':'application/pdf'}))
  const standalone=ok(await owner.post(`/api/v1/tasks/${task.id}/attachments?projectId=${p.id}&name=production-notes.txt`,'Retain the original production instructions',{'content-type':'text/plain'}))
  const standaloneBefore=ok(await owner.get(`/api/v1/tasks/${task.id}`)).attachments.find(row=>row.id===standalone.id)
  const version=ok(await owner.post(`/api/v1/tasks/${task.id}/proofs`,{attachmentId:file.id}))
  const context=await browser.newContext({viewport});await context.addCookies(owner.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:w.origin})))
  const page=await context.newPage()
  const proof=async name=>{assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name} reflows at ${size}`);assert.equal(await page.locator('button,a').evaluateAll(els=>els.filter(e=>!e.textContent.trim()&&e.querySelector('svg,img')).length),0);if(process.env.PEGBOARD_PROOF_DIR){await mkdir(process.env.PEGBOARD_PROOF_DIR,{recursive:true});await page.screenshot({path:join(process.env.PEGBOARD_PROOF_DIR,`recovery-${name}-${size}.jpg`),type:'jpeg',quality:65,fullPage:true})}}
  const restore=async label=>{await page.goto(`${w.origin}/app/recovery`);const row=page.getByRole('list',{name:'Retained work'}).locator('li').filter({hasText:label});await row.getByRole('link',{name:'Review restore'}).click();await proof('restore-preview');await page.getByRole('button',{name:'Restore reviewed work'}).click()}
  try {
   await page.goto(`${w.origin}/app/projects/${p.id}/settings`);await proof('settings');
   await page.getByRole('link',{name:'Project brief',exact:true}).click()
   await page.getByLabel('Brief text').fill('Original retail production brief. Preserve the approved print specification.');await page.getByRole('button',{name:'Save new revision'}).click()
   await page.getByLabel('Brief text').fill('Revised retail production brief. Add the later human production note.');await page.getByRole('button',{name:'Save new revision'}).click()
   const compare=page.getByRole('form',{name:'Compare brief revisions'});await compare.getByLabel('Earlier revision').selectOption('1');await compare.getByLabel('Later revision').selectOption('2');await compare.getByRole('button',{name:'Compare revisions'}).click();await proof('brief-compare')
   const restoreBrief=page.getByRole('form',{name:'Restore project brief revision'});await restoreBrief.getByLabel('Revision to restore').selectOption('1');await restoreBrief.getByRole('button',{name:'Restore as new revision'}).click();await expect(page.getByLabel('Brief text')).toHaveValue('Original retail production brief. Preserve the approved print specification.');await proof('brief-restored')
   await page.goto(`${w.origin}/app/projects/${p.id}/settings`);await page.getByRole('link',{name:'Review archive',exact:true}).click();await proof('archive-preview');await page.getByRole('button',{name:'Archive reviewed project'}).click();await proof('archived')
   assert.ok(!ok(await owner.get('/api/v1/projects')).projects.some(row=>row.id===p.id))
   await restore(p.name);assert.ok(ok(await owner.get('/api/v1/projects')).projects.some(row=>row.id===p.id));await proof('project-restored')
   await page.goto(`${w.origin}/app/tasks/${task.id}`);await proof('task');await page.getByRole('link',{name:'Review trash',exact:true}).click();await proof('trash-preview');await page.getByRole('button',{name:'Trash reviewed work'}).click();await proof('trashed-task')
   for(const id of [task.id,child.id])assert.equal((await owner.get(`/api/v1/tasks/${id}`)).status,404)
   const later=ok(await member.post('/api/v1/tasks',{projectId:p.id,title:'Later production adjustment'}));ok(await member.patch(`/api/v1/tasks/${later.id}`,{description:'Preserve later human edits'}))
   await restore(`Restore print production ${size}`);assert.equal(ok(await owner.get(`/api/v1/tasks/${later.id}`)).description,'Preserve later human edits')
   await page.goto(`${w.origin}/app/tasks/${task.id}`);await expect(page.locator('main')).toContainText('Keep the final production notes');await expect(page.getByRole('link',{name:'Review final artwork',exact:true})).toBeVisible();await proof('task-restored')
   await page.goto(`${w.origin}/app/recovery`);await page.getByLabel('Work to review').selectOption(`attachment.${standalone.id}`);await page.getByRole('button',{name:'Preview removal'}).click();await proof('attachment-trash-preview');await page.getByRole('button',{name:'Trash reviewed work'}).click();await proof('attachment-trashed')
   assert.equal((await owner.get(`/api/v1/attachments/${standalone.id}`)).status,404)
   await page.goto(`${w.origin}/app/tasks/${task.id}`);await expect(page.getByRole('link',{name:'production-notes.txt',exact:true})).toHaveCount(0);await proof('attachment-hidden')
   ok(await member.patch(`/api/v1/tasks/${task.id}`,{description:'Retain the later human production instructions'}))
   await restore(`production-notes.txt on Restore print production ${size}`);await proof('attachment-restored')
   const standaloneAfter=ok(await owner.get(`/api/v1/tasks/${task.id}`));assert.deepEqual(standaloneAfter.attachments.find(row=>row.id===standalone.id),standaloneBefore);assert.equal(standaloneAfter.description,'Retain the later human production instructions');assert.equal(ok(await owner.get(`/api/v1/attachments/${standalone.id}`)),'Retain the original production instructions')
   await page.goto(`${w.origin}/app/tasks/${task.id}`);await expect(page.getByRole('link',{name:'production-notes.txt',exact:true})).toBeVisible();await proof('attachment-task-restored')
   const bulkTask=ok(await owner.post('/api/v1/tasks',{projectId:p.id,title:`Pack retail launch kits ${size}`,dueDate:'2026-12-10'}))
   await page.goto(`${w.origin}/app/recovery/bulk`)
   let form=page.getByRole('form',{name:'Preview bulk change'});await form.getByLabel(`Pack retail launch kits ${size}`,{exact:true}).check();await form.getByLabel('New priority').selectOption('high');await form.getByLabel('New due date').fill('2026-12-15');await proof('bulk-form');await form.getByRole('button',{name:'Preview selected changes'}).click();await proof('bulk-preview');await page.getByRole('button',{name:'Apply reviewed changes'}).click()
   ok(await member.patch(`/api/v1/tasks/${bulkTask.id}`,{priority:'urgent',description:'Preserve the later packing instructions'}))
   await page.reload();await expect(page.getByRole('heading',{name:'Review undo',exact:true})).toBeVisible();await expect(page.locator('main')).toContainText('later field value');await proof('bulk-conflicts');await page.getByRole('button',{name:'Undo unchanged effects'}).click();await proof('bulk-undone')
   const bulkRestored=ok(await owner.get(`/api/v1/tasks/${bulkTask.id}`));assert.equal(bulkRestored.priority,'urgent');assert.equal(bulkRestored.dueDate,'2026-12-10');assert.equal(bulkRestored.description,'Preserve the later packing instructions')
   await page.goto(`${w.origin}/app/recovery`);await page.getByLabel('Work to review').selectOption(`proof_version.${version.versionId}`);await page.getByRole('button',{name:'Preview removal'}).click();await proof('proof-trash-preview');await page.getByRole('button',{name:'Trash reviewed work'}).click();assert.equal((await owner.get(`/api/v1/attachments/${file.id}`)).status,404);await proof('proof-trashed')
   await restore(`Version 1 on Restore print production ${size}`);const restored=ok(await owner.get(`/api/v1/proofs/${version.id}`));assert.equal(restored.versions[0].digest,version.digest);assert.equal((await owner.get(`/api/v1/attachments/${file.id}`)).status,200);await proof('proof-restored')
   const gone=ok(await owner.post('/api/v1/tasks',{projectId:p.id,title:`Erased recovery predecessor ${size}`})),repaired=ok(await owner.post('/api/v1/tasks',{projectId:p.id,title:`Reviewed dependency repair ${size}`}))
   for(const predecessor of [gone,bulkTask])ok(await owner.post('/api/v1/dependencies',{predecessor:predecessor.id,successor:repaired.id,type:'fs'}))
   const erase=ok(await owner.post('/api/v1/data/erasure-preview',{type:'task',id:gone.id}));ok(await owner.post('/api/v1/data/erase',{type:'task',id:gone.id,token:erase.token,confirm:true}))
   const removal={type:'task',id:repaired.id,action:'trash'},removalPreview=ok(await owner.post('/api/v1/recovery/preview',removal));ok(await owner.post('/api/v1/recovery/apply',{...removal,token:removalPreview.token}))
   await page.goto(`${w.origin}/app/recovery?type=task&id=${repaired.id}&action=restore`);await expect(page.getByRole('button',{name:'Restore reviewed work'})).toHaveCount(0);await proof('repair-conflict');await page.getByRole('button',{name:'Preview repaired restore'}).click();await proof('repair-preview');await page.getByRole('button',{name:'Restore reviewed work'}).click();assert.equal(ok(await owner.get(`/api/v1/tasks/${repaired.id}/dependencies`)).dependencies.length,1);await page.goto(`${w.origin}/app/tasks/${repaired.id}`);await proof('graph-repaired')

  } finally {await context.close()}
  console.log(`Recovery at ${size}px passed`)
 }
}
