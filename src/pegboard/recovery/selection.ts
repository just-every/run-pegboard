import {all,bound,conflict,first,invalid,newId,notFound,now,PegError} from '../db'
import {digest,guarded,revision} from '../decisions/revision'
import {bulkPreview,parseBulk,prepareBulkEffects,type BulkInput} from './bulk'
import {viewTask} from '../tasks/view'
import {workspaceRole,type Actor} from '../workspace/people'
export interface SelectionInput extends BulkInput {reviewRows?:unknown}
export interface SelectionRow {id:string;title?:string;outcome:'ready'|'unchanged'|'stale'|'forbidden'|'unavailable'|'blocked';reason?:string;reviewToken?:string;effects:Awaited<ReturnType<typeof bulkPreview>>['tasks'][number]['effects'];reopensApproval?:boolean}
function reviews(value:unknown):Map<string,string>|null {
 if(value===undefined||value==='')return null
 let rows:unknown=value
 if(typeof value==='string')try{rows=JSON.parse(value)}catch{throw invalid('bulk_rows')}
 if(!Array.isArray(rows)||rows.length>50||rows.some(row=>!row||typeof row.id!=='string'||typeof row.token!=='string'))throw invalid('bulk_rows')
 return new Map(rows.map(row=>[row.id,row.token]))
}
export async function selectionPreview(db:D1Database,actor:Actor,workspace:string,input:SelectionInput){
 const rev=await revision(db),role=await workspaceRole(db,actor.id,workspace)
 if(!role||role==='agent')throw notFound()
 const parsed=parseBulk(input),reviewed=reviews(input.reviewRows),rows:SelectionRow[]=[],plans:Awaited<ReturnType<typeof bulkPreview>>[]=[]
 for(const id of parsed.taskIds){
  try{
   const visible=await viewTask(db,actor,id)
   // A readable task in a different workspace is as unavailable as an unknown identifier.
   if(!await first(db,'SELECT 1 FROM peg_tasks WHERE id=? AND workspace_id=?',id,workspace))throw notFound()
   let plan:Awaited<ReturnType<typeof bulkPreview>>
   try{plan=await bulkPreview(db,actor,workspace,{taskIds:[id],patch:input.patch})}
   catch(error){if(error instanceof PegError&&[400,403,409].includes(error.status)){rows.push({id,title:visible.title,outcome:error.status===403?'forbidden':'blocked',reason:error.status===403?'Editing is not permitted':error.code,effects:[]});continue}throw error}
   const token=await digest(['bulk.selection.row',workspace,actor.id,visible,plan.tasks,plan.conflicts])
   const outcome=reviewed&&reviewed.get(id)!==token?'stale':plan.conflicts.length?'blocked':plan.canApply?'ready':'unchanged'
   const row:SelectionRow={id,title:visible.title,outcome,reviewToken:token,effects:plan.tasks[0].effects,reopensApproval:plan.tasks[0].reopensApproval,reason:outcome==='stale'?'Changed since selection; select again to include':plan.conflicts[0]?.reason}
   rows.push(row);if(outcome==='ready')plans.push(plan)
  }catch(error){if(error instanceof PegError&&[403,404].includes(error.status))rows.push({id,outcome:'unavailable',reason:'Unavailable or not permitted',effects:[]});else throw error}
 }
 const reviewRows=reviewed?[...reviewed].map(([id,token])=>({id,token})):rows.filter(row=>row.reviewToken).map(row=>({id:row.id,token:row.reviewToken!}))
 const plan={rows,reviewRows,canApply:plans.length>0,ready:plans.length}
 return {...plan,rev,plans,token:await digest(['bulk.selection',workspace,actor.id,rev,plan])}
}
export async function applySelection(db:D1Database,actor:Actor,workspace:string,input:SelectionInput){
 const preview=await selectionPreview(db,actor,workspace,input)
 if(preview.token!==input.token)throw new PegError(409,'bulk_review_changed',{rows:preview.rows})
 if(!preview.canApply)throw conflict('bulk_no_applicable_effects')
 const combined={...preview.plans[0],tasks:preview.plans.flatMap(plan=>plan.tasks)}
 const prepared=await prepareBulkEffects(db,actor,workspace,combined),id=newId('selection')
 const outcomes=preview.rows.map(row=>({id:row.id,outcome:row.outcome==='ready'?'applied':row.outcome,reason:row.reason}))
 await guarded(db,preview.rev,[...prepared.statements,bound(db,'INSERT INTO peg_bulk_selection_receipts VALUES(?,?,?,?,?,?)',[id,workspace,actor.id,prepared.result.id,JSON.stringify(outcomes),now()])])
 return {id,operationId:prepared.result.id,outcomes}
}
export async function selectionReceipt(db:D1Database,actor:Actor,workspace:string,id:string){
 if(!await workspaceRole(db,actor.id,workspace))throw notFound()
 const receipt=await first<{operation_id:string;outcomes:string}>(db,'SELECT * FROM peg_bulk_selection_receipts WHERE id=? AND workspace_id=? AND actor_id=?',id,workspace,actor.id)
 if(!receipt)throw notFound()
 const rows=[]
 for(const row of JSON.parse(receipt.outcomes) as {id:string;outcome:string;reason?:string}[])try{rows.push({...row,title:(await viewTask(db,actor,row.id)).title})}catch(error){if(error instanceof PegError&&[403,404].includes(error.status))rows.push({id:row.id,outcome:'unavailable',reason:'Unavailable or not permitted'});else throw error}
 return {id,operationId:receipt.operation_id,rows}
}
