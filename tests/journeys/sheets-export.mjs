import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { expect } from '@playwright/test'
import { seedSheetWork, eraseSheetTask } from '../scenarios/sheets-export.mjs'
import { sheetsCredential as credential, spreadsheetId } from '../support/sheets-service.mjs'
export async function sheetsExportJourney({ w, browser, edge, ok }) {
 const seeded = await seedSheetWork(w), root = w.owner, context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
 await context.addCookies(root.cookie.split('; ').map(pair => ({ name: pair.slice(0, pair.indexOf('=')), value: pair.slice(pair.indexOf('=') + 1), url: w.origin })))
 const page = await context.newPage(), here = w.origin + '/app/settings/sheets'
 const proof = async name => {
  if (process.env.PEGBOARD_PROOF_DIR) {
   await mkdir(process.env.PEGBOARD_PROOF_DIR, { recursive: true })
   for (const width of [1440, 390]) { await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 }); await page.screenshot({ path: join(process.env.PEGBOARD_PROOF_DIR, `sheets-${name}-${width}.png`), fullPage: true }) }
   await page.setViewportSize({ width: 1440, height: 1000 })
  }
 }
 const reviewRefresh = async id => { const f = page.getByRole('form', { name: `Review refresh ${id}`, exact: true }); await f.getByLabel('One-use Google credential').fill(credential); await f.getByRole('button', { name: 'Review manual refresh' }).click(); await expect(page.getByRole('heading', { name: 'Review exact export', exact: true })).toBeVisible() }
 const send = async () => { const f = page.getByRole('form', { name: 'Send reviewed export', exact: true }); await f.getByLabel('One-use Google credential').fill(credential); await f.getByRole('checkbox').check(); await f.getByRole('button', { name: 'Send reviewed export', exact: true }).click() }
 try {
  await page.goto(w.origin + '/app/settings'); await page.getByRole('link', { name: 'Google Sheets exports', exact: true }).click()
  const config = page.getByRole('form', { name: 'Configure Sheets export' })
  await config.getByLabel('Google spreadsheet ID').fill(spreadsheetId)
  for (const p of seeded.projects) await config.getByLabel(p.name, { exact: true }).check()
  for (const label of ['Title', 'Status', 'Agency launch: Delivery code']) await config.getByLabel(label, { exact: true }).check()
  await config.getByLabel('One-use Google credential').fill(credential); await config.getByLabel('I authorize this exact project and field scope; no data is sent until reviewed').check()
  await config.getByRole('button', { name: 'Configure export' }).focus(); await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', { name: 'Your export grants' })).toBeVisible()
  const cfg = ok(await root.get('/api/v1/sheets')).exports[0]
  await proof('configuration')
  await reviewRefresh(cfg.id)
  const rows = page.getByRole('list', { name: 'Exact export rows' })
  await expect(rows.getByText('=Untrusted spreadsheet text', { exact: true })).toBeVisible()
  await expect(rows.getByText('Operations review', { exact: true })).toBeVisible()
  await expect(rows.getByText('Client checklist', { exact: true })).toBeVisible()
  await expect(rows.getByText('Agency-42', { exact: true })).toBeVisible()
  await expect(rows.getByText('Never export hidden field value', { exact: true })).toHaveCount(0)
  await expect(rows.getByText('Private no-project work', { exact: true })).toHaveCount(0)
  assert.equal(await page.locator('input[type=password]').evaluateAll(es => es.some(e => e.value)), false, 'credential is never redisplayed')
  await proof('exact-review'); await send()
  await expect(page.getByRole('heading', { name: 'Export confirmed by readback' })).toBeVisible()
  const initial = structuredClone(edge.state.tabs.get(cfg.sheet_id).values)
  assert.deepEqual(initial.slice(2).map(r => r[0]).sort(), [seeded.shared.id, seeded.second.id, seeded.third.id].sort())
  await ok(await root.patch(`/api/v1/tasks/${seeded.shared.id}`, { title: 'Updated delivery work' }))
  await eraseSheetTask(root, seeded.second.id)
  await page.goto(here); await reviewRefresh(cfg.id)
  await expect(page.getByRole('list', { name: 'Exact export rows' }).getByText('Updated delivery work', { exact: true })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Exact export rows' }).getByText('deleted', { exact: true })).toBeVisible()
  await proof('refresh-review'); await send()
  await expect(page.getByRole('heading', { name: 'Export confirmed by readback' })).toBeVisible()
  const refreshed = edge.state.tabs.get(cfg.sheet_id).values
  assert.equal(refreshed.findIndex(r => r[0] === seeded.shared.id), initial.findIndex(r => r[0] === seeded.shared.id))
  assert.deepEqual(refreshed.find(r => r[0] === seeded.second.id), [seeded.second.id, '', 'deleted', '', '', ''])
  const current = page.locator(`[data-sheet-export="${cfg.id}"]`)
  await current.getByRole('button', { name: 'Revoke grant', exact: true }).focus(); await page.keyboard.press('Enter')
  await expect(page.getByText('Status: Revoked', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Review manual refresh', exact: true })).toHaveCount(0)
  await proof('revoked')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Sheets screen fits at the assertion width')
  assert.deepEqual(await page.locator('main').evaluate(el => [...el.querySelectorAll('button,a,input,label,p,h2,h3')].filter(e => e.getBoundingClientRect().width && parseFloat(getComputedStyle(e).fontSize) < 13).map(e => e.tagName)), [], 'Sheets text stays readable')
  assert.deepEqual(await page.locator('main button,main a').evaluateAll(es => es.filter(e => !e.textContent.trim() && e.querySelector('svg,img')).map(e => e.outerHTML)), [], 'every Sheets action has a visible label')
  assert.ok(!edge.state.error, edge.state.error)
 } finally { await context.close() }
 console.log('Google Sheets schema-fake: native configuration, exact review, manual refresh and grant revocation passed')
}
