import {all,bound,conflict,first,notFound,now} from '../db'
import {revision,digest,guarded} from '../decisions/revision'
import {auditStatement} from '../authorization/audit'
import {rootOf} from '../authorization/effective'
import {openTask} from '../tasks/access'
import {openProject} from '../workspace/projects'
import {historyStatement,reopenGuard} from '../tasks/history'
import {projectHomes,projectScope} from './context'
import {conversionAuthority,conversionView,type OperationRow} from './operations'
import type {Actor} from '../workspace/people'
import type {TaskProjectRow} from '../model'

interface EffectRow {conversion_id:string;position:number;kind:string;task_id:string;project_id:string|null;before_state:string;after_state:string;undone_at:number|null}
async function scopes(db:D1Database,actor:Actor,id:string){
 const opened=await openTask(db,actor,id),homes=await projectHomes(db,(await rootOf(db,opened.task)).id)
 return [...new Set(await Promise.all(homes.map(async home=>projectScope(db,(await openProject(db,actor,home.project_id)).project))))].sort()
}
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b)
async function planUndoConversion(db:D1Database,actor:Actor,workspace:string,id:string){
 const rev=await revision(db),operation=await first<OperationRow>(db,'SELECT * FROM peg_conversions WHERE id=? AND workspace_id=?',id,workspace)
 if(!operation)throw notFound()
 await conversionAuthority(db,actor,operation,true)
 const effects=await all<EffectRow>(db,'SELECT * FROM peg_conversion_effects WHERE conversion_id=? AND undone_at IS NULL ORDER BY position',id),conflicts:Array<{position:number;taskId:string;reason:string}>=[],eligible:EffectRow[]=[]
 for(const effect of effects){
  const before=JSON.parse(effect.before_state),after=JSON.parse(effect.after_state)
  if(effect.kind==='task_structure'){
   const {task}=await openTask(db,actor,effect.task_id)
   if(!equal({parentId:task.parent_id,kind:task.kind},after)){conflicts.push({position:effect.position,taskId:task.id,reason:'structure_changed'});continue}
   if(before.parentId&&after.parentId===null){
    const managed=new Set(effects.filter(e=>e.kind==='placement'&&e.task_id===task.id).map(e=>e.project_id))
    if((await projectHomes(db,task.id)).some(home=>!managed.has(home.project_id))){conflicts.push({position:effect.position,taskId:task.id,reason:'independent_relationship_changed'});continue}
   }
   const current=await scopes(db,actor,task.id)
   let previous:string[]
   if(before.parentId)previous=await scopes(db,actor,before.parentId)
   else{
    const homes=new Map((await projectHomes(db,task.id)).map(home=>[home.project_id,home]))
    for(const owned of effects.filter(e=>e.kind==='placement'&&e.task_id===task.id)){const old=JSON.parse(owned.before_state);if(old===null)homes.delete(owned.project_id!);else homes.set(old.project_id,old)}
    previous=[...new Set(await Promise.all([...homes.values()].map(async h=>projectScope(db,(await openProject(db,actor,h.project_id)).project))))].sort()
   }
   if(!equal(current,previous)){conflicts.push({position:effect.position,taskId:task.id,reason:'scope_changed'});continue}
   const descendantDepth=(await first<{depth:number}>(db,'WITH RECURSIVE tree(id,depth) AS (SELECT id,0 FROM peg_tasks WHERE id=? UNION SELECT t.id,tree.depth+1 FROM peg_tasks t JOIN tree ON t.parent_id=tree.id WHERE tree.depth<50) SELECT MAX(depth) depth FROM tree',task.id))!.depth
   let restoredDepth=0
   if(before.parentId){
    let parent=(await openTask(db,actor,before.parentId)).task,depth=0
    while(parent.parent_id){if(parent.id===task.id||++depth>48)break;parent=(await openTask(db,actor,parent.parent_id)).task}
    restoredDepth=depth+1
    if(parent.id===task.id||depth>48){conflicts.push({position:effect.position,taskId:task.id,reason:'cycle_or_depth'});continue}
   }
   if(restoredDepth+descendantDepth>48){conflicts.push({position:effect.position,taskId:task.id,reason:'cycle_or_depth'});continue}
  }else if(effect.kind==='placement'){
   const current=await first<TaskProjectRow>(db,'SELECT * FROM peg_task_projects WHERE task_id=? AND project_id=?',effect.task_id,effect.project_id)
   if(!equal(current,after)){conflicts.push({position:effect.position,taskId:effect.task_id,reason:'placement_changed'});continue}
  }else{conflicts.push({position:effect.position,taskId:effect.task_id,reason:'unsupported_effect'});continue}
  eligible.push(effect)
 }
 // A task's owned placements and structure are one effect group. Never strand only half a conversion.
 const blocked=new Set(conflicts.map(c=>c.taskId)),restorable=eligible.filter(effect=>!blocked.has(effect.task_id))
 const reopenIds=new Set(restorable.map(effect=>effect.task_id))
 for(const effect of restorable.filter(e=>e.kind==='task_structure')){
  const descendants=await all<{id:string;depth:number}>(db,'WITH RECURSIVE tree(id,depth) AS (SELECT id,0 FROM peg_tasks WHERE id=? UNION SELECT t.id,tree.depth+1 FROM peg_tasks t JOIN tree ON t.parent_id=tree.id WHERE tree.depth<50) SELECT * FROM tree',effect.task_id)
  for(const row of descendants)reopenIds.add(row.id)
  for(const parentId of [(await openTask(db,actor,effect.task_id)).task.parent_id,JSON.parse(effect.before_state).parentId]){let id=parentId,depth=0;while(id&&depth++<50){reopenIds.add(id);id=(await openTask(db,actor,id)).task.parent_id}}
 }
 const payload={id,kind:operation.kind,undoneAt:operation.undone_at,conflicts,effects:restorable.map(e=>({position:e.position,taskId:e.task_id,kind:e.kind})),preserved:'Later scalar edits, evidence, approvals and independent relationships remain native records.'}
 return {...payload,rev,token:await digest([actor.id,rev,payload]),operation,effectRows:restorable,reopenIds:[...reopenIds]}
}
export async function undoConversionPreview(db:D1Database,actor:Actor,workspace:string,id:string){
 const {operation,effectRows,reopenIds,...preview}=await planUndoConversion(db,actor,workspace,id)
 return preview
}
export async function undoConversion(db:D1Database,actor:Actor,workspace:string,id:string,input:Record<string,any>){
 const preview=await planUndoConversion(db,actor,workspace,id)
 if(preview.undoneAt)return {...await conversionView(db,actor,id),conflicts:preview.conflicts}
 if(input.token!==preview.token)throw conflict('conversion_undo_preview_changed')
 const at=now(),statements:D1PreparedStatement[]=[],tasks=new Set<string>()
 for(const taskId of preview.reopenIds)statements.push(reopenGuard(db,taskId,actor.id,'conversion_undo'),bound(db,"UPDATE peg_tasks SET status='todo',completed_at=NULL,updated_at=? WHERE id=? AND status='done' AND EXISTS(SELECT 1 FROM peg_approval_tasks WHERE task_id=?)",[at,taskId,taskId]))
 for(const effect of [...preview.effectRows].reverse()){
  const before=JSON.parse(effect.before_state);tasks.add(effect.task_id)
  if(effect.kind==='task_structure')statements.push(reopenGuard(db,effect.task_id,actor.id,'conversion_undo'),bound(db,'UPDATE peg_tasks SET parent_id=?,kind=? WHERE id=?',[before.parentId,before.kind,effect.task_id]),bound(db,"UPDATE peg_tasks SET status='todo',completed_at=NULL,updated_at=? WHERE id=? AND status='done' AND EXISTS(SELECT 1 FROM peg_approval_tasks WHERE task_id=?)",[at,effect.task_id,effect.task_id]))
  else if(before===null)statements.push(bound(db,'DELETE FROM peg_task_projects WHERE task_id=? AND project_id=?',[effect.task_id,effect.project_id]))
  else statements.push(bound(db,'INSERT INTO peg_task_projects VALUES(?,?,?,?,?,?,?) ON CONFLICT(task_id,project_id) DO UPDATE SET section_id=excluded.section_id,fields=excluded.fields,position=excluded.position,added_by=excluded.added_by,added_at=excluded.added_at',[before.task_id,before.project_id,before.section_id,before.fields,before.position,before.added_by,before.added_at]))
  statements.push(bound(db,'UPDATE peg_conversion_effects SET undone_at=? WHERE conversion_id=? AND position=?',[at,id,effect.position]))
 }
 for(const task of tasks)statements.push(historyStatement(db,task,null,actor.id,'conversion.undone',{conversionId:id}))
 if(!preview.conflicts.length)statements.push(bound(db,'UPDATE peg_conversions SET undone_at=?,undone_by=? WHERE id=?',[at,actor.id,id]))
 statements.push(auditStatement(db,{workspaceId:workspace,actorId:actor.id,action:'work.conversion_undone',targetType:'conversion',targetId:id,detail:{effects:preview.effectRows.length,conflicts:preview.conflicts.length}}))
 await guarded(db,preview.rev,statements)
 return {...await conversionView(db,actor,id),conflicts:preview.conflicts}
}
