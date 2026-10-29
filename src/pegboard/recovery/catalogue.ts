import {all,bound,conflict,first,forbidden,invalid,newId,notFound,now,PegError,type Param} from '../db'
import {digest,guarded,revision} from '../decisions/revision'
import {bulkSubject,parseBulk} from './bulk'
import {viewTask} from '../tasks/view'
import {historyStatement,reopenGuard} from '../tasks/history'
import {openProject,need,fieldReadable} from '../workspace/projects'
import {definitions} from '../fields/definitions'
import {normalize} from '../fields/values'
import {prepareTask} from '../tasks/tasks'
import {recoverySubject} from './authority'
import {workspaceRole,type Actor} from '../workspace/people'
import {copyTreePlan,prepareTreeCopy,treeVersions} from './catalogue-tree'
import {conversionGraph} from '../conversion/graph'

type Action='fields'|'move'|'duplicate'|'archive'
export interface CatalogueInput {taskIds?:unknown;action?:unknown;projectId?:unknown;fromProjectId?:unknown;fieldKey?:unknown;fieldValue?:unknown;reviewRows?:unknown;token?:unknown}
interface Row {id:string;title?:string;outcome:string;reason?:string;details?:Record<string,any>;reviewToken?:string}
function parse(input:CatalogueInput){
 const ids=Array.isArray(input.taskIds)?input.taskIds:input.taskIds?[input.taskIds]:[],taskIds=parseBulk({taskIds:ids as string[],patch:{priority:'normal'}}).taskIds
 if(!['fields','move','duplicate','archive'].includes(String(input.action)))throw invalid('bulk_action')
 return {taskIds,action:input.action as Action,projectId:String(input.projectId??''),fromProjectId:String(input.fromProjectId??''),fieldKey:String(input.fieldKey??'')}
}
const generation=(db:D1Database,taskId:string,fieldId?:string)=>first<{generation:number}>(db,fieldId?'SELECT generation FROM peg_custom_generations WHERE task_id=? AND field_id=?':"SELECT generation FROM peg_rule_mutation_generations WHERE task_id=? AND kind='task'",...fieldId?[taskId,fieldId]:[taskId]).then(r=>r?.generation??0)
export async function cataloguePreview(db:D1Database,actor:Actor,workspace:string,input:CatalogueInput){
 const rev=await revision(db),role=await workspaceRole(db,actor.id,workspace)
 if(!role||role==='agent')throw notFound()
 const parsed=parse(input),rows:Row[]=[],plans:{id:string;details:Record<string,any>}[]=[]
 let reviewed:any=input.reviewRows
 if(typeof reviewed==='string'&&reviewed)try{reviewed=JSON.parse(reviewed)}catch{throw invalid('bulk_rows')}
 if(reviewed&&!Array.isArray(reviewed))throw invalid('bulk_rows')
 for(const id of parsed.taskIds)try{
  const visible=await viewTask(db,actor,id),{task,access}=await bulkSubject(db,actor,workspace,id),details:Record<string,any>={}
  if(parsed.action==='fields'){
   const context=access.contexts.get(parsed.projectId)
   if(!context)throw notFound();need(context,'edit')
   const field=(await definitions(db,parsed.projectId)).find(f=>f.key===parsed.fieldKey)
   if(!field||!fieldReadable(field,context))throw notFound()
   const value=normalize(field,input.fieldValue)
   if(field.type==='people'&&Array.isArray(value))for(const person of value)if(!await workspaceRole(db,person,workspace))throw invalid('field_person')
   if(field.type==='rollup'&&Array.isArray(value))for(const taskId of value)await viewTask(db,actor,taskId)
   const before=(await first<{value:string}>(db,'SELECT value FROM peg_field_values WHERE task_id=? AND field_id=?',id,field.id))?.value??null
   Object.assign(details,{fieldId:field.id,label:field.label,before,after:value===null?null:JSON.stringify(value),projectId:parsed.projectId,generation:await generation(db,id,field.id)})
  }else if(parsed.action==='archive'){
   await recoverySubject(db,actor,workspace,'task',id,true)
   Object.assign(details,{archive:true,before:await first(db,"SELECT * FROM peg_recovery WHERE object_type='task' AND object_id=?",id),affectedTasks:(await conversionGraph(db,actor,workspace,[id])).map(t=>({id:t.id,title:t.title}))})
  }else{
   const target=await openProject(db,actor,parsed.projectId);need(target.effective,'edit')
   if(target.project.workspace_id!==workspace)throw notFound()
   const section=await first<{id:string;name:string}>(db,'SELECT id,name FROM peg_sections WHERE project_id=? ORDER BY position LIMIT 1',parsed.projectId)
   Object.assign(details,{projectId:parsed.projectId,projectName:target.project.name,sectionId:section?.id??null,sectionName:section?.name??null})
   if(parsed.action==='move'){
    if(task.parent_id||access.personal)throw conflict('review_task_visibility_first')
    const home=await first(db,'SELECT * FROM peg_task_projects WHERE task_id=? AND project_id=?',id,parsed.fromProjectId)
    if(!home||!access.contexts.has(parsed.fromProjectId))throw notFound()
    if(await first(db,'SELECT 1 FROM peg_task_projects WHERE task_id=? AND project_id=?',id,parsed.projectId))throw conflict('already_in_project')
    const tree=await copyTreePlan(db,actor,workspace,id,parsed.projectId)
    Object.assign(details,{before:home,fromProjectId:parsed.fromProjectId,fromProjectName:visible.projects.find(p=>p.id===parsed.fromProjectId)?.name,affectedTasks:tree.map(t=>({id:t.id,title:t.title})),moveTreeIds:tree.map(t=>t.id)})
   }else{
    const tree=await copyTreePlan(db,actor,workspace,id,parsed.projectId)
    Object.assign(details,{title:task.title.slice(0,295)+' copy',kind:visible.kind,status:visible.kind==='approval'?'todo':task.status,description:task.description,priority:task.priority,startDate:task.start_date,dueDate:task.due_date,estimateHours:task.estimate_hours,ownerId:actor.id,...('internalNotes' in visible?{internalOnly:!!task.internal_only,internalNotes:task.internal_notes}:{}),fields:[],tree})
    for(const field of await definitions(db,parsed.projectId)){
     if(!fieldReadable(field,target.effective)||!visible.projects.some(p=>p.fields.some(f=>f.id===field.id)))continue
     const value=await first<{value:string}>(db,'SELECT value FROM peg_field_values WHERE task_id=? AND field_id=?',id,field.id)
     if(value&&!['formula','rollup'].includes(field.type))details.fields.push({id:field.id,value:value.value})
    }
   }
  }
  const token=await digest(['catalogue.row',actor.id,parsed.action,visible,details]),outcome=reviewed&&reviewed.find((r:any)=>r.id===id)?.token!==token?'stale':parsed.action==='fields'&&details.before===details.after?'unchanged':'ready'
  rows.push({id,title:visible.title,outcome,reason:outcome==='stale'?'Changed since selection; select again to include':undefined,details,reviewToken:token});if(outcome==='ready')plans.push({id,details})
 }catch(error){if(error instanceof PegError&&[400,403,404,409].includes(error.status)){
  const visible=await viewTask(db,actor,id).catch(()=>null)
  rows.push(visible?{id,title:visible.title,outcome:error.status===403?'forbidden':'blocked',reason:error.code}:{id,outcome:'unavailable',reason:'Unavailable or not permitted'})
 }else throw error}
 const reviewRows=reviewed||rows.filter(r=>r.reviewToken).map(r=>({id:r.id,token:r.reviewToken!})),plan={action:parsed.action,rows,reviewRows,canApply:!!plans.length}
 return {...plan,rev,plans,token:await digest(['catalogue',workspace,actor.id,rev,plan])}
}
export async function applyCatalogue(db:D1Database,actor:Actor,workspace:string,input:CatalogueInput){
 const plan=await cataloguePreview(db,actor,workspace,input)
 if(input.token!==plan.token)throw new PegError(409,'bulk_review_changed',{rows:plan.rows})
 if(!plan.canApply)throw conflict('bulk_no_applicable_effects')
 const id=newId('catalogue'),at=now(),offsets=new Map<string,number>(),statements=[bound(db,'INSERT INTO peg_catalogue_operations VALUES(?,?,?,?,?,NULL)',[id,workspace,actor.id,plan.action,at])]
 for(const row of plan.rows){
  const prepared=plan.plans.find(p=>p.id===row.id),d=prepared?.details??{},before=!prepared?null:plan.action==='fields'?{value:d.before}:plan.action==='move'||plan.action==='archive'?d.before:{},after:Record<string,any>=plan.action==='duplicate'?{projectId:d.projectId}:Object.fromEntries(Object.entries(d).filter(([key])=>key!=='affectedTasks'));let resultId=row.id
  if(prepared){
   statements.push(reopenGuard(db,row.id,actor.id,'bulk_'+plan.action))
   if(plan.action==='fields')statements.push(d.after===null?bound(db,'DELETE FROM peg_field_values WHERE task_id=? AND field_id=?',[row.id,d.fieldId]):bound(db,'INSERT INTO peg_field_values VALUES(?,?,?) ON CONFLICT(task_id,field_id) DO UPDATE SET value=excluded.value',[row.id,d.fieldId,d.after]))
   else if(plan.action==='move'){
    for(const taskId of d.moveTreeIds)statements.push(reopenGuard(db,taskId,actor.id,'bulk_move'),bound(db,"UPDATE peg_tasks SET status='todo',completed_at=NULL WHERE id=? AND status='done' AND EXISTS(SELECT 1 FROM peg_approval_tasks WHERE task_id=?)",[taskId,taskId]))
    statements.push(bound(db,'DELETE FROM peg_task_projects WHERE task_id=? AND project_id=?',[row.id,d.fromProjectId]),bound(db,'INSERT INTO peg_task_projects(task_id,project_id,section_id,position,added_by,added_at) VALUES(?,?,?,(SELECT COALESCE(MAX(position),0)+1 FROM peg_task_projects WHERE project_id=?),?,?)',[row.id,d.projectId,d.sectionId,d.projectId,actor.id,at]))
   }
   else if(plan.action==='archive'){after.removedAt=at;statements.push(bound(db,"INSERT INTO peg_recovery VALUES('task',?,?,?, ?,NULL,NULL) ON CONFLICT(object_type,object_id) DO UPDATE SET actor_id=excluded.actor_id,removed_at=excluded.removed_at,restored_at=NULL,restored_by=NULL",[row.id,workspace,actor.id,at]))}
   else{
    const copy=await prepareTreeCopy(db,actor,d.projectId,d.tree,offsets);resultId=copy.id;after.copyIds=copy.ids
    statements.push(...copy.statements)
   }
   statements.push(historyStatement(db,row.id,plan.action==='fields'?d.projectId:null,actor.id,'bulk.'+plan.action,{operationId:id}))
  }
  statements.push(bound(db,'INSERT INTO peg_catalogue_rows VALUES(?,?,?,?,?,?)',[id,row.id,resultId,prepared?'applied':row.outcome,JSON.stringify(before),JSON.stringify(after)]))
  if(prepared)statements.push(bound(db,`UPDATE peg_catalogue_rows SET after_state=json_set(after_state,'$.generation',COALESCE((SELECT generation FROM ${plan.action==='fields'?'peg_custom_generations WHERE task_id=? AND field_id=?':"peg_rule_mutation_generations WHERE task_id=? AND kind='task'"}),0)) WHERE operation_id=? AND task_id=?`,plan.action==='fields'?[row.id,d.fieldId,id,row.id]:[resultId,id,row.id]))
  if(prepared&&plan.action==='duplicate')statements.push(bound(db,`UPDATE peg_catalogue_rows SET after_state=json_set(after_state,'$.copyGenerations',json((SELECT json_group_object(task_id,generation) FROM peg_rule_mutation_generations WHERE kind='task' AND task_id IN (${after.copyIds.map(()=>'?').join(',')})))) WHERE operation_id=? AND task_id=?`,[...after.copyIds,id,row.id]))
  if(prepared&&['duplicate','move'].includes(plan.action)){
   const ids=plan.action==='duplicate'?after.copyIds:after.moveTreeIds
   statements.push(bound(db,`UPDATE peg_catalogue_rows SET after_state=json_set(after_state,'$.treeGenerations',json((SELECT json_group_object(task_id,generation) FROM peg_rule_mutation_generations WHERE kind='task' AND task_id IN (${ids.map(()=>'?').join(',')}))),'$.projectGenerations',json((SELECT json_group_object(task_id||':'||target_id,generation) FROM peg_rule_link_generations WHERE kind='project' AND task_id IN (${ids.map(()=>'?').join(',')})))) WHERE operation_id=? AND task_id=?`,[...ids,...ids,id,row.id]))
  }
 }
 await guarded(db,plan.rev,statements)
 return {id}
}
interface Operation {id:string;workspace_id:string;actor_id:string;action:Action;undone_at:number|null}
async function catalogueOperation(db:D1Database,actor:Actor,workspace:string,id:string){
 const operation=await first<Operation>(db,'SELECT * FROM peg_catalogue_operations WHERE id=? AND workspace_id=? AND actor_id=?',id,workspace,actor.id)
 if(!operation||!await workspaceRole(db,actor.id,workspace))throw notFound()
 const rows=await all<{task_id:string;result_id:string;outcome:string;before_state:string;after_state:string}>(db,'SELECT * FROM peg_catalogue_rows WHERE operation_id=? ORDER BY task_id',id)
 return {operation,rows}
}
export async function catalogueReceipt(db:D1Database,actor:Actor,workspace:string,id:string){
 const {operation,rows}=await catalogueOperation(db,actor,workspace,id),out=[]
 for(const row of rows)try{
  const subject=await recoverySubject(db,actor,workspace,'task',row.task_id)
  out.push({id:row.task_id,title:subject.label,outcome:row.outcome,resultId:row.result_id})
 }catch(error){if(error instanceof PegError&&[403,404].includes(error.status))out.push({id:row.task_id,outcome:'unavailable'});else throw error}
 return {id,action:operation.action,undoneAt:operation.undone_at,rows:out}
}
export async function catalogueUndoPreview(db:D1Database,actor:Actor,workspace:string,id:string){
 const rev=await revision(db),{operation,rows}=await catalogueOperation(db,actor,workspace,id),restored:{id:string;resultId:string;before:any;after:any}[]=[],conflicts:{id:string;reason:string}[]=[]
 if(operation.undone_at)throw conflict('bulk_already_undone')
 for(const row of rows.filter(r=>r.outcome==='applied'))try{
  const before=JSON.parse(row.before_state),after=JSON.parse(row.after_state)
  await recoverySubject(db,actor,workspace,'task',row.task_id,operation.action!=='fields')
  if(operation.action!=='archive')await bulkSubject(db,actor,workspace,row.task_id)
  let reason=''
  if(operation.action==='fields'){
   const {access}=await bulkSubject(db,actor,workspace,row.task_id),field=(await definitions(db,after.projectId)).find(f=>f.id===after.fieldId),context=access.contexts.get(after.projectId)
   if(!field||!context||!fieldReadable(field,context)||!context.capabilities.has('edit'))reason='authority_changed'
   else if(await generation(db,row.task_id,after.fieldId)!==after.generation)reason='later_field_edit'
   else if(before.value!==null){try{if(JSON.stringify(normalize(field,JSON.parse(before.value)))!==before.value)reason='previous_field_value_unavailable'}catch{reason='previous_field_value_unavailable'}}
  }else if(operation.action==='archive'){
   const current=await first<any>(db,"SELECT * FROM peg_recovery WHERE object_type='task' AND object_id=?",row.task_id)
   if(!current||current.removed_at!==after.removedAt||current.restored_at!==null)reason='later_recovery_change'
  }else{
   if(operation.action==='duplicate')await bulkSubject(db,actor,workspace,row.result_id)
   if(await generation(db,row.result_id)!==after.generation)reason='later_work'
   if(operation.action==='duplicate'&&after.copyIds){
    const current=await treeVersions(db,actor,workspace,row.result_id)
    if(JSON.stringify(current.map(t=>t.id).sort())!==JSON.stringify([...after.copyIds].sort())||current.some(t=>t.generation!==(after.copyGenerations?.[t.id]??0)))reason='later_work'
   }
   if(['duplicate','move'].includes(operation.action)&&after.treeGenerations){
    const ids=operation.action==='duplicate'?after.copyIds:after.moveTreeIds,current=await treeVersions(db,actor,workspace,row.result_id),projectVersions=await all<{task_id:string;target_id:string;generation:number}>(db,`SELECT * FROM peg_rule_link_generations WHERE kind='project' AND task_id IN (${ids.map(()=>'?').join(',')})`,...ids)
    if(JSON.stringify(current.map(t=>t.id).sort())!==JSON.stringify([...ids].sort())||current.some(t=>t.generation!==(after.treeGenerations[t.id]??0))||projectVersions.length!==Object.keys(after.projectGenerations).length||projectVersions.some(v=>v.generation!==after.projectGenerations[v.task_id+':'+v.target_id]))reason='later_work'
   }
   if(operation.action==='move'){
    need((await openProject(db,actor,before.project_id)).effective,'edit')
    if(await first(db,'SELECT 1 FROM peg_task_projects WHERE task_id=? AND project_id=?',row.task_id,before.project_id)||!await first(db,'SELECT 1 FROM peg_task_projects WHERE task_id=? AND project_id=?',row.task_id,after.projectId))reason='later_membership_edit'
   }
  }
  if(reason)conflicts.push({id:row.task_id,reason});else restored.push({id:row.task_id,resultId:row.result_id,before,after})
 }catch(error){if(error instanceof PegError&&[400,403,404,409].includes(error.status))conflicts.push({id:row.task_id,reason:'unavailable_or_not_permitted'});else throw error}
 const plan={id,action:operation.action,restored,conflicts}
 return {...plan,rev,token:await digest(['catalogue.undo',actor.id,rev,plan])}
}
export async function undoCatalogue(db:D1Database,actor:Actor,workspace:string,id:string,input:{token?:unknown}){
 const plan=await catalogueUndoPreview(db,actor,workspace,id)
 if(input.token!==plan.token)throw conflict('bulk_undo_review_changed')
 const statements:D1PreparedStatement[]=[]
 for(const row of plan.restored){const {before,after}=row
  if(plan.action==='fields')statements.push(reopenGuard(db,row.id,actor.id,'bulk_undo'),before.value===null?bound(db,'DELETE FROM peg_field_values WHERE task_id=? AND field_id=?',[row.id,after.fieldId]):bound(db,'INSERT INTO peg_field_values VALUES(?,?,?) ON CONFLICT(task_id,field_id) DO UPDATE SET value=excluded.value',[row.id,after.fieldId,before.value]))
  else if(plan.action==='move')statements.push(reopenGuard(db,row.id,actor.id,'bulk_undo'),bound(db,'DELETE FROM peg_task_projects WHERE task_id=? AND project_id=?',[row.id,after.projectId]),bound(db,'INSERT INTO peg_task_projects VALUES(?,?,?,?,?,?,?)',[before.task_id,before.project_id,before.section_id,before.fields,before.position,before.added_by,before.added_at]))
  else if(plan.action==='archive')statements.push(bound(db,"UPDATE peg_recovery SET restored_at=?,restored_by=? WHERE object_type='task' AND object_id=?",[now(),actor.id,row.id]))
  else statements.push(bound(db,"INSERT INTO peg_recovery VALUES('task',?,?,?,?,NULL,NULL) ON CONFLICT(object_type,object_id) DO UPDATE SET removed_at=excluded.removed_at,restored_at=NULL,restored_by=NULL",[row.resultId,workspace,actor.id,now()]))
  statements.push(historyStatement(db,row.id,null,actor.id,'bulk.catalogue_undone',{operationId:id}))
 }
 statements.push(bound(db,'UPDATE peg_catalogue_operations SET undone_at=? WHERE id=?',[now(),id]))
 await guarded(db,plan.rev,statements)
 return {id,restored:plan.restored.map(r=>r.id),conflicts:plan.conflicts}
}
