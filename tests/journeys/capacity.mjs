import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { expect } from '@playwright/test'

// One sanity journey through Account, Settings, Workload and task conversation. Assertions run at 1440;
// optional release proof captures each changed state at 1440 and 390 without repeating the journey.
export async function capacityJourney({ w, browser, services, ok }) {
  const owner = w.owner, address = n => `synthetic-pegboard-${n}` + String.fromCharCode(64) + 'example.test'
  const member = await w.person(address(1610), 'Casey Capacity'), observer = await w.person(address(1611), 'Riley Observer')
  const open = async client => { const context = await browser.newContext({ viewport: { width: 1440, height: 900 } }); await context.addCookies(client.cookie.split('; ').map(pair => ({ name: pair.slice(0, pair.indexOf('=')), value: pair.slice(pair.indexOf('=') + 1), url: w.origin }))); return { context, page: await context.newPage() } }
  const own = await open(owner), mine = await open(member), limited = await open(observer)
  const proof = async (page, name) => {
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
    if (!fits) {
      console.log('Capacity overflow:', JSON.stringify(await page.locator('body *').evaluateAll(elements => elements.filter(e => e.getBoundingClientRect().right > innerWidth + 1).slice(0, 15).map(e => ({ tag: e.tagName, class: e.className, right: e.getBoundingClientRect().right, width: e.getBoundingClientRect().width })))))
      if (process.env.PEGBOARD_PROOF_DIR) await page.screenshot({ path: join(process.env.PEGBOARD_PROOF_DIR, 'capacity-overflow.png'), fullPage: true })
    }
    assert.ok(fits, `capacity ${name} fits the page`)
    const smallText = await page.locator('main').evaluate(el => [...el.querySelectorAll('button,a,input,select,p,h2,h3,label,small')].filter(e => e.getBoundingClientRect().width && parseFloat(getComputedStyle(e).fontSize) < 13).map(e => e.textContent.slice(0, 80)))
    assert.deepEqual(smallText, [], 'touched capacity screens use readable text')
    const iconControls = await page.locator('main button,main a').evaluateAll(elements => elements.filter(e => !e.textContent.trim() && e.querySelector('svg,img')).map(e => e.outerHTML))
    assert.deepEqual(iconControls, [], 'new capacity controls have visible text labels')
    if (!process.env.PEGBOARD_PROOF_DIR) return
    await mkdir(process.env.PEGBOARD_PROOF_DIR, { recursive: true })
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 })
      await page.screenshot({ path: join(process.env.PEGBOARD_PROOF_DIR, `capacity-${name}-${width}.png`), fullPage: true })
    }
    await page.setViewportSize({ width: 1440, height: 900 })
  }
  const api = '/api/v1/workspaces/ws_main', url = w.origin + '/app/workload?from=2026-11-02&days=7'
  const workload = async () => ok(await owner.get(api + '/workload?from=2026-11-02&days=7'))
  try {
    const projects = [], tasks = []
    for (const [i, name] of ['Campaign', 'Launch', 'Operations'].entries()) {
      const project = ok(await owner.post('/api/v1/projects', { name, visibility: 'workspace' })); projects.push(project)
      tasks.push(ok(await owner.post('/api/v1/tasks', { projectId: project.id, title: name + ' commitment', ownerId: member.id, estimateHours: i === 0 ? 30 : 2, startDate: i === 0 ? '2026-11-02' : '2026-11-06', dueDate: '2026-11-06' })))
    }
    const hidden = ok(await owner.post('/api/v1/projects', { name: 'Synthetic hidden project' }))
    ok(await owner.post('/api/v1/tasks', { projectId: hidden.id, title: 'Synthetic private commitment title', ownerId: owner.id, estimateHours: 5, startDate: '2026-11-02', dueDate: '2026-11-06' }))

    await own.page.goto(w.origin + '/app/settings/capacity')
    const resource = own.page.getByRole('form', { name: 'Plan a resource' })
    await resource.getByLabel('Role or skill').fill('Campaign designer')
    await resource.getByLabel('Tentative hours').fill('12')
    await resource.getByLabel('Plan starts').fill('2026-11-02'); await resource.getByLabel('Plan ends').fill('2026-11-06')
    await resource.getByRole('button', { name: 'Save tentative resource plan' }).click()
    await expect(own.page.getByRole('heading', { name: 'Capacity settings', exact: true })).toBeVisible()
    await proof(own.page, 'settings')

    await mine.page.goto(w.origin + '/app/account/availability')
    const profile = mine.page.getByRole('form', { name: 'My working capacity' })
    await profile.getByLabel('My IANA timezone').fill('America/Chicago'); await profile.getByLabel('Skills and roles').fill('Design and delivery')
    await profile.getByRole('button', { name: 'Save my capacity' }).click()
    const full = mine.page.getByRole('form', { name: 'Declare full days' })
    await full.getByLabel('First day away').fill('2026-11-02'); await full.getByLabel('Last day away (included)').fill('2026-11-04')
    await full.getByLabel('Optional delegate contact').selectOption(owner.id); await full.getByRole('button', { name: 'Declare full days', exact: true }).click()
    const half = mine.page.getByRole('form', { name: 'Declare partial day' })
    await half.getByLabel('Away from (my local time)').fill('2026-11-05T09:00'); await half.getByLabel('Away until (my local time)').fill('2026-11-05T13:00')
    await half.getByRole('button', { name: 'Declare partial day', exact: true }).click()
    await expect(mine.page.getByRole('heading', { name: 'My declarations' })).toBeVisible()
    assert.deepEqual((await workload()).people.find(p => p.id === member.id).days.slice(0, 5).map(d => d.availableHours), [0, 0, 0, 4, 8])
    const agentPlan = ok(await owner.get(api + '/capacity-plan?from=2026-11-02&days=7&hours=1'))
    assert.ok(!agentPlan.candidates.some(p => p.personId === member.id && p.date <= '2026-11-04'))
    await proof(mine.page, 'self-declared')

    await own.page.goto(w.origin + '/app/tasks/' + tasks[0].id)
    await expect(own.page.getByLabel('Assigned to').locator('option:checked')).toContainText('Unavailable during planned work')
    await expect(own.page.getByLabel('Mention a participant').locator(`option[value="${member.id}"]`)).toContainText('Unavailable during planned work')
    await own.page.getByLabel('Mention a participant').selectOption(member.id)
    await own.page.getByRole('form', { name: 'Comment', exact: true }).getByLabel('Comment', { exact: true }).fill('Review when available.')
    await own.page.getByRole('button', { name: 'Comment', exact: true }).click()
    await expect(own.page.getByRole('article').filter({ has: own.page.getByRole('heading', { name: 'Conversation', exact: true }) }).getByRole('list').first()).toContainText('@Casey Capacity Review when available.')
    await proof(own.page, 'assignment-and-mention')

    const willow = ok(await owner.post(api + '/capacity-feeds', { service: 'willow', origin: 'https://willow.synthetic.test', mapping: { 'synthetic-pegboard-willow-person': member.id } }))
    services.rows.willow = [{ id: 'synthetic-pegboard-1612', personId: 'synthetic-pegboard-willow-person', name: 'Casey Capacity', startDate: '2026-11-03', endDate: '2026-11-04', status: 'approved' }]
    await own.page.goto(w.origin + '/app/settings/capacity')
    const feed = own.page.getByRole('form', { name: 'Read approved leave ' + willow.id })
    await feed.getByLabel('Source credential for this read').fill('synthetic-pegboard-1600')
    await feed.getByLabel('Read from').fill('2026-11-02'); await feed.getByLabel('Read through').fill('2026-11-08')
    await feed.getByRole('button', { name: 'Read approved leave', exact: true }).click()
    assert.deepEqual((await workload()).people.find(p => p.id === member.id).days.slice(0, 5).map(d => d.availableHours), [0, 0, 0, 4, 8])
    await proof(own.page, 'approved-source')
    await own.page.goto(url)
    await expect(own.page.getByText('Campaign designer · Unfilled role', { exact: false })).toBeVisible()
    await expect(own.page.getByText('Overload 6 h', { exact: true }).first()).toBeVisible()
    await proof(own.page, 'overloaded')
    const dates = own.page.getByRole('form', { name: 'Choose workload dates' })
    await dates.getByLabel('Period').selectOption('1'); await dates.getByRole('button', { name: 'Show capacity' }).click()
    await expect(own.page.getByRole('region', { name: 'Capacity for Casey Capacity' }).locator('.rows > li')).toHaveCount(1)
    await proof(own.page, 'day-capacity')
    await own.page.getByRole('form', { name: 'Choose workload dates' }).getByLabel('Period').selectOption('7')
    await own.page.getByRole('button', { name: 'Show capacity' }).click()
    // Both the drag door and the keyboard-accessible form lead to the same exact review.
    const drag = own.page.locator(`[data-capacity-task="${tasks[0].id}"]`), target = own.page.locator(`[data-capacity-person="${owner.id}"]`)
    assert.equal((await own.page.request.get(w.origin + '/workload.js')).status(), 200)
    const transfer = await own.page.evaluateHandle(() => new DataTransfer())
    await drag.dispatchEvent('dragstart', { dataTransfer: transfer })
    await target.dispatchEvent('dragover', { dataTransfer: transfer })
    await target.dispatchEvent('drop', { dataTransfer: transfer })
    await transfer.dispose()
    await expect(own.page.getByRole('heading', { name: 'Review staffing scenario' })).toBeVisible()
    assert.equal(ok(await owner.get('/api/v1/tasks/' + tasks[0].id)).owner.id, member.id)
    await own.page.getByRole('link', { name: 'Cancel scenario', exact: true }).click()
    const accessible = own.page.getByRole('form', { name: 'Compare staffing', exact: true })
    await accessible.getByLabel('Task to reassign').selectOption(tasks[0].id)
    await accessible.getByLabel('Proposed accountable owner').selectOption(owner.id)
    await accessible.getByRole('button', { name: 'Preview staffing scenario' }).click()
    await expect(own.page.getByRole('heading', { name: 'Review staffing scenario' })).toBeVisible()
    await proof(own.page, 'scenario')
    await own.page.getByRole('button', { name: 'Apply reviewed reassignment' }).click()
    const changed = await workload()
    assert.equal(changed.people.find(p => p.id === member.id).hours, 4)
    assert.equal(changed.people.find(p => p.id === owner.id).hours, 30)
    assert.ok(changed.people.every(p => p.days.every(d => !d.overloadHours)))
    await expect(own.page.getByText(/^Overload /)).toHaveCount(0)
    await proof(own.page, 'reassigned')

    const allocation = ok(await owner.post('/api/v1/tasks', { projectId: projects[0].id, title: 'Ten-hour source work', ownerId: member.id, estimateHours: 10, startDate: '2026-12-01', dueDate: '2026-12-01' }))
    ok(await owner.post('/api/v1/tasks/' + allocation.id + '/projects', { projectId: projects[1].id }))
    for (const [mode, amounts] of [['split', [5, 5]], ['sum', [10, 10]], ['per-person', [3, 7]], ['unknown', null]]) {
      await own.page.goto(url + '&effortTask=' + allocation.id)
      const form = own.page.getByRole('form', { name: 'Preview effort mapping' })
      await form.getByLabel('Source', { exact: true }).selectOption(mode === 'per-person' ? 'workspace-list' : 'board-centric')
      await form.getByLabel('Source item reference').fill('synthetic-pegboard-source-item')
      await form.getByLabel('Source workload setting').selectOption(mode)
      await form.locator(`input[name="selected[]"][value="${owner.id}"]`).check()
      await form.getByLabel('Source person reference for Casey Capacity').fill('synthetic-pegboard-person-1')
      await form.getByLabel('Source person reference for Wes Holloway').fill('synthetic-pegboard-person-2')
      await form.getByLabel('Hours for Casey Capacity').fill('3'); await form.getByLabel('Hours for Wes Holloway').fill('7')
      await form.getByRole('button', { name: 'Preview effort allocation' }).click()
      await expect(own.page.getByRole('heading', { name: 'Review effort mapping' })).toBeVisible()
      await proof(own.page, 'effort-' + mode)
      if (amounts) {
        await own.page.getByRole('button', { name: 'Apply reviewed effort' }).click()
        const view = ok(await owner.get(api + '/workload?from=2026-12-01&days=1'))
        assert.equal(view.tasks.filter(t => t.id === allocation.id).length, 1)
        assert.equal(view.people.find(p => p.id === member.id).hours, amounts[0]); assert.equal(view.people.find(p => p.id === owner.id).hours, amounts[1])
        assert.equal(ok(await owner.get('/api/v1/tasks/' + allocation.id)).estimateHours, 10)
      } else {
        await expect(own.page.getByRole('button', { name: 'Apply reviewed effort' })).toHaveCount(0)
        await expect(own.page.getByText('Choose and review the missing source allocation semantics.', { exact: false })).toBeVisible()
      }
    }
    const repair = own.page.getByRole('form', { name: 'Preview effort mapping' })
    await repair.getByLabel('Source workload setting').selectOption('unknown')
    await repair.getByLabel('Reviewed choice when source semantics are missing').selectOption('split')
    await repair.locator(`input[name="selected[]"][value="${owner.id}"]`).check()
    await repair.getByRole('button', { name: 'Preview effort allocation' }).click()
    await expect(own.page.getByText('Reviewed changed semantics; source equivalence remains unknown.', { exact: true })).toBeVisible()
    await own.page.getByRole('button', { name: 'Apply reviewed effort' }).click()

    const hris = ok(await owner.post(api + '/capacity-feeds', { service: 'bamboohr', account: 'synthetic-pegboard', mapping: { 'synthetic-pegboard-hris-person': member.id } }))
    ok(await owner.post(api + '/capacity-feeds/' + hris.id + '/refresh', { credential: 'synthetic-pegboard-1600', from: '2026-11-02', through: '2026-11-08' }))
    await w.sql(`UPDATE peg_capacity_feeds SET fetched_at=fetched_at-172800000 WHERE id='${hris.id}'`)
    await limited.page.goto(url)
    await expect(limited.page.getByText('bamboohr · Unknown freshness', { exact: true })).toBeVisible()
    assert.ok(!(await limited.page.content()).includes('Synthetic private commitment title'))
    assert.ok(!(await limited.page.content()).includes('Synthetic hidden project'))
    await proof(limited.page, 'unknown-and-private')
    await mine.page.goto(w.origin + '/app/account/availability')
    const extend = mine.page.getByRole('form', { name: /^Extend declaration/ }).filter({ has: mine.page.locator('input[value="2026-11-04"]') })
    await extend.getByLabel('New last day or UTC instant').fill('2026-11-05'); await extend.getByRole('button', { name: 'Extend declaration' }).click()
    await expect(mine.page.getByRole('heading', { name: 'Attributed availability history' })).toBeVisible()
    while (await mine.page.getByRole('button', { name: 'Cancel declaration', exact: true }).count()) { await mine.page.getByRole('button', { name: 'Cancel declaration', exact: true }).first().click() }
    await expect(mine.page.getByText('No self-declared absence.', { exact: true })).toBeVisible()
    const history = mine.page.getByRole('article').filter({ has: mine.page.getByRole('heading', { name: 'Attributed availability history' }) })
    await expect(history).toContainText('Casey Capacity · extended'); await expect(history).toContainText('Casey Capacity · cancelled')
    await proof(mine.page, 'attributed-history')
    console.log('Capacity sanity journey passed at 1440px; Willow and BambooHR are official-schema fakes.')
  } finally { await own.context.close(); await mine.context.close(); await limited.context.close() }
}
