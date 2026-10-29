import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {expect} from '@playwright/test'
import {mergeFixture} from '../scenarios/task-merge.mjs'
import {catalogueFixture} from '../scenarios/bulk-catalogue.mjs'
export async function mergeCatalogueJourney({w,browser,ok}){
 const f=await mergeFixture(w),{root,source,survivor,peer,project}=f,context=await browser.newContext({viewport:{width:1440,height:900}})
 await context.addCookies(root.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:w.origin})))
 const page=await context.newPage(),proof=async name=>{
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:width===1440?900:844})
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' fits '+width)
   if(process.env.PEGBOARD_PROOF_DIR){await mkdir(process.env.PEGBOARD_PROOF_DIR,{recursive:true});await page.screenshot({path:join(process.env.PEGBOARD_PROOF_DIR,`merge-catalogue-${name}-${width}.png`),fullPage:true})}
  }
  await page.setViewportSize({width:1440,height:900})
 }
 try{
  await page.goto(w.origin+'/app/tasks/'+source.id);await page.getByRole('link',{name:'Review duplicate mark or merge',exact:true}).click()
  let form=page.getByRole('form',{name:'Choose merge tasks',exact:true})
  await form.getByLabel('Surviving task').selectOption(survivor.id);await proof('choose-tasks');await form.getByRole('button',{name:'Review duplicate mark',exact:true}).click();await proof('duplicate-preview')
  await page.getByRole('button',{name:'Mark duplicate',exact:true}).click();await expect(page.getByRole('heading',{name:'Duplicate work',exact:true})).toBeVisible();await expect(page.locator('main')).toContainText('Print launch master');await proof('marked-duplicate')
  await page.getByRole('link',{name:'Review duplicate mark or merge',exact:true}).click();form=page.getByRole('form',{name:'Choose merge tasks',exact:true});await form.getByLabel('Surviving task').selectOption(survivor.id);await form.getByRole('button',{name:'Review task merge',exact:true}).click()
  await expect(page.getByRole('button',{name:'Merge reviewed tasks',exact:true})).toHaveCount(0);await proof('unresolved-merge')
  const choose=async()=>{
   const form=page.getByRole('form',{name:'Resolve merge conflicts',exact:true})
   for(const select of await form.locator('select').all())await select.selectOption((await select.getAttribute('name'))==='choice:description'||(await select.getAttribute('name')).startsWith('choice:field:')?'source':'survivor')
   await form.getByRole('button',{name:'Update merge preview',exact:true}).click()
  }
  await choose();await expect(page.getByRole('button',{name:'Merge reviewed tasks',exact:true})).toBeVisible();await expect(page.locator('main')).toContainText('Source printer conversation');await proof('reviewed-merge')
  // A real second writer invalidates the browser's exact preview; it changes neither task.
  ok(await peer.post(`/api/v1/tasks/${source.id}/comments`,{body:'Printer correction from the other browser'}))
  const refusal=page.waitForResponse(response=>response.request().method()==='POST'&&new URL(response.url()).pathname==='/api/v1/task-merges')
  await page.getByRole('button',{name:'Merge reviewed tasks',exact:true}).click();assert.equal((await refusal).status(),409);assert.equal(ok(await root.get(`/api/v1/tasks/${source.id}`)).id,source.id)
  await page.goto(w.origin+`/app/task-merges?sourceId=${source.id}&survivorId=${survivor.id}&review=1`);await choose();await page.getByRole('button',{name:'Merge reviewed tasks',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Merged task',exact:true})).toBeVisible();await expect(page.locator('main')).toContainText('2102 seconds');await expect(page.getByRole('list',{name:'Merged comments'}).locator('li')).toHaveCount(3);await expect(page.getByRole('list',{name:'Conserved time entries'}).locator('li')).toHaveCount(2);await proof('merged-work')
  const operation=new URL(page.url()).pathname.split('/').at(-1)
  await page.goto(w.origin+'/app/tasks/'+source.id);await expect(page).toHaveURL(w.origin+'/app/tasks/'+survivor.id);await expect(page.locator('main')).toContainText('Original printer instructions')
  ok(await root.patch(`/api/v1/tasks/${survivor.id}`,{description:'Later human delivery instructions'}))
  await page.goto(w.origin+`/app/task-merges/${operation}?undo=1`);await expect(page.getByRole('list',{name:'Merge undo conflicts'})).toContainText('later field edit');await proof('merge-undo-conflict');await page.getByRole('button',{name:'Undo unchanged merge effects',exact:true}).click()
  await expect(page.locator('main')).toContainText('Later human delivery instructions');assert.equal(ok(await root.get(`/api/v1/tasks/${source.id}`)).id,source.id);await proof('separated-work')
  const bulk=await catalogueFixture(w)
  await page.goto(w.origin+'/app/recovery/bulk');await page.getByRole('link',{name:'Review fields, project moves, duplication and archive',exact:true}).click()
  const selectRows=async(action,ids)=>{
   const form=page.getByRole('form',{name:'Review bulk action',exact:true})
   for(const id of ids)await form.locator(`input[name="taskIds[]"][value="${id}"]`).check()
   await form.getByLabel('Action',{exact:true}).selectOption(action)
   return form
  }
  form=await selectRows('fields',[bulk.a.id,bulk.b.id]);await form.getByLabel('Project for field or destination').selectOption(bulk.p.id);await form.getByLabel('Custom field key').fill('boxes');await form.getByLabel('Custom field value').fill('8');await form.getByRole('button',{name:'Preview action rows',exact:true}).click();await expect(page.getByRole('list',{name:'Catalogue row outcomes'})).toContainText('Boxes: 1 → 8');await proof('bulk-field-review');await page.getByRole('button',{name:'Apply permitted action rows',exact:true}).click();await expect(page.getByRole('list',{name:'Catalogue applied outcomes'}).locator('li')).toHaveCount(2);await proof('bulk-field-results')
  ok(await root.post(`/api/v1/tasks/${bulk.b.id}/fields`,{projectId:bulk.p.id,values:{boxes:10}}));await page.getByRole('link',{name:'Review action undo',exact:true}).click();await expect(page.getByRole('list',{name:'Catalogue undo conflicts'})).toContainText('later field edit');await proof('bulk-field-undo');await page.getByRole('button',{name:'Undo unchanged action effects',exact:true}).click();assert.equal(ok(await root.get(`/api/v1/tasks/${bulk.b.id}`)).projects[0].fields.find(f=>f.key==='boxes').value,10)
  for(const action of ['move','duplicate','archive']){
   await page.goto(w.origin+'/app/recovery/catalogue');form=await selectRows(action,[bulk.a.id]);if(action!=='archive')await form.getByLabel('Project for field or destination').selectOption(bulk.destination.id);if(action==='move')await form.getByLabel('Move from project').selectOption(bulk.p.id);await form.getByRole('button',{name:'Preview action rows',exact:true}).click();await expect(page.getByRole('list',{name:'Catalogue row outcomes'})).toContainText('ready');await proof('bulk-'+action+'-review');await page.getByRole('button',{name:'Apply permitted action rows',exact:true}).click();await expect(page.getByRole('list',{name:'Catalogue applied outcomes'})).toContainText('applied');await proof('bulk-'+action+'-result');await page.getByRole('link',{name:'Review action undo',exact:true}).click();await page.getByRole('button',{name:'Undo unchanged action effects',exact:true}).click()
  }
 }finally{await context.close()}
 console.log('Duplicate marking, merge, conserved work and bulk catalogue passed at 1440; screens recorded at 1440 and 390')
}
