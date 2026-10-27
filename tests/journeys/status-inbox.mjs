import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { expect } from '@playwright/test'

export async function statusInboxJourney({ w, browser, sizes, ok }) {
  const owner = w.owner
  const member = await w.person('synthetic-pegboard-1510@example.com', 'Status Member')
  const guest = await w.person('synthetic-pegboard-1511@example.com', 'Status Guest', 'guest')
  const project = ok(await owner.post('/api/v1/projects', { name: 'Reviewed status program', visibility: 'private' }))
  const memberGrant = ok(await owner.post('/api/v1/grants', { objectType: 'project', objectId: project.id, granteeId: member.id, level: 'commenter' }))
  const guestGrant = ok(await owner.post('/api/v1/grants', { objectType: 'project', objectId: project.id, granteeId: guest.id, level: 'commenter' }))
  const source = ok(await owner.post('/api/v1/tasks', { projectId: project.id, title: 'Reviewed launch milestone' }))
  const input = { subjectType: 'project', subjectId: project.id, health: 'on_track', summary: 'Launch content approved', highlights: 'Creative reviewed', risks: '', decisions: 'Proceed after human review', nextSteps: 'Confirm the date', from: '2026-10-01', to: '2026-10-26', sourceIds: [source.id], recipients: [{ id: member.id, channels: ['in_app'] }, { id: guest.id, channels: ['in_app'] }] }
  const draft = ok(await owner.post('/api/v1/status-drafts', input))
  const review = ok(await owner.post(`/api/v1/status-drafts/${draft.id}/review`, {}))
  const revision = ok(await owner.post(`/api/v1/status-drafts/${draft.id}/publish`, { token: review.token }))
  const hidden = ok(await owner.post(`/api/v1/status-revisions/${revision.id}/comments`, { body: 'Internal supplier negotiation', internalOnly: true }))
  const open = async client => {
    const context = await browser.newContext({ viewport: sizes[0][1] })
    await context.addCookies(client.cookie.split('; ').map(pair => ({ name: pair.slice(0, pair.indexOf('=')), value: pair.slice(pair.indexOf('=') + 1), url: client.origin })))
    return { context, page: await context.newPage() }
  }
  const m = await open(member), g = await open(guest)
  const proof = async (page, name, size) => {
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} reflows at ${size}`)
    const icons = await page.locator('main button,main a').evaluateAll(els => els.filter(e => !e.textContent.trim() && e.querySelector('svg,img')).map(e => e.outerHTML))
    assert.deepEqual(icons, [], 'status Inbox controls have visible text labels')
    if (process.env.PEGBOARD_PROOF_DIR) {
      await mkdir(process.env.PEGBOARD_PROOF_DIR, { recursive: true })
      await page.screenshot({ path: join(process.env.PEGBOARD_PROOF_DIR, `status-inbox-${name}-${size}.png`), fullPage: true })
    }
  }
  try {
    await g.page.goto(`${w.origin}/app/inbox`)
    const card = g.page.locator(`#status-${revision.id}`)
    await expect(card.getByRole('heading', { name: input.summary })).toBeVisible()
    await card.locator('summary').click()
    await expect(card).not.toContainText('Internal supplier negotiation')
    await expect(card.getByLabel('Reply to', { exact: true })).not.toContainText('Internal supplier negotiation')
    await card.getByLabel('Your reply').fill('Client confirms the launch date')
    await card.getByRole('button', { name: 'Post reply' }).click()
    await g.page.locator(`#status-${revision.id} summary`).click()
    await expect(g.page.locator(`#status-${revision.id}`)).toContainText('Client confirms the launch date')
    await m.page.goto(`${w.origin}/app/inbox`)
    const memberCard = m.page.locator(`#status-${revision.id}`)
    await memberCard.locator('summary').click()
    await expect(memberCard).toContainText('Internal supplier negotiation')
    await expect(memberCard).toContainText('Client confirms the launch date')
    await memberCard.getByLabel('Reply to', { exact: true }).selectOption(hidden.id)
    await memberCard.getByLabel('Your reply').fill('Internal nested supplier detail')
    await memberCard.getByRole('button', { name: 'Post reply' }).click()
    await m.page.locator(`#status-${revision.id} summary`).click()
    await expect(m.page.locator(`#status-${revision.id}`)).toContainText('Internal nested supplier detail')
    await g.page.reload(); await g.page.locator(`#status-${revision.id} summary`).click()
    await expect(g.page.locator('main')).not.toContainText('Internal nested supplier detail')
    for (const [size, viewport] of sizes) {
      await m.page.setViewportSize(viewport); await g.page.setViewportSize(viewport)
      await proof(m.page, 'member', size); await proof(g.page, 'guest', size)
    }
    await g.page.setViewportSize(sizes[0][1])
    const preferences = g.page.getByRole('form', { name: `Discussion preferences ${revision.id}` })
    await preferences.getByLabel('Mute discussion').check()
    await preferences.getByRole('button', { name: 'Save discussion preferences' }).click()
    ok(await owner.post(`/api/v1/status-revisions/${revision.id}/comments`, { body: 'Muted public reply', mentions: [guest.id] }))
    await g.page.reload()
    await expect(g.page.getByRole('heading', { name: 'Status discussion notices' })).toHaveCount(0)
    const decisions = ok(await owner.get(`/api/v1/status-history/project/${project.id}`))
    assert.deepEqual(decisions.revisions.map(item => item.id), [revision.id], 'discussion never republishes the update')
    ok(await owner.post(`/api/v1/grants/${guestGrant.id}/revoke`, {}))
    for (const [size, viewport] of sizes) {
      await g.page.setViewportSize(viewport); await g.page.reload()
      if (size === '1440') await expect(g.page.locator('main')).not.toContainText(input.summary)
      await proof(g.page, 'revoked', size)
    }
    assert.deepEqual(ok(await guest.get('/api/v1/status-digest')), { updates: [], notices: [] })
    ok(await owner.post(`/api/v1/grants/${memberGrant.id}/revoke`, {}))
  } finally { await m.context.close(); await g.context.close() }
}
