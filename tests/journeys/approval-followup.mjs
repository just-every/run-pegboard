import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { expect } from '@playwright/test'
import { pass, person, routeTask, queue, cron, inbox, log } from '../scenarios/approval-followup.mjs'

export async function approvalFollowupJourney({ w, browser }) {
  const owner = w.owner, author = await person(w, 3720, 'Launch author'), reviewer = await person(w, 3721, 'Launch reviewer'), delegate = await person(w, 3722, 'Current reviewer')
  const project = await pass(owner.post('/api/v1/projects', { name: 'Approval follow-up campaign' }))
  const { task, route } = await routeTask(owner, project, author, [reviewer], 'Review the launch packet')
  await pass(owner.post('/api/v1/grants', { objectType: 'task', objectId: task.id, granteeId: delegate.id, level: 'viewer', scope: 'approve' }))
  const open = async client => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await context.addCookies(client.cookie.split('; ').map(pair => ({ name: pair.slice(0, pair.indexOf('=')), value: pair.slice(pair.indexOf('=') + 1), url: w.origin })))
    return { context, page: await context.newPage() }
  }
  const manager = await open(owner), recipient = await open(delegate)
  const capture = async (name, page) => {
    if (!process.env.PEGBOARD_PROOF_DIR) return
    await mkdir(process.env.PEGBOARD_PROOF_DIR, { recursive: true })
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      await page.setViewportSize({ width, height })
      await page.screenshot({ path: join(process.env.PEGBOARD_PROOF_DIR, `approval-followup-${name}-${width}.png`), fullPage: true })
    }
    await page.setViewportSize({ width: 1440, height: 900 })
  }
  const flat = async page => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'approval controls stay inside the viewport')
  try {
    const page = manager.page
    await page.goto(w.origin + '/app/settings')
    await page.getByRole('link', { name: 'Approval notices', exact: true }).click()
    const form = page.getByRole('form', { name: 'Review follow-up policy' })
    await form.getByLabel('Follow-up', { exact: true }).selectOption('true')
    await form.getByLabel('Reviewed projects').selectOption(project.id)
    await form.getByLabel('Authorized named recipients').selectOption([reviewer.id, delegate.id])
    await form.getByLabel('Final escalation recipients').selectOption(delegate.id)
    await form.getByLabel('Working timezone').fill('UTC')
    await form.getByLabel('Working days').selectOption(['1', '2', '3', '4', '5'])
    await form.getByLabel('Working day starts').fill('09:00')
    await form.getByLabel('Working day ends').fill('17:00')
    await form.getByLabel('Minutes between rounds').fill('1')
    await form.getByLabel('Maximum rounds (1 to 5)').fill('2')
    await form.getByLabel('Working day starts').focus(); await page.keyboard.press('Tab')
    await expect(form.getByLabel('Working day ends')).toBeFocused()
    await form.getByRole('button', { name: 'Preview follow-up policy' }).click()
    await expect(page.getByRole('heading', { name: 'Confirm exact follow-up policy' })).toBeVisible()
    await expect(page.locator('main')).toContainText('Final escalation: Current reviewer')
    await capture('reviewed-policy', page); await flat(page)
    const approval = page.getByRole('form', { name: 'Approve follow-up policy' })
    await approval.getByRole('checkbox').check()
    await approval.getByRole('button', { name: 'Approve reviewed policy' }).focus(); await page.keyboard.press('Enter')
    await expect(page.getByText('Owner-approved policy active.', { exact: false })).toBeVisible()
    await queue(owner)
    await recipient.page.goto(w.origin + '/app/inbox')
    await expect(recipient.page.locator('[data-notice-id]')).toHaveCount(0)
    // Delegate through the existing native approval screen while the reminder is still queued.
    await page.goto(w.origin + '/app/approvals/' + route.id)
    const delegation = page.getByRole('form', { name: 'Delegate reviewer' })
    await delegation.getByLabel('Current reviewer').selectOption(reviewer.id)
    await delegation.getByLabel('Delegate', { exact: true }).selectOption(delegate.id)
    await delegation.getByRole('button', { name: 'Delegate review', exact: true }).click()
    await recipient.page.goto(w.origin + '/app/settings/approval-followup')
    const preferences = recipient.page.getByRole('form', { name: 'Approval notice preferences' })
    await preferences.getByLabel('Do not disturb until (UTC)').fill('2030-01-07T10:00')
    await preferences.getByRole('button', { name: 'Save approval preferences' }).click()
    await cron(w, '2030-01-07T09:00:00Z')
    const held = (await log(owner)).find(row => row.route_id === route.id)
    const event = held.events[0]
    await recipient.page.goto(w.origin + '/app/inbox')
    await expect(recipient.page.getByRole('heading', { name: 'Approval notices deferred' })).toBeVisible()
    await expect(recipient.page.locator('[data-notice-id]')).toHaveCount(0)
    await capture('deferred-inbox', recipient.page); await flat(recipient.page)
    await recipient.page.getByRole('link', { name: 'Approval notice settings' }).click()
    await recipient.page.getByLabel('Do not disturb until (UTC)').fill('')
    await recipient.page.getByRole('button', { name: 'Save approval preferences' }).click()
    await cron(w, '2030-01-07T10:00:00Z')
    await recipient.page.goto(w.origin + '/app/inbox')
    const notice = recipient.page.locator(`[data-notice-id][data-event-id="${event.id}"][data-recipient-id="${delegate.id}"][data-route-id="${route.id}"]`)
    await expect(notice).toHaveCount(1); await expect(notice).toContainText('Review the launch packet')
    assert.equal((await inbox(reviewer)).notices.length, 0)
    await notice.getByRole('link', { name: 'Review approval', exact: true }).focus()
    await expect(notice.getByRole('link', { name: 'Review approval', exact: true })).toBeFocused()
    await capture('visible-inbox', recipient.page); await flat(recipient.page)
    await recipient.page.keyboard.press('Enter')
    await recipient.page.waitForURL(w.origin + '/app/approvals/' + route.id)
    const decision = recipient.page.getByRole('form', { name: 'Decide routed approval' })
    await decision.getByLabel('Decision', { exact: true }).selectOption('changes')
    await decision.getByLabel('Decision reason').fill('Please revise the reviewed launch packet')
    await decision.getByRole('button', { name: 'Record reviewed decision' }).focus(); await recipient.page.keyboard.press('Enter')
    await expect(recipient.page.getByRole('status')).toHaveText('changes requested')
    await capture('human-decision', recipient.page); await flat(recipient.page)
    await cron(w, '2030-01-08T10:00:00Z')
    await recipient.page.goto(w.origin + '/app/inbox')
    await expect(recipient.page.locator('[data-notice-id]')).toHaveCount(0)
    const stopped = (await log(owner)).find(row => row.route_id === route.id)
    assert.equal(stopped.state, 'responded'); assert.equal(stopped.events.length, 1)
    console.log('PROBE PEG-037 browser: Settings -> exact owner policy; native delegation -> same queued event for current reviewer; DND -> deferred; Inbox -> rendered recipient and event IDs; keyboard decision -> stopped escalation. Screens captured at 1440 and 390.')
  } finally { await manager.context.close(); await recipient.context.close() }
}
