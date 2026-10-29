import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {chromium} from '@playwright/test'
let taskId,pendingId
export async function afterStep({phase,step,result,request,origin,cookie,args,tool}) {
 if(phase==='held'&&step.id==='shared-report') {
  const pending=await tool('pegboard.task.read',{taskId})
  pendingId=pending.result._meta['com.runeditrun/approval'].id
  const response=await request(new URL(`/agents/api/approvals/${pendingId}`,origin).href,{headers:{Cookie:cookie,Origin:origin}})
  assert.equal((await response.json()).approval.state,'pending')
  if(process.env.PEGBOARD_SCREENSHOTS)await capturePending({request,origin,cookie,id:pendingId,output:process.env.PEGBOARD_SCREENSHOTS})
 }
 if(step.id==='internal-create')taskId=result.id
 if(step.id==='internal-comment') {
  const response=await request(new URL(`/api/v1/tasks/${args.taskId}`,origin).href,{headers:{Origin:origin,Cookie:cookie}})
  assert.equal(response.status,200)
  const native=await response.json()
  assert.ok(native.history.some(entry=>entry.kind==='created'&&entry.actor.includes('Agent door conformance for ')))
  assert.ok(native.history.some(entry=>entry.kind==='updated'&&entry.actor.includes('Agent door conformance for ')))
  assert.ok(native.comments.some(comment=>comment.author.includes('Agent door conformance for ')))
 }
}
export default async function ({request,origin,cookie,tool}) {
 const call=async(method,path,body)=>{
  const response=await request(new URL(path,origin).href,{method,redirect:'manual',headers:{Origin:origin,Cookie:cookie,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})})
  assert.ok(response.ok)
  return response.json()
 }
 const before=await tool('pegboard.work.snapshot',{})
 const changed=await tool('pegboard.task.update',{taskId,revision:'stale-native-revision',patch:{title:'Must remain unchanged'},idempotency_key:crypto.randomUUID()})
 assert.equal(changed.result._meta['com.runeditrun/error'].code,'task_revision_changed')
 assert.deepEqual((await tool('pegboard.work.snapshot',{})).result.structuredContent,before.result.structuredContent)
 const error=await tool('pegboard.task.approve',{taskId})
 assert.equal(error.message.error.data.code,'tool_not_found')
 const preview=await call('POST','/api/v1/data/erasure-preview',{type:'task',id:taskId})
 assert.ok(preview.blockers.includes('review_agent_door_custody_before_erasure'))
 await tool('pegboard.work.snapshot',{})
 const stale=await request(new URL('/api/v1/data/erase',origin).href,{method:'POST',headers:{Origin:origin,Cookie:cookie,'content-type':'application/json'},body:JSON.stringify({type:'task',id:taskId,token:preview.token,confirm:true})})
 assert.equal(stale.status,409)
 const reviewed=await call('POST','/api/v1/data/erasure-preview',{type:'task',id:taskId})
 const retained=await call('POST','/api/v1/data/erase',{type:'task',id:taskId,token:reviewed.token,confirm:true})
 assert.equal(retained.outcome,'retained')
 assert.ok(retained.conflicts.includes('review_agent_door_custody_before_erasure'))
 const browser=await chromium.launch({...(process.env.RER_CHROMIUM_EXECUTABLE?{executablePath:process.env.RER_CHROMIUM_EXECUTABLE}:{}),args:['--no-sandbox']})
 const output=process.env.PEGBOARD_SCREENSHOTS
 try {
  if(output)await mkdir(output,{recursive:true})
  const context=await browser.newContext({viewport:{width:1440,height:1000}})
  await context.route('**/*',async route=>{
   const native=route.request(),url=new URL(native.url())
   if(url.origin!==origin)return route.abort()
   const headers={...native.headers(),Cookie:cookie,Origin:origin}
   const response=await request(url.href,{method:native.method(),headers,redirect:'manual',...(!['GET','HEAD'].includes(native.method())?{body:native.postDataBuffer()}: {})})
   const resultHeaders=Object.fromEntries(response.headers)
   for(const name of ['content-length','content-encoding','transfer-encoding'])delete resultHeaders[name]
   await route.fulfill({status:response.status,headers:resultHeaders,body:Buffer.from(await response.arrayBuffer())})
  })
  const page=await context.newPage()
  for(const [name,path] of [['agents','/agents'],['agent-task',`/app/tasks/${taskId}`],['custody','/app/data'],['expired-approval',`/agents/approvals/${pendingId}`],['unavailable-approval','/agents/approvals/nonexistent']]) {
   await page.setViewportSize({width:1440,height:1000});await page.goto(origin+path)
   if(!['unavailable-approval','custody'].includes(name))assert.ok((await page.textContent('body')).includes('for '))
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
   if(output)await page.screenshot({path:`${output}/${name}-1440.png`,fullPage:true})
   await page.setViewportSize({width:390,height:844})
   if(output)await page.screenshot({path:`${output}/${name}-390.png`,fullPage:true})
  }
  await call('POST','/agents/api/pause',{paused:true})
  await page.goto(origin+'/agents')
  assert.ok(/paused/i.test(await page.textContent('body')))
  if(output)for(const width of [1440,390]){await page.setViewportSize({width,height:width===1440?1000:844});await page.screenshot({path:`${output}/agents-paused-${width}.png`,fullPage:true})}
  await call('POST','/agents/api/pause',{paused:false})
  await context.close()
 }finally{await browser.close()}
}

async function capturePending({request,origin,cookie,id,output}) {
 await mkdir(output,{recursive:true})
 const browser=await chromium.launch({...(process.env.RER_CHROMIUM_EXECUTABLE?{executablePath:process.env.RER_CHROMIUM_EXECUTABLE}:{}),args:['--no-sandbox']})
 try {
  const context=await browser.newContext({viewport:{width:1440,height:1000}})
  await context.route('**/*',async route=>{
   const r=route.request(),url=new URL(r.url());if(url.origin!==origin)return route.abort()
   const response=await request(url.href,{method:r.method(),redirect:'manual',headers:{...r.headers(),Cookie:cookie,Origin:origin}})
   const headers=Object.fromEntries(response.headers);for(const name of ['content-length','content-encoding','transfer-encoding'])delete headers[name]
   await route.fulfill({status:response.status,headers,body:Buffer.from(await response.arrayBuffer())})
  })
  const page=await context.newPage();await page.goto(`${origin}/agents/approvals/${id}`)
  assert.ok(/approve/i.test(await page.textContent('body')))
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
  await page.screenshot({path:`${output}/pending-approval-1440.png`,fullPage:true})
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${output}/pending-approval-390.png`,fullPage:true})
  await context.close()
 }finally{await browser.close()}
}
