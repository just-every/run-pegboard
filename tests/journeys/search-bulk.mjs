import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {expect} from '@playwright/test'
import {searchBulkFixture} from '../scenarios/search-bulk.mjs'
export async function searchBulkJourney({w,browser,ok}){
 const {root,editor,p,grant,approval,later,stale,viewer}=await searchBulkFixture(w)
 const context=await browser.newContext({viewport:{width:1440,height:900}})
 await context.addCookies(editor.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:w.origin})))
 const page=await context.newPage(),proof=async name=>{
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:width===1440?900:844})
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' reflows at '+width)
   assert.deepEqual(await page.locator('main button,main a').evaluateAll(els=>els.filter(el=>!el.textContent.trim()).map(el=>el.outerHTML)),[],'every control has visible words')
   if(process.env.PEGBOARD_PROOF_DIR){await mkdir(process.env.PEGBOARD_PROOF_DIR,{recursive:true});await page.screenshot({path:join(process.env.PEGBOARD_PROOF_DIR,`search-bulk-${name}-${width}.png`),fullPage:true})}
  }
  await page.setViewportSize({width:1440,height:900})
 }
 try{
  await page.goto(w.origin+'/app/projects');await page.getByRole('link',{name:'Find work',exact:true}).click()
  let form=page.getByRole('form',{name:'Search work',exact:true})
  await form.getByLabel('Words or reference').fill('synthetic-pegboard-310');await form.getByLabel('Work type').selectOption('approval');await form.getByRole('button',{name:'Search work',exact:true}).click()
  const results=()=>page.getByRole('list',{name:'Search results',exact:true})
  assert.deepEqual((await results().getByRole('link').allTextContents()).sort(),['Old print approval','Read only approval'])
  assert.deepEqual((await results().locator('[data-result-id]').evaluateAll(els=>els.map(el=>el.dataset.resultId))).sort(),[approval.id,viewer.id].sort())
  await proof('approval-search')
  form=page.getByRole('form',{name:'Save this search',exact:true});await form.getByLabel('Search name').fill('Archived approvals');await form.getByRole('button',{name:'Save search',exact:true}).click()
  await page.goto(w.origin+'/app/search');await page.getByRole('list',{name:'Saved searches',exact:true}).getByRole('link',{name:'Archived approvals',exact:true}).click()
  assert.equal(new URL(page.url()).searchParams.get('kind'),'approval');await expect(page.getByRole('status')).toHaveText('2 permitted results');await proof('saved-search')
  form=page.getByRole('form',{name:'Search work',exact:true});await form.getByLabel('Work type').selectOption('task');await form.getByRole('button',{name:'Search work',exact:true}).click()
  form=page.getByRole('form',{name:'Change selected search results',exact:true})
  for(const title of ['Old print approval','Packing instructions','Concurrent production','Read only approval'])await form.getByLabel('Select '+title,{exact:true}).check()
  await form.getByLabel('New priority').selectOption('high');await form.getByLabel('New due date').fill('2026-12-15');await proof('selected-work')
  await form.getByRole('button',{name:'Review selected changes',exact:true}).click()
  await expect(page.getByRole('list',{name:'Bulk row outcomes'}).locator('li').filter({hasText:'Read only approval'})).toContainText('forbidden')
  await proof('bulk-review')
  ok(await root.patch(`/api/v1/tasks/${stale.id}`,{priority:'urgent',description:'Keep the concurrent production instruction'}))
  await page.getByRole('button',{name:'Apply permitted rows',exact:true}).click()
  await expect(page.getByRole('list',{name:'Bulk row outcomes'}).locator('li').filter({hasText:'Concurrent production'})).toContainText('stale')
  await proof('stale-review')
  await page.getByRole('button',{name:'Apply permitted rows',exact:true}).click()
  await expect(page.getByRole('list',{name:'Applied row outcomes'}).locator('li').filter({hasText:'Packing instructions'})).toContainText('applied')
  await expect(page.getByRole('list',{name:'Applied row outcomes'}).locator('li').filter({hasText:'Concurrent production'})).toContainText('stale')
  await proof('per-row-results')
  ok(await root.patch(`/api/v1/tasks/${later.id}`,{priority:'urgent',description:'Later human packing instructions'}))
  await page.reload();await expect(page.getByRole('heading',{name:'Review undo',exact:true})).toBeVisible();await expect(page.locator('main')).toContainText('later field value');await proof('undo-conflict')
  await page.getByRole('button',{name:'Undo unchanged effects',exact:true}).click()
  const kept=ok(await root.get(`/api/v1/tasks/${later.id}`));assert.equal(kept.dueDate,'2026-12-10');assert.equal(kept.priority,'urgent');assert.equal(kept.description,'Later human packing instructions')
  await page.goto(w.origin+`/app/tasks/${later.id}`);await expect(page.locator('main')).toContainText('Later human packing instructions');await proof('undo-preserves-work')
  ok(await root.post(`/api/v1/grants/${grant.id}/revoke`,{}))
  await page.goto(w.origin+'/app/search');await page.getByRole('list',{name:'Saved searches',exact:true}).getByRole('link',{name:'Archived approvals',exact:true}).click()
  await expect(page.getByRole('status')).toHaveText('1 permitted results');await expect(results().getByRole('link')).toHaveText(['Read only approval'])
  const download=await page.request.get(w.origin+await page.getByRole('link',{name:'Download current results',exact:true}).getAttribute('href'))
  assert.equal(download.status(),200);assert.deepEqual((await download.json()).results.map(r=>r.id),[viewer.id]);await proof('revoked-saved-search')
 }finally{await context.close()}
 console.log('Search and mixed-permission bulk review passed at 1440; screens checked at 1440 and 390')
}
