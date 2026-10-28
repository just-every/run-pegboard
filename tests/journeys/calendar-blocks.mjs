import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { expect } from '@playwright/test'
const token = 'synthetic-pegboard-251', calendarId = 'synthetic-pegboard-250'
export async function calendarBlocksJourney({ w, browser, services, ok }) {
 const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
 await context.addCookies(w.owner.cookie.split('; ').map(pair => ({ name: pair.slice(0, pair.indexOf('=')), value: pair.slice(pair.indexOf('=') + 1), url: w.origin })))
 const page = await context.newPage(), root = w.owner
 const proof = async name => {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'calendar page fits')
  const small = await page.locator('main').evaluate(el => [...el.querySelectorAll('button,a,input,select,p,label,h2,h3')].filter(e => e.getBoundingClientRect().width && parseFloat(getComputedStyle(e).fontSize) < 13).map(e => e.textContent.slice(0, 50)))
  assert.deepEqual(small, [], 'calendar text remains readable')
  assert.deepEqual(await page.locator('main button,main a').evaluateAll(elements => elements.filter(e => !e.textContent.trim() && e.querySelector('svg,img')).map(e => e.outerHTML)), [], 'calendar actions have visible labels')
  if (!process.env.PEGBOARD_PROOF_DIR) return
  await mkdir(process.env.PEGBOARD_PROOF_DIR, { recursive: true })
  for (const width of [1440, 390]) { await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 }); await page.screenshot({ path: join(process.env.PEGBOARD_PROOF_DIR, `calendar-${name}-${width}.png`), fullPage: true }) }
  await page.setViewportSize({ width: 1440, height: 900 })
 }
 try {
  for (const service of ['google', 'microsoft']) {
   await page.goto(w.origin + '/app/settings/calendars')
   let form = page.getByRole('form', { name: 'Connect calendar', exact: true })
   await form.getByLabel('Provider').selectOption(service); await form.getByLabel('Calendar ID').fill(calendarId); await form.getByLabel('One-use credential').fill(token)
   await form.getByRole('checkbox').check(); await form.getByRole('button', { name: 'Connect calendar', exact: true }).click()
   await expect(page.getByRole('heading', { name: 'My connections', exact: true })).toBeVisible()
   await proof(service + '-settings')
   const connections = ok(await root.get('/api/v1/workspaces/ws_main/calendars')).connections, connection = connections.find(c => c.service === service)
   const project = ok(await root.post('/api/v1/projects', { name: service + ' scheduling' })), task = ok(await root.post('/api/v1/tasks', { projectId: project.id, title: service + ' design work', dueDate: '2026-03-20', ownerId: root.id }))
   const here = w.origin + '/app/projects/' + project.id + '/calendar'
   await page.goto(here)
   const find = async date => { const f = page.getByRole('form', { name: 'Find free time', exact: true }); await f.getByLabel('Task', { exact: true }).selectOption(task.id); await f.getByLabel('Calendar', { exact: true }).selectOption(connection.id); await f.getByLabel('Work date').fill(date); await f.getByLabel('Reserved minutes').fill('60'); await f.getByLabel('One-use credential').fill(token); await f.getByRole('button', { name: 'Find free time', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Review free time', exact: true })).toBeVisible() }
   const reserve = async () => { const f = page.getByRole('form', { name: 'Reserve reviewed time', exact: true }); await f.getByLabel('One-use credential').fill(token); await f.getByRole('button', { name: 'Reserve reviewed time', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Calendar work blocks', exact: true })).toBeVisible() }
   await find('2026-03-06'); await expect(page.getByLabel('Free interval').locator('option').first()).toContainText('10:00 AM'); await proof(service + '-review')
   await reserve()
   let block = ok(await root.get(`/api/v1/projects/${project.id}/calendar-blocks`))[0]
   assert.equal(block.start_at, '2026-03-06T15:00:00.000Z'); assert.equal(services.state[service].events.size, 1)
   await find('2026-03-09'); await expect(page.getByLabel('Free interval').locator('option').first()).toContainText('9:00 AM'); await reserve()
   block = ok(await root.get(`/api/v1/projects/${project.id}/calendar-blocks`))[0]; assert.equal(block.start_at, '2026-03-09T13:00:00.000Z')
   await expect(page.getByText('Mar 9, 2026, 9:00 AM America/New_York', { exact: false })).toBeVisible(); await proof(service + '-scheduled')
   services.move(service, block.event_id, '2026-03-10T14:00:00.000Z', '2026-03-10T15:00:00.000Z')
   form = page.getByRole('form', { name: 'Read back ' + service + ' design work', exact: true }); await form.getByLabel('One-use credential').fill(token); await form.getByRole('button', { name: 'Read back event', exact: true }).click()
   assert.equal(ok(await root.get(`/api/v1/projects/${project.id}/calendar-blocks`))[0].start_at, '2026-03-10T14:00:00.000Z')
   ok(await root.patch(`/api/v1/tasks/${task.id}`, { description: 'A simultaneous task edit' }))
   form = page.getByRole('form', { name: 'Read back ' + service + ' design work', exact: true }); await form.getByLabel('One-use credential').fill(token)
   const response = page.waitForResponse(r => r.url().includes(`/calendar-blocks/${block.id}/sync`) && r.request().method() === 'POST'); await form.getByRole('button', { name: 'Read back event', exact: true }).click(); assert.equal((await response).status(), 409)
   await page.goto(here); await expect(page.getByText('Conflict — review required', { exact: false })).toBeVisible(); await proof(service + '-conflict')
   await find('2026-03-11'); await reserve()
   assert.equal(ok(await root.get(`/api/v1/tasks/${task.id}`)).dueDate, '2026-03-20'); assert.equal(services.state[service].events.size, 1)
   form = page.getByRole('form', { name: 'Delete block for ' + service + ' design work', exact: true }); await form.getByLabel('One-use credential').fill(token); await form.getByRole('button', { name: 'Delete work block', exact: true }).click()
   await expect(page.getByText('cancelled', { exact: false })).toBeVisible(); assert.equal(services.state[service].events.size, 0); await proof(service + '-cancelled')
   await page.goto(w.origin + '/app/settings/calendars'); await page.getByRole('form', { name: 'Disconnect ' + service, exact: true }).getByRole('button', { name: 'Disconnect', exact: true }).click()
   assert.equal(ok(await root.get('/api/v1/workspaces/ws_main/calendars')).connections.find(c => c.id === connection.id).active, 0)
   console.log('Calendar schema-fake native flow passed: ' + service)
  }
 } finally { await context.close() }
}
