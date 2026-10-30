import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import {restoreCanvasInstallation} from '../support/canvas-restore.mjs'
import { expect } from '@playwright/test'

export async function archiveCustodyJourney({w,browser,ok,services}){
 const owner=w.owner,pass=async request=>ok(await request)
 const member=await w.person(['synthetic-pegboard-5891','example.test'].join('@'),'Archive viewer')
 const project=await pass(owner.post('/api/v1/projects',{name:'Archive browser project'}))
 const task=await pass(owner.post('/api/v1/tasks',{projectId:project.id,title:'Archive browser task',dueDate:'2026-03-20'}))
 const connection=await pass(owner.post('/api/v1/workspaces/ws_main/calendars',{service:'google',calendarId:'synthetic-pegboard-250',credential:'synthetic-pegboard-251',consent:true}))
 const preview=await pass(owner.post(`/api/v1/tasks/${task.id}/calendar-preview`,{connectionId:connection.id,date:'2026-03-09',minutes:60,credential:'synthetic-pegboard-251'}))
 await pass(owner.post(`/api/v1/calendar-previews/${preview.id}/apply`,{slot:0,credential:'synthetic-pegboard-251'}))
 const open=async actor=>{const context=await browser.newContext({viewport:{width:1440,height:900}});await context.addCookies(actor.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:w.origin})));return {context,page:await context.newPage()}}
 const {context,page}=await open(owner)
 const proof=async(name,screen=page)=>{
  if(!process.env.PEGBOARD_PROOF_DIR)return
  await mkdir(process.env.PEGBOARD_PROOF_DIR,{recursive:true})
  for(const [width,height] of [[1440,900],[390,844]]){
   await screen.setViewportSize({width,height})
   await screen.screenshot({path:join(process.env.PEGBOARD_PROOF_DIR,`archive-${name}-${width}.png`),fullPage:true})
  }
  await screen.setViewportSize({width:1440,height:900})
 }
 try{
  await page.goto(w.origin+'/app/data')
  const card=page.locator('article').filter({has:page.getByRole('heading',{name:'Installation archives',exact:true})})
  await expect(card.getByRole('button',{name:'Start archive'})).toBeVisible()
  await card.getByRole('button',{name:'Start archive'}).focus();assert.ok(await page.evaluate(()=>document.activeElement?.textContent==='Start archive'))
  await proof('owner-start')
  await card.getByRole('button',{name:'Start archive'}).click()
  await expect(card.getByText('Archive in progress',{exact:true})).toBeVisible()
  await proof('interrupted')
  await w.restart();await page.reload()
  for(let i=0;i<40&&await card.getByRole('button',{name:'Continue archive'}).count();i++)await card.getByRole('button',{name:'Continue archive'}).click()
  await expect(card.getByText('Archive ready',{exact:true})).toBeVisible()
  const link=card.getByRole('link',{name:'Download archive'}),href=await link.getAttribute('href')
  const result=await page.request.get(w.origin+href);assert.equal(result.status(),200)
  const text=await result.text(),archive=text.trim().split('\n').map(line=>JSON.parse(line)),manifest=archive[0],closing=archive.at(-1)
  const records=manifest.tables.reduce((n,t)=>n+t.count,0)
  await expect(card).toContainText(records+' records');await expect(card).toContainText(closing.contentHash)
  assert.ok(archive.filter(r=>r.kind==='part').flatMap(r=>r.items).some(r=>r.table==='peg_tasks'&&r.row.title==='Archive browser task'))
  await proof('ready-results')
  const calls=services.state.google.calls.length
  const restored=await restoreCanvasInstallation(owner,{archive:text,settings:{PEGBOARD_LOCAL_CALENDAR_ORIGINS:services.origins}})
  try{
   const restoredContext=await browser.newContext({viewport:{width:1440,height:900}})
   try{
    const root=restored.worker.owner,origin=restored.worker.origin
    const setup=await root.form('/setup',{displayName:root.name,confirm:'yes'});assert.equal(setup.status,303)
    await restoredContext.addCookies(root.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:origin})))
    const screen=await restoredContext.newPage()
    await screen.goto(origin+'/app/settings/calendars');await expect(screen.getByText('Google Calendar · Restored inactive',{exact:false})).toBeVisible();await proof('restored-connection',screen)
    await screen.goto(origin+`/app/projects/${project.id}/calendar`);await expect(screen.getByText('google · Archived history — inactive',{exact:false})).toBeVisible()
    assert.equal(await screen.getByRole('button',{name:'Read back event',exact:true}).count(),0);assert.equal(await screen.getByRole('button',{name:'Delete work block',exact:true}).count(),0)
    await proof('restored-calendar',screen)
    assert.equal(services.state.google.calls.length,calls,'viewing restored calendar history dispatches no provider request')
   }finally{await restoredContext.close()}
  }finally{await restored.stop()}
  const outsider=await open(member)
  try{
   await outsider.page.goto(w.origin+'/app/data');assert.equal(await outsider.page.getByRole('button',{name:'Start archive'}).count(),0)
   assert.equal((await outsider.page.request.get(w.origin+href)).status(),403)
   assert.equal((await member.post('/api/v1/data/archives',{})).status,403)
  }finally{await outsider.context.close()}
  await pass(owner.post(`/api/v1/workspaces/ws_main/people/${member.id}/account`,{role:'admin'}))
  const administrator=await w.signIn(member.email,member.name,member.id),adminView=await open(administrator)
  try{
   await adminView.page.goto(w.origin+'/app/data');assert.equal(await adminView.page.getByRole('button',{name:'Start archive'}).count(),0)
   assert.equal((await adminView.page.request.get(w.origin+href)).status(),403)
   assert.equal((await administrator.post('/api/v1/data/archives',{})).status,403)
   assert.equal((await administrator.post('/api/portability/exports',{})).status,403)
  }finally{await adminView.context.close()}

  await card.getByRole('button',{name:'Discard transfer'}).click()
  assert.equal(await card.getByRole('link',{name:'Download archive'}).count(),0)
  assert.equal((await owner.get(href)).status,409)
  console.log('Archive custody owner controls, durable resume, results and member refusals at 1440px passed; browser proof at 1440 and 390')
 }finally{await context.close()}
}
