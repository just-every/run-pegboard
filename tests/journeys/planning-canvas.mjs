import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { expect } from '@playwright/test'
import { restoreCanvasInstallation } from '../support/canvas-restore.mjs'

export async function planningCanvasJourney({w,browser,sizes,ok}) {
 const saved=[]
 const open=async(client,viewport)=>{
  const context=await browser.newContext({viewport})
  await context.addCookies(client.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:client.origin})))
  return {context,page:await context.newPage()}
 }
 const proof=async(page,name,size)=>{
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`canvas reflow ${name} ${size}`)
  const first=page.locator('main a,main button,main input:not([type=hidden]),main select').first();await first.focus();await page.keyboard.press('Tab')
  assert.ok(await page.evaluate(()=>document.activeElement!==document.body),'keyboard stays in the page')
  const icons=await page.locator('main button,main a').evaluateAll(elements=>elements.filter(e=>!e.textContent.trim()&&e.querySelector('svg,img')).map(e=>e.outerHTML))
  assert.deepEqual(icons,[],'canvas and List use text-labelled controls')
  if(process.env.PEGBOARD_PROOF_DIR){await mkdir(process.env.PEGBOARD_PROOF_DIR,{recursive:true});await page.screenshot({path:join(process.env.PEGBOARD_PROOF_DIR,`canvas-${name}-${size}.png`),fullPage:true})}
 }
 for(const [size,viewport] of sizes){
  const owner=w.owner,member=await w.person(`synthetic-pegboard-1201-${size}@example.com`,'Mia Alvarez'),guest=await w.person(`synthetic-pegboard-1202-${size}@example.com`,'Casey Client','guest')
  const project=ok(await owner.post('/api/v1/projects',{name:`Austin spring campaign ${size}`,description:'Launch planning for the March retail campaign.'}))
  const grant=ok(await owner.post('/api/v1/grants',{objectType:'project',objectId:project.id,granteeId:guest.id,level:'viewer'}))
  ok(await owner.post('/api/v1/grants',{objectType:'project',objectId:project.id,granteeId:member.id,level:'editor'}))
  const api=`/api/v1/projects/${project.id}/canvas`,here=`${w.origin}/app/projects/${project.id}/canvas`
  const phase=ok(await owner.post(api+'/nodes',{title:'Creative preparation',kind:'phase'})),launch=ok(await member.post(api+'/nodes',{title:'Launch week',kind:'phase',position:2}))
  const note=ok(await member.post(api+'/nodes',{title:'Prepare launch brief',parentId:phase.id,position:1})),secret=ok(await owner.post(api+'/nodes',{title:'Internal supplier margin',internalOnly:true,parentId:phase.id}))
  const own=await open(owner,viewport),mia=await open(member,viewport),client=await open(guest,viewport)
  try{
   await own.page.goto(`${w.origin}/app/projects/${project.id}`);await proof(own.page,'project-path',size)
   await own.page.getByRole('link',{name:'Planning canvas',exact:true}).click()
   await mia.page.goto(here)
   await own.page.locator(`[data-canvas-node="${note.id}"] [data-canvas-select]`).first().click()
   let form=own.page.getByRole('form',{name:'Edit planning item',exact:true})
   await form.getByLabel('Parent branch').selectOption(launch.id);await form.getByLabel('Position within branch').fill('1');await form.getByRole('button',{name:'Save planning item'}).click()
   await expect(mia.page.locator(`[data-canvas-node="${launch.id}"] [data-canvas-node="${note.id}"]`)).toBeVisible()
   await mia.page.locator(`[data-canvas-node="${note.id}"] [data-canvas-select]`).first().click()
   form=mia.page.getByRole('form',{name:'Edit planning item',exact:true});await form.getByLabel('Parent branch').selectOption(phase.id);await form.getByLabel('Position within branch').fill('0');await form.getByRole('button',{name:'Save planning item'}).click()
   await expect(own.page.locator(`[data-canvas-node="${phase.id}"] [data-canvas-node="${note.id}"]`)).toBeVisible()
   await mia.page.locator(`[data-canvas-node="${note.id}"] [data-canvas-select]`).first().click();await proof(mia.page,'note-review',size)
   form=mia.page.getByRole('form',{name:'Promote note to task',exact:true});await form.getByLabel('Accountable owner').selectOption(member.id);await form.getByRole('checkbox').check();await form.getByRole('button',{name:'Promote note to task',exact:true}).click()
   let view=ok(await owner.get(api)),linked=view.nodes.find(n=>n.id===note.id),taskId=linked.task.id
   const replay=ok(await member.post(api+`/nodes/${note.id}/promote`,{version:3,ownerId:member.id,confirm:true}));assert.equal(replay.taskId,taskId)
   await mia.page.getByRole('link',{name:'Task List',exact:true}).click()
   form=mia.page.getByRole('form',{name:'Edit Prepare launch brief in List',exact:true});await form.getByLabel('Title', {exact:true}).fill('Launch brief ready for review');await form.getByLabel('Status',{exact:true}).selectOption('doing');await form.getByRole('button',{name:'Update task',exact:true}).click();await proof(mia.page,'task-list',size)
   const card=own.page.locator(`[data-canvas-node="${note.id}"]`).first();await expect(card.locator('[data-canvas-select]').first()).toHaveText('Launch brief ready for review');await expect(card.locator('[data-canvas-detail]').first()).toContainText('doing');await expect(card.locator('[data-canvas-detail]').first()).toContainText('Mia Alvarez');await proof(own.page,'live-task',size)
   assert.equal(ok(await owner.get(`/api/v1/projects/${project.id}`)).columns.flatMap(c=>c.tasks).filter(t=>t.id===taskId).length,1)
   await client.page.goto(here);await expect(client.page.locator('[data-canvas-map]')).toContainText('Launch brief ready for review');assert.ok(!(await client.page.content()).includes('Internal supplier margin'));assert.ok(!(await client.page.content()).includes(secret.id));await proof(client.page,'guest',size)
   const guestView=ok(await guest.get(api));assert.ok(!JSON.stringify(guestView).includes(secret.id));const guestExport=ok(await guest.get(api+'/export'));assert.ok(!JSON.stringify(guestExport).includes(secret.id));assert.ok(guestExport.nodes.some(n=>n.id===note.id))
   await own.page.goto(here+`?node=${note.id}`);await proof(own.page,'task-placement',size)
   ok(await owner.delete(`/api/v1/grants/${grant.id}`));await expect(client.page.locator('[data-canvas-project]')).toContainText('Private content has been cleared');await expect(client.page.locator('[data-canvas-map]')).toHaveCount(0);await proof(client.page,'revoked',size)
   saved.push({project,phase,note,taskId,size,viewport})
   console.log(`Planning canvas collaboration at ${size}px passed`)
  }finally{await own.context.close();await mia.context.close();await client.context.close()}
 }
 const restored=await restoreCanvasInstallation(w.owner)
 try{
  for(const {project,phase,note,taskId,size,viewport} of saved){
   const own=await open(restored.worker.owner,viewport)
   try{
    await own.page.goto(`${restored.worker.origin}/app/projects/${project.id}/canvas`)
    const card=own.page.locator(`[data-canvas-node="${phase.id}"] [data-canvas-node="${note.id}"]`)
    await expect(card).toContainText('Launch brief ready for review');await expect(card).toContainText(taskId);await expect(card).toContainText('Mia Alvarez');await proof(own.page,'restored',size)
    console.log(`Planning canvas native archive restore at ${size}px passed`)
   }finally{await own.context.close()}
  }
 }finally{await restored.stop()}
}
