import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdtemp,mkdir,rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join,resolve } from 'node:path'
import { chromium,expect } from '@playwright/test'
import { capturePayload } from '../scenarios/browser-capture.mjs'
import { startWorker } from '../support/worker.mjs'
const ok=async(promise,status=200)=>{const r=await promise;assert.equal(r.status,status,JSON.stringify(r.body));return r.body}
const cookies=(w,client)=>client.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:w.origin}))
const evidence=process.env.PEGBOARD_CAPTURE_EVIDENCE??join(tmpdir(),'pegboard-capture-screens')
async function screens(page,name){
 await mkdir(evidence,{recursive:true})
 for(const width of [1440,390]){await page.setViewportSize({width,height:900});await page.screenshot({path:join(evidence,name+'-'+width+'.png'),fullPage:true})}
 await page.setViewportSize({width:1440,height:900})
}
async function destination(page,project,owner){
 await page.getByRole('combobox',{name:'Project',exact:true}).selectOption(project.id)
 await page.getByRole('button',{name:'Choose project',exact:true}).click()
 await page.getByRole('combobox',{name:'Owner',exact:true}).selectOption(owner.id)
 await page.getByRole('button',{name:'Review destination',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Confirm this task',exact:true})).toBeVisible()
}
export async function capturePreviewJourney({w,browser}){
 const context=await browser.newContext({viewport:{width:1440,height:900}})
 try{
  await context.addCookies(cookies(w,w.owner));const page=await context.newPage()
  const p=await ok(w.owner.post('/api/v1/projects',{name:'Capture review campaign'})),payload=capturePayload({title:'Research <img src=x onerror=alert(1)>',excerpt:'<script>globalThis.captureExecuted=true</script>\nChosen source words'})
  const intent=await ok(w.owner.post('/api/v1/captures',payload.input))
  await page.goto(w.origin+'/app/capture/'+intent.id);await destination(page,p,w.owner)
  await expect(page.locator('[data-capture-title]')).toHaveText(payload.input.title);await expect(page.locator('[data-capture-excerpt]')).toHaveText(payload.input.excerpt)
  assert.equal(await page.evaluate(()=>globalThis.captureExecuted),undefined)
  assert.equal(await page.locator('[data-capture-excerpt] script,[data-capture-title] img').count(),0)
  assert.ok(await page.locator('main').evaluate(el=>el.scrollWidth<=window.innerWidth))
  await screens(page,'capture-preview')
  await page.getByRole('button',{name:'Cancel capture',exact:true}).click()
  await expect(page.getByRole('status')).toContainText('No task was created')
  assert.equal((await ok(w.owner.get(`/api/v1/projects/${p.id}`))).counts.tasks,0)
 }finally{await context.close()}
}
async function installedBrowser(){
 const directory=await mkdtemp(join(tmpdir(),'pegboard-extension-browser-'))
 // A fresh browser profile, never a copied real profile; public CDP simulates the toolbar gesture.
 const child=spawn(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH??chromium.executablePath(),['--headless=new','--no-sandbox','--use-mock-keychain','--password-store=basic','--enable-unsafe-extension-debugging','--remote-debugging-port=0','--user-data-dir='+directory,'about:blank'],{stdio:['ignore','ignore','pipe']})
 let output=''
 const endpoint=await new Promise((resolveEndpoint,reject)=>{
  const timer=setTimeout(()=>reject(new Error('Extension browser launch timed out')),30000)
  child.stderr.on('data',chunk=>{output+=chunk;const m=/DevTools listening on (ws:\/\/[^\s]+)/.exec(output);if(m){clearTimeout(timer);resolveEndpoint(m[1])}})
  child.once('error',error=>{clearTimeout(timer);reject(error)})
  child.once('exit',()=>{clearTimeout(timer);reject(new Error('Extension browser exited before CDP was ready'))})
 }).catch(async error=>{child.kill('SIGTERM');await rm(directory,{recursive:true,force:true});throw error})
 let browser
 try{browser=await chromium.connectOverCDP(endpoint)}catch(error){child.kill('SIGTERM');await rm(directory,{recursive:true,force:true});throw error}
 return {browser,async close(){await browser.close();child.kill('SIGTERM');if(child.exitCode===null)await new Promise(r=>child.once('exit',r));await rm(directory,{recursive:true,force:true})}}
}
export async function browserCaptureJourney({w}){
 const launched=await installedBrowser(),browser=launched.browser,cdp=await browser.newBrowserCDPSession()
 let context,sourceServer
 try{
  const {id:extensionId}=await cdp.send('Extensions.loadUnpacked',{path:resolve('extensions/capture'),enableInIncognito:true})
  assert.ok((await cdp.send('Extensions.getExtensions')).extensions.some(e=>e.id===extensionId&&e.enabled),'the actual unpacked extension is installed and enabled')
  await capturePreviewJourney({w,browser})
  context=await browser.newContext({viewport:{width:1440,height:900}});await context.addCookies(cookies(w,w.owner))
  const app=await context.newPage(),source=await context.newPage(),errors=[]
  app.on('pageerror',e=>errors.push(e.message))
  const trigger=async page=>{const session=await context.newCDPSession(page);try{const {targetInfo}=await session.send('Target.getTargetInfo');await cdp.send('Extensions.triggerAction',{id:extensionId,targetId:targetInfo.targetId})}finally{await session.detach()}}
  await app.goto(w.origin+'/app/capture');await trigger(app)
  await expect(app.getByRole('status')).toContainText('Extension connected')
  const chosen='<script>globalThis.captureExecuted=true</script> chosen campaign text',title='Selected campaign research'
  sourceServer=createServer((req,res)=>{res.setHeader('content-type','text/html');res.end('<!doctype html><title>'+title+'</title><p id="chosen">'+chosen.replaceAll('&','&amp;').replaceAll('<','&lt;')+'</p><p>UNCHOSEN PRIVATE SENTINEL</p>')})
  await new Promise(r=>sourceServer.listen(0,'127.0.0.1',r));const sourceOrigin='http://127.0.0.1:'+sourceServer.address().port
  const capture=async()=>{
   await source.goto(sourceOrigin+'/research?omitted=synthetic-pegboard-8#omitted')
   await source.locator('#chosen').evaluate(el=>{const range=document.createRange();range.selectNodeContents(el);const selection=getSelection();selection.removeAllRanges();selection.addRange(range)})
   await trigger(source);await app.waitForURL(/\/app\/capture\/capture_/)
   const id=new URL(app.url()).pathname.split('/').pop(),view=await ok(w.owner.get('/api/v1/captures/'+id))
   assert.equal(view.title,title);assert.equal(view.excerpt,chosen);assert.equal(view.url,sourceOrigin+'/research');assert.ok(!JSON.stringify(view).includes('UNCHOSEN PRIVATE'))
   return view
  }
  const project=await ok(w.owner.post('/api/v1/projects',{name:'Installed capture campaign'}))
  let intent=await capture();await destination(app,project,w.owner)
  await expect(app.locator('[data-capture-excerpt]')).toHaveText(chosen)
  assert.equal(await app.locator('[data-capture-excerpt] script').count(),0);assert.equal(await app.evaluate(()=>globalThis.captureExecuted),undefined)
  await screens(app,'installed-capture-review')
  const review=await ok(w.owner.get('/api/v1/captures/'+intent.id))
  await app.getByRole('button',{name:'Create captured task',exact:true}).focus();await app.keyboard.press('Enter');await app.waitForURL(/\/app\/tasks\/tsk_/)
  const taskId=new URL(app.url()).pathname.split('/').pop(),task=await ok(w.owner.get('/api/v1/tasks/'+taskId))
  assert.equal(task.title,title);assert.equal(task.description,chosen);assert.equal(task.captureSources[0].sourceId,intent.sourceId);assert.equal(task.captureSources[0].url,sourceOrigin+'/research');assert.equal(task.captureSources[0].capturedBy,w.owner.id)
  assert.deepEqual(task.projects.map(p=>p.id),[project.id]);assert.equal(task.owner.id,w.owner.id)
  await expect(app.getByRole('link',{name:'Captured source page',exact:true})).toHaveAttribute('href',sourceOrigin+'/research')
  assert.equal(await app.evaluate(()=>globalThis.captureExecuted),undefined);await screens(app,'installed-capture-task')
  await w.restart()
  const replay=await ok(w.owner.post('/api/v1/captures/'+intent.id+'/confirm',{reviewToken:review.reviewToken}))
  assert.equal(replay.id,taskId);assert.equal((await ok(w.owner.get(`/api/v1/projects/${project.id}`))).counts.tasks,1)
  intent=await capture();await destination(app,project,w.owner);await app.getByRole('button',{name:'Cancel capture',exact:true}).click()
  await expect(app.getByRole('status')).toContainText('No task was created')
  assert.equal((await ok(w.owner.get(`/api/v1/projects/${project.id}`))).counts.tasks,1)
  intent=await capture();await destination(app,project,w.owner)
  await source.goto(sourceOrigin.replace('127.0.0.1','localhost')+'/different-document')
  await app.getByRole('button',{name:'Create captured task',exact:true}).click()
  await expect(app.getByRole('alert')).toContainText('Source permission changed')
  assert.equal((await ok(w.owner.get(`/api/v1/projects/${project.id}`))).counts.tasks,1)
  assert.equal((await ok(w.owner.get('/api/v1/captures/'+intent.id))).state,'pending')
  assert.deepEqual(errors,[])
 }finally{await context?.close();if(sourceServer)await new Promise(r=>sourceServer.close(r));await launched.close()}
}
if(process.argv[1]===import.meta.filename){
 const w=await startWorker()
 try{await browserCaptureJourney({w})}finally{await w.stop()}
 console.log('Installed browser capture journey passed')
}
