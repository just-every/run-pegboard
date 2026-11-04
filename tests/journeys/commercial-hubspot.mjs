import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {expect} from '@playwright/test'
import {hubspotCredential as credential} from '../support/hubspot-services.mjs'
import {pass,commercialInput} from '../scenarios/commercial-hubspot.mjs'
export async function commercialHubspotJourney({w,browser,edge}){
 const context=await browser.newContext({viewport:{width:1440,height:1000}})
 await context.addCookies(w.owner.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:w.origin})))
 const page=await context.newPage(),here=w.origin+'/app/settings/commercial',root='/api/v1/commercial'
 const proof=process.env.PEGBOARD_PROOF_DIR??join(tmpdir(),'pegboard-commercial-proof')
 await mkdir(proof,{recursive:true})
 const capture=async name=>{
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'commercial screen fits the desktop viewport')
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:width===1440?1000:844})
   await page.screenshot({path:join(proof,`commercial-${name}-${width}.png`),fullPage:true})
  }
  await page.setViewportSize({width:1440,height:1000})
 }
 const submit=async(form,name)=>{const button=form.getByRole('button',{name,exact:true});await button.focus();await button.press('Enter');await page.waitForLoadState('domcontentloaded')}
 try{
  await page.goto(here)
  const auth=page.getByRole('form',{name:'Authorize HubSpot portal'})
  await auth.getByLabel('HubSpot portal ID').fill('1001');await auth.getByLabel('Credential for this request',{exact:true}).fill(credential)
  await auth.getByRole('checkbox').focus();await page.keyboard.press('Space')
  await submit(auth,'Authorize portal');await expect(page.getByText('Authorized',{exact:false}).first()).toBeVisible()
  await pass(edge.event(w,'4001','5001'));await page.goto(here)
  const input=commercialInput(w.owner.id),review=page.getByRole('form',{name:'Review deal 4001'})
  await review.getByLabel('Approved template').selectOption(input.templateId)
  await review.getByLabel('Delivery project name').fill('Reviewed customer delivery')
  await review.getByLabel('Start date',{exact:true}).fill(input.startDate)
  await review.getByLabel('Role assignments as JSON').fill(JSON.stringify(input.roles))
  await review.getByLabel('Source credential',{exact:true}).fill(credential)
  await submit(review,'Review adoption');await page.waitForURL(/\?review=/)
  await expect(page.getByRole('heading',{name:'Exact adoption review'})).toBeVisible()
  await expect(page.getByText('Client share preview: no recipients, no grants.',{exact:false})).toBeVisible()
  assert.ok(!(await page.locator('#main').innerText()).includes('synthetic-pegboard-excluded-customer'))
  await capture('review')
  const adopt=page.getByRole('form',{name:'Adopt reviewed handoff'})
  await adopt.getByLabel('Fresh source credential').fill(credential);await adopt.getByRole('checkbox').focus();await page.keyboard.press('Space')
  await submit(adopt,'Adopt private project')
  await expect(page.getByText('Original commitment:',{exact:false})).toBeVisible()
  const data=await pass(w.owner.get(root)),source=data.handoffs.find(h=>h.deal_id==='4001')
  assert.ok(source.project_id);assert.equal(source.commitment.template.name,'Reviewed customer delivery')
  await capture('adopted')
  const ret=page.getByRole('form',{name:'Review return 4001'})
  await ret.getByLabel('Delivery status to return').selectOption('delivered');await ret.getByLabel('Source credential',{exact:true}).fill(credential)
  await submit(ret,'Review status return');await page.waitForURL(/\?review=/)
  await expect(page.getByRole('heading',{name:'Exact return review'})).toBeVisible()
  await capture('return')
  const send=page.getByRole('form',{name:'Send reviewed status'})
  await send.getByLabel('Fresh source credential').fill(credential);await send.getByRole('checkbox').focus();await page.keyboard.press('Space')
  edge.rejectWrite=true;await submit(send,'Send exact status');edge.rejectWrite=false
  await expect(page.getByText('Unresolved exception: hubspot_source_refused')).toBeVisible()
  await capture('exception')
  // A new exact review may follow a definite rejection, but an uncertain write can only be read back.
  const again=page.getByRole('form',{name:'Review return 4001'})
  await again.getByLabel('Source credential',{exact:true}).fill(credential);await submit(again,'Review status return');await page.waitForURL(/\?review=/)
  const uncertain=page.getByRole('form',{name:'Send reviewed status'})
  await uncertain.getByLabel('Fresh source credential').fill(credential);await uncertain.getByRole('checkbox').check()
  edge.lose=true;await submit(uncertain,'Send exact status')
  await expect(page.getByText('Unresolved exception: hubspot_unavailable')).toBeVisible()
  edge.readOutage=false
  const reconcile=page.getByRole('form',{name:/^Reconcile commercialreview_/})
  await reconcile.getByLabel('Source credential for readback').fill(credential);await submit(reconcile,'Reconcile source readback')
  await expect(page.getByText('acknowledged',{exact:true})).toBeVisible();assert.equal(edge.writes,1)
  await pass(edge.event(w,'4002','5002'));await page.goto(here)
  const decline=page.getByRole('form',{name:'Decline deal 4002'})
  await decline.getByRole('checkbox').focus();await page.keyboard.press('Space');await submit(decline,'Decline handoff')
  assert.equal((await pass(w.owner.get(root))).handoffs.find(h=>h.deal_id==='4002').project_id,null)
  console.log('PROBE PEG-041 browser: keyboard review, private adoption, exact return, rejected exception and uncertain readback -> one mapped project and one provider write; schema-fake; proof='+proof)
 }finally{await context.close()}
}
