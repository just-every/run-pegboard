import assert from 'node:assert/strict'
import {expect} from '@playwright/test'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {providerLogFixture,pass,previewLogs,query} from '../scenarios/provider-log-retention.mjs'

// Assertions run at 1440; the same changed screens are captured once more at 390.
export async function providerLogRetentionJourney({w,browser,services}){
 const f=await providerLogFixture(w,services),{owner}=f
 const expected=(await previewLogs(f)).providerRows.filter(row=>row.reason===null).map(row=>row.id)
 const context=await browser.newContext({viewport:{width:1440,height:900}})
 await context.addCookies(owner.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:w.origin})))
 const page=await context.newPage()
 const proof=async name=>{
  if(!process.env.PEGBOARD_PROOF_DIR)return
  await mkdir(process.env.PEGBOARD_PROOF_DIR,{recursive:true})
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:width===1440?900:844})
   await page.screenshot({path:join(process.env.PEGBOARD_PROOF_DIR,`provider-log-${name}-${width}.png`),fullPage:true})
  }
  await page.setViewportSize({width:1440,height:900})
 }
 try{
  await page.goto(w.origin+'/app/data')
  const form=page.getByRole('form',{name:'Review expiry',exact:true})
  await form.getByLabel('Class to expire').selectOption('provider_logs')
  await form.getByRole('button',{name:'Preview eligible records',exact:true}).focus();await page.keyboard.press('Enter')
  const review=page.getByRole('region',{name:'Exact provider diagnostic review'})
  for(const id of expected)await expect(review).toContainText('Diagnostic '+id)
  await expect(review).toContainText('Eligible for reviewed expiry.')
  await expect(review).toContainText('No matching settled acknowledgment')
  await expect(page.locator('main')).toContainText('No provider is contacted.')
  const confirmation=page.getByRole('form',{name:'Confirm expiry',exact:true})
  await expect(confirmation.getByRole('checkbox')).not.toBeChecked()
  await proof('review')
  // Invalidate the exact browser review through the ordinary hold door.
  const hold=await pass(owner.post('/api/v1/data/holds',{type:'project',id:f.project.id,authority:'Browser review hold',expiresAt:Date.now()+86400000}))
  await confirmation.getByRole('checkbox').focus();await page.keyboard.press('Space')
  await confirmation.getByRole('button',{name:'Expire reviewed records',exact:true}).focus();await page.keyboard.press('Enter')
  await expect(page.locator('main')).toContainText('Review the exact expiry scope again before confirming.')
  await proof('stale-refusal')
  await page.goto(w.origin+'/app/data?review=expiry&class=provider_logs')
  await expect(page.locator('main')).toContainText('An active hold pauses provider diagnostic expiry.')
  await proof('held-review')
  assert.deepEqual(await query(w,'SELECT * FROM peg_time_delivery_history ORDER BY id'),f.rows)
  await pass(owner.post(`/api/v1/data/holds/${hold.id}/release`,{confirm:true}))
  await page.goto(w.origin+'/app/data?review=expiry&class=provider_logs')
  const confirm=page.getByRole('form',{name:'Confirm expiry',exact:true}),calls=services.requests.length
  await confirm.getByRole('checkbox').focus();await page.keyboard.press('Space')
  await confirm.getByRole('button',{name:'Expire reviewed records',exact:true}).focus();await page.keyboard.press('Enter')
  await page.waitForURL(url=>url.pathname==='/app/data')
  const link=page.getByRole('list',{name:'Data receipts'}).getByRole('link',{name:/^View receipt /}).first()
  await expect(link).toBeVisible()
  const id=(await link.getAttribute('href')).split('/').pop(),receipt=await pass(owner.get('/api/v1/data/receipts/'+id))
  assert.deepEqual(receipt.providerDiagnostics.expired.map(row=>row.id),expected)
  await expect(page.getByRole('list',{name:'Data receipts'})).toContainText('Retained: '+receipt.providerDiagnostics.retained.length+' provider diagnostics')
  const visible=page.getByRole('region',{name:'Provider diagnostic receipt'}).first()
  await expect(visible).toContainText('Expired diagnostics: '+expected.join(', '))
  await expect(visible).toContainText('Delivery ledger and approved time unchanged.')
  await expect(visible).toContainText('No matching settled acknowledgment')
  assert.equal(services.requests.length,calls)
  const rows=await query(w,'SELECT * FROM peg_time_delivery_history ORDER BY id')
  assert.deepEqual(rows.map(row=>row.id),f.rows.filter(row=>!expected.includes(row.id)).map(row=>row.id))
  for(const control of await page.locator('main button,main a').all())assert.ok((await control.innerText()).trim(),'all controls have visible labels')
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  await proof('receipt')
  console.log('PROBE PEG-065 browser: keyboard exact review, stale refusal, hold and receipt -> exact diagnostic IDs at 1440; changed screens captured at 1440 and 390')
 }finally{await context.close()}
}
