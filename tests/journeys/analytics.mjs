import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { expect } from '@playwright/test'

export async function analystJourney({ w, browser, owner, ok }) {
  const pass = async (request, status = 200) => ok(await request, status)
  const project = await pass(owner.post('/api/v1/projects', { name: 'Reviewed analyst project' }))
  const outside = await pass(owner.post('/api/v1/projects', { name: 'Unselected project' }))
  const tasks = []
  for (const title of ['First analyst task', 'Second analyst task']) tasks.push(await pass(owner.post('/api/v1/tasks', { projectId: project.id, title, internalNotes: 'Private analyst note' })))
  await pass(owner.post('/api/v1/tasks', { projectId: outside.id, title: 'Outside analyst work' }))
  const member = await w.person(['synthetic-pegboard-4401', 'example.com'].join('@'), 'Analyst member')
  let admin = await w.person(['synthetic-pegboard-4402', 'example.com'].join('@'), 'Other administrator')
  await pass(owner.post(`/api/v1/workspaces/ws_main/people/${admin.id}/account`, { role: 'admin' }))
  admin = await w.signIn(admin.email, admin.name, admin.id)
  const open = async client => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await context.addCookies(client.cookie.split('; ').map(pair => ({ name: pair.slice(0, pair.indexOf('=')), value: pair.slice(pair.indexOf('=') + 1), url: w.origin })))
    return { context, page: await context.newPage() }
  }
  const { context, page } = await open(owner)
  const proof = async name => {
    // Assertions run at one width. The same live state supplies the release screenshots at both widths.
    if (!process.env.PEGBOARD_PROOF_DIR) return
    await mkdir(process.env.PEGBOARD_PROOF_DIR, { recursive: true })
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      await page.setViewportSize({ width, height })
      await page.screenshot({ path: join(process.env.PEGBOARD_PROOF_DIR, `analytics-${name}-${width}.png`), fullPage: true, mask: [page.locator('[data-analytics-secret]')] })
    }
    await page.setViewportSize({ width: 1440, height: 900 })
  }
  const read = async (path, secret) => {
    const response = await fetch(new URL(path, w.origin), { headers: { authorization: 'Bearer ' + secret, prefer: 'odata.maxpagesize=1' } })
    return { status: response.status, body: await response.json() }
  }
  try {
    await page.goto(`${w.origin}/app/admin`)
    await page.getByRole('link', { name: 'Work settings', exact: true }).click()
    await page.getByRole('link', { name: 'Analyst access', exact: true }).click()
    const form = page.getByRole('form', { name: 'Authorize analyst key' })
    assert.equal(await form.locator('input[type=checkbox]:checked').count(), 0, 'scope and consent start denied')
    await expect(page.getByText('No analyst keys issued by you.')).toBeVisible()
    await proof('settings')
    await form.getByLabel('Credential name').fill('Quarterly analyst review')
    await form.getByLabel('Reviewed analyst project', { exact: true }).check()
    await form.getByLabel('Tasks: Title', { exact: true }).check()
    await form.getByLabel('Credential lifetime').selectOption('30')
    await form.getByRole('button', { name: 'Authorize analyst key' }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    assert.equal((await pass(owner.get('/api/v1/analytics/keys'))).keys.length, 0, 'no key exists without explicit consent')
    await form.getByLabel('I consent to read-only export', { exact: false }).check()
    const issuedResponse = page.waitForResponse(r => r.url().endsWith('/api/v1/analytics/keys') && r.request().method() === 'POST')
    await form.getByRole('button', { name: 'Authorize analyst key' }).click()
    const issued = await (await issuedResponse).json()
    const credential = page.getByRole('region', { name: 'New analyst credential' })
    await expect(credential).toBeVisible()
    await expect(page.locator('[data-analytics-key]')).toHaveText(issued.id)
    await expect(page.locator('[data-analytics-secret]')).toHaveText(issued.secret)
    assert.ok(!page.url().includes(issued.secret))
    const listed = (await pass(owner.get('/api/v1/analytics/keys'))).keys
    assert.equal(listed.length, 1)
    assert.deepEqual(JSON.parse(listed[0].projects), [project.id])
    assert.deepEqual(JSON.parse(listed[0].fields), { Tasks: ['id', 'title'] })
    assert.ok(listed[0].expires_at > Date.now() && listed[0].expires_at <= listed[0].created_at + 30 * 86400000)
    assert.ok(!JSON.stringify(listed).includes(issued.secret) && !JSON.stringify(listed).includes('token_hash'))
    assert.deepEqual(await page.evaluate(() => [localStorage.length, sessionStorage.length]), [0, 0])
    await proof('issued')
    const first = await read(issued.servicePath + '/Tasks', issued.secret)
    assert.equal(first.status, 200)
    assert.deepEqual(Object.keys(first.body.value[0]).sort(), ['id', 'title'])
    const second = await read(first.body['@odata.nextLink'], issued.secret)
    assert.deepEqual([...first.body.value, ...second.body.value].map(t => t.id).sort(), tasks.map(t => t.id).sort())
    assert.equal((await read(issued.servicePath + '/Tasks?$select=internalNotes', issued.secret)).status, 400)
    await page.getByRole('link', { name: 'I saved it; hide credential' }).click()
    await expect(credential).toBeHidden()
    assert.ok(!(await page.content()).includes(issued.secret), 'list cannot redisplay the credential')
    await page.reload()
    assert.ok(!(await page.content()).includes(issued.secret), 'reload cannot redisplay the credential')
    await page.goBack()
    assert.ok(!(await page.content()).includes(issued.secret), 'history cannot redisplay the credential')
    await page.goto(`${w.origin}/app/settings/analytics`)
    const row = page.locator(`[data-analyst-key="${issued.id}"]`)
    await expect(row).toContainText('Quarterly analyst review')
    await expect(row).toContainText('Reviewed analyst project')
    await expect(row).toContainText('Tasks: Stable ID, Title')
    await expect(row).toContainText('Active')
    await proof('listed')
    const audit = await pass(owner.get('/api/v1/admin/audit?action=analytics.key_authorized'))
    assert.ok(audit.events.some(e => e.target_id === issued.id && e.actor_id === owner.id && e.metadata.consent === true))
    assert.ok(!JSON.stringify(audit).includes(issued.secret))
    for (const client of [member, admin]) {
      const other = await open(client)
      try {
        const response = await other.page.goto(`${w.origin}/app/settings/analytics`)
        assert.equal(response.status(), client === member ? 403 : 200)
        assert.ok(!(await other.page.content()).includes(issued.id))
        assert.equal(await other.page.getByRole('form', { name: 'Revoke Quarterly analyst review' }).count(), 0)
      } finally { await other.context.close() }
      await pass(client.post(`/api/v1/analytics/keys/${issued.id}/revoke`, {}), 403)
    }
    assert.equal((await read(first.body['@odata.nextLink'], issued.secret)).status, 200, 'cross-administrator refusals leave the credential active')
    await row.getByRole('button', { name: 'Revoke key' }).click()
    await expect(page.locator(`[data-analyst-key="${issued.id}"]`)).toContainText('Revoked')
    await expect(page.getByRole('form', { name: 'Revoke Quarterly analyst review' })).toHaveCount(0)
    for (const path of [issued.servicePath, issued.servicePath + '/Tasks', issued.servicePath + '/$metadata', first.body['@odata.nextLink'], second.body['@odata.deltaLink']]) assert.equal((await read(path, issued.secret)).status, 401, 'revocation refuses saved new fetches')
    const revoked = await pass(owner.get('/api/v1/admin/audit?action=analytics.key_revoked'))
    assert.ok(revoked.events.some(e => e.target_id === issued.id && e.actor_id === owner.id))
    await proof('revoked')
    const expired = await pass(owner.post('/api/v1/analytics/keys', { name: 'Finite expiry review', projects: [project.id], fields: { Tasks: ['title'] }, expiresAt: Date.now() + 86400000, consent: true }))
    const cached = await read(expired.servicePath + '/Tasks', expired.secret)
    await w.sql(`UPDATE peg_analytics_keys SET expires_at=1 WHERE id='${expired.id}'`)
    assert.equal((await read(cached.body['@odata.nextLink'], expired.secret)).status, 401)
    await page.reload()
    await expect(page.locator(`[data-analyst-key="${expired.id}"]`)).toContainText('Expired')
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    assert.equal(await page.locator('button,a').evaluateAll(nodes => nodes.filter(e => !e.textContent.trim() && e.querySelector('svg,img')).length), 0, 'all controls have visible text')
    console.log('Analyst self-custody, explicit consent, once-shown credentials, finite expiry and saved-fetch revocation passed at 1440px')
  } finally { await context.close() }
}
