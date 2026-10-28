import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { expect } from '@playwright/test'

export async function statusInboxJourney({ w, browser, sizes, ok }) {
  const owner = w.owner
  const member = await w.person('synthetic-pegboard-1510' + '@' + 'example.com', 'Status Member')
  const guest = await w.person('synthetic-pegboard-1511' + '@' + 'example.com', 'Status Guest', 'guest')
  const project = ok(await owner.post('/api/v1/projects', { name: 'Reviewed status program', visibility: 'private' }))
  const memberGrant = ok(await owner.post('/api/v1/grants', { objectType: 'project', objectId: project.id, granteeId: member.id, level: 'commenter' }))
  const guestGrant = ok(await owner.post('/api/v1/grants', { objectType: 'project', objectId: project.id, granteeId: guest.id, level: 'commenter' }))
  const source = ok(await owner.post('/api/v1/tasks', { projectId: project.id, title: 'Reviewed launch milestone' }))
  const input = { subjectType: 'project', subjectId: project.id, health: 'on_track', summary: 'Launch content approved', highlights: 'Creative reviewed', risks: '', decisions: 'Proceed after human review', nextSteps: 'Confirm the date', from: '2026-10-01', to: '2026-10-26', sourceIds: [source.id], recipients: [{ id: member.id, channels: ['in_app'] }, { id: guest.id, channels: ['in_app'] }] }
  const authorContext = await browser.newContext({viewport:sizes[0][1]})
  await authorContext.addCookies(owner.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:owner.origin})))
  const author = await authorContext.newPage(), statusUrl = `${w.origin}/app/projects/${project.id}/status`
  let draft, revision
  try {
    const noModel=await owner.post('/api/v1/status-drafts/generate',{...input,modelConsent:true})
    assert.equal(noModel.status,503);assert.equal(noModel.body.message,'No AI model connected')
    await author.goto(statusUrl)
    const compose = author.getByRole('form',{name:'Compose status draft'})
    await compose.getByLabel('Status summary').fill(input.summary)
    await compose.getByLabel('Window starts').fill(input.from); await compose.getByLabel('Window ends').fill(input.to)
    await compose.getByLabel('Highlights',{exact:true}).fill(input.highlights)
    await compose.getByLabel('Decisions',{exact:true}).fill(input.decisions)
    await compose.getByLabel('Next steps',{exact:true}).fill(input.nextSteps)
    await compose.getByLabel('Reviewed launch milestone',{exact:true}).check()
    await compose.getByLabel('Status Member',{exact:true}).check(); await compose.getByLabel('Status Guest',{exact:true}).check()
    await compose.getByRole('button',{name:'Save draft',exact:true}).click()
    await author.waitForURL(/draft=draft_/)
    draft = ok(await owner.get(`/api/v1/status-drafts/${new URL(author.url()).searchParams.get('draft')}`))
    const rejection = author.getByRole('form',{name:'Reject status draft'})
    await rejection.getByLabel('Rejection reason').fill('Source assertion needs a correction')
    await rejection.getByRole('button',{name:'Reject draft',exact:true}).click()
    await expect(author.getByText('Rejected: Source assertion needs a correction. Save an edit before another review.')).toBeVisible()
    await author.getByRole('form',{name:'Compose status draft'}).getByLabel('Highlights',{exact:true}).fill('Creative reviewed and corrected')
    await author.getByRole('button',{name:'Save draft',exact:true}).click()
    await author.getByRole('link',{name:'Review exact publication',exact:true}).click()
    const approved = author.getByRole('form',{name:'Publish reviewed revision'})
    const staleToken = await approved.locator('[name=token]').inputValue()
    ok(await owner.patch(`/api/v1/tasks/${source.id}`,{title:'Reviewed launch milestone corrected'}))
    assert.equal((await owner.post(`/api/v1/status-drafts/${draft.id}/publish`,{token:staleToken})).status,409)
    await author.goto(`${statusUrl}?draft=${draft.id}`)
    await author.getByRole('button',{name:'Save draft',exact:true}).click()
    await author.getByRole('link',{name:'Review exact publication',exact:true}).click()
    await expect(author.getByRole('heading',{name:'Review exact publication',exact:true})).toBeVisible()
    for(const [size,viewport] of sizes) {
      await author.setViewportSize(viewport)
      if(size==='1440')await expect(author.getByRole('article').filter({has:author.getByRole('heading',{name:'Review exact publication',exact:true})})).toContainText('Creative reviewed and corrected')
      assert.ok(await author.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
      if(process.env.PEGBOARD_PROOF_DIR){await mkdir(process.env.PEGBOARD_PROOF_DIR,{recursive:true});await author.screenshot({path:join(process.env.PEGBOARD_PROOF_DIR,`status-review-${size}.png`),fullPage:true})}
    }
    await author.setViewportSize(sizes[0][1])
    await author.getByRole('button',{name:'Approve and publish exact revision',exact:true}).click()
    const history=ok(await owner.get(`/api/v1/status-history/project/${project.id}`))
    assert.equal(history.revisions.length,1); revision=history.revisions[0]
    await expect(author.getByRole('heading',{name:input.summary,exact:true})).toBeVisible()
  } finally {await authorContext.close()}

  const portfolio = ok(await owner.post('/api/v1/portfolios', { name: 'Status portfolio review' }))
  ok(await owner.post(`/api/v1/portfolios/${portfolio.id}/projects`, { projectId: project.id }))
  ok(await owner.post(`/api/v1/portfolios/${portfolio.id}/members`, { operatorId: member.id, level: 'viewer' }))
  const portfolioDraft = ok(await owner.post('/api/v1/status-drafts', { ...input, subjectType: 'portfolio', subjectId: portfolio.id, summary: 'Portfolio update reviewed', recipients: [{ id: member.id, channels: ['in_app'] }] }))
  const portfolioReview = ok(await owner.post(`/api/v1/status-drafts/${portfolioDraft.id}/review`, {}))
  const portfolioRevision = ok(await owner.post(`/api/v1/status-drafts/${portfolioDraft.id}/publish`, { token: portfolioReview.token }))
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
    await expect(card).toContainText('Reviewed by Wes Holloway')
    await card.locator(':scope > details > summary').click()
    await expect(card).not.toContainText('Internal supplier negotiation')
    await expect(card.getByLabel('Reply to', { exact: true })).not.toContainText('Internal supplier negotiation')
    await card.getByLabel('Your reply').fill('Client confirms the launch date')
    await card.getByRole('button', { name: 'Post reply' }).click()
    await g.page.locator(`#status-${revision.id} > details > summary`).click()
    await expect(g.page.locator(`#status-${revision.id}`)).toContainText('Client confirms the launch date')
    const clientComment = ok(await guest.get(`/api/v1/status-revisions/${revision.id}/comments`)).comments.find(comment => comment.body === 'Client confirms the launch date')
    const edit = g.page.locator(`#${clientComment.id}`)
    await edit.getByText('Edit your reply', { exact: true }).click()
    await edit.getByLabel('Reply text').fill('Client corrects the launch date')
    await edit.getByRole('button', { name: 'Save reply edit' }).click()
    await g.page.locator(`#status-${revision.id} > details > summary`).click()
    await expect(g.page.locator(`#${clientComment.id}`)).toContainText('Client corrects the launch date')
    await expect(g.page.locator(`#${clientComment.id}`)).toContainText('Edited')
    await expect(g.page.locator(`#${clientComment.id}`)).toContainText('Status Guest')
    await m.page.goto(`${w.origin}/app/inbox`)
    const portfolioCard = m.page.locator(`#status-${portfolioRevision.id}`)
    await expect(portfolioCard).toContainText('Portfolio update reviewed')
    await portfolioCard.locator(':scope > details > summary').click()
    await expect(portfolioCard.getByRole('button', { name: 'Post reply' })).toHaveCount(0)
    await portfolioCard.locator(':scope > details > summary').click()
    const memberCard = m.page.locator(`#status-${revision.id}`)
    await memberCard.locator(':scope > details > summary').click()
    await expect(memberCard).toContainText('Internal supplier negotiation')
    await expect(memberCard).toContainText('Client corrects the launch date')
    await expect(memberCard.locator(`#${clientComment.id}`).getByText('Edit your reply', { exact: true })).toHaveCount(0)
    await memberCard.getByLabel('Reply to', { exact: true }).selectOption(hidden.id)
    await memberCard.getByLabel('Your reply').fill('Internal nested supplier detail')
    await memberCard.getByRole('button', { name: 'Post reply' }).click()
    await m.page.locator(`#status-${revision.id} > details > summary`).click()
    await expect(m.page.locator(`#status-${revision.id}`)).toContainText('Internal nested supplier detail')
    await g.page.reload(); await g.page.locator(`#status-${revision.id} > details > summary`).click()
    await expect(g.page.locator('main')).not.toContainText('Internal nested supplier detail')
    const correctionDraft = ok(await owner.post('/api/v1/status-drafts', { ...input, correctsId: revision.id, summary: 'Launch date corrected after review' }))
    const correctionReview = ok(await owner.post(`/api/v1/status-drafts/${correctionDraft.id}/review`, {}))
    const correction = ok(await owner.post(`/api/v1/status-drafts/${correctionDraft.id}/publish`, { token: correctionReview.token }))
    await m.page.reload(); await m.page.locator(`#status-${revision.id} > details > summary`).click()
    await g.page.reload(); await g.page.locator(`#status-${revision.id} > details > summary`).click()
    await expect(g.page.locator(`#status-${correction.id}`).getByRole('link', { name: 'Earlier published revision' })).toHaveAttribute('href', `#status-${revision.id}`)
    await expect(g.page.locator(`#status-${revision.id}`)).toContainText(input.summary)
    await expect(g.page.locator(`#status-${correction.id}`)).not.toContainText('Client corrects the launch date')
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
    await g.page.locator(`#status-${revision.id} > details > summary`).click()
    await g.page.locator(`#${clientComment.id}`).getByText('Edit your reply', { exact: true }).click()
    await g.page.locator(`#${clientComment.id}`).getByRole('button', { name: 'Delete reply' }).click()
    await g.page.locator(`#status-${revision.id} > details > summary`).click()
    await expect(g.page.locator(`#${clientComment.id}`)).toContainText('Comment deleted')
    await expect(g.page.locator(`#${clientComment.id}`)).not.toContainText('Client corrects the launch date')
    const decisions = ok(await owner.get(`/api/v1/status-history/project/${project.id}`))
    assert.deepEqual(new Set(decisions.revisions.map(item => item.id)), new Set([revision.id, correction.id]), 'discussion never republishes either reviewed update')
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
