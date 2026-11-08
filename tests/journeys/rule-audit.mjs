import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { expect } from '@playwright/test'
import { pass, path, audit, request } from '../scenarios/rule-audit.mjs'

export async function ruleAuditJourney({w,browser}){
 const root=w.owner,project=await pass(root.post('/api/v1/projects',{name:'synthetic-pegboard-5721'}))
 const context=await browser.newContext({viewport:{width:1440,height:900}})
 await context.addCookies(root.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:w.origin})))
 const page=await context.newPage()
 const proof=async name=>{
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'audit has no page overflow at 1440')
  const icons=await page.locator('main button,main a,header a').evaluateAll(nodes=>nodes.filter(e=>!e.textContent.trim()&&e.querySelector('svg,img')&&!e.getAttribute('aria-describedby')).map(e=>e.outerHTML))
  assert.deepEqual(icons,[],'audit icon controls expose a tooltip')
  if(!process.env.PEGBOARD_PROOF_DIR)return
  await mkdir(process.env.PEGBOARD_PROOF_DIR,{recursive:true})
  for(const [width,height] of [[1440,900],[390,844]]){
   await page.setViewportSize({width,height})
   await page.screenshot({path:join(process.env.PEGBOARD_PROOF_DIR,`rule-audit-${name}-${width}.png`),fullPage:true})
  }
  await page.setViewportSize({width:1440,height:900})
 }
 try{
  await page.goto(`${w.origin}/app/projects/${project.id}/settings`)
  await page.getByRole('link',{name:'Conditional work rules',exact:true}).click()
  let form=page.getByRole('form',{name:'Create work rule'})
  await form.getByLabel('Rule name',{exact:true}).fill('synthetic-pegboard-5722')
  await form.getByLabel('Trigger',{exact:true}).selectOption('form')
  await form.getByLabel('Due date source',{exact:true}).selectOption('task_start')
  await form.getByLabel('Date offset (negative moves earlier)',{exact:true}).fill('2')
  await form.getByRole('button',{name:'Save rule draft',exact:true}).click()
  let view=await pass(root.get(path(project.id))),rule=view.rules[0]
  form=page.getByRole('form',{name:'Preview synthetic-pegboard-5722'})
  await form.getByRole('button',{name:'Preview activation',exact:true}).click()
  await page.getByRole('form',{name:'Activate work rule'}).getByRole('button',{name:'Activate reviewed version',exact:true}).click()
  const applied=await request(root,project.id,5723),noop=await request(root,project.id,5724,{startDate:null})
  await page.goto(`${w.origin}/app/projects/${project.id}/rules`)
  await expect(page.locator('main')).toContainText('Computed due 2026-07-04')
  await proof('runs')
  await page.getByText('Edit rule definition',{exact:true}).click()
  form=page.getByRole('form',{name:'Edit synthetic-pegboard-5722'});await form.getByLabel('Rule name',{exact:true}).fill('synthetic-pegboard-5727');await form.getByRole('button',{name:'Save new version',exact:true}).click()
  form=page.getByRole('form',{name:'Preview synthetic-pegboard-5727'});await form.getByRole('button',{name:'Preview activation',exact:true}).click()
  await page.getByRole('form',{name:'Activate work rule'}).getByRole('button',{name:'Activate reviewed version',exact:true}).click()
  await page.getByRole('form',{name:'Deactivate synthetic-pegboard-5727'}).getByRole('button',{name:'Deactivate rule',exact:true}).click()
  await request(root,project.id,5725)
  await page.goto(`${w.origin}/app/audit`)
  form=page.getByRole('form',{name:'Search audit'})
  await form.getByLabel('Rule ID',{exact:true}).fill(rule.id)
  await form.getByRole('button',{name:'Search audit',exact:true}).focus();await page.keyboard.press('Enter')
  let events=await audit(root,rule.id)
  assert.deepEqual(events.map(e=>e.action),['rule.created','rule.activated','rule.run_queued','rule.run_applied','rule.run_queued','rule.run_noop','rule.edited','rule.activated','rule.deactivated','rule.run_blocked'])
  const list=page.getByRole('list',{name:'Permanent audit events'})
  await expect(list.getByRole('listitem')).toHaveCount(events.length)
  await expect(list).toContainText('source date missing');await expect(list).toContainText('inactive')
  await expect(list).not.toContainText('synthetic-pegboard-5722');await expect(list).not.toContainText('synthetic-pegboard-5727');await expect(list).toContainText('Previous activation:')
  await proof('lifecycle')
  view=await pass(root.get(path(project.id)));const run=view.runs.find(r=>r.task_id===applied.id)
  await form.getByLabel('Run ID',{exact:true}).fill(run.id)
  await form.getByRole('button',{name:'Search audit',exact:true}).focus();await page.keyboard.press('Enter')
  await expect(list.getByRole('listitem')).toHaveCount(2)
  await expect(list).toContainText(run.activation_id);await expect(list).toContainText(run.operation_id);await expect(list).toContainText(run.event_id);await expect(list).toContainText(applied.id)
  await expect(list).not.toContainText('rule.run_noop')
  const link=page.getByRole('link',{name:'Export this page as JSON',exact:true})
  await link.focus();await expect(link).toBeFocused()
  const exported=await page.request.get(new URL(await link.getAttribute('href'),w.origin).href)
  assert.equal(exported.status(),200)
  const exportedEvents=(await exported.json()).events
  assert.deepEqual(exportedEvents,events.filter(e=>e.metadata.runId===run.id))
  assert.deepEqual(exportedEvents.map(e=>e.metadata.eventId),[run.event_id,run.event_id])
  await proof('filtered')
  await form.getByLabel('Run ID',{exact:true}).fill('')
  await form.getByLabel('Activation ID',{exact:true}).fill(run.activation_id)
  await form.getByLabel('Operation ID',{exact:true}).fill(run.operation_id)
  await form.getByLabel('Triggering event ID',{exact:true}).fill(run.event_id)
  await form.getByRole('button',{name:'Search audit',exact:true}).focus();await page.keyboard.press('Enter')
  await expect(list.getByRole('listitem')).toHaveCount(1);await expect(list).toContainText('rule.run_applied')
  const exact=await page.request.get(new URL(await page.getByRole('link',{name:'Export this page as JSON',exact:true}).getAttribute('href'),w.origin).href)
  assert.equal(exact.status(),200);assert.deepEqual((await exact.json()).events,exportedEvents.filter(e=>e.metadata.operationId===run.operation_id))
  await proof('operation')
  assert.equal((await pass(root.get(`/api/v1/tasks/${noop.id}`))).dueDate,null)
  const template=await pass(root.post('/api/v1/templates',{name:'synthetic-pegboard-5960',definition:{kind:'task',roles:['Producer'],phases:['Production'],fields:[],tasks:[{key:'produce',title:'synthetic-pegboard-5961',role:'Producer',phase:'Production',start:0,due:1,hours:1}],dependencies:[],rules:[]}}))
  const templateRule=await pass(root.post(`/api/v1/projects/${project.id}/template-rules`,{name:'synthetic-pegboard-5962',workName:'synthetic-pegboard-5963',templateId:template.id,templateVersion:1,roles:{Producer:root.id},dateSource:'task_start',offsetDays:0}))
  const reviewed=await pass(root.post(`/api/v1/template-rules/${templateRule.id}/preview`,{sampleSourceDate:'2026-07-02'}))
  await pass(root.post(`/api/v1/template-rules/${templateRule.id}/activate`,{sampleSourceDate:'2026-07-02',token:reviewed.token}))
  await pass(root.post('/api/v1/tasks',{projectId:project.id,title:'synthetic-pegboard-5964',startDate:'2026-07-02'}))
  const show=async(id,prefix,name)=>{
   await page.goto(`${w.origin}/app/audit`)
   const search=page.getByRole('form',{name:'Search audit'})
   await search.getByLabel('Rule ID',{exact:true}).fill(id);await search.getByRole('button',{name:'Search audit',exact:true}).focus();await page.keyboard.press('Enter')
   const receipts=page.getByRole('list',{name:'Permanent audit events'}),actual=await audit(root,id)
   assert.deepEqual(actual.map(e=>e.action),[prefix+'.created',prefix+'.activated',prefix+'.run_queued',prefix+'.run_applied'])
   await expect(receipts.getByRole('listitem')).toHaveCount(4);await expect(receipts).toContainText(prefix+'.run_applied');await expect(receipts).not.toContainText('synthetic-pegboard-5961');await expect(receipts).not.toContainText('synthetic-pegboard-5967')
   await proof(name)
  }
  await show(templateRule.id,'template_rule','template-receipts')
  const bundle=await pass(root.post('/api/v1/workflow-bundles',{name:'synthetic-pegboard-5965'})),base=`/api/v1/workflow-bundles/${bundle.id}`
  await pass(root.post(base+'/versions',{version:1,key:'synthetic-pegboard-5966',kind:'rule',name:'synthetic-pegboard-5967',priority:'high'}))
  const preview=await pass(root.post(base+'/preview',{projectIds:[project.id]}))
  await pass(root.post(base+'/adopt',{projectIds:[project.id],keys:['synthetic-pegboard-5966'],revision:preview.token}))
  await pass(root.post('/api/v1/tasks',{projectId:project.id,title:'synthetic-pegboard-5968'}));await pass(root.post(base+'/jobs/process',{}))
  const created=(await pass(root.get('/api/v1/admin/audit?action=bundle_rule.created&limit=500'))).events.find(e=>e.metadata.bundleId===bundle.id)
  await show(created.metadata.ruleId,'bundle_rule','bundle-receipts')
  const member=await w.person(['synthetic-pegboard-5726','example.com'].join('@'),'synthetic-pegboard-5726')
  const denied=await browser.newContext({viewport:{width:1440,height:900}})
  try{
   await denied.addCookies(member.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:w.origin})))
   const screen=await denied.newPage(),response=await screen.goto(`${w.origin}/app/audit?rule=${rule.id}`)
   assert.equal(response.status(),403);assert.ok(!(await screen.content()).includes(rule.id));assert.equal((await member.get(`/api/v1/admin/audit/export?rule=${rule.id}`)).status,403)
  }finally{await denied.close()}
 }finally{await context.close()}
}
