import { sheetsExportJourney } from './sheets-export.mjs'
import { startSheetsService } from '../support/sheets-service.mjs'
import {reportingJourney} from './reporting.mjs'
import {accessPrivacyJourney} from './access-privacy.mjs'
import {accessDiscoveryJourney} from './access-discovery.mjs'
import {analystJourney} from './analytics.mjs'
import { calendarBlocksJourney } from './calendar-blocks.mjs'
import { startCalendarServices } from '../support/calendar-services.mjs'
import {capacityJourney} from './capacity.mjs'
import {startCapacityServices} from '../support/capacity-services.mjs'
import {publicApiJourney} from './public-api.mjs'
import {approvalRoutingJourney} from './approval-routing.mjs'
import {guestJourney} from './guests.mjs'
import { recoveryJourney } from './recovery.mjs'
import { memberRemovalJourney } from './member-removal.mjs'
import {workflowBundleJourney} from './workflow-bundles.mjs'
import {deliveryRegisterJourney} from './delivery-register.mjs'
// The PEG-001 and PEG-020 screens, driven in a browser at 1440 and 390 px: build and share work through Projects, what a
// guest is never shown, a refused link turned into a request that an admin approves, and a stale tab refused.
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import { chromium, expect } from '@playwright/test'
import { startWorker,proofDocument } from '../support/worker.mjs'
import { startEngineeringServices,vectorTodo,vectorDone } from '../support/engineering-services.mjs'
import { startTimeServices } from '../support/time-services.mjs'
import { startMeetingServices } from '../support/meeting-services.mjs'
import { planningCanvasJourney } from './planning-canvas.mjs'
import { portfolioJourney } from './portfolios.mjs'
import { timelineJourney } from './timeline.mjs'

const journeyNames = ["sheets", "reporting", "access-privacy", "access-discovery", "analytics", "calendar-blocks", "capacity", "public-api", "approval-routing", "guests", "core", "recurrence", "approvals", "time-packets", "goals", "engineering", "meetings", "custody", "recovery", "departure", "canvas", "portfolio", "timeline", "register", "bundles"]
const selected = new Set(process.env.PEGBOARD_JOURNEY === undefined ? journeyNames : process.env.PEGBOARD_JOURNEY.split(',').map(name => name.trim()))
for (const name of selected) if (!journeyNames.includes(name)) throw new Error(`Unknown PEGBOARD_JOURNEY: ${name}`)

