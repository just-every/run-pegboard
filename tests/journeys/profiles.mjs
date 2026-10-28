import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { expect } from '@playwright/test'
import { profileFixture, profilePath, profileOk as ok } from '../support/profiles.mjs'

export async function profilesJourney({ w, browser }) {
  const f = await profileFixture(w)
  const sizes = process.env.PEGBOARD_PROOF_DIR ? [1440, 390] : [1440]
  const open = async (client, width) => {
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    await context.addCookies(client.cookie.split('; ').map(pair => ({ name: pair.slice(0, pair.indexOf('=')), value: pair.slice(pair.indexOf('=') + 1), url: w.origin })))
    return { context, page: await context.newPage() }
  }
  for (const width of sizes) {
    const member = await open(f.reader, width), guest = await open(f.guest, width)
    const proof = async (page, name) => {
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} reflows at ${width}`)
      for (const control of await page.locator('main a,main button').all()) assert.ok((await control.innerText()).trim(), 'controls have visible names')
      assert.deepEqual(await page.locator('main').evaluate(main => [...main.querySelectorAll('*')].filter(el => [...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim())).filter(el => Number.parseFloat(getComputedStyle(el).fontSize) < 13).map(el => el.tagName)), [], 'daily text is at least 13px')
      if (process.env.PEGBOARD_PROOF_DIR) {
        await mkdir(process.env.PEGBOARD_PROOF_DIR, { recursive: true })
        await page.screenshot({ path: join(process.env.PEGBOARD_PROOF_DIR, `profiles-${name}-${width}.png`), fullPage: true })
      }
    }
    try {
      await member.page.goto(`${w.origin}/app/projects`)
      const people = member.page.getByRole('navigation').getByRole('link', { name: 'People', exact: true })
      await people.focus(); await member.page.keyboard.press('Enter')
      await expect(member.page.getByRole('heading', { name: 'People', exact: true })).toBeVisible()
      await expect(member.page.getByRole('list', { name: 'Teammates' })).not.toContainText(f.guest.name)
      await proof(member.page, 'directory')
      const teammate = member.page.getByRole('link', { name: f.subject.name, exact: true })
      await teammate.focus(); await member.page.keyboard.press('Enter')
      await expect(member.page.getByRole('heading', { name: f.subject.name, exact: true })).toBeVisible()
      const assignments = member.page.getByRole('list', { name: 'Permitted assignments' })
      assert.deepEqual((await assignments.getByRole('link').evaluateAll(links => links.map(link => link.getAttribute('href').split('/').pop()))).sort(), f.visibleIds)
      const html = await member.page.content()
      for (const secret of [f.hidden.title, f.hidden.id, f.privateTask.title, f.privateTask.id, f.privateChild.title, f.privateChild.id, f.projects[2].id, f.projects[2].name]) assert.ok(!html.includes(secret), `profile excludes ${secret}`)
      await expect(member.page.getByRole('list', { name: 'Working hours' })).toBeVisible()
      const task = assignments.getByRole('link', { name: f.shared.title, exact: true })
      await task.focus(); assert.equal(await task.evaluate(el => el === document.activeElement), true)
      await proof(member.page, 'assignments')
      await member.page.keyboard.press('Enter'); await expect(member.page.getByRole('heading', { name: f.shared.title, exact: true })).toBeVisible()
      for (const path of ['/app/people', `/app/people/${f.subject.id}`]) {
        assert.equal((await guest.page.goto(w.origin + path)).status(), 404)
        assert.ok(!(await guest.page.content()).includes(f.subject.name))
      }
      assert.equal(await guest.page.getByRole('navigation').getByRole('link', { name: 'People', exact: true }).count(), 0)
      await proof(guest.page, 'guest-refused')
    } finally { await member.context.close(); await guest.context.close() }
  }
  for (const grant of f.grants) await ok(f.owner.delete(`/api/v1/grants/${grant.id}`))
  assert.deepEqual((await ok(f.reader.get(profilePath(f.subject)))).assignments, [])
  const revoked = await open(f.reader, 1440)
  try {
    await revoked.page.goto(`${w.origin}/app/people/${f.subject.id}`)
    await expect(revoked.page.getByText('No shared assignments available to you.', { exact: true })).toBeVisible()
    assert.equal(await revoked.page.getByRole('list', { name: 'Permitted assignments' }).getByRole('link').count(), 0)
  } finally { await revoked.context.close() }
  console.log('Teammate profiles: permitted work, keyboard navigation, private-work exclusion and revocation passed')
}
