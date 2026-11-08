import assert from 'node:assert/strict'
import {mkdir,readFile} from 'node:fs/promises'
import {join} from 'node:path'
import {expect} from '@playwright/test'
import {reportingScenario,reportingBusinessScenario} from '../scenarios/reporting.mjs'
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
  const business=await reportingBusinessScenario(w)
  await page.goto(w.origin+'/app/settings/reports')
  const settings=page.getByRole('form',{name:'Create a dashboard'})
  await settings.getByLabel('Dashboard name',{exact:true}).fill('Business buyer dashboard')
  for(const project of business.projects)await settings.getByLabel(project.name,{exact:true}).check()
  await settings.getByLabel('First local day',{exact:true}).fill('2026-03-06')
  await settings.getByLabel('Last local day',{exact:true}).fill('2026-03-10')
  for(const widget of business.input.widgets.slice(0,8))await settings.getByLabel(widget.kind.replace(/-/g,' ').replace(/^./,c=>c.toUpperCase())+' measure',{exact:true}).selectOption(widget.measure)
  await proof('business-settings')
  const save=settings.getByRole('button',{name:'Save dashboard',exact:true})
  await save.focus();await expect(save).toBeFocused();await page.keyboard.press('Enter')
  await expect(page.getByRole('heading',{name:'Business buyer dashboard',exact:true})).toBeVisible()
  const capture=page.getByRole('button',{name:'Capture report',exact:true})
  await capture.focus();await expect(capture).toBeFocused();await page.keyboard.press('Enter')
  await page.waitForURL(/snapshot=/)
  const businessUrl=page.url(),businessId=new URL(businessUrl).pathname.split('/').at(-1),businessSnapshot=new URL(businessUrl).searchParams.get('snapshot')
  const actual=(await owner.get(`/api/v1/reports/${businessId}/snapshots/${businessSnapshot}`)).body
  const expectedBusiness=[[1.75,0,0],[20,0,0],[0,0,1,0,0],[3,0,0],[6],[]]
  // The earlier scenario reopened its approved task; the new capture shows that current state.
  for(const [i,expected] of expectedBusiness.entries()){
   assert.deepEqual(actual.widgets[i].values.map(v=>v.value),expected)
   const rendered=page.locator(`[data-report-value^="${i}:"]`)
   assert.equal(await rendered.count(),expected.length)
   for(const [j,value] of expected.entries())await expect(rendered.nth(j).locator('strong')).toHaveText(actual.widgets[i].values[j].label+': '+value)
  }
  await expect(page.getByText('This is a current plan for the selected days, not a historical capacity trend.',{exact:false})).toBeVisible()
  const timeRow=page.locator('[data-report-value="0:0"]')
  await timeRow.locator('summary').click()
  await timeRow.getByRole('link',{name:/^Business record /}).first().click()
  assert.ok(new URL(page.url()).hash.startsWith('#metric-approved-hours:'))
  const source=page.locator('[data-report-metric="approved-hours"]').first()
  await expect(source.getByRole('link',{name:'Timesheet record',exact:true})).toBeVisible()
  await source.getByRole('link',{name:'Timesheet record',exact:true}).click()
  await expect(page.getByRole('heading',{name:/timesheet/i,level:1})).toBeVisible()
  await page.goto(businessUrl)
  for(const format of ['CSV','XLSX','PDF']){
   const pending=page.waitForEvent('download')
   await page.getByRole('link',{name:'Download '+format,exact:true}).click()
   const downloaded=await pending,bytes=await readFile(await downloaded.path())
   assert.ok(bytes.length>100)
   if(format==='CSV'){assert.ok(bytes.toString().includes(businessSnapshot));assert.ok(bytes.toString().includes('approved-hours'));assert.ok(!bytes.toString().includes('Never export time notes'))}
  }
  await page.reload()
  await expect(page.locator('[data-report-snapshot]')).toHaveText(businessSnapshot)
  await page.goto(w.origin+'/app/reports/'+business.dashboard.id+'?snapshot='+business.report.id)
  await expect(page.locator('[data-report-value="8:0"] strong')).toHaveText('Total: 20')
  for(const [index,value] of [2,0,0,2,0].entries())await expect(page.locator(`[data-report-value="9:${index}"] strong`)).toHaveText(business.report.widgets[9].values[index].label+': '+value)
  await proof('business-dashboard')
  await page.goto(w.origin+'/app/reports/'+business.signed.id+'?snapshot='+business.signedReport.id)
  await expect(page.getByRole('heading',{name:'Approved correction day',exact:true})).toBeVisible()
  await expect(page.getByText('Total: -0.25',{exact:true})).toBeVisible()
  assert.ok(await page.getByRole('img',{name:'Horizontal bar chart',exact:true}).locator('rect').first().evaluate(e=>Number(e.getAttribute('width'))>0))
  assert.ok(await page.getByRole('img',{name:'Vertical column chart',exact:true}).locator('rect').first().evaluate(e=>Number(e.getAttribute('height'))>0))
  await expect(page.getByText('Signed values have no donut proportion.',{exact:false})).toBeVisible()
  await proof('correction-dashboard')
  await intakeReportingJourney({w,browser,page,proof})
  const guest=await browser.newContext({viewport:{width:1440,height:1000}})
  try {
   await guest.addCookies(seeded.guest.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:w.origin})))
   const denied=await guest.newPage()
   assert.equal((await denied.goto(url)).status(),404)
   assert.ok(!(await denied.content()).includes('Shared deliverable'))
  } finally {await guest.close()}
 } finally {await context.close()}
}


