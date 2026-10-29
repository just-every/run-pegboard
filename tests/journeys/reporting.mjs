import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {expect} from '@playwright/test'
import {reportingScenario} from '../scenarios/reporting.mjs'
export async function reportingJourney({w,browser}) {
 const seeded=await reportingScenario(w,{erase:false}),owner=w.owner
 const output=process.env.PEGBOARD_REPORT_PROOF_DIR
 if(output)await mkdir(output,{recursive:true})
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true})
 await context.addCookies(owner.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:w.origin})))
 const page=await context.newPage()
 const proof=async(name)=>{if(!output)return;for(const width of [1440,390]){await page.setViewportSize({width,height:width===390?844:1000});await page.screenshot({path:join(output,`${name}-${width}.png`),fullPage:true})}await page.setViewportSize({width:1440,height:1000})}
 try {
  await page.goto(w.origin+'/app/reports')
  await page.getByRole('link',{name:'Report settings',exact:true}).click()
  const form=page.getByRole('form',{name:'Create a dashboard'})
  await form.getByLabel('Dashboard name',{exact:true}).fill('Buyer dashboard')
  for(const project of seeded.projects)await form.getByLabel(project.name,{exact:true}).check()
  await form.getByLabel('First local day',{exact:true}).fill('2026-03-06')
  await form.getByLabel('Last local day',{exact:true}).fill('2026-03-10')
  await form.getByLabel('IANA timezone',{exact:true}).fill('America/New_York')
  await form.getByLabel('Burn up measure',{exact:true}).selectOption('effort')
  await form.getByLabel('Burn down measure',{exact:true}).selectOption('effort')
  await proof('settings')
  await form.getByRole('button',{name:'Save dashboard'}).click()
  await expect(page.getByRole('heading',{name:'Buyer dashboard',exact:true})).toBeVisible()
  await page.getByRole('button',{name:'Capture report',exact:true}).click()
  await page.waitForURL(/snapshot=/)
  const url=page.url(),id=new URL(url).pathname.split('/').at(-1),snapshot=new URL(url).searchParams.get('snapshot')
  const response=await owner.get(`/api/v1/reports/${id}/snapshots/${snapshot}`)
  assert.equal(response.status,200)
  const report=response.body
  assert.equal(report.widgets.length,8)
  await expect(page.getByRole('status')).toContainText('earlier history is unknown')
  const expected=[['1','1','1'],['1','1','1'],['Unknown','Unknown','4','3','3'],['1','1','1'],['3'],null,['Unknown','Unknown','5','0','5'],['Unknown','Unknown','5','10','5']]
  for(const [index,widget] of report.widgets.entries()){
   const values=page.locator(`[data-report-value^="${index}:"]`)
   assert.equal(await values.count(),widget.values.length)
   if(expected[index])for(const [point,value] of expected[index].entries())await expect(values.nth(point).locator('strong')).toHaveText(widget.values[point].label+': '+value)
  }
  // Inspect the actual plotted marks as well as the source-row value lists.
  const chart=kind=>page.getByRole('img',{name:kind+' chart',exact:true})
  const bars=await chart('Horizontal bar').locator('rect').evaluateAll(nodes=>nodes.map(n=>Number(n.getAttribute('width'))))
  assert.equal(bars.length,3);assert.ok(bars.every(n=>n>0&&n===bars[0]),'equal status counts draw equal horizontal bars')
  const columns=await chart('Vertical column').locator('rect').evaluateAll(nodes=>nodes.map(n=>Number(n.getAttribute('height'))))
  assert.equal(columns.length,3);assert.ok(columns.every(n=>n>0&&n===columns[0]),'equal status counts draw equal columns')
  const slices=await chart('Donut').locator('circle').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('stroke-dasharray').split(' ').map(Number)))
  assert.equal(slices.length,3);for(const [part,gap] of slices)assert.ok(Math.abs(part/(part+gap)-1/3)<0.000001,'each slice reconciles to one of three tasks')
  const line=await chart('Line').locator('circle').evaluateAll(nodes=>nodes.map(n=>Number(n.getAttribute('cy'))))
  assert.equal(line.length,3,'unknown history has no invented plotted marks');assert.ok(line[0]<line[1]&&line[1]===line[2],'the line draws four tasks followed by three and three')
  for(const [kind,rises] of [['Burn up',false],['Burn down',true]]){
   const points=await chart(kind).locator('circle').evaluateAll(nodes=>nodes.map(n=>Number(n.getAttribute('cy'))))
   assert.equal(points.length,3);assert.ok(points[0]===points[2]&&(rises?points[1]<points[0]:points[1]>points[0]),'reopening and effort changes are drawn in the burn curve')
   assert.equal(await chart(kind).locator('line[stroke-dasharray]').count(),2,'known scope is drawn independently of progress')
  }
  const shared=page.locator('[data-report-value="0:2"]')
  await shared.locator('summary').click()
  await shared.getByRole('link',{name:'Shared deliverable',exact:true}).click()
  assert.ok(new URL(page.url()).hash==='#source-'+seeded.a.id)
  await page.locator('#source-'+seeded.a.id).getByRole('link',{name:'Shared deliverable',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Shared deliverable',exact:true})).toBeVisible()
  await page.goto(url)
  for(const format of ['CSV','XLSX','PDF']){
   const pending=page.waitForEvent('download')
   await page.getByRole('link',{name:'Download '+format,exact:true}).click()
   const download=await pending,bytes=await readFile(await download.path())
   assert.ok(bytes.length>100)
   if(format==='CSV')assert.ok(bytes.toString().includes(snapshot))
   if(format==='XLSX')assert.equal(bytes.subarray(0,2).toString(),'PK')
   if(format==='PDF')assert.equal(bytes.subarray(0,8).toString(),'%PDF-1.4')
  }
  await page.reload()
  await expect(page.locator('[data-report-snapshot]')).toHaveText(snapshot)
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  assert.equal(await page.locator('button,a').evaluateAll(nodes=>nodes.filter(e=>!e.textContent.trim()&&e.querySelector('svg,img')).length),0,'all reporting actions have visible text')
  await proof('dashboard')
  const guest=await browser.newContext({viewport:{width:1440,height:1000}})
  try {
   await guest.addCookies(seeded.guest.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:w.origin})))
   const denied=await guest.newPage()
   assert.equal((await denied.goto(url)).status(),404)
   assert.ok(!(await denied.content()).includes('Shared deliverable'))
  } finally {await guest.close()}
 } finally {await context.close()}
}
