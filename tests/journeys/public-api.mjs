import assert from 'node:assert/strict'
import {expect} from '@playwright/test'
import {mkdir} from 'node:fs/promises'

export async function publicApiJourney({w,browser,owner,cookies}) {
 const ok=async promise=>{const r=await promise;assert.equal(r.status,200,JSON.stringify(r.body));return r.body}
 const project=await ok(owner.post('/api/v1/projects',{name:'Connected work'}))
 const guest=await w.person('api-browser-guest@example.com','Connected guest','guest')
 const viewer=await w.person('api-browser-viewer@example.com','Connected viewer')
 await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:project.id,granteeId:guest.id,level:'editor'}))
 await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:project.id,granteeId:viewer.id,level:'viewer'}))
 const key=await ok(guest.post('/api/v1/api-keys',{name:'Connected client',projects:[project.id],expiresAt:Date.now()+3600000,writable:true,consent:true}))
 const call=async(name,args)=>{
  const response=await fetch(w.origin+'/api/v1/public/mcp',{method:'POST',headers:{authorization:'Bearer '+key.secret,'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:['tools','call'].join('/'),params:{name,arguments:args}})})
  assert.equal(response.status,200);const message=await response.json();assert.equal(message.result.isError,false,JSON.stringify(message));return JSON.parse(message.result.content[0].text)
 }
 const task=await call('task_create',{title:'Connected draft',projectId:project.id,intent:'browser-create'})
 const initial=await call('task_read',{taskId:task.id})
 await call('task_update',{taskId:task.id,revision:initial.revision,patch:{title:'Reviewed connected work'},intent:'browser-update'})
 const context=await browser.newContext({viewport:{width:1440,height:900}})
 const evidence=process.env.PEGBOARD_SCREENSHOTS??'./test-results/public-api'
 if(evidence)await mkdir(evidence,{recursive:true})
 try {
  await context.addCookies(cookies(guest));const page=await context.newPage()
  const errors=[];page.on('pageerror',error=>errors.push(error.message))
  await page.goto(w.origin+'/app/tasks/'+task.id)
  await expect(page.getByRole('heading',{name:'Reviewed connected work',exact:true})).toBeVisible()
  const edit=page.getByRole('form',{name:'Edit task',exact:true})
  await edit.getByLabel('Title',{exact:true}).fill('Human edit after the client')
  await edit.getByRole('button',{name:'Save',exact:true}).click()
  await expect(page.getByRole('heading',{name:'Human edit after the client',exact:true})).toBeVisible()
  assert.equal((await call('task_read',{taskId:task.id})).title,'Human edit after the client')
  assert.equal((await call('task_read',{taskId:task.id})).history.filter(h=>h.kind==='created').length,1)
  for(const control of await page.locator('button,a').all()) if(await control.isVisible()) assert.ok((await control.innerText()).trim(),'every visible action has a word label')
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  assert.deepEqual(errors,[])
  if(evidence){await page.screenshot({path:evidence+'/connected-task-1440.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:evidence+'/connected-task-390.png',fullPage:true})}
  await context.clearCookies();await context.addCookies(cookies(viewer));await page.setViewportSize({width:1440,height:900})
  await page.goto(w.origin+'/app/tasks/'+task.id)
  await expect(page.getByRole('heading',{name:'Human edit after the client',exact:true})).toBeVisible()
  assert.equal(await page.getByRole('form',{name:'Edit task',exact:true}).count(),0)
  assert.equal(await page.getByRole('form',{name:'Comment',exact:true}).count(),0)
  if(evidence){await page.screenshot({path:evidence+'/connected-viewer-1440.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:evidence+'/connected-viewer-390.png',fullPage:true})}
  const personalKey = await ok(owner.post('/api/v1/api-keys', {name:'Personal organizer',projects:[],personal:true,writable:true,consent:true,expiresAt:Date.now()+3600000}))
  const personalCall = async (method, path, body) => {
   const response = await fetch(w.origin+'/api/v1/public'+path, {method,headers:{authorization:'Bearer '+personalKey.secret,'content-type':['application','json'].join('/')},...(body?{body:JSON.stringify(body)}:{})})
   assert.equal(response.status,200);return response.json()
  }
  const privateTask = await personalCall('POST','/tasks',{title:'Connected personal plan',intent:'personal-browser-task'})
  const beforeSection = await personalCall('GET','/personal-sections')
  const personalSection = await personalCall('POST','/personal-sections',{name:'Connected focus',revision:beforeSection.revision,intent:'personal-browser-section'})
  const beforePlace = await personalCall('GET','/personal-sections')
  await personalCall('PATCH',`/personal-tasks/${privateTask.id}/layout`,{sectionId:personalSection.id,position:2,revision:beforePlace.revision,intent:'personal-browser-layout'})
  await context.clearCookies();await context.addCookies(cookies(owner));await page.setViewportSize({width:1440,height:900})
  await page.goto(w.origin+'/app/my-tasks')
  await expect(page.getByRole('heading',{name:'My tasks',exact:true})).toBeVisible()
  const arrangement = page.getByRole('form',{name:'Arrange Connected personal plan',exact:true})
  await expect(arrangement.getByLabel('Section',{exact:true})).toHaveValue(personalSection.id)
  await expect(arrangement.getByLabel('Task rank',{exact:true})).toHaveValue('2')
  await expect(page.getByRole('form',{name:'Edit Connected focus',exact:true})).toBeVisible()
  const iconControls=await page.locator('button,a').evaluateAll(elements=>elements.filter(e=>!e.textContent.trim()&&e.querySelector('svg,img')&&!e.getAttribute('aria-describedby')).map(e=>e.outerHTML))
  assert.deepEqual(iconControls,[])
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[])
  if(evidence){await page.screenshot({path:evidence+'/connected-personal-1440.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:evidence+'/connected-personal-390.png',fullPage:true})}
 } finally {await context.close()}
}
