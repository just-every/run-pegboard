import { all, bound, conflict, first, forbidden, invalid, newId, notFound, now, PegError, type Param } from '../db'
import { rootOf, taskAccess } from '../authorization/effective'
import { digest, guarded, revision } from '../decisions/revision'
import { permanentEvent } from '../audit/search'
import { historyStatement, reopenGuard } from '../tasks/history'
import type { TaskRow } from '../model'
import { workspaceRole, type Actor } from '../workspace/people'

const fields = {ownerId:'owner_id',startDate:'start_date',dueDate:'due_date',priority:'priority'} as const
type Field = typeof fields[keyof typeof fields]
type Value = string | null
export interface BulkInput {taskIds:string[];patch:{ownerId?:string;startDate?:string|null;dueDate?:string|null;priority?:string};token?:unknown}
interface Effect {taskId:string;field:Field;before:Value;after:Value}
interface Operation {id:string;workspace_id:string;actor_id:string;applied_at:number;task_count:number}
interface EffectRow {id:string;operation_id:string;task_id:string;field:Field;before_value:string;after_value:string;history_id:number;task_decisions:number;proof_decisions:number}
interface UndoConflict {taskId:string;field:Field;reason:string}

async function human(db:D1Database,actor:Actor,workspace:string) {
 const role=await workspaceRole(db,actor.id,workspace)
 if(!role||role==='agent')throw forbidden('human_bulk_edit')
}
async function subject(db:D1Database,actor:Actor,workspace:string,id:string,write=true) {
 const task=await first<TaskRow>(db,'SELECT * FROM peg_tasks WHERE id=? AND workspace_id=?',id,workspace)
 if(!task||await first(db,"SELECT 1 FROM peg_data_erased_objects WHERE object_type='task' AND object_id=?",id))throw notFound()
 const access=await taskAccess(db,actor,task)
 if(!access.capabilities.has('read'))throw notFound()
 if(write){
  if(!access.capabilities.has('edit')||access.role==='agent')throw forbidden('bulk_edit')
  const homes=await all<{project_id:string}>(db,'SELECT project_id FROM peg_task_projects WHERE task_id=?',(await rootOf(db,task)).id)
  if(homes.some(home=>!access.contexts.get(home.project_id)?.capabilities.has('edit')))throw forbidden('bulk_shared_edit')
 }
 return {task,access}
}
function parse(input:BulkInput) {
 if(!input||!Array.isArray(input.taskIds)||!input.taskIds.length||input.taskIds.length>50||input.taskIds.some(id=>typeof id!=='string'||!id||id.length>100))throw invalid('bulk_tasks')
 if(!input.patch||typeof input.patch!=='object'||Array.isArray(input.patch)||Object.keys(input.patch).some(key=>!Object.prototype.hasOwnProperty.call(fields,key)))throw invalid('bulk_patch')
 const patch:Partial<Record<Field,Value>>={}
 for(const key of Object.keys(fields) as (keyof typeof fields)[]){
  const value=input.patch[key]
  if(value===undefined)continue
  if(key==='ownerId'){
   if(typeof value!=='string'||!value||value.length>100)throw invalid('bulk_owner')
   patch.owner_id=value
  }else if(key==='priority'){
   if(typeof value!=='string'||!['low','normal','high','urgent'].includes(value))throw invalid('bulk_priority')
   patch.priority=value
  }else{
   if(value!==null&&(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z)?$/.test(value)||Number.isNaN(Date.parse(value))||new Date(value.length===10?value+'T00:00:00Z':value).toISOString().slice(0,10)!==value.slice(0,10)))throw invalid('bulk_date')
   patch[fields[key]]=value
  }
 }
 if(!Object.keys(patch).length)throw invalid('bulk_patch')
 return {taskIds:[...new Set(input.taskIds)].sort(),patch}
}
async function replacement(db:D1Database,actor:Actor,task:TaskRow,owner:string) {
 if(owner===task.owner_id)return
 const current=await taskAccess(db,actor,task)
 if(current.personal)throw conflict('personal_task_owner')
 // Check existing access before assignment can make an assignee-only grant reach this task.
 const role=await workspaceRole(db,owner,task.workspace_id)
 if(!role||role==='agent')throw invalid('bulk_owner')
 const next=await taskAccess(db,{...actor,id:owner},task)
 if(!next.capabilities.has('read')||!next.capabilities.has('edit'))throw forbidden('bulk_owner_existing_access')
}
async function counts(db:D1Database,id:string) {
 return (await first<{task_decisions:number;proof_decisions:number}>(db,`SELECT
 (SELECT COUNT(*) FROM peg_task_decisions WHERE task_id=?) task_decisions,
 (SELECT COUNT(*) FROM peg_proof_decisions d JOIN peg_proofs p ON p.id=d.proof_id WHERE p.task_id=?) proof_decisions`,id,id))!
}
const dependency=(db:D1Database,id:string)=>first(db,'SELECT 1 FROM peg_dependencies WHERE predecessor_id=? OR successor_id=? LIMIT 1',id,id)

