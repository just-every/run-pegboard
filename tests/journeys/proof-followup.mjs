import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { expect } from '@playwright/test'
import { fixture,pass,replace,route,cron,view,inbox } from '../scenarios/proof-followup.mjs'
export async function proofFollowupJourney({w,browser}){
 const f=await fixture(w,6760),owner=w.owner
 const open=async(client)=>{const context=await browser.newContext({viewport:{width:1440,height:900}});await context.addCookies(client.cookie.split('; ').map(p=>({name:p.slice(0,p.indexOf('=')),value:p.slice(p.indexOf('=')+1),url:w.origin})));return {context,page:await context.newPage()}}
 const manager=await open(owner),internal=await open(f.reviewer),guest=await open(f.guest),page=manager.page
 const capture=async(name,p)=>{
  if(!process.env.PEGBOARD_PROOF_DIR)return
  await mkdir(process.env.PEGBOARD_PROOF_DIR,{recursive:true})
  for(const [width,height]of [[1440,900],[390,844]]){await p.setViewportSize({width,height});await p.screenshot({path:join(process.env.PEGBOARD_PROOF_DIR,`proof-followup-${name}-${width}.png`),fullPage:true})}
  await p.setViewportSize({width:1440,height:900})
 }
 const decision=async(p,action)=>{const form=p.getByRole('form',{name:'Decide routed approval'});await form.getByLabel('Decision',{exact:true}).selectOption(action);await form.getByLabel('Decision reason').fill('Human reviewed the current campaign PDF');await form.getByRole('button',{name:'Record reviewed decision'}).focus();await Promise.all([p.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/decision')).then(r=>assert.equal(r.status(),303)),p.keyboard.press('Enter')]);await expect(p.locator('li').filter({hasText:'Human reviewed the current campaign PDF'})).toHaveCount(1)}
 try{
  await page.goto(w.origin+'/app/settings')
  await page.getByRole('link',{name:'Proof follow-up',exact:true}).click()
  const policy=page.getByRole('form',{name:'Review proof policy'})
  await policy.getByLabel('Reviewed projects').selectOption(f.project.id)
  await policy.getByLabel('Accountable internal recipients').selectOption(owner.id)
  await policy.getByLabel('Working timezone').fill('UTC')
  await policy.getByLabel('Minutes between notices').fill('1')
  await policy.getByRole('button',{name:'Preview proof policy'}).click()
  await expect(page.getByRole('heading',{name:'Confirm proof policy'})).toBeVisible()
  await capture('policy-review',page)
  const consent=page.getByRole('form',{name:'Approve proof policy'});await consent.getByRole('checkbox').check();await consent.getByRole('button',{name:'Approve proof policy'}).focus();await page.keyboard.press('Enter')
  await page.waitForURL(w.origin+'/app/settings/proof-followup')
  await page.goto(w.origin+'/app/approvals/'+f.route.id)
  await page.getByRole('link',{name:'Accountable proof follow-through'}).click()
  const start=page.getByRole('form',{name:'Review proof follow-through'})
  await start.getByLabel('Accountable internal person').selectOption(owner.id)
  await start.getByRole('button',{name:'Preview proof episode'}).click()
  await expect(page.getByRole('heading',{name:'Confirm current proof binding'})).toBeVisible()
  const confirm=page.getByRole('form',{name:'Confirm proof episode'});await confirm.getByRole('checkbox').check();await confirm.getByRole('button',{name:'Confirm human follow-through'}).focus();await page.keyboard.press('Enter')
  await page.waitForURL(/\/app\/proof-followup\/proofepisode_/)
  const episodeId=new URL(page.url()).pathname.split('/').at(-1),episode={id:episodeId}
  await expect(page.getByRole('status')).toHaveText('active');await expect(page.locator('[data-proof-stage="0"]')).toContainText('0 of 2 approved')
  await capture('missing-review',page)
  await cron(w);await page.goto(w.origin+'/app/inbox')
  const notice=page.locator(`[data-proof-notice-id][data-episode-id="${episodeId}"][data-recipient-id="${owner.id}"]`)
  await expect(notice).toHaveCount(1);assert.equal((await inbox(owner)).notices[0].routeId,f.route.id)
  await notice.getByRole('link',{name:'Follow proof review'}).focus();await expect(notice.getByRole('link')).toBeFocused();await capture('internal-inbox',page);await page.keyboard.press('Enter')
  await guest.page.goto(w.origin+'/app/proof-reviews/'+f.links[0].id)
  await expect(guest.page.getByRole('link',{name:'Download reviewed proof'})).toBeVisible()
  await capture('guest-v2',guest.page)
  await decision(guest.page,'changes');await expect(guest.page.getByRole('status')).toHaveText('changes requested')
  await page.goto(w.origin+'/app/proof-followup/'+episodeId);await expect(page.getByRole('status')).toHaveText('awaiting revision');await capture('requested-changes',page)
  const oldLink=f.links[0].id
  await replace(owner,f,'synthetic-pegboard-browser-human-v3');await route(owner,f)
  await guest.page.goto(w.origin+'/app/proof-reviews/'+oldLink);assert.equal((await f.guest.get('/api/v1/proof-reviews/'+oldLink)).status,404)
  await page.goto(w.origin+'/app/proof-followup/'+episodeId)
  await expect(page.getByRole('status')).toHaveText('awaiting route')
  await page.getByRole('link',{name:'Review current version continuation'}).click()
  await page.getByRole('button',{name:'Preview proof episode'}).click()
  const continuation=page.getByRole('form',{name:'Confirm proof episode'});await continuation.getByRole('checkbox').check();await continuation.getByRole('button',{name:'Confirm human follow-through'}).click()
  await expect(page.getByRole('status')).toHaveText('active')
  await internal.page.goto(w.origin+'/app/approvals/'+f.route.id);await decision(internal.page,'approve')
  await page.goto(w.origin+'/app/proof-followup/'+episodeId);await expect(page.getByRole('status')).toHaveText('active');await expect(page.locator('[data-proof-stage="0"]')).toContainText('1 of 2 approved');await capture('partial-v3',page)
  await guest.page.goto(w.origin+'/app/proof-reviews/'+f.links[0].id);await capture('guest-v3',guest.page);await decision(guest.page,'approve')
  await page.goto(w.origin+'/app/proof-followup/'+episodeId);await expect(page.getByRole('status')).toHaveText('approved');await expect(page.locator('[data-proof-stage="0"]')).toContainText('2 of 2 approved')
  const result=await view(owner,episode);assert.equal(result.routing.votes.length,2);assert.equal(result.bindings.length,2)
  await capture('approved-v3',page)
  // At the assertion width, inspect standard text and keyboard controls; both widths are captured once above.
  const tiny=await page.locator('main').evaluate(el=>[...el.querySelectorAll('a,button,input,select,p,li')].filter(n=>n.getClientRects().length&&parseFloat(getComputedStyle(n).fontSize)<13).length);assert.equal(tiny,0)
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  console.log('PROBE PEG-067 browser: owner Settings review -> explicit internal policy; manager keyboard start -> current v2 quorum and missing reviewer evidence; native Inbox -> one identity-bound notice; guest request-changes and human v3 -> explicit continuation; one human vote stays active; guest current-version sign-off -> approved. Manager and guest screens captured at 1440 and 390.')
 }finally{await manager.context.close();await internal.context.close();await guest.context.close()}
}
