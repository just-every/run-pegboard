import assert from 'node:assert/strict'
import {expect} from '@playwright/test'
export async function hierarchyConversionJourney({w,page,proof,size,ok}){
 const root=w.owner,project=ok(await root.post('/api/v1/projects',{name:`Regional launch production ${size}`}))
 const parent=ok(await root.post('/api/v1/tasks',{projectId:project.id,title:'Prepare retail rollout',estimateHours:4})),child=ok(await root.post('/api/v1/tasks',{parentId:parent.id,title:'Coordinate Brisbane signage',estimateHours:3,startDate:'2026-11-09',dueDate:'2026-11-11'}))
 const nested=ok(await root.post('/api/v1/tasks',{parentId:child.id,title:'Check storefront measurements',estimateHours:1}))
 await page.goto(`${w.origin}/app/tasks/${child.id}`);await proof('subtask-source');await page.getByRole('link',{name:'Promote to top-level work',exact:true}).click();await proof('promote-choices')
 await page.getByRole('form',{name:'Preview work conversion'}).getByRole('button',{name:'Preview conversion',exact:true}).click();await proof('promote-review')
 await page.getByRole('form',{name:'Apply reviewed conversion'}).getByRole('button',{name:'Apply reviewed conversion',exact:true}).click();await proof('promoted-result')
 assert.equal(ok(await root.get(`/api/v1/tasks/${child.id}`)).parentId,null);assert.equal(ok(await root.get(`/api/v1/tasks/${nested.id}`)).parentId,child.id)
 await page.goto(`${w.origin}/app/tasks/${child.id}`);await proof('promoted-work');await page.getByRole('link',{name:'Make a subtask',exact:true}).click()
 let form=page.getByRole('form',{name:'Preview work conversion'});await form.getByLabel('New parent work',{exact:true}).selectOption(nested.id);await form.getByRole('button',{name:'Preview conversion',exact:true}).click();await expect(page.locator('main')).toContainText('cycle');await proof('cycle-refused')
 assert.equal(ok(await root.get(`/api/v1/tasks/${child.id}`)).parentId,null)
 await page.goto(`${w.origin}/app/conversions?kind=demote&sourceId=${child.id}`);form=page.getByRole('form',{name:'Preview work conversion'});await form.getByLabel('New parent work',{exact:true}).selectOption(parent.id);await proof('demote-choices');await form.getByRole('button',{name:'Preview conversion',exact:true}).click();await proof('demote-review')
 await page.getByRole('form',{name:'Apply reviewed conversion'}).getByRole('button',{name:'Apply reviewed conversion',exact:true}).click();await proof('demoted-result')
 await page.getByRole('link',{name:'Review undo',exact:true}).click();await proof('hierarchy-undo-review');await page.getByRole('form',{name:'Undo unchanged conversion effects'}).getByRole('button',{name:'Undo unchanged structure',exact:true}).click();await proof('hierarchy-undone')
 await page.goto(`${w.origin}/app/tasks/${child.id}`);await expect(page.getByRole('link',{name:'Make a subtask',exact:true})).toBeVisible();await proof('hierarchy-restored-work')
 assert.equal(ok(await root.get(`/api/v1/tasks/${child.id}`)).parentId,null)
}