export async function bulkPreview(db:D1Database,actor:Actor,workspace:string,input:BulkInput) {
 const rev=await revision(db)
 await human(db,actor,workspace)
 const {taskIds,patch}=parse(input),tasks: {id:string;title:string;effects:Effect[];reopensApproval:boolean}[]=[],conflicts:UndoConflict[]=[]
 for(const id of taskIds){
  const {task}=await subject(db,actor,workspace,id)
  if(patch.owner_id!==undefined)await replacement(db,actor,task,patch.owner_id!)
  const effects=(Object.entries(patch) as [Field,Value][]).filter(([field,value])=>task[field]!==value).map(([field,after])=>({taskId:id,field,before:task[field],after}))
  if(effects.some(effect=>effect.field==='start_date'||effect.field==='due_date')&&await dependency(db,id))conflicts.push({taskId:id,field:effects.find(effect=>effect.field==='start_date'||effect.field==='due_date')!.field,reason:'dependency_cascade_requires_review'})
  const start=patch.start_date===undefined?task.start_date:patch.start_date,due=patch.due_date===undefined?task.due_date:patch.due_date
  if(start&&due&&Date.parse(start)>Date.parse(due))throw invalid('bulk_date_order')
  const reopensApproval=!!effects.length&&task.status==='done'&&!!await first(db,'SELECT 1 FROM peg_approval_tasks WHERE task_id=?',id)
  tasks.push({id,title:task.title,effects,reopensApproval})
 }
 const plan={tasks,conflicts,canApply:conflicts.length===0&&tasks.some(task=>task.effects.length>0)}
 return {...plan,rev,token:await digest(['bulk',workspace,actor.id,rev,plan])}
}

function edit(db:D1Database,actor:Actor,taskId:string,effects:Effect[],at:number,reopen:boolean,kind:string,operationId:string) {
 const assignments=effects.map(effect=>`${effect.field}=?`),args:Param[]=effects.map(effect=>effect.after)
 if(reopen)assignments.push("status='todo'",'completed_at=NULL')
 return [reopenGuard(db,taskId,actor.id,kind),bound(db,`UPDATE peg_tasks SET ${assignments.join(',')},updated_at=? WHERE id=?`,[...args,at,taskId]),
  historyStatement(db,taskId,null,actor.id,kind,{...Object.fromEntries(effects.map(effect=>[effect.field,{from:effect.before,to:effect.after}])),operationId})]
}
export async function applyBulk(db:D1Database,actor:Actor,workspace:string,input:BulkInput) {
 const preview=await bulkPreview(db,actor,workspace,input)
 if(input.token!==preview.token)throw conflict('bulk_review_changed')
 if(!preview.canApply)throw conflict('bulk_no_applicable_effects')
 const id=newId('bulk'),at=now(),changed=preview.tasks.filter(task=>task.effects.length),statements=[bound(db,'INSERT INTO peg_bulk_operations VALUES(?,?,?,?,?)',[id,workspace,actor.id,at,changed.length])]
 for(const task of changed){
  const decisions=await counts(db,task.id)
  statements.push(...edit(db,actor,task.id,task.effects,at,task.reopensApproval,'bulk.applied',id))
  for(const effect of task.effects)statements.push(bound(db,`INSERT INTO peg_bulk_effects VALUES(?,?,?,?,?,?,(SELECT COALESCE(MAX(id),0) FROM peg_history WHERE task_id=?),?,?)`,[newId('effect'),id,task.id,effect.field,JSON.stringify(effect.before),JSON.stringify(effect.after),task.id,decisions.task_decisions,decisions.proof_decisions]))
  const {access}=await subject(db,actor,workspace,task.id)
  statements.push(permanentEvent(db,{workspace:access.personal?null:workspace,actor:actor.id,action:'bulk.applied',type:'task',id:task.id,metadata:{id,count:task.effects.length}}))
 }
 await guarded(db,preview.rev,statements)
 return {id,operationId:id,at,tasks:changed.length,effects:changed.reduce((sum,task)=>sum+task.effects.length,0)}
}

