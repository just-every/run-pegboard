import assert from 'node:assert/strict'
import { expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { profileFixture, pass } from '../scenarios/profiles.mjs'

export async function profilesJourney({ w, browser }) {
 const f = await profileFixture(w)
 const contexts = []
 const open = async client => {
  const context = await browser.newContext({viewport:{width:1440,height:900}})
  contexts.push(context)
  await context.addCookies(client.cookie.split('; ').map(pair => ({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:w.origin})))
  return context.newPage()
 }
 const proof = async (page, name) => {
  if (!process.env.PEGBOARD_PROOF_DIR) return
  await mkdir(process.env.PEGBOARD_PROOF_DIR, {recursive:true})
  for (const [width,height] of [[1440,900],[390,844]]) {
   await page.setViewportSize({width,height})
   await page.screenshot({path:join(process.env.PEGBOARD_PROOF_DIR,`profiles-${name}-${width}.png`),fullPage:true})
  }
  await page.setViewportSize({width:1440,height:900})
 }
 const safe = async page => {
  const content = await page.locator('main').innerText()
  for (const value of ['Confidential acquisition','Confidential assignment','Private no-project assignment','Someone else owns this',f.teammate.email,'777','999']) assert.ok(!content.includes(value), 'Private content excluded: '+value)
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), 'No page overflow')
  const small = await page.locator('main').evaluate(main=>[...main.querySelectorAll('*')].filter(el=>[...el.childNodes].some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim())&&el.getClientRects().length&&parseFloat(getComputedStyle(el).fontSize)<13).map(el=>el.tagName))
  assert.deepEqual(small, [], 'Profile text is at least 13 pixels')
 }
 try {
  const page = await open(f.colleague)
  await page.goto(w.origin+'/app/projects')
  await page.getByRole('link',{name:'People',exact:true}).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading',{name:'People',exact:true})).toBeVisible()
  await expect(page.getByRole('link',{name:'Profile teammate',exact:true})).toBeVisible()
  assert.ok(!(await page.locator('main').innerText()).includes('Profile guest'))
  assert.ok(!(await page.locator('main').innerText()).includes('Outside workspace identity'))
  await proof(page,'directory')
  await page.getByRole('link',{name:'Profile teammate',exact:true}).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading',{name:'Profile teammate',exact:true})).toBeVisible()
  assert.deepEqual((await page.locator('[data-task-id]').evaluateAll(rows=>rows.map(row=>row.dataset.taskId))).sort(), [f.shared.id,f.subtask.id,f.done.id].sort())
  assert.equal(await page.getByRole('link',{name:'Shared profile assignment',exact:true}).count(),1)
  const child = page.locator('[data-task-id="'+f.subtask.id+'"]')
  await expect(child).toContainText('Subtask')
  await expect(child).toContainText('Profile campaign')
  await expect(child).toContainText('Profile launch')
  await page.getByLabel('Starting date',{exact:true}).fill('2026-03-09')
  await page.getByRole('button',{name:'Show availability',exact:true}).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('list',{name:'Availability by day'})).toContainText('Mon, 03/09/2026')
  assert.deepEqual(await page.getByRole('list',{name:'Availability by day'}).locator('li > span:last-child').allTextContents(), ['8 hours available','0 hours available','5 hours available','8 hours available','8 hours available','0 hours available','0 hours available'])
  await safe(page)
  await proof(page,'permitted')
  await page.getByRole('link',{name:'Inherited profile subtask',exact:true}).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading',{name:'Inherited profile subtask',exact:true})).toBeVisible()
  await page.goto(w.origin+'/app/people/'+f.teammate.id+'?from=2026-03-09')
  const feed = await pass(f.owner.post('/api/v1/workspaces/ws_main/capacity-feeds', {service:'willow',origin:'https://willow.example.com',mapping:{'synthetic-pegboard-6002':f.teammate.id}}))
  await page.reload()
  await expect(page.getByRole('list',{name:'Availability by day'}).locator('li > span:last-child')).toHaveText(Array(7).fill('Availability unknown'))
  await safe(page)
  await proof(page,'unknown')
  for (const client of [f.guest,f.agent]) {
   const denied = await open(client)
   for (const path of ['/app/people','/app/people/'+f.teammate.id,'/app/people/synthetic-pegboard-guessed']) {
    assert.equal((await denied.goto(w.origin+path)).status(),404)
    assert.ok(!(await denied.locator('main').innerText()).includes('Profile teammate'))
   }
   assert.equal(await denied.getByRole('link',{name:'People',exact:true}).count(),0)
   if (client===f.guest) await proof(denied,'guest-refusal')
  }
  for (const path of ['/app/people/'+f.outside.id,'/app/people/'+f.teammate.id+'?workspace='+f.workspace.id]) assert.equal((await page.goto(w.origin+path)).status(),404)
  await pass(f.owner.delete('/api/v1/grants/'+f.colleagueGrants[0].id))
  await pass(f.owner.delete('/api/v1/grants/'+f.colleagueGrants[1].id))
  await page.goto(w.origin+'/app/people/'+f.teammate.id+'?from=2026-03-09')
  await expect(page.getByText('No permitted project assignments.',{exact:true})).toBeVisible()
  assert.equal(await page.locator('[data-task-id]').count(),0)
  await proof(page,'revoked')
  await pass(f.owner.post('/api/v1/workspaces/ws_main/people/'+f.teammate.id+'/account', {status:'inactive'}))
  await w.restart()
  assert.equal((await page.reload()).status(),404)
  assert.ok(!(await page.locator('main').innerText()).includes('Profile teammate'))
  await pass(f.owner.post('/api/v1/workspaces/ws_main/people/'+f.colleague.id+'/role', {role:'guest'}))
  assert.equal((await page.goto(w.origin+'/app/people')).status(),404)
  console.log('PROBE PEG-060 browser: keyboard People -> profile -> inherited task; current assignments and availability match expected values; guest, cross-workspace, revoked and inactive reads refuse after restart')
  assert.ok(feed.id)
 } finally { for (const context of contexts) await context.close() }
}
