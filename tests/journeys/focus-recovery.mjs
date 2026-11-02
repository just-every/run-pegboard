import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { expect } from '@playwright/test'
import { focusFixture, credential, pass } from '../scenarios/focus-recovery.mjs'
export async function focusRecoveryJourney({w,browser,services}) {
 const f=await focusFixture(w,services),context=await browser.newContext({viewport:{width:1440,height:1000}})
 await context.addCookies(w.owner.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:w.origin})))
 const page=await context.newPage(),here='/app/projects/'+f.p.id+'/focus-recovery'
 const keyboard=async locator=>{await locator.focus();await locator.press('Enter')}
 const proof=async name=>{
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'focus review fits desktop')
  const small=await page.locator('main').evaluate(el=>[...el.querySelectorAll('button,a,input,select,p,label,h2,h3')].filter(e=>e.getBoundingClientRect().width&&parseFloat(getComputedStyle(e).fontSize)<13).map(e=>e.textContent.slice(0,50)))
  assert.deepEqual(small,[],'review text is readable')
  const icons=await page.locator('main button,main a').evaluateAll(es=>es.filter(e=>!e.textContent.trim()&&e.querySelector('svg,img')).map(e=>e.outerHTML))
  assert.deepEqual(icons,[],'actions use visible labels')
  if(process.env.PEGBOARD_PROOF_DIR){
   await mkdir(process.env.PEGBOARD_PROOF_DIR,{recursive:true})
   for(const width of [1440,390]){
    await page.setViewportSize({width,height:width===1440?1000:844})
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'focus page fits '+width)
    await page.screenshot({path:join(process.env.PEGBOARD_PROOF_DIR,'focus-'+name+'-'+width+'.png'),fullPage:true})
   }
   await page.setViewportSize({width:1440,height:1000})
  }
 }
 try{
  await page.goto(w.origin+'/app/projects/'+f.p.id+'/calendar')
  await keyboard(page.getByRole('link',{name:'Focus recovery',exact:true}))
  await expect(page.getByRole('heading',{name:'Human scheduling scenarios',exact:true})).toBeVisible()
  let form=page.getByRole('form',{name:'Review lock for Protected focus',exact:true})
  await form.getByLabel('Focus decision').selectOption('true');await form.getByLabel('One-use credential').fill(credential)
  await keyboard(form.getByRole('button',{name:'Review focus decision',exact:true}))
  await expect(page.getByRole('heading',{name:'Review focus decision',exact:true})).toBeVisible()
  await proof('lock-review')
  form=page.getByRole('form',{name:'Confirm focus decision',exact:true})
  await form.getByRole('checkbox').check();await form.getByLabel('One-use credential').fill(credential)
  await keyboard(form.getByRole('button',{name:'Confirm focus decision',exact:true}))
  assert.equal((await pass(w.owner.get('/api/v1/projects/'+f.p.id+'/focus-recovery'))).locks.find(l=>l.block_id===f.lockBlock.id).locked,1)
  services.state.google.locked.push({start:f.block.start_at,end:f.block.end_at})
  form=page.getByRole('form',{name:'Compare human scenarios',exact:true})
  await form.getByLabel('Calendar',{exact:true}).selectOption(f.connection.id);await form.getByLabel('Affected work block').selectOption(f.block.id)
  for(const [i,date] of ['2026-03-10','2026-03-11'].entries()){
   await form.getByLabel('Scenario '+(i+1)+' name').fill('Human option '+(i+1))
   await form.getByLabel('Scenario '+(i+1)+' event start in UTC').fill(date+'T13:00:00Z')
   await form.getByLabel('Scenario '+(i+1)+' event end in UTC').fill(date+'T16:00:00Z')
   await form.getByLabel('Scenario '+(i+1)+' task start',{exact:true}).fill(date)
   await form.getByLabel('Scenario '+(i+1)+' task deadline').fill(date)
  }
  await form.getByLabel('One-use credential').fill(credential)
  await keyboard(form.getByRole('button',{name:'Compare human scenarios',exact:true}))
  await expect(page.getByRole('heading',{name:'Exact recovery review',exact:true})).toBeVisible()
  await expect(page.getByRole('heading',{name:'Human scenario 1: Human option 1',exact:true})).toBeVisible()
  await expect(page.getByText('2026-03-10 · America/New_York · Free 8 h · Other commitments 0 h · Available 8 h · Required 3 h · Shortage 0 h',{exact:true})).toBeVisible()
  await expect(page.getByText('Unchanged locked periods:',{exact:false})).toContainText(f.lockBlock.start_at)
  await expect(page.getByText('Event '+f.block.event_id,{exact:false})).toHaveCount(2)
  const reviewId=new URL(page.url()).searchParams.get('focusReview')
  assert.equal((await pass(w.owner.get('/api/v1/tasks/'+f.task.id))).dueDate,'2026-03-09')
  await proof('comparison')
  form=page.getByRole('form',{name:'Apply human scenario 1',exact:true})
  await form.getByRole('checkbox').check();await form.getByLabel('One-use credential').fill(credential)
  services.state.google.loseNextMove=true
  await keyboard(form.getByRole('button',{name:'Apply human scenario 1',exact:true}))
  await keyboard(page.getByRole('link',{name:'recovery · uncertain · Calendar and task state are not yet reconciled.',exact:true}))
  await expect(page.getByRole('form',{name:'Reconcile recovery',exact:true})).toBeVisible()
  assert.equal((await pass(w.owner.get('/api/v1/tasks/'+f.task.id))).dueDate,'2026-03-09')
  await proof('uncertain')
  form=page.getByRole('form',{name:'Reconcile recovery',exact:true});await form.getByLabel('One-use credential').fill(credential)
  await keyboard(form.getByRole('button',{name:'Read back intended events',exact:true}))
  await page.goto(w.origin+here+'?focusReview='+reviewId)
  await expect(page.getByRole('status')).toHaveText('reconciled')
  assert.equal((await pass(w.owner.get('/api/v1/tasks/'+f.task.id))).dueDate,'2026-03-10')
  const event=services.state.google.events.get(f.block.event_id)
  assert.equal(event.start.dateTime,'2026-03-10T13:00:00.000Z');assert.equal(event.end.dateTime,'2026-03-10T16:00:00.000Z')
  assert.equal(services.state.google.events.size,2)
  await proof('reconciled')
  services.state.google.locked=services.state.google.locked.filter(b=>b.start!==f.block.start_at)
  form=page.getByRole('form',{name:'Review recovery undo',exact:true});await form.getByLabel('One-use credential').fill(credential)
  await keyboard(form.getByRole('button',{name:'Review recovery undo',exact:true}))
  await expect(page.getByRole('heading',{name:'Human scenario 1: Human undo of reviewed recovery',exact:true})).toBeVisible()
  await proof('undo-review')
  form=page.getByRole('form',{name:'Apply reviewed undo',exact:true}).first()
  await form.getByRole('checkbox').check();await form.getByLabel('One-use credential').fill(credential)
  await keyboard(form.getByRole('button',{name:'Apply reviewed undo',exact:true}))
  assert.equal((await pass(w.owner.get('/api/v1/tasks/'+f.task.id))).dueDate,'2026-03-09')
  for(const view of ['calendar','timeline']){
   await page.goto(w.origin+'/app/projects/'+f.p.id+'/'+view)
   await expect(page.getByRole('link',{name:'Focus recovery',exact:true})).toBeVisible()
   await expect(page.getByRole('link',{name:'Overrun work',exact:true})).toBeVisible()
   await proof(view)
  }
  console.log('PROBE PEG-069 browser: keyboard lock, compare, approve, reconcile, reviewed undo, Calendar and Timeline -> exact native state; provider schema-fake')
 }finally{await context.close()}
}