async function operation(db:D1Database,actor:Actor,workspace:string,id:string,write:boolean) {
 await human(db,actor,workspace)
 const op=await first<Operation>(db,'SELECT * FROM peg_bulk_operations WHERE id=? AND workspace_id=?',id,workspace)
 if(!op)throw notFound()
 const effects=await all<EffectRow>(db,'SELECT * FROM peg_bulk_effects WHERE operation_id=? ORDER BY task_id,field',id)
 const taskIds=[...new Set(effects.map(effect=>effect.task_id))]
 // Erased effects never leave an apparently complete restorable operation behind.
 if(taskIds.length!==op.task_count)throw notFound()
 const tasks=new Map<string,TaskRow>()
 for(const taskId of taskIds)tasks.set(taskId,(await subject(db,actor,workspace,taskId,write)).task)
 return {op,effects,tasks}
}
export async function undoBulkPreview(db:D1Database,actor:Actor,workspace:string,id:string) {
 const rev=await revision(db),{op,effects,tasks}=await operation(db,actor,workspace,id,true)
 if(await first(db,'SELECT 1 FROM peg_bulk_undos WHERE operation_id=?',id))throw conflict('bulk_already_undone')
 const restored:Effect[]=[],conflicts:UndoConflict[]=[]
 for(const task of tasks.values()){
  const current=await counts(db,task.id),history=await all<{id:number;detail:string}>(db,'SELECT id,detail FROM peg_history WHERE task_id=? ORDER BY id',task.id)
  for(const effect of effects.filter(effect=>effect.task_id===task.id)){
   const before=JSON.parse(effect.before_value) as Value,after=JSON.parse(effect.after_value) as Value
   let reason:string|null=null
   if(current.task_decisions!==effect.task_decisions||current.proof_decisions!==effect.proof_decisions)reason='later_human_decision'
   else if(task[effect.field]!==after)reason='later_field_value'
   else if(history.some(row=>row.id>effect.history_id&&Object.prototype.hasOwnProperty.call(JSON.parse(row.detail),effect.field)))reason='later_field_edit'
   else if((effect.field==='start_date'||effect.field==='due_date')&&await dependency(db,task.id))reason='dependency_cascade_requires_review'
   else if(effect.field==='owner_id'){
    try{await replacement(db,actor,task,before!)}catch(error){if(error instanceof PegError&&[400,403,404,409].includes(error.status))reason='previous_owner_unavailable';else throw error}
   }
   if(reason)conflicts.push({taskId:task.id,field:effect.field,reason})
   else restored.push({taskId:task.id,field:effect.field,before:after,after:before})
  }
  // Restoring one date beside a newer, preserved date must not invert the interval.
  const selected=restored.filter(effect=>effect.taskId===task.id)
  const startEffect=selected.find(effect=>effect.field==='start_date'),dueEffect=selected.find(effect=>effect.field==='due_date')
  const start=startEffect?startEffect.after:task.start_date,due=dueEffect?dueEffect.after:task.due_date
  if(start&&due&&Date.parse(start)>Date.parse(due))for(const effect of selected.filter(effect=>effect.field==='start_date'||effect.field==='due_date')){
   restored.splice(restored.indexOf(effect),1);conflicts.push({taskId:task.id,field:effect.field,reason:'later_date_conflict'})
  }
 }
 const plan={id,operation:op,tasks:[...tasks.values()].map(task=>({id:task.id,title:task.title})),restored,conflicts,canApply:true}
 return {...plan,rev,token:await digest(['bulk.undo',workspace,actor.id,rev,plan])}
}
export async function undoBulk(db:D1Database,actor:Actor,workspace:string,id:string,input:{token?:unknown}|string) {
 const preview=await undoBulkPreview(db,actor,workspace,id)
 if((typeof input==='string'?input:input.token)!==preview.token)throw conflict('bulk_undo_review_changed')
 const at=now(),statements:D1PreparedStatement[]=[]
 for(const taskId of [...new Set(preview.restored.map(effect=>effect.taskId))]){
  const {task,access}=await subject(db,actor,workspace,taskId),effects=preview.restored.filter(effect=>effect.taskId===taskId)
  const reopen=task.status==='done'&&!!await first(db,'SELECT 1 FROM peg_approval_tasks WHERE task_id=?',taskId)
  statements.push(...edit(db,actor,taskId,effects,at,reopen,'bulk.undone',id),permanentEvent(db,{workspace:access.personal?null:workspace,actor:actor.id,action:'bulk.undone',type:'task',id:taskId,metadata:{id,count:effects.length}}))
 }
 statements.push(bound(db,'INSERT INTO peg_bulk_undos VALUES(?,?,?,?,?)',[id,actor.id,at,preview.restored.length,JSON.stringify(preview.conflicts)]))
 await guarded(db,preview.rev,statements)
 return {id,operationId:id,at,restored:preview.restored,conflicts:preview.conflicts}
}
export async function listBulk(db:D1Database,actor:Actor,workspace:string) {
 await human(db,actor,workspace)
 const rows=await all<Operation>(db,'SELECT * FROM peg_bulk_operations WHERE workspace_id=? ORDER BY applied_at DESC,id',workspace),operations=[]
 for(const row of rows){
  try{
   const {effects,tasks}=await operation(db,actor,workspace,row.id,false)
   let canUndo=true
   try{await operation(db,actor,workspace,row.id,true)}catch(error){if(error instanceof PegError&&[403,404].includes(error.status))canUndo=false;else throw error}
   const undo=await first<{actor_id:string;undone_at:number;restored:number;conflicts:string}>(db,'SELECT * FROM peg_bulk_undos WHERE operation_id=?',row.id)
   operations.push({...row,tasks:[...tasks.values()].map(task=>({id:task.id,title:task.title})),effectCount:effects.length,canUndo:canUndo&&!undo,undo:undo?{...undo,conflicts:JSON.parse(undo.conflicts)}:null})
  }catch(error){if(!(error instanceof PegError&&[403,404].includes(error.status)))throw error}
 }
 return {operations}
}
