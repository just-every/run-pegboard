import assert from 'node:assert/strict'
import {pathToFileURL} from 'node:url'
import {writeFile,mkdir} from 'node:fs/promises'
const {startWorker}=await import(pathToFileURL(process.cwd()+'/tests/support/worker.mjs'))
const {seedPortfolioCapacity,ok}=await import(pathToFileURL(process.cwd()+'/tests/scenarios/portfolio-capacity.mjs'))
const rows=[]
let browser
if(process.env.PROBE_SCREENS){const {chromium}=await import(pathToFileURL(process.cwd()+'/node_modules/@playwright/test/index.mjs'));browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});await mkdir(process.env.PROBE_SCREENS,{recursive:true})}
const w=await startWorker()
try {
 const f=await seedPortfolioCapacity(w),{owner,reviewer,alternate,designer,projects,tasks,path,input}=f
 for(const holder of [alternate,designer]){
  const deadline=await ok(owner.post('/api/v1/tasks',{projectId:projects[2].id,title:'Synthetic deadline-only commitment',ownerId:holder.id,estimateHours:2,dueDate:'2026-11-03T15:00:00Z'}))
  const comparison=await ok(reviewer.post(path+'/compare',input))
  if(browser){
   const context=await browser.newContext({viewport:{width:1440,height:900}})
   await context.addCookies(reviewer.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:w.origin})))
   const page=await context.newPage()
   await page.goto(w.origin+'/app/portfolios/'+f.portfolio.id+'/capacity?from=2026-11-02&days=2')
   const form=page.getByRole('form',{name:'Compare human scenarios'})
   for(const n of [1,2]){await form.getByLabel('Task for scenario '+n,{exact:true}).selectOption(tasks[n-1].id);await form.getByLabel('Alternate for scenario '+n,{exact:true}).selectOption(alternate.id)}
   await form.getByRole('button',{name:'Compare alternatives',exact:true}).click()
   await page.getByRole('heading',{name:'Exact human review',exact:true}).waitFor()
   for(const width of [1440,390]){await page.setViewportSize({width,height:width===1440?900:844});await page.screenshot({path:process.env.PROBE_SCREENS+'/deadline-'+(holder===alternate?'alternate':'designer')+'-review-'+width+'.png',fullPage:true})}
   await context.close()
  }
  const approval=await reviewer.post(path+'/apply',{...input,choice:0,token:comparison.token})
  const actual=await ok(owner.get('/api/v1/tasks/'+tasks[0].id))
  const view=await ok(reviewer.get(path+'?from=2026-11-02&days=2'))
  const row={holder:holder===alternate?'alternate':'designer',feasible:comparison.alternatives.map(a=>a.feasible),shortage:comparison.shortage,reasons:comparison.alternatives.map(a=>a.reasons),approvalStatus:approval.status,attributedApplications:actual.history.filter(h=>h.kind==='capacity.portfolio_applied').length,actualOwner:actual.owner.id===alternate.id?'alternate':'designer',deadline:await ok(owner.get('/api/v1/tasks/'+deadline.id)),affected:view.people.filter(p=>[alternate.id,designer.id].includes(p.id)).map(p=>({person:p.id===alternate.id?'alternate':'designer',days:p.days.map(d=>({date:d.date,hours:d.hours,availableHours:d.availableHours,unavailableHours:d.unavailableHours,overloadHours:d.overloadHours}))}))}
  row.deadline={start:row.deadline.startDate,due:row.deadline.dueDate,estimateHours:row.deadline.estimateHours}
  rows.push(row)
  if(approval.status===200){const undo=await ok(reviewer.get(path+'/'+approval.body.id+'/undo-preview'));await ok(reviewer.post(path+'/'+approval.body.id+'/undo',{token:undo.token}))}
  await ok(owner.patch('/api/v1/tasks/'+deadline.id,{status:'done'}))
 }
 console.log(JSON.stringify(rows,null,2))
 const expected=rows.map((r,i)=>({holder:r.holder,feasible:[true,true],shortage:false,approvalStatus:200,attributedApplications:i+1,actualOwner:'alternate',unavailableHours:0,overloadHours:0}))
 assert.deepEqual(rows.map(r=>({holder:r.holder,feasible:r.feasible,shortage:r.shortage,approvalStatus:r.approvalStatus,attributedApplications:r.attributedApplications,actualOwner:r.actualOwner,unavailableHours:r.affected.reduce((n,p)=>n+p.days.reduce((s,d)=>s+d.unavailableHours,0),0),overloadHours:r.affected.reduce((n,p)=>n+p.days.reduce((s,d)=>s+d.overloadHours,0),0)})),expected)
} finally {await browser?.close();await w.stop()}
