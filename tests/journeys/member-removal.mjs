import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {expect} from '@playwright/test'
import {createDepartureFixture,choicesFor} from '../support/departure.mjs'
export async function memberRemovalJourney({w,browser,sizes,ok}) {
 const pass=async(p,status=200)=>ok(await p,status)
 for(const [size,viewport] of sizes) {
  const f=await createDepartureFixture({w,ok:pass,suffix:`browser-${size}`})
  const context=await browser.newContext({viewport})
  await context.addCookies(f.owner.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:w.origin})))
  const page=await context.newPage(),url=`${w.origin}/app/admin/removal/${f.departing.id}`
  const proof=async name=>{
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name} reflows at ${size}`)
   assert.equal(await page.locator('button,a').evaluateAll(els=>els.filter(e=>!e.textContent.trim()&&e.querySelector('svg,img')).length),0,'all controls have text labels')
   if(process.env.PEGBOARD_PROOF_DIR){await mkdir(process.env.PEGBOARD_PROOF_DIR,{recursive:true});await page.screenshot({path:join(process.env.PEGBOARD_PROOF_DIR,`departure-${name}-${size}.jpg`),type:'jpeg',quality:65,fullPage:true})}
  }
  try {
   await page.goto(`${w.origin}/app/admin`);await proof('admin')
   await page.locator(`a[href="/app/admin/removal/${f.departing.id}"]`).click()
   await expect(page.getByRole('heading',{name:'Review every affected set'})).toBeVisible()
   assert.ok(!(await page.locator('main').innerText()).includes('Private departure work'),'private titles stay redacted')
   await proof('review')
   let review=await pass(f.owner.get(f.removalPath+'/removal-preview'))
   const fill=async review=>{const form=page.getByRole('form',{name:'Review member removal'});for(const [key,value] of Object.entries(choicesFor(review,f.owner.id)))await form.locator(`select[name="${key}"]`).selectOption(value);await form.getByLabel('I reviewed every affected set and approve this removal').check()}
   await fill(review)
   const late=await pass(f.owner.post('/api/v1/tasks',{projectId:f.project.id,title:'New assignment during review',ownerId:f.departing.id}))
   await page.getByRole('button',{name:'Remove reviewed member'}).click()
   await expect(page.locator('main')).toContainText('removal_review_changed');await proof('stale')
   assert.equal((await f.departing.get(`/api/v1/tasks/${late.id}`)).status,200)
   await page.goto(url);review=await pass(f.owner.get(f.removalPath+'/removal-preview'));await fill(review)
   await page.getByRole('button',{name:'Remove reviewed member'}).click()
   await expect(page.getByRole('heading',{name:'Member removed',exact:true})).toBeVisible();await proof('removed')
   assert.equal((await f.departing.get('/api/v1/me')).status,401);assert.equal((await f.readAnalytics()).status,401)
   assert.equal((await pass(f.owner.get(`/api/v1/tasks/${late.id}`))).owner.id,f.owner.id)
   assert.ok((await pass(f.owner.get(f.bundlePath))).jobs.some(j=>j.task_id===f.queuedTask.id&&j.status==='cancelled'))
   await page.goto(`${w.origin}/app/tasks/${f.task.id}`);await expect(page.locator('main')).toContainText('Original handover context');await proof('transferred-task')
   await page.goto(`${w.origin}/app/projects/${f.project.id}`);await proof('transferred-project')
   await page.goto(`${w.origin}/app/tasks/${f.approval.id}`);await expect(page.locator('main')).toContainText('PENDING');await proof('pending-approval')
   await page.goto(`${url}?removed=1`);await page.getByRole('link',{name:'Inspect permanent audit'}).click();await expect(page.getByRole('list',{name:'Permanent audit events'})).toContainText('person.departure');await proof('audit')
  } finally {await context.close()}
  console.log(`Member removal at ${size}px passed`)
 }
}
