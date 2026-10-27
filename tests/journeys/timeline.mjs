import {scheduleSettingsJourney} from './schedule-settings.mjs'
// PEG-004 in a browser at 1440 and 390 px: Timeline with its critical path and baseline variance, a project editor previewing
// the knock-on set over the July 3 holiday and weekend, confirming it once and undoing it, and a viewer who can only look.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { expect } from '@playwright/test'

export async function timelineJourney({ w, browser, sizes, ok }) {
  for (const [size, viewport] of sizes) {
    const open = async client => { const context = await browser.newContext({ viewport }); await context.addCookies(client.cookie.split('; ').map(pair => ({ name: pair.slice(0, pair.indexOf('=')), value: pair.slice(pair.indexOf('=') + 1), url: client.origin }))); return { context, page: await context.newPage() } }
    const proof = async (page, name) => {
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `timeline ${name} reflows at ${size}`)
      const icons = await page.locator('main button,main a').evaluateAll(els => els.filter(e => !e.textContent.trim() && e.querySelector('svg,img')).map(e => e.outerHTML))
      assert.deepEqual(icons, [], 'timeline screens use text-labelled controls')
      if (process.env.PEGBOARD_PROOF_DIR) { await mkdir(process.env.PEGBOARD_PROOF_DIR, { recursive: true }); await page.screenshot({ path: join(process.env.PEGBOARD_PROOF_DIR, `timeline-${name}-${size}.png`), fullPage: true }) }
    }
    const owner = w.owner, editor = await w.person(`synthetic-pegboard-1401-${size}@example.com`, 'Eli Editor'), viewer = await w.person(`synthetic-pegboard-1402-${size}@example.com`, 'Vic Viewer')
    const project = ok(await owner.post('/api/v1/projects', { name: `Austin print launch ${size}` }))
    for (const [person, level] of [[editor, 'editor'], [viewer, 'viewer']]) ok(await owner.post('/api/v1/grants', { objectType: 'project', objectId: project.id, granteeId: person.id, level }))
    const copy = ok(await owner.post('/api/v1/tasks', { title: `Final copy ${size}`, projectId: project.id, startDate: '2026-06-29', dueDate: '2026-07-01' }))
    const run = ok(await owner.post('/api/v1/tasks', { title: `Print run ${size}`, projectId: project.id, startDate: '2026-07-02', dueDate: '2026-07-02' }))
    const ship = ok(await owner.post('/api/v1/tasks', { title: `Ship to stores ${size}`, projectId: project.id, startDate: '2026-07-07', dueDate: '2026-07-08' }))
    const titles = { [copy.id]: `Final copy ${size}`, [run.id]: `Print run ${size}`, [ship.id]: `Ship to stores ${size}` }
    const own = await open(owner), eli = await open(editor), vic = await open(viewer), url = `${w.origin}/app/projects/${project.id}/timeline`
    try {
      await own.page.goto(`${w.origin}/app/projects/${project.id}`); await own.page.getByRole('link', { name: 'Timeline', exact: true }).click()
      await expect(own.page.getByRole('heading', { name: `Austin print launch ${size}: timeline` })).toBeVisible()
      // Link the chain through the screen, then save the plan as a baseline.
      for (const [from, to] of [[copy, run], [run, ship]]) {
        const form = own.page.getByRole('form', { name: 'Link tasks', exact: true })
        await form.getByLabel('Predecessor').selectOption({ label: titles[from.id] }); await form.getByLabel('Dependant').selectOption({ label: titles[to.id] }); await form.getByLabel('Link type').selectOption('fs')
        await form.getByRole('button', { name: 'Link tasks' }).click()
      }
      await expect(own.page.getByText('finish to start').first()).toBeVisible()
      await own.page.getByRole('form', { name: 'Save baseline' }).getByLabel('Baseline name').fill('Kickoff plan'); await own.page.getByRole('button', { name: 'Save current dates as a baseline' }).click()
      await expect(own.page.getByText('Critical path').first()).toBeVisible(); await proof(own.page, 'schedule')
      // A cycle is refused with its own words and changes nothing.
      const refused = await owner.post('/api/v1/dependencies', { predecessor: ship.id, successor: copy.id }); assert.equal(refused.status, 409)

      // The editor previews the whole knock-on set before confirming it.
      await eli.page.goto(url)
      const move = eli.page.getByRole('form', { name: 'Preview a date change' })
      await move.getByLabel('Task to move').selectOption({ label: titles[copy.id] }); await move.getByLabel('New due').fill('2026-07-02'); await move.getByRole('button', { name: 'Preview knock-on changes' }).click()
      await expect(eli.page.getByRole('heading', { name: 'Knock-on preview' })).toBeVisible()
      await expect(eli.page.getByText(/skips Independence Day/).first()).toBeVisible(); await expect(eli.page.getByText(/finish to start/).first()).toBeVisible()
      assert.deepEqual(ok(await owner.get(`/api/v1/tasks/${run.id}`)).dueDate ?? ok(await owner.get(`/api/v1/tasks/${run.id}`)).due_date, '2026-07-02', 'previewing moves nothing')
      await proof(eli.page, 'preview')
      await eli.page.getByRole('button', { name: 'Apply this change set' }).click()
      await expect(eli.page.getByText('moved by Eli Editor')).toBeVisible()
      const after = ok(await owner.get(`/api/v1/tasks/${run.id}`)); assert.equal(after.dueDate ?? after.due_date, '2026-07-06')
      assert.equal(after.history.filter(h => h.kind === 'schedule.shifted').length, 1)
      // Baseline variance against the saved plan, then undo.
      await eli.page.goto(url); await eli.page.getByRole('form', { name: 'Choose a baseline' }).getByLabel('Compare with baseline').selectOption({ index: 1 }); await eli.page.getByRole('button', { name: 'Show variance' }).click()
      await expect(eli.page.getByText(/baseline due 2026-07-02 \(\+1 working days\)/)).toBeVisible(); await proof(eli.page, 'variance')
      await eli.page.getByRole('button', { name: 'Undo this change set' }).click()
      await expect(eli.page.getByText('moved by Eli Editor')).toHaveCount(0)
      const undone = ok(await owner.get(`/api/v1/tasks/${run.id}`)); assert.equal(undone.dueDate ?? undone.due_date, '2026-07-02')
      // A held pointer gesture exposes its exact set before release, which is the editor's only approval.
      await eli.page.goto(url)
      const handle=eli.page.getByRole('button',{name:`Drag ${titles[copy.id]}`,exact:true}),box=await handle.boundingBox()
      assert.ok(box);await eli.page.mouse.move(box.x+box.width/2,box.y+box.height/2);await eli.page.mouse.down();await eli.page.mouse.move(box.x+box.width/2+24,box.y+box.height/2,{steps:4})
      const drag=eli.page.getByRole('region',{name:'Drag knock-on preview',exact:true})
      await expect(drag).toContainText('Release to apply once')
      await expect(drag).toContainText(titles[run.id]);await expect(drag).toContainText('2026-07-06')
      assert.equal(ok(await owner.get(`/api/v1/tasks/${run.id}`)).dueDate,'2026-07-02')
      await proof(eli.page,'held-drag-preview')
      await eli.page.mouse.up();await expect(eli.page.getByText('moved by Eli Editor')).toBeVisible()
      const dragged=ok(await owner.get(`/api/v1/tasks/${run.id}`))
      assert.equal(dragged.dueDate,'2026-07-06');assert.equal(dragged.history.filter(h=>h.kind==='schedule.shifted').length,2)
      assert.equal(dragged.history.filter(h=>h.kind==='schedule.shifted').at(-1).actor,'Eli Editor')
      await proof(eli.page,'drag-applied');await eli.page.getByRole('button',{name:'Undo this change set',exact:true}).click()
      // Each native work view renders the same knock-on review and commits the exact reviewed set.
      for(const [name,path] of [['board',`/app/projects/${project.id}`],['list',`/app/projects/${project.id}?view=list`],['calendar',`/app/projects/${project.id}/calendar`],['task',`/app/tasks/${copy.id}`]]){
        await eli.page.goto(w.origin+path)
        const form=eli.page.getByRole('form',{name:'Preview a date change',exact:true})
        await form.getByLabel('Task to move',{exact:true}).selectOption(copy.id);await form.getByLabel('New due',{exact:true}).fill('2026-07-02');await form.getByRole('button',{name:'Preview knock-on changes',exact:true}).click()
        const review=eli.page.getByRole('region',{name:'Knock-on preview',exact:true})
        await expect(review).toContainText(titles[copy.id]);await expect(review).toContainText(titles[run.id]);await expect(review).toContainText('2026-07-06');await expect(review).toContainText('Wes Holloway')
        assert.equal(ok(await owner.get(`/api/v1/tasks/${run.id}`)).dueDate,'2026-07-02')
        await proof(eli.page,`${name}-preview`);await review.getByRole('button',{name:'Apply this change set',exact:true}).click()
        await expect(eli.page.getByRole('heading',{name:'Knock-on preview',exact:true})).toHaveCount(0)
        assert.equal(ok(await owner.get(`/api/v1/tasks/${run.id}`)).dueDate,'2026-07-06')
        await proof(eli.page,`${name}-applied`)
        await eli.page.goto(url);await eli.page.getByRole('button',{name:'Undo this change set',exact:true}).click()
        assert.equal(ok(await owner.get(`/api/v1/tasks/${run.id}`)).dueDate,'2026-07-02')
      }
      // A viewer can read the schedule and has no way to move it.
      await vic.page.goto(url); await expect(vic.page.getByRole('heading', { name: 'Schedule' })).toBeVisible()
      await expect(vic.page.getByRole('heading', { name: 'Move a task' })).toHaveCount(0); await expect(vic.page.getByRole('form', { name: 'Link tasks' })).toHaveCount(0); await proof(vic.page, 'viewer')
      await scheduleSettingsJourney({w,owner,editor,own,eli,proof,size,ok})
      console.log(`Timeline journey at ${size}px passed`)
    } finally { await own.context.close(); await eli.context.close(); await vic.context.close() }
  }
}
