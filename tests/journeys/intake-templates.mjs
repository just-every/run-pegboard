import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {join} from 'node:path'
import {expect} from '@playwright/test'
import {intakeTemplateFixture,pass} from '../scenarios/intake-templates.mjs'
export async function intakeTemplatesJourney({w,browser}){
 const f=await intakeTemplateFixture(w),item=await f.send('7120'),context=await browser.newContext({viewport:{width:1440,height:900}})
 await context.addCookies(f.owner.cookie.split('; ').map(pair=>({name:pair.slice(0,pair.indexOf('=')),value:pair.slice(pair.indexOf('=')+1),url:w.origin})))
 const page=await context.newPage()
 const proof=async name=>{
  if(!process.env.PEGBOARD_PROOF_DIR)return
  await mkdir(process.env.PEGBOARD_PROOF_DIR,{recursive:true})
  for(const [width,height]of [[1440,900],[390,844]]){await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'review fits viewport');await page.screenshot({path:join(process.env.PEGBOARD_PROOF_DIR,`intake-template-${name}-${width}.png`),fullPage:true})}
  await page.setViewportSize({width:1440,height:900})
 }
 try{
  await page.goto(w.origin+`/app/projects/${f.project.id}/settings/intake?review=${f.form.id}`)
  await expect(page.getByText('Internal task template pinned:',{exact:false})).toContainText('Creative task')
  await expect(page.getByRole('form',{name:'Publish intake form'}).getByLabel('Audience',{exact:true})).toHaveValue('internal')
  await proof('publication')
  await page.goto(w.origin+`/app/projects/${f.project.id}/intake`)
  await page.getByRole('link',{name:'Review task template'}).click()
  const preview=page.getByRole('form',{name:'Preview task template'})
  await preview.getByLabel('Template start date').fill(f.input.startDate)
  await preview.getByLabel('Owner for Lead').selectOption(f.owner.id)
  await preview.getByLabel('Owner for Designer').selectOption(f.peer.id)
  await preview.getByLabel('Template start date').focus()
  for(let step=0;step<4&&!await preview.getByLabel('Owner for Lead').evaluate(el=>el===document.activeElement);step++)await page.keyboard.press('Tab')
  await expect(preview.getByLabel('Owner for Lead')).toBeFocused()
  await preview.getByRole('button',{name:'Preview application'}).focus();await page.keyboard.press('Enter')
  await expect(page.getByRole('heading',{name:'Review exact application'})).toBeVisible()
  await expect(page.getByText(f.answers.details,{exact:true})).toBeVisible()
  await expect(page.locator('[data-template-key="draft"]')).toContainText('Template designer')
  await expect(page.locator('[data-template-key="draft"]')).toContainText('2026-01-06 to 2026-01-07')
  await expect(page.locator('[data-template-key="check"]')).toContainText('Parent: draft')
  await proof('review')
  assert.equal((await pass(f.owner.get('/api/v1/tasks/'+item.taskId))).subtasks.length,0,'review has not written work')
  const apply=page.getByRole('form',{name:'Apply reviewed task template'})
  await apply.getByRole('checkbox').focus();await page.keyboard.press('Space');await page.keyboard.press('Tab')
  await expect(apply.getByRole('button',{name:'Apply reviewed template once'})).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('heading',{name:'Request triage',exact:true})).toBeVisible()
  await proof('applied')
  const root=await pass(f.owner.get('/api/v1/tasks/'+item.taskId)),draft=await pass(f.owner.get('/api/v1/tasks/'+root.subtasks[0].id))
  assert.equal(root.title,f.answers.title);assert.equal(root.description,'Details: '+f.answers.details);assert.equal(draft.owner.id,f.peer.id);assert.equal(draft.subtasks.length,1)
  const queue=await pass(f.owner.get(`/api/v1/projects/${f.project.id}/intake`));assert.equal(queue.items[0].deadline,item.deadline)
  await pass(f.owner.patch('/api/v1/tasks/'+draft.id,{ownerId:f.owner.id}))
  await pass(f.owner.post(`/api/v1/workspaces/ws_main/people/${f.peer.id}/account`,{status:'inactive'}))
  await page.goto(w.origin+'/app/data?review=erase&type=person&id='+f.peer.id)
  const mapping=page.getByRole('list',{name:'Reviewed intake template mappings'})
  await expect(mapping).toContainText(draft.id);await expect(mapping).toContainText('clear owner mapping')
  await proof('erasure-review')
  console.log('PROBE PEG-007 browser template mapping: Settings pin, keyboard preview and explicit application -> exact retained request, nested role mappings and owner and date review at 1440, inspected at 390')
 }finally{await context.close()}
}
