import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {expect} from '@playwright/test'
export async function deliveryRegisterJourney({w,browser,sizes,ok}){
 for(const [size,viewport] of sizes){
  const context=await browser.newContext({viewport});await context.addCookies(w.owner.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:w.origin})))
  const page=await context.newPage(),owner=w.owner
  const proof=async name=>{assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`delivery register ${name} reflows at ${size}`);assert.equal(await page.locator('main button,main a').evaluateAll(els=>els.filter(e=>!e.textContent.trim()&&e.querySelector('svg,img')).length),0);if(process.env.PEGBOARD_PROOF_DIR){await mkdir(process.env.PEGBOARD_PROOF_DIR,{recursive:true});await page.screenshot({path:join(process.env.PEGBOARD_PROOF_DIR,`register-${name}-${size}.png`),fullPage:true})}}
  try{
   const p=ok(await owner.post('/api/v1/projects',{name:`Austin retail launch ${size}`,description:'Original retail campaign scope'})),task=ok(await owner.post('/api/v1/tasks',{projectId:p.id,title:'Print campaign signage',startDate:'2026-11-09',dueDate:'2026-11-10'}))
   await page.goto(`${w.origin}/app/projects/${p.id}`);await proof('project');await page.getByRole('link',{name:'Delivery register',exact:true}).click();await proof('project-entry')
   const raise=async(kind,title,parent='',due='',scope='')=>{const f=page.getByRole('form',{name:'Raise delivery record'});await f.getByLabel('Record kind').selectOption(kind);await f.getByLabel('Title',{exact:true}).fill(title);await f.getByLabel('Accountable owner').selectOption(owner.id);await f.getByLabel('Impact',{exact:true}).fill('Retail launch depends on printer availability');await f.getByLabel('Next action and mitigation').fill('Reserve backup printer and confirm capacity');await f.getByLabel('Review date',{exact:true}).fill('2026-11-06');await f.getByLabel('Linked task or milestone').selectOption(task.id);await f.getByLabel('Related risk or alternative').selectOption(parent);await f.getByLabel('Proposed task due date (change requests)').fill(due);await f.getByLabel('Proposed scope (change requests)').fill(scope);await f.getByRole('button',{name:'Raise record',exact:true}).click();await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();return ok(await owner.get(`/api/v1/projects/${p.id}/register`)).records.find(r=>r.title===title)}
   const risk=await raise('risk','Printer dependency at risk');await proof('risk')
   await raise('change','Rejected rush alternative',risk.id,'2026-11-12','Rush original campaign')
   let f=page.getByRole('form',{name:'Decide Rejected rush alternative'});await f.getByLabel('Decision',{exact:true}).selectOption('reject');await f.getByLabel('Decision reason').fill('Rush cost is unacceptable');await f.getByRole('button',{name:'Record human decision'}).click();await proof('rejected')
   await raise('change','Backup printer approved',risk.id,'2026-11-13','Campaign uses backup printer')
   await proof('preview');f=page.getByRole('form',{name:'Decide Backup printer approved'});await f.getByLabel('Decision reason').fill('Approve this exact mitigation and date');await f.getByRole('button',{name:'Record human decision'}).click();await expect(page.getByText(/Campaign uses backup printer · Due 2026-11-13/)).toBeVisible();await expect(page.getByText('Original retail campaign scope',{exact:true}).first()).toBeVisible();await proof('accepted')
   await page.getByRole('link',{name:'Print campaign signage',exact:true}).first().click();await expect(page.getByRole('link',{name:'Printer dependency at risk',exact:true})).toBeVisible();await proof('linked-task')
   const portfolio=ok(await owner.post('/api/v1/portfolios',{name:`Retail portfolio ${size}`}));ok(await owner.post(`/api/v1/portfolios/${portfolio.id}/projects`,{projectId:p.id}))
   await page.goto(`${w.origin}/app/portfolios/${portfolio.id}`);f=page.getByRole('form',{name:'Publish portfolio status'});await f.getByLabel('Status summary').fill('Backup printer approved; the original baseline remains visible.');await f.getByLabel('Delivery record to cite').selectOption(risk.id);await f.getByRole('button',{name:'Publish status',exact:true}).click();await expect(page.getByRole('link',{name:'Printer dependency at risk',exact:true})).toBeVisible();await proof('portfolio-citation')
   await page.getByRole('link',{name:'Printer dependency at risk',exact:true}).click();await expect(page.getByRole('heading',{name:'Printer dependency at risk',exact:true})).toBeVisible();console.log(`Delivery register journey at ${size}px passed`)
  }finally{await context.close()}
 }
}
