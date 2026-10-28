// Native discovery and internal requests through the browser and the authenticated API.
import assert from 'node:assert/strict'
import { expect } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'

export async function accessDiscoveryJourney({ w, browser, ok }) {
  const owner = w.owner
  const address = n => `synthetic-pegboard-${n}` + String.fromCharCode(64) + 'example.com'
  const member = await w.person(address(8331), 'Discovery member')
  const guest = await w.person(address(8332), 'Discovery guest', 'guest')
  const teams = {}
  for (const privacy of ['public', 'request', 'private']) teams[privacy] = ok(await owner.post('/api/v1/teams', { name: `Discovery ${privacy} crew`, description: `${privacy} planning group`, privacy, defaultLevel: 'viewer' }))
  const teamProject = ok(await owner.post('/api/v1/projects', { name: 'Joined crew project', visibility: 'team', teamId: teams.public.id, teamLevel: 'commenter' }))
  const hidden = ok(await owner.post('/api/v1/projects', { name: 'Discovery confidential project' }))
  const task = ok(await owner.post('/api/v1/tasks', { title: 'Joined crew task', projectId: teamProject.id }))
  const open = async person => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await context.addCookies(person.cookie.split('; ').map(pair => ({ name: pair.slice(0, pair.indexOf('=')), value: pair.slice(pair.indexOf('=') + 1), url: w.origin })))
    return { context, page: await context.newPage() }
  }
  // Assertions run at 1440; the same changed screens are captured once at both release widths.
  const proof = async (page, name) => {
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `discovery reflow: ${name}`)
    const icons = await page.locator('main button,main a').evaluateAll(els => els.filter(el => !el.textContent.trim() && el.querySelector('svg,img')).map(el => el.outerHTML))
    assert.deepEqual(icons, [], 'discovery controls have visible labels')
    if (process.env.PEGBOARD_PROOF_DIR) {
      await mkdir(process.env.PEGBOARD_PROOF_DIR, { recursive: true })
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: width === 390 ? 844 : 900 })
        await page.screenshot({ path: join(process.env.PEGBOARD_PROOF_DIR, `access-discovery-${name}-${width}.png`), fullPage: true })
      }
      await page.setViewportSize({ width: 1440, height: 900 })
    }
  }
  const m = await open(member), g = await open(guest), a = await open(owner)
  try {
    assert.deepEqual(ok(await member.get('/api/v1/teams')).teams.map(row => row.id).sort(), [teams.public.id, teams.request.id].sort())
    assert.deepEqual(ok(await guest.get('/api/v1/teams')).teams, [])
    await m.page.goto(`${w.origin}/app/teams`)
    await expect(m.page.getByRole('link', { name: teams.public.name, exact: true })).toBeVisible()
    await expect(m.page.getByRole('link', { name: teams.request.name, exact: true })).toBeVisible()
    assert.ok(!(await m.page.content()).includes(teams.private.name))
    await m.page.getByLabel('Search teams', { exact: true }).focus()
    assert.ok(await m.page.getByLabel('Search teams', { exact: true }).evaluate(el => el === document.activeElement))
    await proof(m.page, 'member-browse')
    for (const privacy of ['public', 'request', 'private']) {
      const found = ok(await member.get('/api/v1/teams?q=' + encodeURIComponent(teams[privacy].name)))
      assert.deepEqual(found.teams.map(row => row.id), privacy === 'private' ? [] : [teams[privacy].id])
      assert.equal(found.count, privacy === 'private' ? 0 : 1)
      await m.page.goto(`${w.origin}/app/teams?q=${encodeURIComponent(teams[privacy].name)}`)
      await expect(m.page.getByRole('link', { name: teams[privacy].name, exact: true })).toHaveCount(privacy === 'private' ? 0 : 1)
      if (privacy === 'private') await expect(m.page.getByText('No teams match.', { exact: true })).toBeVisible()
      await proof(m.page, `member-search-${privacy}`)
      assert.deepEqual(ok(await guest.get('/api/v1/teams?q=' + encodeURIComponent(teams[privacy].name))).teams, [])
      await g.page.goto(`${w.origin}/app/teams?q=${encodeURIComponent(teams[privacy].name)}`)
      await expect(g.page.getByText('No teams match.', { exact: true })).toBeVisible()
      await expect(g.page.getByRole('button', { name: /Join|Request/ })).toHaveCount(0)
      await expect(g.page.getByRole('link', { name: 'Request to join', exact: true })).toHaveCount(0)
      await proof(g.page, `guest-search-${privacy}`)
      const refused = await g.page.goto(`${w.origin}/app/teams/${teams[privacy].id}`)
      assert.equal(refused.status(), 404)
      await expect(g.page.getByRole('form', { name: 'Request access', exact: true })).toHaveCount(0)
      assert.ok(!(await g.page.content()).includes(teams[privacy].name))
      assert.equal((await guest.post('/api/v1/access-requests', { targetId: teams[privacy].id })).status, 403)
      assert.equal((await guest.post(`/api/v1/teams/${teams[privacy].id}/join`, {})).status, 404)
    }
    await g.page.goto(`${w.origin}/app/teams`)
    await expect(g.page.getByText('No teams match.', { exact: true })).toBeVisible()
    await proof(g.page, 'guest-browse')
    await m.page.goto(`${w.origin}/app/teams`)
    await m.page.getByRole('button', { name: 'Join as Viewer', exact: true }).click()
    await expect(m.page.getByRole('heading', { name: teams.public.name, exact: true })).toBeVisible()
    assert.equal(ok(await member.get(`/api/v1/teams/${teams.public.id}`)).level, 'viewer')
    const joined = ok(await member.get(`/api/v1/projects/${teamProject.id}`))
    assert.equal(joined.level, 'commenter'); assert.ok(!joined.capabilities.includes('manage_settings'))
    assert.equal((await member.patch(`/api/v1/tasks/${task.id}`, { title: 'Unauthorized edit' })).status, 403)
    assert.equal((await member.get(`/api/v1/projects/${hidden.id}`)).status, 404)
    await m.page.goto(`${w.origin}/app/projects/${teamProject.id}`)
    await expect(m.page.getByRole('heading', { name: teamProject.name, exact: true })).toBeVisible()
    await proof(m.page, 'joined-project')
    const texts = []
    for (const id of [teams.private.id, 'team_synthetic-pegboard-8333']) {
      const response = await m.page.goto(`${w.origin}/app/teams/${id}`); assert.equal(response.status(), 404)
      texts.push(await m.page.locator('main').innerText())
      assert.ok(!(await m.page.content()).includes(teams.private.name))
    }
    assert.equal(texts[0], texts[1])
    await proof(m.page, 'blind-refusal')
    await m.page.goto(`${w.origin}/app/teams/${teams.request.id}`)
    const form = m.page.locator('form[action="/api/v1/access-requests"]')
    await form.getByLabel('Message (optional)', { exact: true }).fill('Help with this planning crew')
    await form.getByRole('button', { name: 'Request to join', exact: true }).click()
    await expect(m.page.getByText('Request sent', { exact: true })).toBeVisible()
    await proof(m.page, 'team-request-sent')
    await a.page.goto(`${w.origin}/app/inbox`)
    const card = a.page.locator('article').filter({ has: a.page.getByText(teams.request.name, { exact: true }) })
    await expect(card).toContainText('Help with this planning crew')
    await card.getByRole('form', { name: 'Approve', exact: true }).getByLabel('Grant', { exact: true }).selectOption('editor')
    await proof(a.page, 'team-decision')
    await card.getByRole('button', { name: 'Approve', exact: true }).click()
    await m.page.goto(`${w.origin}/app/teams/${teams.request.id}`)
    await expect(m.page.getByRole('heading', { name: teams.request.name, exact: true })).toBeVisible()
    assert.equal(ok(await member.get(`/api/v1/teams/${teams.request.id}`)).level, 'editor')
    assert.equal((await member.get(`/api/v1/projects/${hidden.id}`)).status, 404)
    await proof(m.page, 'team-request-approved')
    console.log('Access discovery member and guest browser journey at 1440 passed; release screens captured when requested')
  } finally { await m.context.close(); await g.context.close(); await a.context.close() }
}
