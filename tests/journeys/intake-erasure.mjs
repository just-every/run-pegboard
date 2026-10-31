import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { expect } from '@playwright/test'
import { intakeErasureFixture, pass, reviewPerson } from '../scenarios/intake-erasure.mjs'

export async function intakeErasureJourney({w,browser}) {
 const f=await intakeErasureFixture(w),{owner,target,project}=f
 await pass(owner.patch('/api/v1/tasks/'+f.owned.taskId,{ownerId:owner.id}))
 await pass(owner.post(`/api/v1/workspaces/ws_main/people/${target.id}/account`,{status:'inactive'}))
 const context=await browser.newContext({viewport:{width:1440,height:900}})
 await context.addCookies(owner.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:w.origin})))
 const page=await context.newPage()
 let review
 const proof=async name=>{
  const controls=await page.locator('main button,main a,header a').evaluateAll(nodes=>nodes.filter(e=>!e.textContent.trim()&&e.querySelector('svg,img')&&!e.getAttribute('aria-describedby')).map(e=>e.outerHTML))
  assert.deepEqual(controls,[],'icon-only controls have tooltips')
  assert.ok(await page.locator('main').evaluate(node=>[...node.querySelectorAll('p,li,label,button,input,select')].every(e=>parseFloat(getComputedStyle(e).fontSize)>=13)),'Data controls and text use at least 13px')
  if(!process.env.PEGBOARD_PROOF_DIR)return
  await mkdir(process.env.PEGBOARD_PROOF_DIR,{recursive:true})
  for(const [width,height]of [[1440,900],[390,844]]){
   await page.setViewportSize({width,height})
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'intake custody stays within viewport')
   await page.screenshot({path:join(process.env.PEGBOARD_PROOF_DIR,`intake-erasure-${name}-${width}.png`),fullPage:true})
  }
  await page.setViewportSize({width:1440,height:900})
 }
 try{
  const hold=await pass(owner.post('/api/v1/data/holds',{type:'person',id:target.id,authority:'synthetic-pegboard-5913',expiresAt:Date.now()+86400000}))
  await page.goto(w.origin+'/app/data?review=erase&type=person&id='+target.id)
  let confirmation=page.getByRole('form',{name:'Confirm erasure'})
  await confirmation.getByLabel('I reviewed this exact scope and its retention conflicts.').focus();await page.keyboard.press('Space')
  await confirmation.getByRole('button',{name:'Record retained outcome',exact:true}).focus();await page.keyboard.press('Enter')
  await page.waitForURL(url=>url.pathname==='/app/data'&&!url.search)
  await expect(page.getByRole('list',{name:'Data receipts'})).toContainText('No intake redaction was applied')
  assert.equal((await pass(owner.get(f.authored.path+'/review'))).version,1)
  await pass(owner.post(`/api/v1/data/holds/${hold.id}/release`,{confirm:true}))
  review=await reviewPerson(owner,target.id)
  await page.reload()
  const request=page.getByRole('form',{name:'Review erasure'})
  await request.getByLabel('Type of data',{exact:true}).selectOption('person')
  await request.getByLabel('Record ID',{exact:true}).fill(target.id)
  await request.getByRole('button',{name:'Preview erasure',exact:true}).focus();await page.keyboard.press('Enter')
  const card=page.getByRole('article').filter({has:page.getByRole('heading',{name:'Review irreversible erasure',exact:true})}),forms=card.getByRole('list',{name:'Reviewed intake forms'}),submissions=card.getByRole('list',{name:'Reviewed intake submissions'})
  await expect(forms.getByRole('listitem')).toHaveCount(3);await expect(submissions.getByRole('listitem')).toHaveCount(5)
  for(const form of [f.authored,f.published,f.mapped])await expect(forms).toContainText(form.id)
  for(const submission of [f.source,f.triager,f.both,f.witness,f.owned]){await expect(submissions).toContainText(submission.receipt);await expect(submissions).toContainText(submission.taskId)}
  await expect(forms).toContainText('redact author');await expect(forms).toContainText('redact publisher');await expect(forms).toContainText('clear owner mapping')
  await expect(submissions).toContainText('redact source');await expect(submissions).toContainText('redact triager');await expect(submissions).toContainText('retain replay witness')
  for(const text of ['2 · Submission sources redacted','2 · Submission triagers redacted','1 · Form authors redacted','1 · Form publishers redacted','1 · Form owner mappings cleared','3 · Form publications disabled','Opaque submission replay witnesses · 5','Inactive form provenance · 3'])await expect(page.locator('main')).toContainText(text)
  await proof('review')
  const confirm=page.getByRole('form',{name:'Confirm erasure'})
  await confirm.getByLabel('I reviewed this exact scope and its retention conflicts.').focus();await page.keyboard.press('Space')
  await confirm.getByRole('button',{name:'Erase reviewed data',exact:true}).focus();await page.keyboard.press('Enter')
  await page.waitForURL(url=>url.pathname==='/app/data')
  const receiptLink=page.getByRole('list',{name:'Data receipts'}).getByRole('link',{name:/^View receipt /}).first()
  await expect(receiptLink).toBeVisible()
  const id=(await receiptLink.getAttribute('href')).split('/').pop(),receipt=await pass(owner.get('/api/v1/data/receipts/'+id))
  assert.deepEqual(receipt.intake,review.intake);assert.equal(receipt.outcome,'partial');assert.equal(receipt.retained.counts.intake_replay_witnesses,5)
  const receipts=page.getByRole('list',{name:'Data receipts'}),row=receipts.getByRole('listitem').filter({has:page.getByRole('link',{name:'View receipt '+id,exact:true})})
  await expect(row).toContainText('partial');await expect(row).toContainText('Submission sources redacted: 2');await expect(row).toContainText('Submission triagers redacted: 2')
  await expect(row).toContainText('Opaque submission replay witnesses: 5');await expect(row).toContainText('Inactive form provenance: 3')
  await expect(row).toContainText(receipt.scopeDigest)
  for(const form of review.intake.forms)await expect(row).toContainText(form.id)
  for(const submission of review.intake.submissions)await expect(row).toContainText(submission.id)
  await proof('receipt')
  await page.goto(w.origin+`/app/projects/${project.id}/settings/intake?review=${f.mapped.id}`)
  for(const form of [f.authored,f.published,f.mapped]){
   const result=await pass(owner.get(form.path+'/review'));assert.equal(result.published,false)
   const response=await fetch(w.origin+'/api/v1/public-intake/'+form.capability);assert.equal(response.status,404)
  }
  await expect(page.locator('main')).toContainText('Draft or revoked')
  await expect(page.getByRole('status')).toContainText('Publication remains inactive after erasure')
  await expect(page.getByRole('form',{name:'Publish intake form'})).toHaveCount(0)
  await proof('inactive-forms')
  await page.goto(w.origin+`/app/projects/${project.id}/intake`)
  for(const submission of [f.source,f.triager,f.both,f.witness,f.owned])await expect(page.locator(`[data-submission="${submission.receipt}"]`)).toBeVisible()
  await proof('surviving-work')
  console.log('PROBE PEG-059 rendered custody: keyboard owner review and confirmation -> exact intake IDs and redacted/retained receipt counts; surviving work and inactive forms at 1440 and 390')
 }finally{await context.close()}
}