// A submitted form becomes an identifiable report source through the ordinary keyboard doors.
async function intakeReportingJourney({w,browser,page,proof}) {
 const owner=w.owner,ok=async(p,status=200)=>{const r=await p;assert.equal(r.status,status,JSON.stringify(r.body));return r.body}
 const project=await ok(owner.post('/api/v1/projects',{name:'Submitted request reporting'}))
 const form=await ok(owner.post(`/api/v1/projects/${project.id}/intake/forms`,{name:'Reporting intake',fields:[{id:'title',label:'Report request title',required:true},{id:'detail',label:'Private request answer',required:true}],mapping:{title:'title',description:['detail'],ownerId:owner.id,priority:'normal'},hours:8}))
 const formBase=`/api/v1/intake/forms/${form.id}`,review=await ok(owner.get(formBase+'/review'))
 await ok(owner.post(formBase+'/publish',{version:form.version,review:review.review,audience:'internal',consent:true}))
 await page.goto(w.origin+'/app/intake/'+form.id)
 const request=page.getByRole('form',{name:'Submit request'})
 await request.getByLabel('Report request title',{exact:true}).fill('Submitted report source')
 await request.getByLabel('Private request answer',{exact:true}).fill('Private answer stays out of reports')
 await proof('receipt-form')
 const submit=request.getByRole('button',{name:'Submit request',exact:true})
 await submit.focus();await expect(submit).toBeFocused();await page.keyboard.press('Enter')
 await expect(page.getByRole('heading',{name:'Request received',exact:true})).toBeVisible()
 const receipt=new URL(page.url()).searchParams.get('receipt')
 assert.ok(receipt)
 const queue=await ok(owner.get(`/api/v1/projects/${project.id}/intake`)),item=queue.items.find(row=>row.id===receipt)
 assert.ok(item)
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:['America','New_York'].join('/'),year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(item.submittedAt)
 const part=name=>parts.find(p=>p.type===name).value,day=part('year')+'-'+part('month')+'-'+part('day')
 const input={name:'Submitted requests dashboard',projects:[project.id],start:day,end:day,timezone:['America','New_York'].join('/'),widgets:['horizontal-bar','vertical-column','line','donut','single-number','table'].map(kind=>({kind,measure:'requests'}))}
 const dashboard=await ok(owner.post('/api/v1/reports',input))
 await page.goto(w.origin+'/app/reports/'+dashboard.id)
 const capture=page.getByRole('button',{name:'Capture report',exact:true})
 await capture.focus();await page.keyboard.press('Enter');await page.waitForURL(/snapshot=/)
 const reportUrl=page.url(),snapshot=new URL(reportUrl).searchParams.get('snapshot'),download=`/api/v1/reports/${dashboard.id}/snapshots/${snapshot}`
 const report=await ok(owner.get(download))
 assert.deepEqual(report.metrics.map(row=>[row.id,row.taskId,row.projectId]),[[receipt,item.taskId,project.id]])
 for(const [index,widget] of report.widgets.entries()){
  const values=page.locator(`[data-report-value^="${index}:"]`)
  assert.equal(await values.count(),widget.values.length)
  for(const [j,value] of widget.values.entries())await expect(values.nth(j).locator('strong')).toHaveText(value.label+': '+value.value)
 }
 assert.ok(!(await page.locator('main').innerText()).includes('Private answer stays out of reports'))
 const value=page.locator('[data-report-value="4:0"]'),summary=value.locator('summary')
 await summary.focus();await page.keyboard.press('Enter')
 const record=value.getByRole('link',{name:'Business record requests:'+receipt,exact:true})
 await record.focus();await expect(record).toBeFocused();await page.keyboard.press('Enter')
 assert.equal(decodeURIComponent(new URL(page.url()).hash),'#metric-requests:'+receipt)
 const source=page.locator('[data-report-metric="requests"]')
 await expect(source.locator('code')).toHaveText(receipt)
 const task=source.getByRole('link',{name:'Submitted report source',exact:true})
 await task.focus();await expect(task).toBeFocused();await page.keyboard.press('Enter')
 await expect(page.getByRole('heading',{name:'Submitted report source',exact:true})).toBeVisible()
 assert.equal(new URL(page.url()).pathname,'/app/tasks/'+item.taskId)
 await page.goto(reportUrl)
 for(const format of ['CSV','XLSX','PDF']){
  const pending=page.waitForEvent('download'),link=page.getByRole('link',{name:'Download '+format,exact:true})
  await link.focus();await page.keyboard.press('Enter')
  const downloaded=await pending,bytes=await readFile(await downloaded.path())
  assert.ok(bytes.includes(Buffer.from(receipt)),'the actual download contains the submitted receipt')
  assert.ok(!bytes.includes(Buffer.from('Private answer stays out of reports')))
 }
 await proof('receipt-dashboard')
 assert.equal(await page.locator('main button,main a').evaluateAll(nodes=>nodes.filter(n=>!n.textContent.trim()).length),0,'reporting controls use visible words')
 const guest=await w.person(['synthetic-pegboard-report-browser','example.test'].join(String.fromCharCode(64)),'Report browser guest','guest')
 const grant=await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:project.id,granteeId:guest.id,level:'viewer'}))
 const guestDashboard=await ok(guest.post('/api/v1/reports',input)),guestBase=`/api/v1/reports/${guestDashboard.id}`,saved=await ok(guest.post(guestBase+'/capture',{}))
 const context=await browser.newContext({viewport:{width:1440,height:1000}})
 try {
  await context.addCookies(guest.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:w.origin})))
  const screen=await context.newPage(),url=w.origin+'/app/reports/'+guestDashboard.id+'?snapshot='+saved.id
  await screen.goto(url);await expect(screen.locator('[data-report-metric="requests"] code')).toHaveText(receipt)
  await ok(owner.delete(`/api/v1/grants/${grant.id}`))
  assert.equal((await screen.reload()).status(),404)
  assert.ok(!(await screen.locator('main').innerText()).includes('Submitted report source'))
  for(const format of ['csv','xlsx','pdf'])assert.equal((await screen.request.get(w.origin+guestBase+'/snapshots/'+saved.id+'?format='+format)).status(),404)
  if(process.env.PEGBOARD_REPORT_PROOF_DIR)for(const width of [1440,390]){
   await screen.setViewportSize({width,height:width===390?844:1000})
   await screen.screenshot({path:join(process.env.PEGBOARD_REPORT_PROOF_DIR,'receipt-revoked-'+width+'.png'),fullPage:true})
  }
 } finally {await context.close()}
}
