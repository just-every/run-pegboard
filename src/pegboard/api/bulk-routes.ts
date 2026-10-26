import {first,notFound} from '../db'
import type {Hono} from 'hono'
import type {Bindings} from '../../auth.server'
import {door} from './door'
import {bulkPreview,applyBulk,undoBulkPreview,undoBulk,listBulk,type BulkInput} from '../recovery/bulk'
export function bulkInput(input:Record<string,any>):BulkInput {
 if(input.patch)return input as BulkInput
 const patch:BulkInput['patch']={}
 for(const key of ['ownerId','priority','startDate','dueDate'] as const)if(input[key])patch[key]=input[key]
 if(input.clearStart)patch.startDate=null
 if(input.clearDue)patch.dueDate=null
 return {taskIds:Array.isArray(input.taskIds)?input.taskIds:input.taskIds?[String(input.taskIds)]:[],patch,token:input.token}
}
const ruleOperation=async(db:D1Database,id:string)=>{const row=await first<{operation_id:string|null}>(db,'SELECT operation_id FROM peg_rule_effect_runs WHERE run_id=?',id);if(!row?.operation_id)throw notFound();return row.operation_id}
export function bulkRoutes(app:Hono<{Bindings:Bindings}>) {
 app.get('/recovery/rules/:id/undo-preview',door(async({db,actor,workspace,params})=>undoBulkPreview(db,actor,workspace,await ruleOperation(db,params.id))))
 app.post('/recovery/rules/:id/undo',door(async({db,actor,workspace,params,input})=>undoBulk(db,actor,workspace,await ruleOperation(db,params.id),input),{next:()=>'/app/recovery/bulk'}))
 app.get('/recovery/bulk',door(({db,actor,workspace})=>listBulk(db,actor,workspace)))
 app.post('/recovery/bulk/preview',door(({db,actor,workspace,input})=>bulkPreview(db,actor,workspace,bulkInput(input))))
 app.post('/recovery/bulk/apply',door(({db,actor,workspace,input})=>applyBulk(db,actor,workspace,bulkInput(input)),{next:r=>`/app/recovery/bulk?operationId=${r.id}`}))
 app.get('/recovery/bulk/:id/undo-preview',door(({db,actor,workspace,params})=>undoBulkPreview(db,actor,workspace,params.id)))
 app.post('/recovery/bulk/:id/undo',door(({db,actor,workspace,params,input})=>undoBulk(db,actor,workspace,params.id,input),{next:()=>'/app/recovery/bulk'}))
}
