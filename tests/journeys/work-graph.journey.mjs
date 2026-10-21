// The PEG-001 and PEG-020 screens, driven in a browser at 1440 and 390 px: build and share work through Projects, what a
// guest is never shown, a refused link turned into a request that an admin approves, and a stale tab refused.
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import { chromium } from '@playwright/test'
import { startWorker } from '../support/worker.mjs'

const w = await startWorker()
const browser = await chromium.launch({ headless: true, args: ['--use-mock-keychain', '--password-store=basic'] })
const cookies = client => client.cookie.split('; ').map(pair => ({ name: pair.slice(0, pair.indexOf('=')), value: pair.slice(pair.indexOf('=') + 1), url: w.origin }))
const sizes = [['1440', { width: 1440, height: 900 }], ['390', { width: 390, height: 844 }]]
try {
  const owner = w.owner, ok = (r, status = 200) => { assert.equal(r.status, status, JSON.stringify(r.body)); return r.body }
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
    const launchUrl = page.url()
    await page.goBack(); await page.getByRole('link', { name: `Campaign ${size}`, exact: true }).click()
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
    assert.deepEqual(await page.locator('#main section .card:has(h2:text-is("Projects")) .rows > li a:first-child').allTextContents(), [`Campaign ${size}`, `Launch ${size}`])
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
    const proof=async(name)=>{if(process.env.PEGBOARD_EVIDENCE_DIR){await mkdir(process.env.PEGBOARD_EVIDENCE_DIR,{recursive:true});await ownPage.screenshot({path:join(process.env.PEGBOARD_EVIDENCE_DIR,`${name}-${size}.png`),fullPage:true})}}
    await proof('my-tasks')
    const ownProject=ok(await personal.post('/api/v1/projects',{name:`Personal sharing ${size}`}))
    ok(await personal.post('/api/v1/grants',{objectType:'project',objectId:ownProject.id,granteeId:nina.id,level:'viewer'}))
    await ownPage.getByRole('link',{name:`Personal plan ${size}`,exact:true}).click()
    const personalUrl=ownPage.url()
    assert.equal((await page.goto(personalUrl)).status(),404,'ordinary admin cannot read personal work')
    await ownPage.locator('form[aria-label="Preview personal sharing"] select[name=projectId]').selectOption(ownProject.id)
    await ownPage.getByRole('button',{name:'Preview visibility'}).click()
    assert.ok((await ownPage.locator('main').innerText()).includes(`Nina ${size} · Viewer`))
    await flat(ownPage);await proof('personal-visibility-preview')
    await ownPage.getByRole('button',{name:'Share with reviewed audience'}).click()
    assert.equal((await nina.get(`/api/v1/tasks/${personalUrl.split('/').pop()}`)).status,200)
    assert.equal(await ownPage.locator('form[aria-label="Approve personal sharing"]').count(),0)
    await flat(ownPage);await proof('shared-personal-task')
    await own.context.close()
    console.log(`journey at ${size}px passed`)
  }
} finally {
  await browser.close()
  await w.stop()
}
