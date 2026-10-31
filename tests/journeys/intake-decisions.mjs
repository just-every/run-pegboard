import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {expect} from '@playwright/test'
import {decisionFixture,pass} from '../scenarios/intake-decisions.mjs'
export async function intakeDecisionsJourney({w,browser}) {
 const f=await decisionFixture(w),{owner,project,a,b}=f
 const context=await browser.newContext({viewport:{width:1440,height:900}})
 await context.addCookies(owner.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:w.origin})))
 const page=await context.newPage(),queuePath=`/app/projects/${project.id}/intake`
 const proof=async name=>{
  if(!process.env.PEGBOARD_PROOF_DIR)return
  await mkdir(process.env.PEGBOARD_PROOF_DIR,{recursive:true})
  for(const [width,height]of [[1440,900],[390,844]]){await page.setViewportSize({width,height});await page.screenshot({path:join(process.env.PEGBOARD_PROOF_DIR,`intake-decisions-${name}-${width}.png`),fullPage:true})}
  await page.setViewportSize({width:1440,height:900})
 }
 try{
  await page.goto(w.origin+`/app/projects/${project.id}/settings/intake`)
  const policy=page.getByRole('form',{name:'Review intake decision policy'})
  await expect(policy.getByLabel('Human decisions',{exact:true})).toHaveValue('false')
  await policy.getByLabel('Human decisions',{exact:true}).selectOption('true')
  await policy.getByLabel('Human decisions',{exact:true}).focus();await page.keyboard.press('Tab')
  await expect(policy.getByLabel('I approve this exact human decision policy')).toBeFocused()
  await page.keyboard.press('Space');await page.keyboard.press('Tab')
  await expect(policy.getByRole('button',{name:'Save reviewed policy'})).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Policy version 1 · Enabled')).toBeVisible()
  await proof('settings')
  await page.goto(w.origin+queuePath)
  const first=page.locator(`[data-submission="${a.item.id}"]`)
  await expect(first).toContainText('Not accepted or declined')
  await first.getByRole('button',{name:'Mark triaged'}).click()
  await expect(page.locator(`[data-submission="${a.item.id}"]`)).toContainText('triaged')
  await expect(page.locator(`[data-submission="${a.item.id}"]`)).toContainText('Not accepted or declined')
  await page.locator(`[data-submission="${a.item.id}"]`).getByRole('link',{name:'Review decision'}).click()
  const choose=page.getByRole('form',{name:'Choose intake decision'})
  await choose.getByLabel('Priority',{exact:true}).selectOption('high')
  await choose.getByRole('button',{name:'Preview exact decision'}).click()
  const preview=page.locator('.card').filter({has:page.getByRole('heading',{name:'Exact decision preview'})})
  for(const value of [a.item.id,a.item.taskId,f.form.id,a.input.answers.title,a.input.answers.details,'Priority: normal → high','Disposition: accepted','Triage: triaged'])await expect(preview).toContainText(value)
  assert.equal(await page.evaluate(()=>globalThis.intakeAttack),undefined,'malicious request text remains inert')
  assert.equal(await preview.locator('script').count(),0)
  const confirm=page.getByRole('form',{name:'Confirm intake decision'})
  await confirm.getByLabel('I approve this exact priority and disposition').focus();await page.keyboard.press('Space');await page.keyboard.press('Tab')
  await expect(confirm.getByRole('button',{name:'Accept reviewed request'})).toBeFocused()
  await proof('accept-preview')
  await pass(owner.patch('/api/v1/tasks/'+a.item.taskId,{title:'Reviewed campaign image'}))
  await page.keyboard.press('Enter')
  await expect(page.locator('body')).toContainText('intake_decision_review_required')
  assert.equal((await pass(owner.get('/api/v1/tasks/'+a.item.taskId))).priority,'normal')
  await page.goto(w.origin+`/app/intake/${a.item.id}/decision?priority=high&disposition=accepted`)
  await page.getByRole('form',{name:'Confirm intake decision'}).getByLabel('I approve this exact priority and disposition').check()
  await page.getByRole('button',{name:'Accept reviewed request'}).click()
  await expect(page.locator(`[data-submission="${a.item.id}"]`)).toContainText('Decision: accepted')
  await expect(page.locator(`[data-submission="${a.item.id}"]`)).toContainText(owner.name)
  assert.equal((await pass(owner.get('/api/v1/tasks/'+a.item.taskId))).priority,'high')
  await page.locator(`[data-submission="${b.item.id}"]`).getByRole('link',{name:'Review decision'}).click()
  await page.getByLabel('Disposition',{exact:true}).selectOption('declined')
  await page.getByRole('button',{name:'Preview exact decision'}).click()
  await expect(page.getByRole('button',{name:'Decline reviewed request'})).toBeVisible()
  await proof('decline-preview')
  await page.getByLabel('I approve this exact priority and disposition').check()
  await page.getByRole('button',{name:'Decline reviewed request'}).click()
  await expect(page.locator(`[data-submission="${b.item.id}"]`)).toContainText('Decision: declined')
  assert.equal((await pass(owner.get('/api/v1/tasks/'+b.item.taskId))).description,'Request details: '+b.input.answers.details)
  await page.locator(`[data-submission="${a.item.id}"]`).getByText('Decision history and source',{exact:true}).click()
  await expect(page.locator(`[data-submission="${a.item.id}"] details`)).toContainText(a.input.answers.title)
  await expect(page.locator(`[data-submission="${a.item.id}"] details`)).toContainText(a.input.answers.details)
  await proof('decision-history')
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'intake decision history stays inside its viewport')
  const decisionRows=await pass(owner.get(`/api/v1/intake/submissions/${a.item.id}/decisions`))
  assert.equal(decisionRows.length,1);assert.equal(decisionRows[0].actorId,owner.id)
  // The same native editor can triage but sees no policy or acceptance control.
  const editorContext=await browser.newContext({viewport:{width:1440,height:900}})
  try{
   await editorContext.addCookies(f.editor.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:w.origin})))
   const editorPage=await editorContext.newPage();await editorPage.goto(w.origin+queuePath)
   await expect(editorPage.getByRole('link',{name:'Review decision'})).toHaveCount(0)
   assert.equal((await editorPage.goto(w.origin+`/app/intake/${f.c.item.id}/decision`)).status(),403)
  }finally{await editorContext.close()}
  console.log('PROBE PEG-066 browser: keyboard Settings, exact decision preview and queue -> policy consent, stale refusal, one accepted and one declined decision, source retained; native editor has triage only')
 }finally{await context.close()}
}