// Harvest and QuickBooks Time schema fakes at the network edge; every Worker below reaches them through local origins.
const engineering = await startEngineeringServices(), meetings = await startMeetingServices()
const sheetsService = await startSheetsService()
const capacityServices = await startCapacityServices(), calendarServices = await startCalendarServices()
const services = await startTimeServices(), settings = { PEGBOARD_LOCAL_SHEETS_ORIGIN:sheetsService.origin, PEGBOARD_LOCAL_CALENDAR_ORIGINS:calendarServices.origins, PEGBOARD_LOCAL_CAPACITY_ORIGINS:capacityServices.origins, PEGBOARD_LOCAL_TIME_SERVICE_ORIGINS: services.origins, PEGBOARD_VECTOR_ORIGIN:'https://vector.example.com',PEGBOARD_LOCAL_ENGINEERING_ORIGINS:engineering.origins, PEGBOARD_LOCAL_MEETING_ORIGINS:meetings.origins }
let w = await startWorker({ settings })
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}), args: ['--use-mock-keychain', '--password-store=basic', '--no-sandbox'] })
const cookies = client => client.cookie.split('; ').map(pair => ({ name: pair.slice(0, pair.indexOf('=')), value: pair.slice(pair.indexOf('=') + 1), url: w.origin }))
const sizes = [['1440', { width: 1440, height: 900 }], ['390', { width: 390, height: 844 }]]
try {
  let owner = w.owner
  const ok = (r, status = 200) => { assert.equal(r.status, status, JSON.stringify(r.body)); return r.body }
  let usedWorker = false
  const select = async name => {
    if (!selected.has(name)) return false
    if (usedWorker) {
      await w.stop()
      w = await startWorker({ settings })
      owner = w.owner
    }
    usedWorker = true
    return true
  }
  if(await select('access-privacy'))await accessPrivacyJourney({w,browser,owner,cookies})
  if(await select('access-discovery'))await accessDiscoveryJourney({w,browser,ok})
  if(await select('reporting'))await reportingJourney({w,browser})
  if(await select('analytics'))await analystJourney({w,browser,owner,ok})
  if(await select('sheets'))await sheetsExportJourney({w,browser,edge:sheetsService,ok})
  if(await select('calendar-blocks'))await calendarBlocksJourney({w,browser,services:calendarServices,ok})
  if(await select('capacity'))await capacityJourney({w,browser,services:capacityServices,ok})
  if(await select('public-api'))await publicApiJourney({w,browser,owner,cookies})
  if(await select('approval-routing'))await approvalRoutingJourney({w,browser,owner,cookies})
  if(await select('guests'))await guestJourney({w,browser,owner,sizes,cookies})
  if (await select('core')) {
  ok(await owner.post('/api/v1/teams', { name: 'Brand crew', privacy: 'public' }))
  for (const [size, viewport] of sizes) {
    const open = async client => { const context = await browser.newContext({ viewport }); await context.addCookies(cookies(client)); return { context, page: await context.newPage() } }
    const flat = async page => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `no sideways scroll at ${size}: ${page.url()}`)
    const gus = await w.person(`gus${size}@example.com`, `Gus ${size}`, 'guest'), nina = await w.person(`nina${size}@example.com`, `Nina ${size}`), eli = await w.person(`eli${size}@example.com`, `Eli ${size}`)
    const { page, context } = await open(owner)

    // Build a campaign and a launch project, hang one task in both, complete a subtask, read one task ID and one history.
    await page.goto(`${w.origin}/app/projects`)
    for (const name of [`Campaign ${size}`, `Launch ${size}`]) {
      await page.locator('form[aria-label="Start a project"] input[name=name]').fill(name)
      await page.getByRole('button', { name: 'Create project' }).click()
      await page.getByRole('link', { name, exact: true }).waitFor()
    }
    await flat(page)
    await page.getByRole('link', { name: `Launch ${size}`, exact: true }).click()
    await page.waitForURL(/\/app\/projects\/prj_/)
    const launchUrl = page.url()
    await page.goto(`${w.origin}/app/projects`); await page.getByRole('link', { name: `Campaign ${size}`, exact: true }).click()
    await page.waitForURL(/\/app\/projects\/prj_/)
    const campaignUrl = page.url(), campaignId = campaignUrl.split('/').pop()
    await page.locator('form[aria-label="Add a task"] input[name=title]').fill(`Hero shot ${size}`)
    await page.getByRole('button', { name: 'Add task' }).click()
    await page.getByRole('link', { name: `Hero shot ${size}` }).click()
    await page.waitForURL(/\/app\/tasks\/tsk_/)
    const taskUrl = page.url(), taskId = taskUrl.split('/').pop()
    await page.locator('form[aria-label="Add a subtask"] input[name=title]').fill('Scout locations')
    await page.getByRole('button', { name: 'Add subtask' }).click()
    await page.locator('form[aria-label="Add to a project"] select[name=projectId]').selectOption({ label: `Launch ${size}` })
    await page.getByRole('button', { name: 'Add to project' }).click()
    await expect(page.locator('#main section .card:has(h2:text-is("Projects")) .rows > li a:first-child')).toHaveText([`Campaign ${size}`, `Launch ${size}`])
    await page.getByRole('link', { name: 'Scout locations' }).click()
    await page.getByRole('button', { name: 'Mark complete' }).click()
    await page.goto(taskUrl)
    assert.equal(await page.locator('.rows li:has-text("Scout locations") .tagline').textContent(), 'Done')
    assert.ok((await page.locator('code').first().textContent()).includes(taskId), 'the task ID is shown')
    assert.equal(await page.locator('.history li:has-text("created the task")').count(), 1, 'one history, created once')
    await flat(page)
    // The same task, not a copy, in both projects' own views.
    for (const url of [campaignUrl, launchUrl]) {
      await page.goto(url)
      assert.equal(await page.locator(`a[href="/app/tasks/${taskId}"]`).count(), 1)
      assert.ok((await page.locator(`.tassel:has(a[href="/app/tasks/${taskId}"])`).innerText()).includes('1/1 subtasks'), 'a change made through one project shows in the other')
      await flat(page)
    }
    // Launch-only material: a private field with a value, and a file attached through that project.
    const launchId = launchUrl.split('/').pop()
    ok(await owner.post(`/api/v1/projects/${launchId}/fields`, { key: 'embargo', label: `Embargo code ${size}` }))
    ok(await owner.post(`/api/v1/tasks/${taskId}/fields`, { projectId: launchId, values: { embargo: 'EMB-SECRET' } }))
    ok(await owner.post(`/api/v1/tasks/${taskId}/attachments?projectId=${launchId}&name=embargo-${size}.txt`, 'embargoed', { 'content-type': 'text/plain' }))

    // A reference, then a prefix change: the old reference still opens the task.
    const prefix = size === '1440' ? 'MKW' : 'MKN'
    await page.goto(`${campaignUrl}/settings`)
    await page.locator('form[aria-label="Reference prefix"] input[name=prefix]').fill(prefix)
    await page.getByRole('button', { name: 'Set prefix' }).click()
    await page.locator('form[aria-label="Reference prefix"] input[name=prefix]').waitFor()
    await page.goto(`${campaignUrl}/settings`)
    await page.locator('form[aria-label="Reference prefix"] input[name=prefix]').fill(`${prefix}X`)
    await page.getByRole('button', { name: 'Set prefix' }).click()
    for (const ref of [`${prefix}-1`, `${prefix}X-1`]) {
      await page.goto(`${w.origin}/app/link/${ref}`)
      assert.ok(page.url().endsWith(`/app/tasks/${taskId}`), `${ref} opens the same task`)
    }
    assert.ok((await page.locator('.muted').first().textContent()).includes(`earlier references ${prefix}-1`))
    await flat(page)

    // A guest on the campaign sees nothing of the launch project, and is offered no request.
    ok(await owner.post('/api/v1/grants', { objectType: 'project', objectId: campaignId, granteeId: gus.id, level: 'commenter' }))
    const guest = await open(gus)
    await guest.page.goto(`${w.origin}/app/projects`)
    const seen = await guest.page.locator('main').innerText()
    assert.ok(seen.includes(`Campaign ${size}`) && !seen.includes(`Launch ${size}`))
    const refused = await guest.page.goto(launchUrl)
    assert.equal(refused.status(), 404)
    assert.ok(!(await guest.page.locator('main').innerText()).includes(`Launch ${size}`))
    assert.equal(await guest.page.locator('form[aria-label="Request access"]').count(), 0, 'a guest has no request option')
    await guest.page.goto(taskUrl)
    const taskText = await guest.page.content()
    assert.ok(!taskText.includes(`Launch ${size}`) && !taskText.includes('EMB-SECRET') && !taskText.includes(`Embargo code ${size}`) && !taskText.includes(`embargo-${size}.txt`), 'a guest sees nothing of the launch project on the shared task')
    for (const path of [`/api/v1/projects/${launchId}/export`, `/api/v1/projects/${launchId}`]) assert.equal((await guest.page.request.get(w.origin + path)).status(), 404)
    const exported = await (await guest.page.request.get(`${w.origin}/api/v1/export`)).text()
    assert.ok(exported.includes(`Hero shot ${size}`) && !exported.includes('EMB-SECRET') && !exported.includes(`Embargo code ${size}`) && !exported.includes(`Launch ${size}`))
    await flat(guest.page); await guest.context.close()

    // A newcomer joins the public team, meets the private campaign's refusal, asks, and the owner approves from the inbox.
    const newcomer = await open(nina)
    await newcomer.page.goto(`${w.origin}/app/teams`)
    await newcomer.page.getByRole('button', { name: /Join as Viewer/ }).click()
    await newcomer.page.waitForURL(/\/app\/teams\/team_/)
    await flat(newcomer.page)
    const denied = await newcomer.page.goto(campaignUrl)
    assert.equal(denied.status(), 404)
    assert.ok(!(await newcomer.page.content()).includes(`Campaign ${size}`))
    await newcomer.page.locator('form[aria-label="Request access"] select[name=level]').selectOption('commenter')
    await newcomer.page.locator('form[aria-label="Request access"] textarea[name=message]').fill('For the shoot')
    await newcomer.page.getByRole('button', { name: 'Request access' }).click()
    assert.ok((await newcomer.page.locator('main').innerText()).includes('Request sent'))
    await flat(newcomer.page)
    await page.goto(`${w.origin}/app/inbox`)
    assert.ok((await page.locator('main').innerText()).includes(`Nina ${size} asks for Commenter access`))
    await flat(page)
    await page.locator('form[aria-label="Approve"] select[name=level]').selectOption('commenter')
    await page.getByRole('button', { name: 'Approve' }).click()
    assert.equal((await newcomer.page.goto(campaignUrl)).status(), 200)
    await newcomer.page.locator(`a[href="/app/tasks/${taskId}"]`).click()
    await newcomer.page.locator('form[aria-label="Comment"] textarea').fill('On my way')
    await newcomer.page.getByRole('button', { name: 'Comment', exact: true }).click()
    assert.ok((await newcomer.page.locator('main').innerText()).includes('On my way'))
    assert.equal(await newcomer.page.locator('form[aria-label="Edit task"]').count(), 0, 'a Commenter is not offered edit')
    await newcomer.context.close()

    // The review shows the same grant and audit the API holds.
    await page.goto(`${w.origin}/app/access-review`)
    const review = ok(await owner.get('/api/v1/admin/access-review'))
    const approved = review.audit.find(row => row.action === 'request.approved' && row.subject === `Nina ${size}`)
    assert.equal(approved.detail.grantedLevel, 'commenter')
    const shown = await page.locator('main').innerText()
    assert.ok(shown.includes(`Nina ${size}`) && shown.includes('approved Commenter (asked Commenter)') && shown.includes('Approved request by Wes Holloway'))
    await flat(page)

    // A tab left open on an Editor's grant is refused the moment it is revoked.
    ok(await owner.post('/api/v1/grants', { objectType: 'project', objectId: campaignId, granteeId: eli.id, level: 'editor' }))
    const editor = await open(eli)
    await editor.page.goto(taskUrl)
    assert.equal(await editor.page.locator('form[aria-label="Edit task"]').count(), 1)
    const grant = ok(await owner.get(`/api/v1/grants?objectType=project&objectId=${campaignId}`)).grants.find(g => g.grantee_id === eli.id)
    ok(await owner.delete(`/api/v1/grants/${grant.id}`))
    await editor.page.locator('form[aria-label="Comment"] textarea').fill('Still here?')
    await editor.page.getByRole('button', { name: 'Comment', exact: true }).click()
    assert.ok((await editor.page.locator('main').innerText()).includes('Not done'))
    assert.ok(ok(await owner.get('/api/v1/admin/access-review')).audit.some(row => row.action === 'grant.revoked' && row.subject === `Eli ${size}`), 'the revocation is in the audit')
    await flat(editor.page); await editor.context.close(); await context.close()
    // Personal-work public UI, in the existing approved cards and controls.
    const personal=await w.person(`personal${size}@example.com`,`Personal ${size}`)
    const own=await open(personal), ownPage=own.page
    await ownPage.goto(`${w.origin}/app/my-tasks`)
    await ownPage.locator('form[aria-label="Add a personal task"] input[name=title]').fill(`Personal plan ${size}`)
    await ownPage.getByRole('button',{name:'Add task',exact:true}).click()
    await ownPage.locator('form[aria-label="Add a personal section"] input[name=name]').fill('Focus')
    await ownPage.getByRole('button',{name:'Add section',exact:true}).click()
    const arrange=ownPage.locator(`form[aria-label="Arrange Personal plan ${size}"]`)
    await arrange.locator('select[name=sectionId]').selectOption({label:'Focus'})
    await arrange.locator('input[name=position]').fill('2')
    await arrange.locator('select[name=today]').selectOption('true')
    await arrange.getByRole('button',{name:'Arrange',exact:true}).click()
    assert.ok((await ownPage.locator('.card:has(h2:text-is("Today"))').innerText()).includes(`Personal plan ${size}`))
    await ownPage.locator('form[aria-label="Day settings"] select[name=sort]').selectOption('manual')
    await ownPage.getByRole('button',{name:'Save day settings'}).click()
    assert.ok((await ownPage.locator('.card:has(h2:text-is("Focus"))').innerText()).includes(`Personal plan ${size}`))
    await ownPage.reload()
    assert.equal(await ownPage.locator(`form[aria-label="Arrange Personal plan ${size}"] input[name=position]`).inputValue(),'2')
    await flat(ownPage)
    const proof=async(name,target=ownPage)=>{const first=target.locator('main a,main button,main input:not([type=hidden]),main select,main textarea').first();if(await first.count()){await first.focus();await target.keyboard.press('Tab');assert.ok(await target.evaluate(()=>document.activeElement!==document.body),'keyboard focus remains in the page')}if(process.env.PEGBOARD_EVIDENCE_DIR){await mkdir(process.env.PEGBOARD_EVIDENCE_DIR,{recursive:true});await target.screenshot({path:join(process.env.PEGBOARD_EVIDENCE_DIR,`${name}-${size}.png`),fullPage:true})}}
    await proof('my-tasks')
    const dstTask=ok(await personal.post('/api/v1/tasks',{title:`DST tomorrow ${size}`,dueDate:'2026-11-01'}))
    ok(await personal.post('/api/v1/my-tasks/settings',{sort:'default',timezone:'America/New_York'}))
    for(const [on,group] of [['2026-10-31','Upcoming'],['2026-11-01','Today']]) {
      await ownPage.goto(`${w.origin}/app/my-tasks?on=${on}`)
      assert.equal(await ownPage.locator(`.card:has(h2:text-is("${group}")) [data-task-id="${dstTask.id}"]`).count(),1)
    }
    await ownPage.clock.install({time:new Date('2030-01-01T05:00:01Z')})
    await ownPage.goto(`${w.origin}/app/my-tasks`)
    const midnightReload=ownPage.waitForEvent('request',r=>r.isNavigationRequest()&&r.url().endsWith('/app/my-tasks'))
    await ownPage.clock.runFor(30001)
    await midnightReload
    await ownPage.waitForLoadState('domcontentloaded')
    await ownPage.clock.setSystemTime(new Date())
    await ownPage.clock.resume()

    const ownProject=ok(await personal.post('/api/v1/projects',{name:`Personal sharing ${size}`}))
    ok(await personal.post('/api/v1/grants',{objectType:'project',objectId:ownProject.id,granteeId:nina.id,level:'viewer'}))
    await ownPage.getByRole('link',{name:`Personal plan ${size}`,exact:true}).click()
    const personalUrl=ownPage.url()
    const adminPersonal=await open(owner)
    assert.equal((await adminPersonal.page.goto(personalUrl)).status(),404,'ordinary admin cannot read personal work')
    await adminPersonal.context.close()
    await ownPage.locator('form[aria-label="Preview personal sharing"] select[name=projectId]').selectOption(ownProject.id)
    await ownPage.getByRole('button',{name:'Preview visibility'}).click()
    assert.ok((await ownPage.locator('main').innerText()).includes(`Nina ${size} · Viewer`))
    await flat(ownPage);await proof('personal-visibility-preview')
    await ownPage.getByRole('button',{name:'Share with reviewed audience'}).click()
    assert.equal((await nina.get(`/api/v1/tasks/${personalUrl.split('/').pop()}`)).status,200)
    assert.equal(await ownPage.locator('form[aria-label="Approve personal sharing"]').count(),0)
    await flat(ownPage);await proof('shared-personal-task')
    // Fields and tags: each definition comes through Project Settings, and all views use the same values.
    const fieldProjects=[]
    for(const name of [`Field campaign ${size}`,`Field launch ${size}`,`Field review ${size}`])fieldProjects.push(ok(await personal.post('/api/v1/projects',{name})))
    const fieldProject=fieldProjects[0].id
    const settingsUrl=`${w.origin}/app/projects/${fieldProject}/settings`
    await ownPage.goto(settingsUrl)
    for(const [key,type,extra] of [['effort','number',{}],['brief','text',{}],['budget','currency',{}],['deadline','date',{}],['reviewers','people',{}],['channel','single',{options:'Web,Email'}],['audiences','multi',{options:'Retail,Wholesale'}],['checked','checkbox',{}],['twice','formula',{expression:'effort * 2'}],['related','rollup',{sourceKey:'twice'}]]) {
      const form=ownPage.locator('form[aria-label="Add a field"]')
      await form.locator('input[name=key]').fill(key)
      await form.locator('input[name=label]').fill(key)
      await form.locator('select[name=type]').selectOption(type)
      for(const [name,value] of Object.entries(extra))await form.locator(`input[name=${name}]`).fill(value)
      await form.getByRole('button',{name:'Add field',exact:true}).click()
      await ownPage.locator('form[aria-label="Add a field"]').waitFor()
    }
    for(const [key,type,extra]of [['hidden_input','number',{visibility:'internal'}],['hidden_result','formula',{expression:'hidden_input * 2'}],['circular_a','formula',{expression:'circular_b + 1'}],['circular_b','formula',{expression:'circular_a + 1'}]])ok(await personal.post(`/api/v1/projects/${fieldProject}/fields`,{key,label:key,type,...extra}))
    const libraryField=ok(await personal.get(`/api/v1/projects/${fieldProject}/fields`)).fields.find(f=>f.key==='effort')
    for(const p of fieldProjects.slice(1)){
      await ownPage.goto(`${w.origin}/app/projects/${p.id}/settings`)
      await ownPage.locator('form[aria-label="Adopt library field"] select').selectOption(libraryField.id)
      await ownPage.getByRole('button',{name:'Use shared field'}).click()
      assert.ok((await ownPage.locator('main').innerText()).includes(libraryField.id))
    }
    await ownPage.goto(settingsUrl)
    const statusForm=ownPage.locator('form[aria-label="Define project status"]')
    await statusForm.locator('input[name=name]').fill('Awaiting review')
    await statusForm.getByRole('button',{name:'Add status'}).click()
    await flat(ownPage);await proof('field-settings')
    const dueInstant='2026-11-01T18:30:59.123Z'
    const instantTask=ok(await personal.post('/api/v1/tasks',{title:`Timestamp deadline ${size}`,projectId:fieldProject,dueDate:dueInstant}))
    await ownPage.goto(`${w.origin}/app/tasks/${instantTask.id}`)
    const instantEdit=ownPage.locator('form[aria-label="Edit task"]')
    await instantEdit.locator('textarea[name=description]').fill('Preserve the exact deadline while editing the brief.')
    await instantEdit.getByRole('button',{name:'Save',exact:true}).click()
    assert.equal(ok(await personal.get(`/api/v1/tasks/${instantTask.id}`)).dueDate,dueInstant)
    await flat(ownPage);await proof('instant-deadline-editor')
    await ownPage.goto(`${w.origin}/app/projects/${fieldProject}`)
    assert.ok(!(await ownPage.locator('main').innerText()).includes('Invalid Date'))
    assert.ok((await ownPage.locator('main').innerText()).includes('UTC'))
    await flat(ownPage);await proof('project-instant-deadline')
    const fieldTask=ok(await personal.post('/api/v1/tasks',{title:`Calculation ${size}`,projectId:fieldProject})),sourceTask=ok(await personal.post('/api/v1/tasks',{title:`Related source ${size}`,projectId:fieldProject}))
    ok(await personal.post(`/api/v1/tasks/${sourceTask.id}/fields`,{projectId:fieldProject,values:{effort:2}}))
    ok(await personal.post(`/api/v1/tasks/${fieldTask.id}/fields`,{projectId:fieldProject,values:{hidden_input:999.5}}))
    await ownPage.goto(`${w.origin}/app/tasks/${fieldTask.id}`)
    const values=ownPage.locator(`form[aria-label="Fields in Field campaign ${size}"]`)
    for(const [key,value]of Object.entries({effort:'3',brief:'Launch brief',budget:'12.25',deadline:'2026-11-01'}))await values.locator(`input[name="field:${key}"]`).fill(value)
    await values.locator('select[name="field:reviewers[]"]').selectOption(personal.id)
    await values.locator('select[name="field:audiences[]"]').selectOption(['Retail','Wholesale'])
    await values.locator('select[name="field:related[]"]').selectOption(sourceTask.id)
    await values.locator('select[name="field:channel"]').selectOption('Web')
    await values.locator('select[name="field:checked"]').selectOption('false')
    await values.getByRole('button',{name:'Save fields'}).click()
    assert.equal(await ownPage.locator('label:has-text("twice") output').textContent(),'6')
    assert.equal(await ownPage.locator('label:has-text("related") output').textContent(),'4')
    assert.ok((await ownPage.locator('main').innerText()).includes('dependency cycle'))
    await flat(ownPage);await proof('typed-task-fields')
    ok(await personal.post('/api/v1/grants',{objectType:'project',objectId:fieldProject,granteeId:gus.id,level:'viewer'}))
    const hiddenReader=await open(gus)
    await hiddenReader.page.goto(`${w.origin}/app/tasks/${fieldTask.id}`)
    const hiddenText=await hiddenReader.page.locator('main').innerText()
    assert.ok(!hiddenText.includes('hidden_input')&&!hiddenText.includes('999.5'))
    assert.ok(hiddenText.includes('A required field or related task is unavailable to you'))
    await flat(hiddenReader.page);await proof('field-hidden-input',hiddenReader.page)
    await hiddenReader.context.close()
    await ownPage.goto(`${w.origin}/app/projects/${fieldProject}/field-report`)
    assert.ok((await ownPage.locator(`li:has(a[href="/app/tasks/${fieldTask.id}"])`).innerText()).includes('6'))
    await flat(ownPage);await proof('field-report')
    await ownPage.goto(settingsUrl)
    await ownPage.getByText('Change type for brief',{exact:true}).click()
    const change=ownPage.locator('form[aria-label="Preview type for brief"]')
    await change.locator('select[name=type]').selectOption('number')
    await change.getByRole('button',{name:'Preview type change'}).click()
    assert.ok((await ownPage.locator('main').innerText()).includes('Incompatible values are preserved'))
    assert.equal(await ownPage.locator('form[aria-label="Apply field change"]').count(),0)
    await flat(ownPage);await proof('field-type-preview')
    await ownPage.goto(`${w.origin}/app/tags`)
    const tagForm=ownPage.locator('form[aria-label="Create tag"]')
    await tagForm.locator('input[name=name]').fill(`Campaign ${size}`)
    await tagForm.locator('select[name=projectId]').selectOption(fieldProject)
    await tagForm.getByRole('button',{name:'Create tag',exact:true}).click()
    const tag=ok(await personal.get('/api/v1/tags')).tags.find(t=>t.name===`Campaign ${size}`)
    const tagged=[fieldTask]
    for(const p of fieldProjects.slice(1)){
      ok(await personal.post(`/api/v1/tags/${tag.id}`,{projectId:p.id}))
      tagged.push(ok(await personal.post('/api/v1/tasks',{title:`Campaign work ${fieldProjects.indexOf(p)+1}`,projectId:p.id})))
    }
    for(const task of tagged)ok(await personal.post(`/api/v1/tasks/${task.id}/tags`,{tagId:tag.id}))
    await ownPage.reload()
    const editTag=ownPage.locator(`form[aria-label="Edit tag Campaign ${size}"]`)
    await editTag.locator('input[name=name]').fill(`Autumn ${size}`)
    await editTag.getByRole('button',{name:'Save tag'}).click()
    await ownPage.getByRole('link',{name:`Autumn ${size}`,exact:true}).click()
    await ownPage.waitForURL(url=>url.searchParams.get('tag')===tag.id)
    await ownPage.getByRole('heading',{name:`Tagged: Autumn ${size}`,exact:true}).waitFor()
    assert.equal(await ownPage.locator(`.card:has(h2:text-is("Tagged: Autumn ${size}")) li`).count(),3)
    await flat(ownPage);await proof('tag-catalogue-filter')
    // Durable task time, reviewed correction, approval/locking and exact approved CSV.
    await ownPage.goto(`${w.origin}/app/time`)
    const workDay=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
    const createSheet=ownPage.locator('form[aria-label="Create timesheet"]')
    await createSheet.locator('input[name=startDate]').fill(workDay)
    await createSheet.locator('input[name=endDate]').fill(workDay)
    await createSheet.getByRole('button',{name:'Create timesheet',exact:true}).click()
    await ownPage.locator('a[href^="/app/time/sheet_"]').first().click()
    const timeUrl=ownPage.url(),sheetId=timeUrl.split('/').pop()
    await ownPage.locator('form[aria-label="Start timer"] select[name=taskId]').selectOption(fieldTask.id)
    await ownPage.getByRole('button',{name:'Start timer',exact:true}).click()
    assert.equal(await ownPage.getByRole('button',{name:'Stop timer',exact:true}).count(),1)
    await ownPage.reload()
    assert.equal(await ownPage.getByRole('button',{name:'Stop timer',exact:true}).count(),1,'the durable timer survives reconnect')
    await flat(ownPage);await proof('timesheet-running')
    await ownPage.getByRole('button',{name:'Stop timer',exact:true}).click()
    const manualTime=ownPage.locator('form[aria-label="Manual time"]')
    await manualTime.locator('select[name=taskId]').selectOption(sourceTask.id)
    await manualTime.locator('input[name=date]').fill(workDay)
    await manualTime.locator('input[name=seconds]').fill('1800')
    await manualTime.getByRole('button',{name:'Add manual time'}).click()
    await ownPage.getByRole('button',{name:'Submit exact revision'}).click()
    const reviewer=await open(owner)
    await reviewer.page.goto(timeUrl)
    await flat(reviewer.page);await proof('timesheet-review',reviewer.page)
    await reviewer.page.locator('form[aria-label="Review timesheet"] select[name=action]').selectOption('return')
    await reviewer.page.locator('form[aria-label="Review timesheet"] input[name=reason]').fill('Include final review')
    await reviewer.page.getByRole('button',{name:'Apply decision'}).click()
    await ownPage.goto(timeUrl)
    assert.ok((await ownPage.locator('main').innerText()).includes('Include final review'))
    const correction=ownPage.locator(`form[aria-label="Correct Related source ${size}"]`)
    await correction.locator('input[name=seconds]').fill('2100')
    await correction.getByRole('button',{name:'Save correction'}).click()
    await flat(ownPage);await proof('timesheet-correction')
    await ownPage.getByRole('button',{name:'Submit exact revision'}).click()
    await reviewer.page.goto(timeUrl)
    await reviewer.page.getByRole('button',{name:'Apply decision'}).click()
    await ownPage.goto(timeUrl)
    assert.ok((await ownPage.locator('main').innerText()).includes('Approved and locked'))
    assert.equal(await ownPage.getByRole('button',{name:'Save correction'}).count(),0)
    const csv=await ownPage.request.get(`${w.origin}/api/v1/timesheets/${sheetId}/export.csv`)
    assert.equal(csv.status(),200)
    const csvText=await csv.text();assert.ok(csvText.includes(sourceTask.id)&&csvText.includes(fieldProject)&&csvText.includes('2100'))
    await flat(ownPage);await proof('timesheet-approved')

    // Accountable delegated review, including loss of access on a returned sheet.
    const timeLogger=await w.person(`review-log-${size}@example.com`,`Time logger ${size}`),timeAdmin=await w.person(`review-admin-${size}@example.com`,`Project reviewer ${size}`),timeManager=await w.person(`review-manager-${size}@example.com`,`Time manager ${size}`,'manager')
    const timeA=ok(await owner.post('/api/v1/projects',{name:`Hidden time A ${size}`})),timeB=ok(await owner.post('/api/v1/projects',{name:`Reviewed time B ${size}`}))
    const ta=ok(await owner.post('/api/v1/tasks',{title:`Hidden time task ${size}`,projectId:timeA.id})),tb=ok(await owner.post('/api/v1/tasks',{title:`Visible time task ${size}`,projectId:timeB.id}))
    const timeGrant=async(person,p,level)=>ok(await owner.post('/api/v1/grants',{objectType:'project',objectId:p.id,granteeId:person.id,level}))
    const logA=await timeGrant(timeLogger,timeA,'editor');await timeGrant(timeLogger,timeB,'editor')
    let reviewB=await timeGrant(timeAdmin,timeB,'admin')
    await timeGrant(timeManager,timeA,'viewer');await timeGrant(timeManager,timeB,'viewer')
    let timeSequence=300
    const newSheet=async(person,tasks)=>{
      const sheet=ok(await person.post('/api/v1/timesheets',{startDate:workDay,endDate:workDay}))
      for(const task of tasks)ok(await person.post(`/api/v1/timesheets/${sheet.id}/entries`,{taskId:task.id,date:workDay,seconds:600,key:`synthetic-pegboard-${size}-${++timeSequence}`}))
      const view=ok(await person.get(`/api/v1/timesheets/${sheet.id}`));ok(await person.post(`/api/v1/timesheets/${sheet.id}/decision`,{action:'submit',revision:view.token}));return sheet
    }
    const adminBrowser=await open(timeAdmin),managerBrowser=await open(timeManager),loggerBrowser=await open(timeLogger)
    const singleTime=await newSheet(timeLogger,[tb])
    await adminBrowser.page.goto(`${w.origin}/app/time/${singleTime.id}`)
    await adminBrowser.page.getByRole('button',{name:'Apply decision'}).click()
    await adminBrowser.page.waitForURL(`${w.origin}/app/time`)
    await adminBrowser.page.goto(`${w.origin}/app/time/${singleTime.id}`)
    await adminBrowser.page.getByRole('heading',{name:'Approved and locked'}).waitFor()
    await flat(adminBrowser.page);await proof('timesheet-project-admin',adminBrowser.page)
    const managerMixed=await newSheet(timeLogger,[ta,tb])
    await managerBrowser.page.goto(`${w.origin}/app/time/${managerMixed.id}`)
    await managerBrowser.page.getByRole('button',{name:'Apply decision'}).click()
    await managerBrowser.page.waitForURL(`${w.origin}/app/time`)
    assert.equal(ok(await timeLogger.get(`/api/v1/timesheets/${managerMixed.id}`)).sheet.status,'approved')
    const mixedTime=await newSheet(timeLogger,[ta,tb]),mixedUrl=`${w.origin}/app/time/${mixedTime.id}`
    assert.equal((await adminBrowser.page.goto(mixedUrl)).status(),404)
    assert.ok(!(await adminBrowser.page.content()).includes(`Hidden time task ${size}`))
    await loggerBrowser.page.goto(mixedUrl)
    await loggerBrowser.page.getByRole('status').filter({hasText:'awaiting another reviewer'}).waitFor()
    await flat(loggerBrowser.page);await proof('timesheet-awaiting-reviewer',loggerBrowser.page)
    await managerBrowser.page.goto(mixedUrl)
    await managerBrowser.page.locator('select[name=action]').selectOption('return')
    await managerBrowser.page.locator('form[aria-label="Review timesheet"] input[name=reason]').fill('Review the entries')
    await managerBrowser.page.getByRole('button',{name:'Apply decision'}).click()
    ok(await owner.delete(`/api/v1/grants/${logA.id}`))
    await loggerBrowser.page.goto(mixedUrl)
    assert.ok(!(await loggerBrowser.page.content()).includes(`Hidden time task ${size}`))
    await flat(loggerBrowser.page);await proof('timesheet-unavailable-entry',loggerBrowser.page)
    await loggerBrowser.page.getByRole('button',{name:'Withdraw unavailable entry'}).click()
    assert.ok((await loggerBrowser.page.locator('main').innerText()).includes('Withdrew unavailable entry'))
    await loggerBrowser.page.getByRole('button',{name:'Submit exact revision'}).click()
    await adminBrowser.page.goto(mixedUrl)
    ok(await owner.delete(`/api/v1/grants/${reviewB.id}`))
    await adminBrowser.page.getByRole('button',{name:'Apply decision'}).click()
    assert.equal(ok(await timeLogger.get(`/api/v1/timesheets/${mixedTime.id}`)).sheet.status,'submitted')
    await managerBrowser.page.goto(mixedUrl)
    await managerBrowser.page.getByRole('button',{name:'Apply decision'}).click()
    await managerBrowser.page.waitForURL(`${w.origin}/app/time`)
    await managerBrowser.page.goto(mixedUrl)
    await managerBrowser.page.getByRole('heading',{name:'Approved and locked'}).waitFor()
    await flat(managerBrowser.page);await proof('timesheet-manager-approved',managerBrowser.page)
    const soleProject=ok(await owner.post('/api/v1/projects',{name:`Sole reviewer ${size}`})),soleTask=ok(await owner.post('/api/v1/tasks',{title:'Only owner can review',projectId:soleProject.id})),soleTime=await newSheet(owner,[soleTask])
    await reviewer.page.goto(`${w.origin}/app/time/${soleTime.id}`)
    assert.equal(await reviewer.page.getByRole('button',{name:'Apply decision'}).count(),0)
    await reviewer.page.getByRole('status').filter({hasText:'awaiting another reviewer'}).waitFor()
    const soleView=ok(await owner.get(`/api/v1/timesheets/${soleTime.id}`))
    assert.equal((await owner.post(`/api/v1/timesheets/${soleTime.id}/decision`,{action:'approve',revision:soleView.token})).status,403)
    const timeGuest=await w.person(`time-guest-${size}@example.com`,`Time guest ${size}`,'guest')
    await timeGrant(timeGuest,timeB,'editor')
    const guestTask=ok(await owner.post('/api/v1/tasks',{title:`Guest assigned work ${size}`,projectId:timeB.id,ownerId:timeGuest.id})),guestTime=await newSheet(timeGuest,[guestTask])
    await managerBrowser.page.goto(`${w.origin}/app/time/${guestTime.id}`)
    await managerBrowser.page.getByRole('button',{name:'Apply decision'}).click()
    await managerBrowser.page.waitForURL(`${w.origin}/app/time`)
    await managerBrowser.page.goto(`${w.origin}/app/time/${guestTime.id}`)
    await managerBrowser.page.getByRole('heading',{name:'Approved and locked'}).waitFor()
    for(const session of [adminBrowser,managerBrowser,loggerBrowser])await session.context.close()
    await reviewer.context.close()
    await own.context.close()
    console.log(`journey at ${size}px passed`)
  }
  }
  // Accountable recurring work: the standing audience, occurrence and held schedule, at both widths.
  if(await select('recurrence'))for(const [size,viewport] of sizes){
    const open=async client=>{const context=await browser.newContext({viewport});await context.addCookies(cookies(client));return {context,page:await context.newPage()}}
    const flat=async page=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`recurrence no sideways scroll ${size}`)
    const proof=async(name,page)=>{if(process.env.PEGBOARD_PROOF_DIR){await mkdir(process.env.PEGBOARD_PROOF_DIR,{recursive:true});await page.screenshot({path:join(process.env.PEGBOARD_PROOF_DIR,`${name}-${size}.png`),fullPage:true})}}
    const lead=await w.person(`repeat-lead-${size}@example.com`,`Recurring lead ${size}`),admin=await w.person(`repeat-admin-${size}@example.com`,`Recurring admin ${size}`),member=await w.person(`repeat-member-${size}@example.com`,`Recurring teammate ${size}`),editor=await w.person(`repeat-editor-${size}@example.com`,`Recurring editor ${size}`),outside=await w.person(`repeat-outside-${size}@example.com`,`Unreachable assignee ${size}`),guest=await w.person(`repeat-guest-${size}@example.com`,`Recurring guest ${size}`,'guest')
    const team=ok(await owner.post('/api/v1/teams',{name:`Onboarding team ${size}`,privacy:'private'}))
    for(const person of [member,guest])ok(await owner.post('/api/v1/grants',{objectType:'team',objectId:team.id,granteeId:person.id,level:'viewer'}))
    const project=ok(await owner.post('/api/v1/projects',{name:`Monthly onboarding ${size}`,teamId:team.id,visibility:'team',teamLevel:'commenter'}))
    const onboarding=ok(await owner.post('/api/v1/tasks',{title:`Unreachable work ${size}`,projectId:project.id,ownerId:outside.id}))
    const sharedHours=ok(await owner.post(`/api/v1/projects/${project.id}/fields`,{key:'onboarding_hours',label:'Onboarding hours',type:'number'}))
    const sharedFormula=ok(await owner.post(`/api/v1/projects/${project.id}/fields`,{key:'onboarding_total',label:'Onboarding total',type:'formula',expression:'onboarding_hours * 2'}))
    ok(await owner.post(`/api/v1/tasks/${onboarding.id}/fields`,{projectId:project.id,values:{onboarding_hours:3}}))
    const grant=async(person,level)=>ok(await owner.post('/api/v1/grants',{objectType:'project',objectId:project.id,granteeId:person.id,level}))
    const leadGrant=await grant(lead,'admin');await grant(admin,'admin');const direct=await grant(editor,'editor');await grant(guest,'viewer')
    const own=await open(lead),page=own.page
    await page.goto(`${w.origin}/app/projects/${project.id}`);await flat(page);await proof('recurrence-source-project',page)
    await page.getByRole('link',{name:'Make recurring'}).click()
    await page.getByRole('form',{name:'Preview recurring work'}).getByLabel('First date').fill('2026-01-01')
    await page.getByRole('form',{name:'Preview recurring work'}).getByLabel('Occurrences',{exact:true}).fill('2')
    await page.getByRole('form',{name:'Preview recurring work'}).locator(`input[value="${direct.id}"]`).check()
    await page.getByRole('button',{name:'Preview occurrences'}).click()
    const audience=page.locator('article').filter({has:page.getByRole('heading',{name:'Standing occurrence audience'})})
    await expect(audience).toContainText(`Recurring editor ${size}`);await expect(audience).toContainText(`Source team: Onboarding team ${size} · Commenter`);await expect(audience).toContainText(`Unreachable assignee ${size}`)
    assert.ok(!(await audience.innerText()).includes(`Recurring guest ${size}`))
    await flat(page);await proof('recurrence-preview',page)
    await page.getByRole('button',{name:'Activate reviewed schedule'}).click();await page.waitForURL(/\/app\/recurrences\/recurrence_/)
    const url=page.url(),id=url.split('/').pop()
    const reviewAudience=page.getByRole('form',{name:'Review standing audience'})
    await expect(reviewAudience.locator(`input[value="${direct.id}"]`)).toBeChecked()
    await reviewAudience.getByRole('button',{name:'Review current audience'}).click()
    await expect(page.getByRole('form',{name:'Review standing audience'}).locator(`input[value="${direct.id}"]`)).toBeChecked()
    assert.equal(await page.getByRole('form',{name:'Review standing audience'}).locator('input[type=checkbox]:checked').count(),1,'re-review never preselects additional grants')
    await page.getByRole('button',{name:'Confirm reviewed audience'}).click()
    await page.getByRole('button',{name:'Run due occurrence'}).click()
    await expect(page.locator('article').filter({has:page.getByRole('heading',{name:'Occurrences',exact:true})})).toContainText(`Unreachable assignee ${size}`)
    await flat(page);await proof('recurrence-occurrence',page)
    await w.restart();await page.goto(url)
    const v=ok(await lead.get(`/api/v1/recurrences/${id}`));assert.equal(v.occurrences.length,1)
    const generated=v.occurrences[0].object_id
    for(const [person,allowed] of [[member,true],[editor,true],[guest,false],[outside,false]]){
      const session=await open(person),response=await session.page.goto(`${w.origin}/app/projects/${generated}`)
      assert.equal(response.status(),allowed?200:404)
      if(allowed)await expect(session.page.locator('main')).toContainText(`Unreachable assignee ${size}`)
      await flat(session.page);await proof(`recurrence-project-${allowed?person===member?'team':'editor':'refused'}`,session.page);await session.context.close()
    }
    // Library identities and calculations survive a project occurrence, while task values stay independent.
    await page.goto(`${w.origin}/app/projects/${generated}/settings`)
    for(const field of [sharedHours,sharedFormula])await expect(page.locator('main')).toContainText(field.id)
    await flat(page);await proof('recurrence-shared-field-settings',page)
    await page.getByRole('link',{name:'Open field report',exact:true}).click()
    const generatedReport=ok(await lead.get(`/api/v1/projects/${generated}/field-report`)),generatedTask=generatedReport.rows.find(r=>r.title===`Unreachable work ${size}`)
    assert.equal(generatedTask.fields.find(f=>f.id===sharedFormula.id).value,6)
    await page.getByRole('link',{name:`Unreachable work ${size}`,exact:true}).click()
    const values=page.getByRole('form',{name:new RegExp('^Fields in Monthly onboarding')})
    await values.locator('input[name="field:onboarding_hours"]').fill('4')
    await values.getByRole('button',{name:'Save fields'}).click()
    await expect(page.locator('label:has-text("Onboarding total") output')).toHaveText('8')
    await flat(page);await proof('recurrence-shared-field-task',page)
    await page.goto(`${w.origin}/app/projects/${generated}/field-report`)
    await expect(page.locator(`li:has(a[href="/app/tasks/${generatedTask.id}"])`)).toContainText('8')
    assert.equal(ok(await lead.get(`/api/v1/projects/${project.id}/field-report`)).rows.find(r=>r.id===onboarding.id).fields.find(f=>f.id===sharedHours.id).value,3)
    await flat(page);await proof('recurrence-shared-field-report',page)
    // A reviewed formula change updates both adopters. The next pinned occurrence must wait for a new template.
    await page.goto(`${w.origin}/app/projects/${project.id}/settings`)
    await page.getByText('Change type for Onboarding total',{exact:true}).click()
    await page.getByRole('form',{name:'Preview type for Onboarding total'}).getByLabel('Formula expression',{exact:true}).fill('onboarding_hours * 3')
    await page.getByRole('button',{name:'Preview type change',exact:true}).click()
    await expect(page.locator('main')).toContainText('across 2 projects')
    await flat(page);await proof('recurrence-shared-definition-preview',page)
    await page.getByRole('button',{name:'Apply reviewed field change'}).click()
    for(const [home,value] of [[project.id,9],[generated,12]]){
      await page.goto(`${w.origin}/app/projects/${home}/field-report`)
      const report=ok(await lead.get(`/api/v1/projects/${home}/field-report`))
      assert.equal(report.rows.find(r=>r.title===`Unreachable work ${size}`).fields.find(f=>f.id===sharedFormula.id).value,value)
      await expect(page.locator('main')).toContainText(String(value));await flat(page)
    }
    await page.goto(url)
    await page.getByRole('button',{name:'Run due occurrence'}).click()
    await expect(page.getByRole('status')).toContainText('A template field definition changed.')
    assert.equal(ok(await lead.get(`/api/v1/recurrences/${id}`)).occurrences.length,1)
    await flat(page);await proof('recurrence-changed-definition-held',page)
    // Restore only the audience hold so the existing lost-authority scenario still exercises its own cause.
    await page.getByRole('button',{name:'Review current audience'}).click()
    await page.getByRole('button',{name:'Confirm reviewed audience'}).click()
    ok(await owner.delete(`/api/v1/grants/${leadGrant.id}`))
    await page.getByRole('button',{name:'Run due occurrence'}).click();await expect(page.getByRole('status')).toContainText('Authority over the source or a recorded target project was lost.');await expect(page.locator('main')).toContainText(`Accountable owner: Recurring lead ${size}`)
    assert.equal(ok(await owner.get(`/api/v1/recurrences/${id}`)).occurrences.length,1)
    await flat(page);await proof('recurrence-held',page)
    const oversight=await open(admin);await oversight.page.goto(`${w.origin}/app/recurrences`);await oversight.page.getByRole('link',{name:`Monthly onboarding ${size}`,exact:true}).click();await flat(oversight.page);await proof('recurrence-admin',oversight.page)
    await oversight.page.getByRole('button',{name:'Stop schedule'}).click();assert.equal(ok(await owner.get(`/api/v1/recurrences/${id}`)).schedule.active,0)
    // The task template retains a home after its live source leaves; lost pinned-home authority holds it.
    const homeA=ok(await owner.post('/api/v1/projects',{name:`Pinned home A ${size}`})),homeB=ok(await owner.post('/api/v1/projects',{name:`Pinned home B ${size}`}))
    const authority=[]
    for(const home of [homeA,homeB])authority.push(ok(await owner.post('/api/v1/grants',{objectType:'project',objectId:home.id,granteeId:lead.id,level:'admin'})))
    const task=ok(await owner.post('/api/v1/tasks',{title:`Pinned recurring task ${size}`,projectId:homeA.id}));ok(await owner.post(`/api/v1/tasks/${task.id}/projects`,{projectId:homeB.id}))
    await page.goto(`${w.origin}/app/recurrences?sourceType=task&sourceId=${task.id}&start=2026-01-01&unit=month&count=2`)
    await page.getByRole('button',{name:'Activate reviewed schedule'}).click();await page.waitForURL(/\/app\/recurrences\/recurrence_/)
    const taskSchedule=page.url().split('/').pop()
    ok(await owner.delete(`/api/v1/tasks/${task.id}/projects/${homeB.id}`));ok(await owner.delete(`/api/v1/grants/${authority[1].id}`))
    await page.getByRole('button',{name:'Run due occurrence'}).click();await expect(page.getByRole('status')).toContainText('Held for re-review')
    assert.equal(ok(await owner.get(`/api/v1/recurrences/${taskSchedule}`)).occurrences.length,0)
    await flat(page);await proof('recurrence-pinned-home-held',page)
    await oversight.context.close();await own.context.close();console.log(`Accountable recurring work at ${size}px passed`)
  }
  // Recurrence and revision-bound human approval: explicit states and attributed reopens.
  if(await select('approvals'))for(const [size,viewport] of sizes){
    const open=async client=>{const context=await browser.newContext({viewport});await context.addCookies(cookies(client));return {context,page:await context.newPage()}}
    const flat=async page=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`approval no sideways scroll ${size}`)
    const proof=async(name,page)=>{if(process.env.PEGBOARD_PROOF_DIR){await mkdir(process.env.PEGBOARD_PROOF_DIR,{recursive:true});await page.screenshot({path:join(process.env.PEGBOARD_PROOF_DIR,`${name}-${size}.png`),fullPage:true})}}
    const worker=await w.person(`approval-worker-${size}@example.com`,`Approval worker ${size}`),project=ok(await owner.post('/api/v1/projects',{name:`Approval campaign ${size}`}))
    ok(await owner.post('/api/v1/grants',{objectType:'project',objectId:project.id,granteeId:worker.id,level:'editor'}))
    const writer=await open(worker),reviewer=await open(owner)
    await writer.page.goto(`${w.origin}/app/projects/${project.id}`)
    const add=writer.page.getByRole('form',{name:'Add a task'});await add.getByLabel('Task title',{exact:true}).fill(`Approve campaign ${size}`);await add.locator('select[name=kind]').selectOption('approval');await add.getByRole('button',{name:'Add task',exact:true}).click();await writer.page.getByRole('link',{name:`Approve campaign ${size}`,exact:true}).click();await writer.page.waitForURL(/\/app\/tasks\/tsk_/)
    const url=writer.page.url(),id=url.split('/').pop()
    await expect(writer.page.getByRole('status')).toHaveText('Pending decision');assert.equal(await writer.page.getByRole('button',{name:'Mark complete',exact:true}).count(),0);assert.equal(await writer.page.getByRole('button',{name:'Record reviewed decision'}).count(),0)
    await expect(writer.page.locator('main')).toContainText('You own or have owned this work.');await flat(writer.page);await proof('approval-owner-waits',writer.page)
    await reviewer.page.goto(url)
    const decide=async(action,reason)=>{const form=reviewer.page.getByRole('form',{name:'Decide approval task'});await form.locator('select[name=action]').selectOption(action);await form.getByLabel('Decision reason',{exact:true}).fill(reason);await form.getByRole('button',{name:'Record reviewed decision'}).click()}
    await decide('changes','Add current campaign evidence');await expect(reviewer.page.getByRole('status')).toHaveText('Changes requested');await flat(reviewer.page);await proof('approval-changes-requested',reviewer.page)
    await writer.page.goto(url);await writer.page.getByRole('form',{name:'Edit task'}).getByLabel('Description',{exact:true}).fill('Current evidence is attached to this revision.');await writer.page.getByRole('form',{name:'Edit task'}).getByRole('button',{name:'Save',exact:true}).click()
    await reviewer.page.goto(url);await decide('approve','Reviewed the current evidence');await expect(reviewer.page.getByRole('status')).toHaveText('Approved');await flat(reviewer.page);await proof('approval-approved',reviewer.page)
    // The stale reviewer cannot decide after a new comment reopens sign-off.
    await writer.page.goto(url);await writer.page.getByRole('form',{name:'Comment',exact:true}).getByLabel('Comment',{exact:true}).fill('New evidence changes this review.');await writer.page.getByRole('form',{name:'Comment',exact:true}).getByRole('button',{name:'Comment',exact:true}).click()
    await expect(writer.page.getByRole('status')).toContainText('Reopened');await expect(writer.page.locator('.history')).toContainText(`Approval worker ${size} reopened sign-off after a work change`)
    await decide('approve','A stale tab must be refused');await expect(reviewer.page.locator('main')).toContainText('This approval or its access changed.')
    assert.equal(ok(await owner.get(`/api/v1/tasks/${id}/decision-preview`)).decisions.length,2)
    await reviewer.page.goto(url);await decide('reject','Current evidence is insufficient');await expect(reviewer.page.getByRole('status')).toHaveText('Rejected');await flat(reviewer.page);await proof('approval-rejected',reviewer.page)
    await writer.page.goto(url);await writer.page.getByRole('form',{name:'Edit task'}).getByLabel('Description',{exact:true}).fill('The rejected issues have been corrected.');await writer.page.getByRole('form',{name:'Edit task'}).getByRole('button',{name:'Save',exact:true}).click()
    await reviewer.page.goto(url);await decide('approve','Reviewed corrected current work');await expect(reviewer.page.getByRole('status')).toHaveText('Approved')
    await reviewer.page.getByRole('link',{name:'Make task recurring'}).click()
    const repeat=reviewer.page.getByRole('form',{name:'Preview recurring work'});await repeat.getByLabel('First date',{exact:true}).fill('2026-03-08');await repeat.locator('select[name=unit]').selectOption('week');await repeat.getByLabel('Occurrences',{exact:true}).fill('1');await repeat.getByLabel('Skip dates (comma separated)',{exact:true}).fill('2026-03-08');await repeat.getByRole('button',{name:'Preview occurrences'}).click()
    await expect(reviewer.page.locator('main')).toContainText('2026-03-15');await flat(reviewer.page);await proof('approval-weekly-recurrence-preview',reviewer.page)
    await reviewer.page.getByRole('button',{name:'Activate reviewed schedule'}).click();await reviewer.page.waitForURL(/\/app\/recurrences\/recurrence_/);const scheduleId=reviewer.page.url().split('/').pop()
    await reviewer.page.getByRole('button',{name:'Run due occurrence'}).click();await w.restart();await reviewer.page.goto(`${w.origin}/app/recurrences/${scheduleId}`)
    const result=ok(await owner.get(`/api/v1/recurrences/${scheduleId}`));assert.equal(result.occurrences.length,1)
    await reviewer.page.getByRole('link',{name:'2026-03-15',exact:true}).click();await expect(reviewer.page.getByRole('status')).toHaveText('Pending decision');assert.equal(ok(await owner.get(`/api/v1/tasks/${result.occurrences[0].object_id}/decision-preview`)).decisions.length,0);await flat(reviewer.page);await proof('approval-recurring-copy-pending',reviewer.page)
    // A personal approval and an owner who is the only eligible decider state why they wait.
    const personal=ok(await worker.post('/api/v1/tasks',{title:`Personal approval ${size}`,kind:'approval'}));await writer.page.goto(`${w.origin}/app/tasks/${personal.id}`);await expect(writer.page.locator('main')).toContainText('This personal approval needs a reviewed project share');assert.equal(await writer.page.getByRole('button',{name:'Record reviewed decision'}).count(),0);await flat(writer.page);await proof('approval-personal-waits',writer.page)
    const sole=ok(await owner.post('/api/v1/tasks',{title:`Only reviewer owns this work ${size}`,projectId:project.id,kind:'approval'}));await reviewer.page.goto(`${w.origin}/app/tasks/${sole.id}`);await expect(reviewer.page.locator('main')).toContainText('Another eligible owner or administrator must decide it.');assert.equal(await reviewer.page.getByRole('button',{name:'Record reviewed decision'}).count(),0);await flat(reviewer.page);await proof('approval-sole-reviewer-waits',reviewer.page)
    await writer.context.close();await reviewer.context.close();console.log(`Recurring work and human decisions at ${size}px passed`)
  }
  // Read-only time service packets: approved downloads and explicit pending work at both widths.
  if(await select('time-packets'))for(const [size,viewport] of sizes){
    const person=await w.person(`packet-${size}@example.com`,`Campaign coordinator ${size}`),project=ok(await person.post('/api/v1/projects',{name:`Autumn campaign ${size}`})),task=ok(await person.post('/api/v1/tasks',{title:'Prepare launch brief',projectId:project.id}))
    const sheet=ok(await person.post('/api/v1/timesheets',{startDate:'2026-10-22',endDate:'2026-10-22'}))
    const entry=ok(await person.post(`/api/v1/timesheets/${sheet.id}/entries`,{taskId:task.id,date:'2026-10-22',seconds:72,notes:'Review the launch brief',key:'synthetic-pegboard-951'}))
    let view=ok(await person.get(`/api/v1/timesheets/${sheet.id}`));ok(await person.post(`/api/v1/timesheets/${sheet.id}/decision`,{action:'submit',revision:view.token}));view=ok(await owner.get(`/api/v1/timesheets/${sheet.id}`));ok(await owner.post(`/api/v1/timesheets/${sheet.id}/decision`,{action:'approve',revision:view.token}))
    const context=await browser.newContext({viewport});await context.addCookies(cookies(person));const page=await context.newPage()
    await page.goto(`${w.origin}/app/time/${sheet.id}`)
    const form=page.getByRole('form',{name:'Prepare time service packet'})
    await expect(form.getByRole('button',{name:'Download time service packet'})).toBeVisible()
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`time packet reflow ${size}`)
    if(process.env.PEGBOARD_PROOF_DIR){await mkdir(process.env.PEGBOARD_PROOF_DIR,{recursive:true});await page.screenshot({path:join(process.env.PEGBOARD_PROOF_DIR,`time-service-packet-${size}.png`),fullPage:true})}
    for(const service of ['harvest','quickbooks-time']){
      await form.getByLabel('Time service',{exact:true}).selectOption(service)
      await form.getByLabel('Provider ID mapping (JSON)').fill(JSON.stringify({people:{[person.id]:101},projects:{[project.id]:201},tasks:{[task.id]:301},jobcodes:{[`${project.id}/${task.id}`]:401}}))
      await form.getByLabel('Provider ID mapping (JSON)').press('Tab');await expect(form.getByRole('button',{name:'Download time service packet'})).toBeFocused()
      const downloaded=page.waitForEvent('download');await page.keyboard.press('Enter');const download=await downloaded
      const stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk)
      const packet=JSON.parse(Buffer.concat(chunks).toString());assert.equal(packet.service,service);assert.equal(packet.totalSeconds,72);assert.equal(packet.delivery,'not_sent');assert.equal(packet.pending.length,0);assert.equal(packet.rows[0].taskId,task.id)
    }
    await form.getByLabel('Provider ID mapping (JSON)').fill('{}')
    const downloaded=page.waitForEvent('download');await form.getByRole('button',{name:'Download time service packet'}).click();const download=await downloaded,stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk)
    const packet=JSON.parse(Buffer.concat(chunks).toString());assert.equal(packet.rows.length,0);assert.equal(packet.pending[0].reason,'map_person')
    assert.equal(await page.getByRole('form',{name:'Send reviewed time'}).count(),0,'the person who logged the time sends nothing')
    await context.close();console.log(`Read-only time service packets at ${size}px passed`)
    // A workspace owner sends the reviewed packet: a refused job code is visible, repaired and resent; nothing is sent twice.
    const admin=await browser.newContext({viewport});await admin.addCookies(cookies(owner));const desk=await admin.newPage()
    await desk.goto(`${w.origin}/app/time/${sheet.id}`)
    const deliver=desk.getByRole('form',{name:'Send reviewed time'}),ledger=desk.getByRole('list',{name:'Delivery ledger'})
    const sendReviewed=async(service,jobcode)=>{
      await deliver.getByLabel('Delivery service',{exact:true}).selectOption(service)
      await deliver.getByLabel('Harvest account ID').fill(service==='harvest'?services.harvest.account:'')
      await deliver.getByLabel('Delivery ID mapping (JSON)').fill(JSON.stringify({people:{[person.id]:101},projects:{[project.id]:201},tasks:{[task.id]:301},jobcodes:{[`${project.id}/${task.id}`]:jobcode}}))
      await deliver.getByLabel('Service access token').fill(services.token(service))
      await deliver.getByLabel('I reviewed this exact packet and mapping.').check()
      await deliver.getByRole('button',{name:'Send reviewed time'}).click()
    }
    await sendReviewed('quickbooks-time',999999)
    await expect(ledger.locator('li',{hasText:'QuickBooks Time'})).toContainText('Rejected (417): Expectation Failed: Invalid jobcode_id')
    await sendReviewed('quickbooks-time',401)
    await expect(ledger.locator('li',{hasText:'QuickBooks Time'})).toContainText('Acknowledged as')
    await sendReviewed('harvest',401)
    await expect(ledger.locator('li',{hasText:'Harvest'})).toContainText('Acknowledged as')
    for(const service of ['harvest','quickbooks-time'])assert.deepEqual(services.entries(service,entry.id).map(e=>e.seconds),[72])
    assert.ok(await desk.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`time delivery reflow ${size}`)
    if(process.env.PEGBOARD_PROOF_DIR)await desk.screenshot({path:join(process.env.PEGBOARD_PROOF_DIR,`time-service-delivery-${size}.png`),fullPage:true})
    await admin.close();console.log(`Reviewed time service delivery at ${size}px passed`)
  }
  // Goal visibility and accountable owners: complete native Goals workflows at both widths.
  if(await select('goals'))for(const [size,viewport] of sizes){
    const open=async client=>{const context=await browser.newContext({viewport});await context.addCookies(cookies(client));return {context,page:await context.newPage()}}
    const flat=async page=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`goals no sideways scroll ${size}`)
    const proof=async(name,page)=>{if(process.env.PEGBOARD_PROOF_DIR){await mkdir(process.env.PEGBOARD_PROOF_DIR,{recursive:true});await page.screenshot({path:join(process.env.PEGBOARD_PROOF_DIR,`${name}-${size}.png`),fullPage:true})}}
    const member=await w.person(`goal-member-${size}@example.com`,`Goal member ${size}`),other=await w.person(`goal-other-${size}@example.com`,`Goal other ${size}`),manager=await w.person(`goal-manager-${size}@example.com`,`Goal manager ${size}`,'manager'),guest=await w.person(`goal-guest-${size}@example.com`,`Goal guest ${size}`,'guest'),agent=await w.person(`goal-agent-${size}@example.com`,`Goal agent ${size}`,'agent'),analyst=await w.person(`goal-analyst-${size}@example.com`,`Goal analyst ${size}`,'analyst')
    const project=ok(await owner.post('/api/v1/projects',{name:`Goal permitted project ${size}`,visibility:'workspace'})),task=ok(await owner.post('/api/v1/tasks',{title:`Permitted goal work ${size}`,projectId:project.id}))
    const own=await open(owner),page=own.page
    await page.goto(`${w.origin}/app/goals`)
    const create=page.getByRole('form',{name:'Create a goal'})
    await create.getByLabel('Goal title',{exact:true}).fill(`Company outcome ${size}`);await create.locator('select[name=scope]').selectOption('company');await create.locator('select[name=kind]').selectOption('key_result');await create.locator('select[name=mode]').selectOption('numeric');await create.getByLabel('Period ends').fill('2026-12-31');await create.getByRole('button',{name:'Create goal',exact:true}).click();await page.waitForURL(/\/app\/goals\/goal_/)
    const companyUrl=page.url(),companyId=companyUrl.split('/').pop()
    await page.getByRole('form',{name:'Link goal work'}).getByLabel('Linked work ID').fill(task.id);await page.getByRole('button',{name:'Link work',exact:true}).click()
    const readers=[]
    for(const client of [member,other,analyst]){
      const session=await open(client);readers.push(session);await session.page.goto(`${w.origin}/app/goals`);await session.page.getByRole('link',{name:`Company outcome ${size}`,exact:true}).click();await expect(session.page.locator('main')).toContainText(`Permitted goal work ${size}`);await flat(session.page)
    }
    await proof('goals-company-member',readers[0].page)
    const edit=page.getByRole('form',{name:'Preview goal audience'})
    await edit.locator('select[name=ownerId]').selectOption(member.id);await edit.getByRole('button',{name:'Preview audience and ownership'}).click()
    await page.getByRole('button',{name:'Confirm reviewed goal audience'}).click()
    const named=readers[0];await named.page.goto(companyUrl)
    const observation=named.page.getByRole('form',{name:'Numeric observation'})
    await observation.getByLabel('Observed value (percent)').fill('50');await observation.getByRole('button',{name:'Record observation'}).click()
    await expect(named.page.getByRole('status')).toContainText('50%')
    await named.page.getByRole('form',{name:'Goal check-in'}).getByLabel('Check-in note').fill(`Accountable owner note ${size}`);await named.page.getByRole('button',{name:'Record check-in'}).click()
    await expect(named.page.locator('main')).toContainText(`Accountable owner note ${size}`);await flat(named.page);await proof('goals-named-owner',named.page)
    // A reviewed CSV and a scoped integration update the same native numeric goal; replays retain one observation.
    const authorize=named.page.getByRole('form',{name:'Authorize CSV source'})
    await authorize.getByLabel('CSV source name').fill(`Quarterly metric ${size}`);await authorize.locator('input[name=consent]').check();await authorize.getByRole('button',{name:'Authorize CSV source'}).click()
    const csv=`event_key,value,observed_at\nsynthetic-pegboard-801,75,${Date.now()}`
    const csvForm=named.page.getByRole('form',{name:`Preview CSV Quarterly metric ${size}`})
    await csvForm.getByLabel('Metric CSV',{exact:true}).fill(csv);await csvForm.getByRole('button',{name:'Preview numeric CSV'}).click()
    await expect(named.page.locator('main')).toContainText('1 new · 0 replays');await flat(named.page);await proof('goals-numeric-csv-preview',named.page)
    await named.page.getByRole('button',{name:'Apply reviewed numeric CSV'}).click();await expect(named.page.getByRole('status')).toContainText('75%')
    await named.page.getByRole('form',{name:`Preview CSV Quarterly metric ${size}`}).getByLabel('Metric CSV',{exact:true}).fill(csv);await named.page.getByRole('button',{name:'Preview numeric CSV'}).click();await expect(named.page.locator('main')).toContainText('0 new · 1 replays');await named.page.getByRole('button',{name:'Apply reviewed numeric CSV'}).click()
    // The owner authorizes an API source through Goals, chooses its expiry and sees the credential once.
    const apiForm=named.page.getByRole('form',{name:'Authorize API source'})
    await apiForm.getByLabel('API source name').fill(`Metric integration ${size}`);await apiForm.getByLabel('Expires in days (1–30)').fill('7');await apiForm.locator('input[name=consent]').check();await apiForm.getByRole('button',{name:'Authorize API source'}).click()
    await expect(named.page.getByRole('heading',{name:'API source authorized'})).toBeVisible();await flat(named.page);await proof('goals-api-source-credential',named.page)
    const credential=await named.page.locator('article code').first().innerText(),endpoint=await named.page.locator('article code').nth(2).innerText()
    const apiSource={id:endpoint.split('/')[4],token:credential}
    const provider=new owner.constructor(w.origin,'','Authorized metric provider'),event={key:'synthetic-pegboard-802',value:90,observedAt:Date.now()},providerHeaders={authorization:'Bearer '+apiSource.token}
    ok(await provider.call('POST',`/api/v1/metric-sources/${apiSource.id}/events`,event,providerHeaders));assert.equal(ok(await provider.call('POST',`/api/v1/metric-sources/${apiSource.id}/events`,event,providerHeaders)).replayed,true)
    await named.page.goto(companyUrl);await expect(named.page.getByRole('status')).toContainText('90%');await expect(named.page.getByRole('heading',{name:'Observation history'})).toBeVisible();await expect(named.page.locator('main')).toContainText(`API source “Metric integration ${size}”`);await flat(named.page);await proof('goals-numeric-integration',named.page)
    await named.page.getByRole('button',{name:`Revoke Metric integration ${size}`}).click();await expect(named.page.getByRole('status')).toContainText('source ended');await expect(named.page.getByRole('alert')).toContainText('Numeric source ended: revoked')
    await expect(named.page.locator('main')).toContainText('source ended: revoked');await flat(named.page);await proof('goals-source-ended',named.page)
    const refusedPublish=await provider.call('POST',`/api/v1/metric-sources/${apiSource.id}/events`,event,providerHeaders);assert.equal(refusedPublish.status,403);assert.equal(refusedPublish.body.cause,'revoked')
    const aged=ok(await member.post('/api/v1/goals',{title:`Stale metric ${size}`,scope:'personal',mode:'numeric',staleAfterSeconds:30,periodStart:'2026-01-01',periodEnd:'2026-12-31'})),agedSource=ok(await member.post(`/api/v1/goals/${aged.id}/sources`,{kind:'csv',name:'Aged observations',consent:true})),agedCsv=`event_key,value,observed_at\nsynthetic-pegboard-803,100,${Date.now()-60000}`
    const agedPreview=ok(await member.post(`/api/v1/metric-sources/${agedSource.id}/csv-preview`,{csv:agedCsv}));ok(await member.post(`/api/v1/metric-sources/${agedSource.id}/csv`,{csv:agedCsv,revision:agedPreview.token}))
    await named.page.goto(`${w.origin}/app/goals/${aged.id}`);await expect(named.page.getByRole('status')).toContainText('stale input');await flat(named.page);await proof('goals-stale-numeric-source',named.page)
    // Weighted project/task/subgoal inputs deduplicate the same task through every link.
    ok(await owner.patch(`/api/v1/tasks/${task.id}`,{status:'done'}))
    ok(await owner.post('/api/v1/tasks',{title:`Second weighted task ${size}`,projectId:project.id}))
    const workGoal=async title=>ok(await owner.post('/api/v1/goals',{title,scope:'company',mode:'work',periodStart:'2026-01-01',periodEnd:'2026-12-31'}))
    const childGoal=await workGoal(`Execution key result ${size}`),rootGoal=await workGoal(`Weighted objective ${size}`)
    const link=async(g,type,id,weight=1)=>ok(await owner.post(`/api/v1/goals/${g.id}/links`,{sourceType:type,sourceId:id,weight}))
    await link(childGoal,'task',task.id,2);await link(rootGoal,'project',project.id);await link(rootGoal,'task',task.id,3);await link(rootGoal,'goal',childGoal.id)
    await named.page.goto(`${w.origin}/app/goals/${rootGoal.id}`);await expect(named.page.getByRole('status')).toContainText('75%');await expect(named.page.locator('main')).toContainText('2 permitted inputs');await named.page.getByRole('link',{name:`Execution key result ${size}`,exact:true}).waitFor();await flat(named.page);await proof('goals-weighted-deduplicated-hierarchy',named.page)

    await readers[1].page.goto(companyUrl);assert.equal(await readers[1].page.getByRole('button',{name:'Record observation'}).count(),0);assert.equal(await readers[1].page.getByRole('button',{name:'Record check-in'}).count(),0)
    const companyView=ok(await other.get(`/api/v1/goals/${companyId}`))
    assert.equal((await other.post(`/api/v1/goals/${companyId}/checkins`,{revision:companyView.token,note:'No editor authority'})).status,403)
    for(const invalid of [agent,guest,analyst])assert.equal((await owner.post(`/api/v1/goals/${companyId}/audience-preview`,{ownerId:invalid.id})).status,400)
    await page.goto(companyUrl);await page.getByRole('form',{name:'Preview goal audience'}).locator('select[name=visibility]').selectOption('restricted');await page.getByRole('button',{name:'Preview audience and ownership'}).click();await page.getByRole('button',{name:'Confirm reviewed goal audience'}).click()
    for(const client of [other,guest,agent]){
      const session=await open(client);assert.equal((await session.page.goto(companyUrl)).status(),404);assert.ok(!(await session.page.locator('main').innerText()).includes(`Company outcome ${size}`));await flat(session.page);await proof(`goals-restricted-${client===other?'member':client===guest?'guest':'agent'}`,session.page);await session.context.close()
    }
    // Current team membership is checked at every read.
    const team=ok(await owner.post('/api/v1/teams',{name:`Goals team ${size}`,privacy:'private'}))
    ok(await owner.post('/api/v1/grants',{objectType:'team',objectId:team.id,granteeId:member.id,level:'viewer'}))
    await page.goto(`${w.origin}/app/goals`)
    const teamCreate=page.getByRole('form',{name:'Create a goal'});await teamCreate.getByLabel('Goal title',{exact:true}).fill(`Team outcome ${size}`);await teamCreate.locator('select[name=scope]').selectOption('team');await teamCreate.locator('select[name=teamId]').selectOption(team.id);await teamCreate.getByLabel('Period ends').fill('2026-12-31');await teamCreate.getByRole('button',{name:'Create goal',exact:true}).click();await page.waitForURL(/\/app\/goals\/goal_/)
    const teamGoal={id:page.url().split('/').pop()}
    await named.page.goto(`${w.origin}/app/goals/${teamGoal.id}`);await expect(named.page.getByRole('heading',{name:`Team outcome ${size}`,exact:true})).toBeVisible();await flat(named.page);await proof('goals-team-member',named.page)
    assert.equal((await readers[1].page.goto(`${w.origin}/app/goals/${teamGoal.id}`)).status(),404)
    // An owner previews notes and permitted linked titles before a personal share, then revokes it.
    const privateProject=ok(await owner.post('/api/v1/projects',{name:`Private input project ${size}`})),privateTask=ok(await owner.post('/api/v1/tasks',{title:`Hidden source title ${size}`,projectId:privateProject.id,ownerId:other.id}))
    const access=ok(await owner.post('/api/v1/grants',{objectType:'project',objectId:privateProject.id,granteeId:member.id,level:'viewer'}));ok(await owner.post('/api/v1/grants',{objectType:'project',objectId:privateProject.id,granteeId:manager.id,level:'viewer'}))
    await named.page.goto(`${w.origin}/app/goals`)
    const personalCreate=named.page.getByRole('form',{name:'Create a goal'});await personalCreate.getByLabel('Goal title',{exact:true}).fill(`Personal outcome ${size}`);await personalCreate.locator('select[name=scope]').selectOption('personal');await personalCreate.locator('select[name=mode]').selectOption('work');await personalCreate.getByLabel('Period ends').fill('2026-12-31');await personalCreate.getByRole('button',{name:'Create goal',exact:true}).click();await named.page.waitForURL(/\/app\/goals\/goal_/)
    const personal={id:named.page.url().split('/').pop()};ok(await member.post(`/api/v1/goals/${personal.id}/links`,{sourceType:'task',sourceId:privateTask.id}))
    const personalUrl=`${w.origin}/app/goals/${personal.id}`
    await named.page.goto(personalUrl);await named.page.getByRole('form',{name:'Goal check-in'}).getByLabel('Check-in note').fill(`Personal disclosure note ${size}`);await named.page.getByRole('button',{name:'Record check-in'}).click()
    const managed=await open(manager)
    assert.equal((await managed.page.goto(personalUrl)).status(),404);assert.equal((await page.goto(personalUrl)).status(),404)
    const audienceForm=named.page.getByRole('form',{name:'Preview goal audience'})
    await audienceForm.locator(`input[name="people[]"][value="${manager.id}"]`).check();await audienceForm.getByRole('button',{name:'Preview audience and ownership'}).click()
    const disclosure=named.page.locator('article').filter({has:named.page.getByRole('heading',{name:'Review newly revealed notes and titles'})})
    await expect(disclosure).toContainText(`Goal manager ${size}`);await expect(disclosure).toContainText(`Personal disclosure note ${size}`);await expect(disclosure).toContainText(`Hidden source title ${size}`)
    await flat(named.page);await proof('goals-personal-preview',named.page)
    await named.page.getByRole('button',{name:'Confirm reviewed goal audience'}).click();await managed.page.goto(personalUrl);await expect(managed.page.locator('main')).toContainText(`Personal disclosure note ${size}`);await flat(managed.page);await proof('goals-personal-shared',managed.page)
    assert.equal((await page.goto(personalUrl)).status(),404)
    await named.page.getByRole('form',{name:'Preview goal audience'}).locator(`input[name="people[]"][value="${manager.id}"]`).uncheck();await named.page.getByRole('button',{name:'Preview audience and ownership'}).click();await named.page.getByRole('button',{name:'Confirm reviewed goal audience'}).click()
    assert.equal((await managed.page.goto(personalUrl)).status(),404)
    await named.page.goto(personalUrl)
    ok(await owner.delete(`/api/v1/grants/${access.id}`))
    await named.page.getByRole('form',{name:'Goal check-in'}).getByLabel('Check-in note').fill('Refuse a stale check-in');await named.page.getByRole('button',{name:'Record check-in'}).click()
    assert.equal(ok(await member.get(`/api/v1/goals/${personal.id}`)).checkins.length,1)
    await named.page.goto(personalUrl);await expect(named.page.getByRole('status')).toContainText('restricted input')
    const progress=named.page.locator('article').filter({has:named.page.getByRole('heading',{name:'Progress and permitted links'})})
    assert.ok(!(await progress.innerText()).includes(`Hidden source title ${size}`));assert.ok(!(await progress.innerText()).includes('permitted inputs'))
    const restricted=ok(await member.get(`/api/v1/goals/${personal.id}`));assert.equal(restricted.sourceCount,null);assert.equal(restricted.progress,null);assert.ok(!JSON.stringify(restricted).includes(privateTask.id))
    await flat(named.page);await proof('goals-restricted-input',named.page)
    for(const session of [...readers,managed,own])await session.context.close()
    console.log(`Goal visibility and accountable owners at ${size}px passed`)
  }

  // Engineering handoff: actual review forms against all three provider wire boundaries.
  if(await select('engineering'))for(const [size,viewport] of sizes){
    const context=await browser.newContext({viewport});await context.addCookies(cookies(owner));const page=await context.newPage()
    const proof=async name=>{
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`engineering reflow ${name} ${size}`)
      for(const control of await page.locator('button,a[href]').all())assert.ok((await control.innerText()).trim(),'all controls have visible words')
      const focus=page.locator('main input:not([type=hidden]),main a,main button').first();await focus.focus();assert.ok(await focus.evaluate(el=>el===document.activeElement))
      if(process.env.PEGBOARD_PROOF_DIR){await mkdir(process.env.PEGBOARD_PROOF_DIR,{recursive:true});await page.screenshot({path:join(process.env.PEGBOARD_PROOF_DIR,`engineering-${name}-${size}.png`),fullPage:true})}
    }
    const p=ok(await owner.post('/api/v1/projects',{name:`Engineering campaign ${size}`})),member=await w.person(`synthetic-pegboard-81${size}@example.com`,`Engineering owner ${size}`)
    const task=ok(await owner.post('/api/v1/tasks',{projectId:p.id,title:`Human launch decision ${size}`,ownerId:member.id,kind:'approval'}))
    await page.goto(`${w.origin}/app/tasks/${task.id}`);await proof('task-entry');await page.getByRole('link',{name:'Engineering handoff',exact:true}).click()
    await expect(page.getByRole('heading',{name:'Engineering handoff',exact:true})).toBeVisible();await proof('empty')
    for(const service of ['vector','jira','github']){
      const state=engineering.services[service],todo=service==='vector'?vectorTodo:service==='jira'?'100':'open',done=service==='vector'?vectorDone:service==='jira'?'200':'closed',locator=service==='github'?['synthetic-pegboard-1','synthetic-pegboard-2','issues','1'].join('/'):'SYN-1'
      state.refused=false;state.change(todo)
      let form=page.getByRole('form',{name:'Link engineering work',exact:true})
      await form.getByLabel('Engineering service',{exact:true}).selectOption(service)
      if(service==='jira')await form.getByLabel('Jira site origin (Vector uses configured origin)').fill('https://synthetic-pegboard-1.atlassian.net')
      await form.getByLabel('Source reference',{exact:false}).fill(locator)
      await form.getByLabel('Credential for this request',{exact:false}).fill('synthetic-pegboard-800')
      await form.getByLabel('Status ID mapping as JSON',{exact:false}).fill(JSON.stringify({[todo]:'todo',[done]:'done'}))
      await form.getByLabel('Source owner ID to Pegboard person ID mapping as JSON').fill(JSON.stringify({[service==='github'?'801':state.owner]:member.id}))
      await form.getByLabel('Sync direction').selectOption('both');await form.getByRole('checkbox').check();await form.getByRole('button',{name:'Link work',exact:true}).click()
      let card=page.locator('article').filter({has:page.getByRole('heading',{name:`${service} · ${locator}`,exact:true})})
      await expect(card).toContainText('Engineering indicator: todo');await expect(card).toContainText(member.id)
      form=card.getByRole('form',{name:'Review source backlink',exact:true});await form.getByLabel('Source credential',{exact:true}).fill('synthetic-pegboard-800');await form.getByRole('checkbox').check();await form.getByRole('button',{name:'Publish or reconcile backlink'}).click();await expect(card).toContainText('Source backlink: posted')
      form=card.getByRole('form',{name:'Review source update',exact:true});await form.getByLabel('Reviewed source status ID').selectOption(done)
      if(service==='jira')await form.getByLabel('Jira transition ID').fill('31')
      await form.getByLabel('Source credential',{exact:true}).fill('synthetic-pegboard-800');await form.getByRole('checkbox').check();await form.getByRole('button',{name:'Apply reviewed update',exact:true}).click()
      await expect(card).toContainText('Engineering indicator: done');assert.equal(ok(await owner.get(`/api/v1/tasks/${task.id}`)).status,'todo')
      await proof(service+'-current')
      state.change('synthetic-pegboard-820')
      form=card.getByRole('form',{name:`Refresh ${locator}`,exact:true});await form.getByLabel('Source credential',{exact:true}).fill('synthetic-pegboard-800');await form.getByRole('button',{name:'Refresh source'}).click()
      await expect(card).toContainText('unmapped_source_status');await proof(service+'-unmapped')
      await card.getByRole('button',{name:'Revoke source grant',exact:true}).click();await expect(card).toContainText('source_grant_revoked');await expect(card).toContainText('Source owner ID: Unavailable');await proof(service+'-revoked')
    }
    // A reviewed write that discovers lost source access must clear cached context too.
    const recovery=ok(await owner.post('/api/v1/tasks',{projectId:p.id,title:`Source authority review ${size}`}))
    const link=ok(await owner.post(`/api/v1/tasks/${recovery.id}/engineering`,{service:'vector',locator:'SYN-1',mappings:{[vectorTodo]:'todo',[vectorDone]:'done','synthetic-pegboard-820':'doing'},direction:'both',consent:true,credential:'synthetic-pegboard-800'}))
    await page.goto(`${w.origin}/app/engineering/${recovery.id}`)
    engineering.services.vector.outage=true
    let preflight=page.getByRole('form',{name:'Review source backlink',exact:true})
    await preflight.getByLabel('Source credential',{exact:true}).fill('synthetic-pegboard-800');await preflight.getByRole('checkbox').check();await preflight.getByRole('button',{name:'Publish or reconcile backlink'}).click()
    await expect(page.locator('main')).toContainText('The engineering source is unavailable.');await proof('backlink-unavailable-error')
    await page.goto(`${w.origin}/app/engineering/${recovery.id}`);await expect(page.locator('main')).toContainText('Source stale or unavailable');await expect(page.locator('main')).toContainText('Source status: Unavailable');await proof('failed-backlink-preflight')
    engineering.services.vector.outage=false;engineering.services.vector.change(vectorTodo)
    ok(await owner.post(`/api/v1/engineering/${link.id}/refresh`,{credential:'synthetic-pegboard-800'}));await page.reload()
    engineering.services.vector.refused=true
    preflight=page.getByRole('form',{name:'Review source update',exact:true})
    await preflight.getByLabel('Reviewed source status ID').selectOption(vectorDone);await preflight.getByLabel('Source credential',{exact:true}).fill('synthetic-pegboard-800');await preflight.getByRole('checkbox').check();await preflight.getByRole('button',{name:'Apply reviewed update',exact:true}).click()
    await expect(page.locator('main')).toContainText('The engineering source refused access.');await proof('update-refused-error')
    await page.goto(`${w.origin}/app/engineering/${recovery.id}`);await expect(page.locator('main')).toContainText('Source owner ID: Unavailable');assert.equal(await page.getByRole('button',{name:'Apply reviewed update',exact:true}).count(),0);await proof('refused-update-preflight')
    engineering.services.vector.refused=false
    await page.goto(`${w.origin}/app/tasks/${task.id}`);await expect(page.getByText('Pending decision',{exact:false})).toBeVisible();await proof('human-decision')
    await context.close();console.log(`Engineering handoff at ${size}px passed`)
  }

  // Meeting import and human adoption use the product's own source and review pages.
  if(await select('meetings'))for(const [size,viewport] of sizes){
    const context=await browser.newContext({viewport});await context.addCookies(cookies(owner));const page=await context.newPage()
    const proof=async name=>{
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`meeting reflow ${name} ${size}`)
      for(const control of await page.locator('button,a[href]').all())assert.ok((await control.innerText()).trim(),'all controls have visible words')
      const focus=page.locator('main input:not([type=hidden]),main a,main button').first();await focus.focus();assert.ok(await focus.evaluate(el=>el===document.activeElement))
      if(process.env.PEGBOARD_PROOF_DIR){await mkdir(process.env.PEGBOARD_PROOF_DIR,{recursive:true});await page.screenshot({path:join(process.env.PEGBOARD_PROOF_DIR,`meeting-${name}-${size}.png`),fullPage:true})}
    }
    const project=ok(await owner.post('/api/v1/projects',{name:`Meeting campaign ${size}`})),member=await w.person(`synthetic-pegboard-91${size}@example.com`,`Meeting participant ${size}`)
    for(const service of ['zoom','meet','teams']){
      const source=`synthetic-pegboard-${service==='zoom'?921:service==='meet'?922:923}${size}`,raw='Action: Synthetic follow-up with uncertain owner and date'
      const content=service==='meet'?JSON.stringify({transcriptEntries:[{name:'synthetic-pegboard-924',participant:'synthetic-pegboard-925',startTime:'2026-10-23T12:00:01Z',endTime:'2026-10-23T12:00:05Z',text:raw}]}):'WEBVTT\n\n1\n00:00:01.000 --> 00:00:05.000\n'+raw+'\n'
      await page.goto(`${w.origin}/app/meetings`);let form=page.getByRole('form',{name:'Import meeting transcript',exact:true})
      await form.getByLabel('Meeting service',{exact:true}).selectOption(service);await form.getByLabel('Stable source transcript ID',{exact:false}).fill(source);await form.getByLabel('Complete transcript export').fill(content)
      for(const checkbox of await form.getByRole('checkbox').all())await checkbox.check()
      await proof(service+'-import');await form.getByRole('button',{name:'Import transcript',exact:true}).click()
      await page.getByRole('link',{name:`${service} · ${source}`,exact:true}).click();await expect(page.getByText('Unresolved owner or date: adoption is blocked.',{exact:true})).toBeVisible();await proof(service+'-uncertain')
      const reviewUrl=page.url();form=page.getByRole('form',{name:'Resolve meeting action',exact:true})
      await form.getByLabel('Reviewed action title').fill(`Reviewed ${service} action ${size}`);await form.getByLabel('Accountable owner').selectOption(member.id);await form.getByLabel('Reviewed due date',{exact:false}).fill('2026-11-03');await form.getByRole('checkbox').check();await form.getByRole('button',{name:'Save resolved action'}).click()
      await expect(page.getByText('Owner and date resolved. Review the current action before adoption.',{exact:true})).toBeVisible();await proof(service+'-resolved')
      form=page.getByRole('form',{name:'Approve meeting action',exact:true});await form.getByLabel('Project receiving this action').selectOption(project.id);await form.getByRole('checkbox').check();await form.getByRole('button',{name:'Approve action once'}).click()
      await expect(page.getByRole('link',{name:'Open adopted task',exact:true})).toBeVisible();await proof(service+'-adopted')
      await page.getByRole('link',{name:'Open adopted task',exact:true}).click();await expect(page.getByRole('heading',{name:`Reviewed ${service} action ${size}`,exact:true})).toBeVisible();await expect(page.locator('main')).toContainText('Meeting citation:');await expect(page.getByRole('link',{name:'Meeting source segment 1',exact:true})).toBeVisible();await proof(service+'-task')
      await page.goto(reviewUrl);await page.getByRole('button',{name:'Revoke source access',exact:true}).click();await expect(page.getByText('Source access revoked.',{exact:false})).toBeVisible();assert.ok(!(await page.locator('main').innerText()).includes(raw));await proof(service+'-revoked')
      const resource=(service==='zoom'?['meetings','synthetic-pegboard-951','recordings','synthetic-pegboard-952']:service==='meet'?['conferenceRecords','synthetic-pegboard-951','transcripts','synthetic-pegboard-952']:['users','synthetic-pegboard-951','onlineMeetings','synthetic-pegboard-952','transcripts','synthetic-pegboard-953']).join('/')
      await page.goto(`${w.origin}/app/meetings`);form=page.getByRole('form',{name:'Import meeting transcript',exact:true})
      await form.getByLabel('Meeting service',{exact:true}).selectOption(service);await form.getByLabel('Stable source transcript ID',{exact:false}).fill(resource+size)
      // The recording file ID is fixed by Zoom's official manifest.
      if(service==='zoom')await form.getByLabel('Stable source transcript ID',{exact:false}).fill(resource.replace('synthetic-pegboard-951',`synthetic-pegboard-951${size}`))
      await form.getByLabel('Source credential',{exact:false}).fill('synthetic-pegboard-950');for(const checkbox of await form.getByRole('checkbox').all())await checkbox.check()
      await form.getByRole('button',{name:'Import transcript',exact:true}).click()
      const directResource=service==='zoom'?resource.replace('synthetic-pegboard-951',`synthetic-pegboard-951${size}`):resource+size
      await page.getByRole('link',{name:`${service} · ${directResource}`,exact:true}).click();const directUrl=page.url()
      await expect(page.locator('main')).toContainText('Synthetic provider follow-up');await proof(service+'-provider-source')
      meetings.state.changed.add(service)
      form=page.getByRole('form',{name:'Recheck provider source',exact:true});await form.getByLabel('Source credential',{exact:true}).fill('synthetic-pegboard-950');await form.getByRole('button',{name:'Recheck source access',exact:true}).click()
      await expect(page.locator('main')).toContainText('The source transcript changed.');await proof(service+'-changed-source-error')
      await page.goto(directUrl);await expect(page.locator('main')).toContainText('Source access revoked.');assert.ok(!(await page.locator('main').innerText()).includes('Synthetic provider follow-up'));assert.equal(await page.getByRole('button',{name:'Approve action once',exact:true}).count(),0);await proof(service+'-superseded-source')
      meetings.state.changed.delete(service)
    }
    await context.close();console.log(`Meeting review at ${size}px passed`)
  }

  // Data settings and permanent audit, through the same HTML forms as the owner uses.
  if(await select('custody'))for(const [size,viewport] of sizes){
    const context=await browser.newContext({viewport});await context.addCookies(cookies(owner));const page=await context.newPage()
    const proof=async name=>{
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`no sideways scroll: ${name} ${size}`)
      // All controls in these screens have visible words; there are no icon-only controls requiring a tooltip.
      for(const control of await page.locator('button,a[href]').all())assert.ok((await control.innerText()).trim().length>0,'control has visible words')
      const focus=page.locator('main button,main input:not([type=hidden]),main select,main a').first();await focus.focus();assert.ok(await focus.evaluate(el=>el===document.activeElement))
      if(process.env.PEGBOARD_PROOF_DIR){await mkdir(process.env.PEGBOARD_PROOF_DIR,{recursive:true});await page.screenshot({path:join(process.env.PEGBOARD_PROOF_DIR,`${name}-${size}.png`),fullPage:true})}
    }
    const member=await w.person(`synthetic-pegboard-72${size}@example.com`,`Custody reviewer ${size}`)
    const p=ok(await owner.post('/api/v1/projects',{name:`Custody review ${size}`})),task=ok(await owner.post('/api/v1/tasks',{projectId:p.id,title:`Custody task ${size}`,ownerId:member.id}))
    ok(await owner.post(`/api/v1/tasks/${task.id}/comments`,{body:'synthetic-pegboard-701@example.com'}))
    const versionedProof=async n=>{
      const file=async v=>ok(await owner.post(`/api/v1/tasks/${task.id}/attachments?name=synthetic-pegboard-${n}${v}.pdf`,proofDocument(`synthetic-pegboard-${n}${v}`),{'content-type':'application/pdf'}))
      const a=await file(1),proof=ok(await owner.post(`/api/v1/tasks/${task.id}/proofs`,{attachmentId:a.id})),b=await file(2),v2=ok(await owner.post(`/api/v1/proofs/${proof.id}/versions`,{attachmentId:b.id,currentVersion:proof.versionId}))
      const d=ok(await owner.get(`/api/v1/proofs/${proof.id}/decision-preview`));ok(await owner.post(`/api/v1/proofs/${proof.id}/decisions`,{versionId:v2.versionId,token:d.token,action:'approve',reason:'synthetic-pegboard-748'}));return proof
    }
    await versionedProof(741)
    const agent=await w.person(`synthetic-pegboard-73${size}@example.com`,`Custody agent ${size}`,'agent')
    ok(await owner.post('/api/v1/grants',{objectType:'project',objectId:p.id,granteeId:agent.id,level:'editor',scopes:['read','edit']}));ok(await owner.post('/api/v1/data/processors',{processor:'synthetic-pegboard-744',approved:true,sharing:false,training:false,confirm:true}))
    const intake={projectId:p.id,processor:'synthetic-pegboard-744',body:'synthetic-pegboard-745',key:'synthetic-pegboard-746'},output=ok(await agent.post(`/api/v1/tasks/${task.id}/agent-outputs`,intake))
    assert.ok(ok(await owner.get('/api/v1/search?q='+encodeURIComponent(`Custody task ${size}`))).results.some(r=>r.id===task.id))
    await page.goto(`${w.origin}/app/admin`);await proof('admin-data-doors');await page.getByRole('link',{name:'Data settings',exact:true}).click();await expect(page.getByRole('heading',{name:'Data settings',exact:true})).toBeVisible();await proof('data-settings')
    let form=page.getByRole('form',{name:'Review retention',exact:true})
    await form.getByLabel('Retention class',{exact:true}).selectOption('attachments_proofs');await form.getByLabel('Days to keep (blank keeps until explicit erasure)').fill('1');await form.getByRole('button',{name:'Preview retention',exact:true}).click()
    await expect(page.getByRole('heading',{name:'Review retention change'})).toBeVisible();await proof('data-retention-review')
    await page.getByRole('button',{name:'Publish retention',exact:true}).click();await expect(page.locator('li').filter({has:page.getByText('Attachments and proofs',{exact:true})})).toContainText('1 day, then eligible for reviewed expiry')
    form=page.getByRole('form',{name:'Apply legal hold',exact:true});await form.getByLabel('Hold scope').selectOption('project');await form.getByLabel('Scope ID',{exact:true}).fill(p.id);await form.getByLabel('Authority for this hold').fill(`Custody authority ${size}`);await form.getByLabel('Hold expiry (UTC)').fill(new Date(Date.now()+86400000).toISOString().slice(0,16));await form.getByRole('button',{name:'Apply hold',exact:true}).click()
    form=page.getByRole('form',{name:'Review erasure',exact:true});await form.getByLabel('Type of data').selectOption('project');await form.getByLabel('Record ID',{exact:true}).fill(p.id);await form.getByRole('button',{name:'Preview erasure'}).click()
    await expect(page.getByText(`Legal hold: Custody authority ${size}`,{exact:false})).toBeVisible();await expect(page.getByRole('button',{name:'Record retained outcome'})).toBeVisible();await proof('data-held-erasure')
    form=page.getByRole('form',{name:'Confirm erasure',exact:true});await form.getByRole('checkbox').check();await form.getByRole('button',{name:'Record retained outcome'}).click();await expect(page.getByRole('list',{name:'Data receipts'})).toContainText('retained')
    form=page.getByRole('form',{name:'Release hold',exact:true}).last();await form.getByLabel('Confirm release').check();await form.getByRole('button',{name:'Release hold',exact:true}).click()
    await w.sql(`UPDATE peg_attachments SET created_at=${Date.now()-3*86400000} WHERE task_id='${task.id}'`)
    await page.goto(`${w.origin}/app/data`);form=page.getByRole('form',{name:'Review expiry',exact:true});await form.getByLabel('Class to expire').selectOption('attachments_proofs');await form.getByRole('button',{name:'Preview eligible records'}).click()
    await expect(page.getByRole('heading',{name:'Review eligible expiry'})).toBeVisible();await expect(page.locator('article').filter({has:page.getByRole('heading',{name:'Review eligible expiry'})})).toContainText('2 · Attachment bytes');await proof('data-expiry-review')
    await page.getByRole('button',{name:'Expire reviewed records',exact:true}).click();assert.equal(ok(await owner.get(`/api/v1/tasks/${task.id}`)).attachments.length,0)
    const finalProof=await versionedProof(749)
    await page.goto(`${w.origin}/app/data?review=erase&type=project&id=${p.id}`);await expect(page.getByRole('button',{name:'Erase reviewed data',exact:true})).toBeVisible();await proof('data-erasure-review')
    form=page.getByRole('form',{name:'Confirm erasure',exact:true});await form.getByRole('checkbox').check();await form.getByRole('button',{name:'Erase reviewed data',exact:true}).click()
    await expect(page.getByRole('list',{name:'Data receipts'}).locator('li').filter({hasText:p.id}).first()).toContainText('partial');await expect(page.getByRole('list',{name:'Unresolved processor deletions'})).toContainText(output.id);await proof('data-receipt')
    assert.equal((await owner.get(`/api/v1/tasks/${task.id}`)).status,404)
    for(const path of [`/api/v1/proofs/${finalProof.id}`,`/api/v1/agent-outputs/${output.id}`,`/api/v1/agent-outputs/${output.id}/retrieval`])assert.equal((await owner.get(path)).status,404)
    assert.equal((await agent.post(`/api/v1/tasks/${task.id}/agent-outputs`,intake)).status,404);assert.deepEqual(ok(await owner.get('/api/v1/search?q='+encodeURIComponent(`Custody task ${size}`))).results,[])
    const second=ok(await owner.post('/api/v1/projects',{name:`Shared custody ${size}`})),kept=ok(await owner.post('/api/v1/projects',{name:`Retained custody ${size}`})),signoff=ok(await owner.post('/api/v1/tasks',{projectId:second.id,title:`Shared sign-off ${size}`,kind:'approval',ownerId:member.id}))
    ok(await owner.post(`/api/v1/tasks/${signoff.id}/projects`,{projectId:kept.id}));const decision=ok(await owner.get(`/api/v1/tasks/${signoff.id}/decision-preview`));ok(await owner.post(`/api/v1/tasks/${signoff.id}/decision`,{revision:decision.token,action:'approve',reason:'synthetic-pegboard-731'}))
    await page.goto(`${w.origin}/app/data?review=erase&type=project&id=${second.id}`);await expect(page.getByText('The retained shared work needs a fresh human decision after its context is erased.',{exact:false})).toBeVisible();await proof('data-shared-signoff-review')
    form=page.getByRole('form',{name:'Confirm erasure',exact:true});await form.getByRole('checkbox').check();await form.getByRole('button',{name:'Erase reviewed data',exact:true}).click();assert.equal(ok(await owner.get(`/api/v1/tasks/${signoff.id}`)).status,'todo')
    await page.goto(`${w.origin}/app/audit`);form=page.getByRole('form',{name:'Search audit',exact:true});await form.getByLabel('Subject ID').fill(p.id);await form.getByRole('button',{name:'Search audit',exact:true}).click()
    const rows=page.getByRole('list',{name:'Permanent audit events'});await expect(rows).toContainText('data.erasure');assert.ok(!(await rows.innerText()).includes('synthetic-pegboard-701@example.com'));await proof('permanent-audit')
    const download=await page.request.get(w.origin+await page.getByRole('link',{name:'Export this page as JSON'}).getAttribute('href'));assert.equal(download.status(),200);assert.ok((await download.json()).events.every(e=>e.target_id===p.id))
    await context.close();console.log(`Data custody at ${size}px passed`)
  }
  if(await select('recovery'))await recoveryJourney({w,browser,sizes,ok})
  if(await select('departure'))await memberRemovalJourney({w,browser,sizes,ok})
  if(await select('canvas'))await planningCanvasJourney({w,browser,sizes,ok})
  if(await select('portfolio'))await portfolioJourney({w,browser,sizes,ok})
  if(await select('timeline'))await timelineJourney({w,browser,sizes,ok})
  if(await select('register'))await deliveryRegisterJourney({w,browser,sizes,ok})
  if(await select('bundles'))await workflowBundleJourney({w,browser,sizes,ok})
} finally {
  await browser.close()
  await w.stop()
  await capacityServices.stop()
  await sheetsService.stop()
  await calendarServices.stop()
  await services.stop()
  await engineering.stop()
  await meetings.stop()
}
