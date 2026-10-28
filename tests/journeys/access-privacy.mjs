import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {expect} from '@playwright/test'

// Assertions run once at 1440. Each changed screen is also recorded at 390.
export async function accessPrivacyJourney({w,browser,owner,cookies}) {
  const ok = async promise => { const response=await promise;assert.equal(response.status,200,JSON.stringify(response.body));return response.body }
  const requester = await w.person(`synthetic-pegboard-9210@${'example.test'}`, 'Project requester')
  const hidden = await ok(owner.post('/api/v1/projects',{name:'Private launch synthetic-pegboard-9211'}))
  const invalid = 'prj_00000000000000000000'
  const contexts = []
  const open = async client => {
    const context = await browser.newContext({viewport:{width:1440,height:900}})
    contexts.push(context)
    await context.addCookies(cookies(client))
    return context.newPage()
  }
  const evidence = process.env.PEGBOARD_SCREENSHOTS
  const capture = async (page,name) => {
    if (!evidence) return
    await mkdir(evidence,{recursive:true})
    for (const width of [1440,390]) {
      await page.setViewportSize({width,height:width===1440?900:844})
      await page.screenshot({path:`${evidence}/access-privacy-${name}-${width}.png`,fullPage:true})
    }
    await page.setViewportSize({width:1440,height:900})
  }
  try {
    const page = await open(requester), reviewer = await open(owner)
    const baseline = await ok(requester.get('/api/v1/access-requests'))
    const refusals = [], acknowledgments = []
    for (const [kind,target] of [['private',hidden.id],['invalid',invalid]]) {
      const response = await page.goto(w.origin+'/app/link/'+target)
      assert.equal(response.status(),404)
      refusals.push(await page.locator('main').innerText())
      assert.ok(!refusals.at(-1).includes(hidden.name))
      await capture(page,kind+'-refused')
      const form = page.getByRole('form',{name:'Request access',exact:true})
      await form.getByLabel('Message (optional)').fill('Please review my request')
      await form.getByRole('button',{name:'Request access',exact:true}).focus()
      await form.getByRole('button',{name:'Request access',exact:true}).press('Enter')
      await expect(page.getByRole('heading',{name:'Request sent',exact:true})).toBeVisible()
      acknowledgments.push(await page.locator('main').innerText())
      await capture(page,kind+'-acknowledged')
      await page.getByRole('link',{name:'Open your inbox',exact:true}).click()
      await expect(page.getByRole('heading',{name:'Requests you made',exact:true})).toBeVisible()
      assert.deepEqual(await ok(requester.get('/api/v1/access-requests')),baseline)
      assert.ok(!(await page.locator('main').innerText()).includes(hidden.name))
      await capture(page,kind+'-receipts')
    }
    assert.equal(refusals[0],refusals[1])
    assert.equal(acknowledgments[0],acknowledgments[1])
    await reviewer.goto(w.origin+'/app/inbox')
    const queue = (await ok(owner.get('/api/v1/access-requests'))).toDecide
    assert.equal(queue.length,1)
    assert.equal(queue[0].targetId,hidden.id)
    await expect(reviewer.locator('main')).toContainText(hidden.name)
    await capture(reviewer,'owner-review')
    const approve = reviewer.getByRole('form',{name:'Approve',exact:true}).getByRole('button',{name:'Approve',exact:true})
    await approve.focus()
    await approve.press('Enter')
    await expect(reviewer.getByRole('heading',{name:'Nothing waiting',exact:true})).toBeVisible()
    await page.goto(w.origin+'/app/inbox')
    await expect(page.locator('main')).toContainText('Approved')
    await capture(page,'approved-receipt')
    assert.equal((await requester.get('/api/v1/projects/'+hidden.id)).status,200)
    const grants = (await ok(owner.get('/api/v1/grants?objectType=project&objectId='+hidden.id))).grants
    await ok(owner.delete('/api/v1/grants/'+grants.find(grant=>grant.grantee_id===requester.id).id))
    await page.reload()
    assert.deepEqual(await ok(requester.get('/api/v1/access-requests')),baseline)
    await expect(page.locator('main')).not.toContainText('Approved')
    await capture(page,'revoked-receipts')
    console.log('Access-request privacy browser journey passed at 1440; proof screens recorded at 1440 and 390 when requested')
  } finally { for (const context of contexts) await context.close() }
}
