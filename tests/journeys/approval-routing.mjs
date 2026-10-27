import assert from 'node:assert/strict'
import {expect} from '@playwright/test'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {proofDocument} from '../support/worker.mjs'

export async function approvalRoutingJourney({w,browser,owner,cookies}){
 const ok=async p=>{const r=await p;assert.equal(r.status,200,JSON.stringify(r.body));return r.body}
 const author=await w.person('synthetic-pegboard-7301@example.com','Creative author'),client=await w.person('synthetic-pegboard-7302@example.com','Client reviewer','guest'),delegate=await w.person('synthetic-pegboard-7303@example.com','Client delegate','guest')
 const project=await ok(owner.post('/api/v1/projects',{name:'Campaign proof reviews'}))
 await ok(owner.post('/api/v1/grants',{objectType:'project',objectId:project.id,granteeId:author.id,level:'editor'}))
 const context=await browser.newContext({viewport:{width:1440,height:900}});await context.addCookies(cookies(owner));const page=await context.newPage()
 const guestContext=await browser.newContext({viewport:{width:1440,height:900}});await guestContext.addCookies(cookies(client));const guestPage=await guestContext.newPage()
 const capture=async(kind,state,role,p)=>{
 for(const width of [1440,390]){
 await p.setViewportSize({width,height:900})
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${kind} ${state} ${role} reflows at ${width}`)
 if(process.env.PEGBOARD_PROOF_DIR){await mkdir(process.env.PEGBOARD_PROOF_DIR,{recursive:true});await p.screenshot({path:join(process.env.PEGBOARD_PROOF_DIR,`routing-${kind}-${state}-${role}-${width}.png`),fullPage:true})}
 }
 await p.setViewportSize({width:1440,height:900})
 }
 const proofs=[]
 try{
 for(const kind of ['task','proof']){
 const title=kind==='task'?'Campaign approval':'Creative proof',description=kind==='task'?'Review the campaign launch brief and confirm the client deliverables are ready.':'Review the creative proof PDF.'
 const task=await ok(owner.post('/api/v1/tasks',{projectId:project.id,title,description,ownerId:author.id,...(kind==='task'?{kind:'approval'}:{})}))
 for(const p of [client,delegate])await ok(owner.post('/api/v1/grants',{objectType:'task',objectId:task.id,granteeId:p.id,level:'viewer',scope:'approve'}))
 let subject=task.id
 if(kind==='proof'){
 const file=await ok(owner.post(`/api/v1/tasks/${task.id}/attachments?name=synthetic-pegboard-7304.pdf`,proofDocument('Reviewed PDF v1'),{'content-type':'application/pdf'}))
 await page.goto(`${w.origin}/app/tasks/${task.id}`);await page.getByRole('link',{name:'Proof reviews',exact:true}).click();await page.getByRole('button',{name:'Create proof',exact:true}).click();await page.waitForURL(`${w.origin}/app/proofs/${task.id}`);const listed=await ok(owner.get(`/api/v1/tasks/${task.id}/proofs`));subject=listed.proofs[0].proof.id
 const nextFile=await ok(owner.post(`/api/v1/tasks/${task.id}/attachments?name=synthetic-pegboard-7305.pdf`,proofDocument('Reviewed PDF v2'),{'content-type':'application/pdf'}));await page.reload();await page.getByLabel('Replacement file',{exact:true}).selectOption(nextFile.id);await page.getByRole('button',{name:'Add reviewed version',exact:true}).click()
 await page.getByRole('link',{name:'Route proof for review'}).click()
 }else{await page.goto(`${w.origin}/app/tasks/${task.id}`);await page.getByRole('link',{name:'Approval routing',exact:true}).click()}
 const form=page.getByRole('form',{name:'Review routing plan'})
 await form.getByLabel('Stage order',{exact:true}).selectOption('parallel')
 await form.getByLabel('Due (UTC)',{exact:true}).fill('2030-01-03T12:00')
 await form.getByLabel('Stage 1 name',{exact:true}).fill('Client sign-off')
 await form.getByLabel('Reviewers for stage 1',{exact:true}).selectOption([client.id,delegate.id])
 await form.getByLabel('Stage 1 required approvals',{exact:true}).fill('2')
 await form.getByRole('button',{name:'Preview routing',exact:true}).click()
 await expect(page.getByRole('heading',{name:'Confirm reviewed routing'})).toBeVisible()
 await capture(kind,'preview','manager',page)
 await page.getByRole('button',{name:'Apply reviewed routing',exact:true}).click();await page.waitForURL(/\/app\/approvals\/route_/)
 const routeId=page.url().split('/').pop();proofs.push({kind,routeId,taskId:task.id})
 await expect(page.getByRole('status')).toHaveText('pending')
 await expect(page.locator('main')).toContainText('Due Jan 3, 2030, 12:00 PM UTC')
 assert.equal((await guestPage.goto(`${w.origin}/app/approvals/${routeId}`)).status(),404,'unshared guest cannot open a direct review route')
 const share=page.getByRole('form',{name:'Share reviewed proof'});await share.getByLabel('Reviewer',{exact:true}).selectOption(client.id);await share.getByLabel('Link expires (UTC)',{exact:true}).fill(new Date(Date.now()+86400000).toISOString().slice(0,16));await share.getByRole('button',{name:'Share reviewed version',exact:true}).click()
 const view=await ok(owner.get('/api/v1/approvals/'+routeId)),link=view.links[0]
 const reviewedTask=async p=>{
 const material=p.locator('article').filter({has:p.getByRole('heading',{name:'Reviewed material',exact:true})})
 await expect(material.getByRole('link',{name:title,exact:true})).toHaveAttribute('href',`/app/tasks/${task.id}`)
 await expect(material.getByText(description,{exact:true})).toBeVisible()
 await expect(material.getByText('Reviewed task revision',{exact:false})).toBeVisible()
 await expect(material.locator('code')).toBeVisible()
 await expect(material.locator('code')).toHaveText(view.version)
 }
 await guestPage.goto(`${w.origin}/app/proof-reviews/${link.id}`)
 await expect(guestPage.getByRole('status')).toHaveText('pending');await expect(guestPage.getByRole('button',{name:'Delegate review'})).toHaveCount(0)
 if(kind==='task'){await reviewedTask(page);await reviewedTask(guestPage)}
 await capture(kind,'pending','manager',page);await capture(kind,'pending','recipient',guestPage)
 if(kind==='proof'){const download=guestPage.waitForEvent('download');await guestPage.getByRole('link',{name:'Download reviewed proof'}).click();assert.ok(await (await download).path())}
 const decision=guestPage.getByRole('form',{name:'Decide routed approval'});await decision.getByLabel('Decision reason',{exact:true}).fill('Reviewed campaign material');await decision.getByRole('button',{name:'Record reviewed decision',exact:true}).click();await expect(guestPage.getByRole('status')).toHaveText('pending')
 assert.equal((await ok(owner.get('/api/v1/approvals/'+routeId))).stages[0].approved,1)
 await page.reload();const delegation=page.getByRole('form',{name:'Delegate reviewer'});await delegation.getByLabel('Current reviewer',{exact:true}).selectOption(delegate.id);await delegation.getByLabel('Delegate',{exact:true}).selectOption(owner.id);await delegation.getByRole('button',{name:'Delegate review',exact:true}).click()
 const ownDecision=page.getByRole('form',{name:'Decide routed approval'});await ownDecision.getByLabel('Decision reason',{exact:true}).fill('Independent second review');await ownDecision.getByRole('button',{name:'Record reviewed decision',exact:true}).click();await expect(page.getByRole('status')).toHaveText('approved')
 if(kind==='task')assert.equal((await ok(owner.get('/api/v1/tasks/'+task.id))).status,'done')
 for(const width of [1440,390]){
 await page.setViewportSize({width,height:900});await guestPage.setViewportSize({width,height:900});await page.goto(`${w.origin}/app/approvals/${routeId}`);await guestPage.goto(`${w.origin}/app/proof-reviews/${link.id}`)
 for(const [name,p] of [['manager',page],['recipient',guestPage]]){
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${kind} ${name} reflows at ${width}`)
 if(kind==='task'){
 await reviewedTask(p)
 const reviewUrl=p.url()
 await p.getByRole('link',{name:title,exact:true}).click()
 await p.waitForURL(`${w.origin}/app/tasks/${task.id}`)
 await expect(p.getByRole('heading',{name:title,exact:true})).toBeVisible()
 await p.goto(reviewUrl)
 }
 if(process.env.PEGBOARD_PROOF_DIR){await mkdir(process.env.PEGBOARD_PROOF_DIR,{recursive:true});await p.screenshot({path:join(process.env.PEGBOARD_PROOF_DIR,`routing-${kind}-${name}-${width}.png`),fullPage:true})}
 }
 }
 await page.setViewportSize({width:1440,height:900});await guestPage.setViewportSize({width:1440,height:900})
 }
 console.log('Named proof and task routing, guest decisions, quorum and delegation passed at 1440; screens captured at 1440 and 390')
 }finally{await context.close();await guestContext.close()}
}
