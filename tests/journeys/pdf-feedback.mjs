import assert from 'node:assert/strict'
import { expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { pdfFeedbackFixture,pass } from '../scenarios/pdf-feedback.mjs'

export async function pdfFeedbackJourney({w,browser}){
 const f=await pdfFeedbackFixture(w),{owner,writer,one,two,proof,api}=f
 const context=await browser.newContext({viewport:{width:1440,height:1000}})
 await context.addCookies(writer.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:w.origin})))
 const page=await context.newPage(),errors=[]
 page.on('pageerror',error=>errors.push(error.message))
 const capture=async(name,{unavailable=false,target=page}={})=>{
  if(!unavailable)for(const status of await target.locator('[data-pdf-status]').all())await expect(status).toHaveText('Verified PDF · 2 pages')
  for(const width of [1440,390]){
   await target.setViewportSize({width,height:1000})
   assert.ok(await target.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' reflows at '+width)
   if(process.env.PEGBOARD_PROOF_DIR){await mkdir(process.env.PEGBOARD_PROOF_DIR,{recursive:true});await target.screenshot({path:join(process.env.PEGBOARD_PROOF_DIR,'pdf-'+name+'-'+width+'.png'),fullPage:true})}
  }
  await target.setViewportSize({width:1440,height:1000})
 }
 const here=w.origin+'/app/proof-viewer/'+proof.id
 try{
  await page.goto(w.origin+'/app/tasks/'+f.task.id)
  await expect(page.getByRole('link',{name:'Proof reviews',exact:true})).toBeVisible()
  await capture('task-entry')
  await page.getByRole('link',{name:'Proof reviews',exact:true}).click()
  await expect(page.getByRole('link',{name:'Review PDF versions'})).toBeVisible()
  await expect(page.getByRole('button',{name:'Create proof'})).toHaveCount(0)
  await capture('proof-list')
  await page.getByRole('link',{name:'Review PDF versions'}).click()
  await page.getByLabel('Compare version',{exact:true}).selectOption(one.versionId)
  await page.getByRole('button',{name:'Show selected versions'}).click()
  const v2=page.getByRole('region',{name:'Version 2',exact:true}),v1=page.getByRole('region',{name:'Version 1',exact:true})
  for(const [region,label]of [[v2,'v2'],[v1,'v1']]){
   await expect(region.getByRole('status')).toHaveText('Verified PDF · 2 pages',{timeout:45000})
   await expect(region.getByRole('img',{name:'PDF page 2'})).toBeVisible()
   await region.getByText('Page 2 text',{exact:true}).click()
   await expect(region.getByText('Back draft '+label,{exact:true})).toBeVisible()
  }
  const canvas=v2.getByRole('img',{name:'PDF page 2'}),pixels=await canvas.evaluate(c=>{const p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let ink=0;for(let i=0;i<p.length;i+=4)if(p[i]<100&&p[i+1]<100&&p[i+2]<100&&p[i+3])ink++;return ink})
  assert.ok(pixels>50,'the actual PDF text is painted onto its page')
  await capture('comparison')
  const add=page.getByRole('form',{name:'Add feedback to version 2'})
  await add.getByLabel('Page',{exact:true}).focus();await add.getByLabel('Page',{exact:true}).selectOption('2');await page.keyboard.press('Tab')
  await expect(add.getByLabel('Horizontal coordinate',{exact:true})).toBeFocused()
  await add.getByLabel('Horizontal coordinate',{exact:true}).fill('0.25');await page.keyboard.press('Tab')
  await expect(add.getByLabel('Vertical coordinate',{exact:true})).toBeFocused();await add.getByLabel('Vertical coordinate',{exact:true}).fill('0.75');await page.keyboard.press('Tab')
  await expect(add.getByLabel('Feedback',{exact:true})).toBeFocused();await page.keyboard.type('Tighten the second-page heading')
  await page.keyboard.press('Tab');await expect(add.getByRole('button',{name:'Add pinned feedback'})).toBeFocused();await page.keyboard.press('Enter')
  await expect(page.locator('[data-feedback-id]')).toHaveCount(1)
  const pin=(await f.view()).feedback[0]
  assert.deepEqual([pin.version_id,pin.page,pin.x,pin.y,pin.author_id],[two.versionId,2,0.25,0.75,writer.id])
  await page.getByRole('link',{name:'Pin 1 · Page 2'}).click()
  await expect(page.locator('[data-feedback-id]')).toContainText('PDF reviewer')
  const edit=page.getByRole('form',{name:'Edit pin 1 on version 2'})
  await edit.getByLabel('Feedback status',{exact:true}).selectOption('resolved')
  await edit.getByRole('button',{name:'Save feedback'}).click()
  await page.getByText('Version-specific history',{exact:true}).click()
  await expect(page.locator('[data-feedback-id] details')).toContainText('resolved')
  await expect(page.locator('[data-feedback-id] details li')).toHaveCount(2)
  await expect(page.getByRole('region',{name:'Version 2',exact:true}).getByRole('status')).toHaveText('Verified PDF · 2 pages')
  await capture('resolved-history')
  const three=await f.upload('v3',f.hidden.id),v3=await pass(owner.post(api+'/versions',{attachmentId:three.file.id,currentVersion:two.versionId}))
  // The ordinary review entry stays usable for a reader of retained bytes only.
  const readerContext=await browser.newContext({viewport:{width:1440,height:1000}})
  try{
   await readerContext.addCookies(f.reader.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:w.origin})))
   const readerPage=await readerContext.newPage()
   await readerPage.goto(w.origin+'/app/tasks/'+f.task.id)
   await readerPage.getByRole('link',{name:'Proof reviews',exact:true}).click()
   await readerPage.getByRole('link',{name:'Review PDF versions'}).click()
   await expect(readerPage.getByRole('region',{name:'Version 2',exact:true}).getByRole('status')).toHaveText('Verified PDF · 2 pages')
   await expect(readerPage.getByRole('heading',{name:'Version 2 · Retained',exact:true})).toBeVisible()
   await expect(readerPage.locator('[data-proof-version]')).toHaveCount(1)
   await expect(readerPage.getByLabel('Review version',{exact:true}).locator('option')).toHaveText(['Version 2 · synthetic-pegboard-v2.pdf'])
   await expect(readerPage.getByRole('form',{name:'Add feedback to version 2'})).toHaveCount(0)
   await expect(readerPage.getByRole('form',{name:'Edit pin 1 on version 2'})).toHaveCount(0)
   assert.ok(!(await readerPage.content()).includes(v3.versionId),'the hidden current version is not disclosed')
   await capture('reader-retained-entry',{target:readerPage})
  }finally{await readerContext.close()}
  await page.goto(here+'?version='+v3.versionId+'&compare='+two.versionId)
  await expect(page.getByRole('region',{name:'Version 3',exact:true}).getByRole('status')).toHaveText('Verified PDF · 2 pages')
  await expect(page.getByRole('region',{name:'Version 3',exact:true})).toContainText('No feedback on this version.')
  await expect(page.getByRole('region',{name:'Version 2',exact:true}).locator('[data-feedback-id]')).toHaveAttribute('data-feedback-id',pin.id)
  await capture('retained-after-replacement')
  // Revoke one selected file after the HTML review, before its real material read.
  const material=api+'/versions/'+one.versionId+'/material'
  await page.route('**'+material,async route=>{
   await pass(owner.post('/api/v1/grants/'+f.hiddenGrant.id+'/revoke',{}))
   await route.continue()
  },{times:1})
  const refused=page.waitForResponse(response=>response.url()===w.origin+material)
  await page.goto(here+'?version='+two.versionId+'&compare='+one.versionId)
  assert.equal((await refused).status(),404)
  await expect(v2.getByRole('status')).toHaveText('Verified PDF · 2 pages')
  await expect(v1.getByRole('status')).toHaveText('PDF unavailable. Refresh to check current access and retained bytes.')
  await expect(v1.locator('canvas')).toHaveCount(0)
  await expect(v1.getByText('Back draft v1',{exact:true})).toHaveCount(0)
  await capture('revoked-source',{unavailable:true})
  const refresh=await page.goto(here+'?version='+two.versionId+'&compare='+one.versionId)
  assert.equal(refresh.status(),404)
  await expect(page.locator('[data-proof-review]')).toHaveCount(0)
  await page.goto(here+'?version='+two.versionId)
  await expect(v2.getByRole('status')).toHaveText('Verified PDF · 2 pages')
  assert.equal((await f.view()).feedback[0].id,pin.id)
  assert.deepEqual(errors,[])
  console.log('PROBE PEG-011 UI: keyboard selects retained PDF comparison, adds a page-coordinate pin and resolves it -> real page pixels and text, exact author and retained v2 history after v3; screens inspected at 1440 and 390')
  console.log('PROBE PEG-011 retained entry: reader follows task and proof list after hidden v3 replacement -> readable v2 opens with retained feedback, no hidden version identity or annotation controls')
  console.log('PROBE PEG-011 unavailable source: revoke selected v1 access before material read -> 404, no v1 pixels or text, permitted v2 still renders; refreshed hidden comparison refuses')
 }finally{await context.close()}
}
