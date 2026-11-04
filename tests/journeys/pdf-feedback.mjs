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
 const capture=async name=>{
  for(const status of await page.locator('[data-pdf-status]').all())await expect(status).toHaveText('Verified PDF · 2 pages')
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000})
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' reflows at '+width)
   if(process.env.PEGBOARD_PROOF_DIR){await mkdir(process.env.PEGBOARD_PROOF_DIR,{recursive:true});await page.screenshot({path:join(process.env.PEGBOARD_PROOF_DIR,'pdf-'+name+'-'+width+'.png'),fullPage:true})}
  }
  await page.setViewportSize({width:1440,height:1000})
 }
 const here=w.origin+'/app/proof-viewer/'+proof.id
 try{
  await page.goto(w.origin+'/app/proofs/'+f.task.id)
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
  const three=await f.upload('v3'),v3=await pass(owner.post(api+'/versions',{attachmentId:three.file.id,currentVersion:two.versionId}))
  await page.goto(here+'?version='+v3.versionId+'&compare='+two.versionId)
  await expect(page.getByRole('region',{name:'Version 3',exact:true}).getByRole('status')).toHaveText('Verified PDF · 2 pages')
  await expect(page.getByRole('region',{name:'Version 3',exact:true})).toContainText('No feedback on this version.')
  await expect(page.getByRole('region',{name:'Version 2',exact:true}).locator('[data-feedback-id]')).toHaveAttribute('data-feedback-id',pin.id)
  await capture('retained-after-replacement')
  assert.deepEqual(errors,[])
  console.log('PROBE PEG-011 UI: keyboard selects retained PDF comparison, adds a page-coordinate pin and resolves it -> real page pixels and text, exact author and retained v2 history after v3; screens inspected at 1440 and 390')
 }finally{await context.close()}
}
