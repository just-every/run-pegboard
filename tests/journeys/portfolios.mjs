// PEG-013 in a browser at 1440 and 390 px: a nested portfolio of 20 projects with a private one, read as its owner, as a
// limited stakeholder and as someone outside it; the risk policy and a published status changed through the screens.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { expect } from '@playwright/test'

export async function portfolioJourney({ w, browser, sizes, ok }) {
  const clock = '2026-03-16T12:00'
  for (const [size, viewport] of sizes) {
    const open = async client => { const context = await browser.newContext({ viewport }); await context.addCookies(client.cookie.split('; ').map(pair => ({ name: pair.slice(0, pair.indexOf('=')), value: pair.slice(pair.indexOf('=') + 1), url: client.origin }))); return { context, page: await context.newPage() } }
    const proof = async (page, name) => {
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `portfolio ${name} reflows at ${size}`)
      const icons = await page.locator('main button,main a').evaluateAll(els => els.filter(e => !e.textContent.trim() && e.querySelector('svg,img')).map(e => e.outerHTML))
      assert.deepEqual(icons, [], 'portfolio screens use text-labelled controls')
      if (process.env.PEGBOARD_PROOF_DIR) { await mkdir(process.env.PEGBOARD_PROOF_DIR, { recursive: true }); await page.screenshot({ path: join(process.env.PEGBOARD_PROOF_DIR, `portfolio-${name}-${size}.png`), fullPage: true }) }
    }
    const owner = w.owner, stakeholder = await w.person(`synthetic-pegboard-1301-${size}@example.com`, 'Sam Stakeholder'), outsider = await w.person(`synthetic-pegboard-1302-${size}@example.com`, 'Nina Outsider')
    const own = await open(owner), sam = await open(stakeholder), out = await open(outsider)
    try {
      await own.page.goto(`${w.origin}/app/portfolios`)
      await own.page.getByRole('form', { name: 'Start a portfolio' }).getByLabel('Portfolio name').fill(`Spring programs ${size}`)
      await own.page.getByRole('button', { name: 'Create portfolio' }).click()
      await own.page.getByRole('link', { name: `Spring programs ${size}`, exact: true }).click(); await own.page.waitForURL(/\/app\/portfolios\/pf_/)
      const rootId = own.page.url().split('/').pop().split('?')[0]
      await own.page.goto(`${w.origin}/app/portfolios`)
      const start = own.page.getByRole('form', { name: 'Start a portfolio' })
      await start.getByLabel('Portfolio name').fill(`Retail launches ${size}`); await start.getByLabel('Inside portfolio').selectOption(rootId)
      await own.page.getByRole('button', { name: 'Create portfolio' }).click()
      await own.page.getByRole('link', { name: `Retail launches ${size}`, exact: true }).click(); await own.page.waitForURL(/\/app\/portfolios\/pf_/)
      const childId = own.page.url().split('/').pop().split('?')[0]
      await proof(own.page, 'empty')
      const projects = []
      for (let i = 1; i <= 19; i++) projects.push(ok(await owner.post('/api/v1/projects', { name: `Campaign ${size}-${i}`, visibility: 'workspace' })))
      const secret = ok(await owner.post('/api/v1/projects', { name: `Confidential acquisition ${size}`, visibility: 'private' }))
      for (const [index, p] of [...projects, secret].entries()) ok(await owner.post(`/api/v1/portfolios/${index < 10 ? rootId : childId}/projects`, { projectId: p.id }))
      ok(await owner.post(`/api/v1/portfolios/${rootId}/members`, { operatorId: stakeholder.id, level: 'viewer' }))
      const late = ok(await owner.post('/api/v1/tasks', { title: `Venue permit ${size}`, projectId: projects[0].id, dueDate: '2026-03-10' }))
      for (const p of projects.slice(0, 3)) ok(await owner.post('/api/v1/tasks', { title: `Creative review ${p.name}`, projectId: p.id, dueDate: '2026-03-30', ownerId: stakeholder.id }))
      ok(await owner.post('/api/v1/tasks', { title: `Negotiate terms ${size}`, projectId: secret.id, dueDate: '2026-04-30' }))
      ok(await owner.post('/api/v1/tasks', { title: `Venue contract ${size}`, projectId: projects[1].id, kind: 'milestone', dueDate: '2026-03-02' }))

      // The owner reads the rollup at a controlled clock: flags with reasons, sources and the policy version.
      const url = `${w.origin}/app/portfolios/${rootId}?at=${clock}`
      await own.page.goto(url)
      await expect(own.page.getByRole('heading', { name: `Spring programs ${size}`, exact: true })).toBeVisible()
      await expect(own.page.getByText('Risk policy · version 1')).toBeVisible()
      await expect(own.page.getByText('Computed from the work')).toBeVisible(); await expect(own.page.getByText('Manual health (published by a person)')).toBeVisible()
      await expect(own.page.getByText('1 incomplete milestone is past due')).toBeVisible()
      await expect(own.page.getByText(/1 of 2 incomplete due-dated tasks are overdue/)).toBeVisible()
      await expect(own.page.getByRole('link', { name: `Venue permit ${size}` })).toBeVisible()
      await own.page.getByRole('link', { name: 'Overdue', exact: true }).click()
      await expect(own.page.getByText('Source rows: overdue')).toBeVisible(); await expect(own.page.locator('main').getByRole('link', { name: `Venue permit ${size}` }).first()).toBeVisible()
      await proof(own.page, 'summary')
      // The nested portfolio and its figures.
      await expect(own.page.getByRole('link', { name: `Retail launches ${size}` }).first()).toBeVisible()
      // Complete the late task through Tasks and the rollup moves.
      ok(await owner.patch(`/api/v1/tasks/${late.id}`, { status: 'done' }))
      await own.page.goto(url); await expect(own.page.getByText(/1 of 2 incomplete due-dated tasks are overdue/)).toHaveCount(0)
      // Change the policy through the screen: a new version, recalculated.
      const policy = own.page.getByRole('form', { name: 'Change risk policy' })
      await policy.getByLabel('Overdue share percent').fill('50'); await policy.getByRole('button', { name: 'Save policy version' }).click()
      await own.page.goto(url); await expect(own.page.getByText('Risk policy · version 2')).toBeVisible(); await expect(own.page.getByText('At risk at 50% of incomplete due-dated tasks overdue')).toBeVisible()
      // Publish a project status through its settings; the portfolio shows it beside the computed reason.
      await own.page.goto(`${w.origin}/app/projects/${projects[1].id}/settings`)
      const status = own.page.getByRole('form', { name: 'Publish project status' })
      await status.getByLabel('Health').selectOption('on_track'); await status.getByLabel('Status summary').fill('Contract is with the venue.'); await status.getByRole('button', { name: 'Publish status' }).click()
      await own.page.goto(`${w.origin}/app/portfolios/${rootId}?at=${new Date(Date.now() + 60000).toISOString().slice(0, 16)}`)
      await expect(own.page.getByText('manual: On track').first()).toBeVisible(); await expect(own.page.getByText('1 incomplete milestone is past due')).toBeVisible()
      await proof(own.page, 'health')
      for (const tab of ['Timeline', 'Workload', 'Dashboard']) {
        await own.page.getByRole('navigation', { name: 'Portfolio tabs' }).getByRole('link', { name: tab, exact: true }).click()
        await expect(own.page.getByRole('navigation', { name: 'Portfolio tabs' }).getByRole('link', { name: tab, exact: true })).toHaveAttribute('aria-current', 'page')
        await proof(own.page, tab.toLowerCase())
      }
      await expect(own.page.getByText('Overdue by project')).toBeVisible()

      // A limited stakeholder reads only what they may read: no private name or task in any tab.
      for (const tab of ['summary', 'timeline', 'workload', 'dashboard']) {
        await sam.page.goto(`${w.origin}/app/portfolios/${rootId}?tab=${tab}`)
        await expect(sam.page.getByRole('heading', { name: `Spring programs ${size}`, exact: true })).toBeVisible()
        const html = await sam.page.content(); assert.ok(!html.includes('Confidential') && !html.includes('Negotiate terms') && !html.includes(secret.id), `no hidden leak in ${tab}`)
      }
      await expect(sam.page.getByText('19 projects you can read')).toBeVisible()
      await expect(sam.page.getByRole('heading', { name: 'Manage this portfolio' })).toHaveCount(0)
      await proof(sam.page, 'stakeholder')
      // Someone outside the portfolio gets the same refusal as for a portfolio that never existed.
      const refused = await out.page.goto(`${w.origin}/app/portfolios/${rootId}`); assert.equal(refused.status(), 404)
      await proof(out.page, 'refused')
      const requestForm = out.page.getByRole('form', { name: 'Request access', exact: true })
      assert.deepEqual(await requestForm.getByLabel('Level you are asking for').locator('option').evaluateAll(options => options.map(option => option.value)), ['viewer'])
      await requestForm.getByLabel('Message (optional)').fill('Review portfolio membership only')
      await requestForm.getByRole('button', { name: 'Request access', exact: true }).click()
      await expect(out.page.getByText('Request sent', { exact: true })).toBeVisible(); await proof(out.page, 'request-sent')
      ok(await outsider.post('/api/v1/access-requests', { targetId: rootId, level: 'viewer' }))
      const requests = ok(await owner.get('/api/v1/access-requests')).toDecide.filter(row => row.targetId === rootId)
      assert.equal(requests.length, 1)
      await own.page.goto(`${w.origin}/app/inbox`)
      const decision = own.page.locator('article').filter({ has: own.page.getByText(`Spring programs ${size}`, { exact: true }) })
      await expect(decision).toContainText('Nina Outsider'); await expect(decision).toContainText('Portfolio membership only; no project access')
      assert.deepEqual(await decision.getByLabel('Grant', { exact: true }).locator('option').evaluateAll(options => options.map(option => option.value)), ['viewer'])
      await proof(own.page, 'request-decision')
      await decision.getByRole('button', { name: 'Approve', exact: true }).click()
      await out.page.goto(`${w.origin}/app/portfolios/${rootId}`)
      await expect(out.page.getByRole('heading', { name: `Spring programs ${size}`, exact: true })).toBeVisible()
      await expect(out.page.getByText('19 projects you can read')).toBeVisible()
      assert.ok(!(await out.page.content()).includes(secret.id)); assert.equal((await outsider.get(`/api/v1/projects/${secret.id}`)).status, 404)
      await expect(out.page.getByRole('heading', { name: 'Manage this portfolio', exact: true })).toHaveCount(0)
      await proof(out.page, 'request-approved')
      await own.page.goto(`${w.origin}/app/access-review`)
      const membership = own.page.getByRole('list', { name: 'Portfolio memberships', exact: true }).locator('li').filter({ hasText: 'Nina Outsider' })
      await expect(membership).toContainText(`Spring programs ${size}`); await expect(membership).toContainText('Viewer'); await expect(membership).toContainText('Approved request')
      const audit = own.page.getByRole('list', { name: 'Audit', exact: true })
      await expect(audit).toContainText('approved Viewer (asked Viewer)'); await proof(own.page, 'request-review')
      await membership.getByRole('button', { name: 'Revoke', exact: true }).click()
      const revoked = await out.page.goto(`${w.origin}/app/portfolios/${rootId}`); assert.equal(revoked.status(), 404)
      assert.equal((await owner.post(`/api/v1/access-requests/${requests[0].id}/decision`, { decision: 'approve', revision: requests[0].revision })).status, 409)
      await proof(out.page, 'request-revoked')
      console.log(`Portfolio journey at ${size}px passed`)
    } finally { await own.context.close(); await sam.context.close(); await out.context.close() }
  }
}
