import {all,bound,conflict,first,newId,notFound,now,type Param} from '../db'
import {guarded,revision,digest} from '../decisions/revision'
import {mergePair} from './authority'
import {canonicalTask} from './canonical'
import {mergeFields,mergePreview,type MergeInput} from './preview'
import {historyStatement} from '../tasks/history'
import {permanentEvent} from '../audit/search'
import {viewTask} from '../tasks/view'
import {listSheets,sheetView} from '../time/time'
import {workspaceRole,type Actor} from '../workspace/people'

interface MergeRow {id:string;workspace_id:string;actor_id:string;source_id:string;survivor_id:string;review_token:string;before_state:string;after_state:string;created_at:number;undone_at:number|null}
const tables={comment:'peg_comments',history:'peg_history',attachment:'peg_attachments'} as const
async function record(db:D1Database,actor:Actor,workspace:string,id:string){
 const row=await first<MergeRow>(db,'SELECT * FROM peg_task_merges WHERE id=? AND workspace_id=?',id,workspace)
 if(!row)throw notFound()
 if(await canonicalTask(db,row.survivor_id)!==row.survivor_id)throw conflict('review_newer_merge_first')
 await mergePair(db,actor,workspace,row.source_id,row.survivor_id,!row.undone_at)
 return row
}
export async function mergeView(db:D1Database,actor:Actor,workspace:string,id:string){
 const row=await record(db,actor,workspace,id),task=await viewTask(db,actor,row.survivor_id),items=await all<{kind:string;object_id:string;source_id:string}>(db,'SELECT kind,object_id,source_id FROM peg_merge_items WHERE operation_id=? ORDER BY kind,object_id',id),time=[]
 for(const sheet of await listSheets(db,actor,workspace))for(const entry of (await sheetView(db,actor,sheet.id)).entries){
  if(!entry.available||await canonicalTask(db,entry.task_id??'')!==row.survivor_id)continue
  time.push({id:entry.id,sourceTaskId:entry.task_id,seconds:entry.seconds??(entry.end_ms&&entry.start_ms?Math.floor((entry.end_ms-entry.start_ms)/1000):null),personId:entry.person_id})
 }
 return {id,sourceId:row.source_id,survivorId:row.survivor_id,title:task.title,undoneAt:row.undone_at,comments:task.comments.map(c=>({...c,sourceTaskId:items.find(i=>i.kind==='comment'&&i.object_id===c.id)?.source_id??row.survivor_id})),history:task.history.map(h=>({...h,sourceTaskId:items.find(i=>i.kind==='history'&&i.object_id===String(h.id))?.source_id??row.survivor_id})),attachments:task.attachments.map(a=>({...a,sourceTaskId:items.find(i=>i.kind==='attachment'&&i.object_id===a.id)?.source_id??row.survivor_id})),time:{entries:time,seconds:time.reduce((sum,e)=>sum+(e.seconds??0),0)}}
}
export async function applyMerge(db:D1Database,actor:Actor,workspace:string,input:MergeInput){
 const replay=typeof input.token==='string'?await first<MergeRow>(db,'SELECT * FROM peg_task_merges WHERE review_token=?',input.token):null
 if(replay){if(replay.actor_id!==actor.id||replay.workspace_id!==workspace||replay.source_id!==input.sourceId||replay.survivor_id!==input.survivorId)throw conflict('merge_replay_changed');return mergeView(db,actor,workspace,replay.id)}
 const preview=await mergePreview(db,actor,workspace,input)
 if(input.token!==preview.token)throw conflict('merge_review_changed')
 if(!preview.canApply)throw conflict('merge_choices_required')
 const {source,survivor}=await mergePair(db,actor,workspace,preview.source.id,preview.survivor.id),id=newId('merge'),at=now(),statements:D1PreparedStatement[]=[],items:{kind:string;id:string}[]=[]
 const before={task:survivor.task,homes:survivor.homes,fields:await all<any>(db,'SELECT * FROM peg_field_values WHERE task_id=?',survivor.task.id),dependencies:await all<any>(db,'SELECT * FROM peg_dependencies WHERE predecessor_id=? OR successor_id=?',source.task.id,source.task.id),refs:await all<any>(db,'SELECT * FROM peg_task_refs WHERE task_id=?',source.task.id)}
 for(const [kind,table] of Object.entries(tables)){
  const rows=await all<{id:string|number}>(db,`SELECT id FROM ${table} WHERE task_id=?`,source.task.id)
  items.push(...rows.map(r=>({kind,id:String(r.id)})))
  statements.push(bound(db,`UPDATE ${table} SET task_id=? WHERE task_id=?`,[survivor.task.id,source.task.id]))
 }
 statements.push(bound(db,`UPDATE peg_tasks SET ${mergeFields.map(f=>f+'=?').join(',')},completed_at=?,updated_at=? WHERE id=?`,[...mergeFields.map(f=>preview.values[f]) as Param[],preview.values.status==='done'?(survivor.task.completed_at??at):null,at,survivor.task.id]))
 for(const field of preview.custom)statements.push(bound(db,'INSERT INTO peg_field_values VALUES(?,?,?) ON CONFLICT(task_id,field_id) DO UPDATE SET value=excluded.value',[survivor.task.id,field.id,field.value??'null']))
 for(const home of source.homes)if(!survivor.homes.some(h=>h.project_id===home.project_id))statements.push(bound(db,'INSERT INTO peg_task_projects VALUES(?,?,?,?,?,?,?)',[survivor.task.id,home.project_id,home.section_id,home.fields,home.position,actor.id,at]))
 for(const edge of before.dependencies){
  const from=edge.predecessor_id===source.task.id?survivor.task.id:edge.predecessor_id,to=edge.successor_id===source.task.id?survivor.task.id:edge.successor_id
  const existing=await first(db,'SELECT 1 FROM peg_dependencies WHERE predecessor_id=? AND successor_id=? AND id<>?',from,to,edge.id)
  statements.push(from===to||existing?bound(db,'DELETE FROM peg_dependencies WHERE id=?',[edge.id]):bound(db,'UPDATE peg_dependencies SET predecessor_id=?,successor_id=? WHERE id=?',[from,to,edge.id]))
 }
 statements.push(bound(db,'UPDATE peg_task_refs SET task_id=?,current=0 WHERE task_id=?',[survivor.task.id,source.task.id]))
 // The original time ledger is never rewritten. Its task door resolves the retained source ID.
 statements.push(bound(db,'INSERT INTO peg_task_merges VALUES(?,?,?,?,?,?,?,?,?,NULL)',[id,workspace,actor.id,source.task.id,survivor.task.id,preview.token,JSON.stringify(before),JSON.stringify({values:preview.values,fields:preview.custom,sourceHomes:source.homes}),at]),...items.map(item=>bound(db,'INSERT INTO peg_merge_items VALUES(?,?,?,?)',[id,item.kind,item.id,source.task.id])),historyStatement(db,survivor.task.id,null,actor.id,'task.merged',{sourceId:source.task.id,operationId:id}),permanentEvent(db,{workspace:source.access.personal?null:workspace,actor:actor.id,action:'task.merged',type:'task',id:survivor.task.id,metadata:{id}}))
 // Capture the actual structural result inside this same transaction, for later split fencing.
 statements.push(bound(db,`UPDATE peg_task_merges SET after_state=json_set(after_state,'$.dependencies',json((SELECT json_group_array(json_object('id',id,'predecessor_id',predecessor_id,'successor_id',successor_id,'type',type,'lag_days',lag_days)) FROM (SELECT * FROM peg_dependencies WHERE predecessor_id=? OR successor_id=? ORDER BY id))),'$.homes',json((SELECT json_group_array(json_object('project_id',project_id,'section_id',section_id,'fields',fields,'position',position,'generation',(SELECT generation FROM peg_rule_link_generations WHERE kind='project' AND task_id=? AND target_id=project_id))) FROM (SELECT * FROM peg_task_projects WHERE task_id=? ORDER BY project_id)))) WHERE id=?`,[survivor.task.id,survivor.task.id,survivor.task.id,survivor.task.id,id]))
 await guarded(db,preview.rev,statements)
 return mergeView(db,actor,workspace,id)
}
export async function mergeUndoPreview(db:D1Database,actor:Actor,workspace:string,id:string){
 const rev=await revision(db),row=await record(db,actor,workspace,id)
 if(row.undone_at)throw conflict('merge_already_undone')
 const before=JSON.parse(row.before_state),after=JSON.parse(row.after_state),current=(await mergePair(db,actor,workspace,row.source_id,row.survivor_id,true)).survivor.task,history=await all<{detail:string}>(db,'SELECT detail FROM peg_history WHERE task_id=? AND id>(SELECT MAX(id) FROM peg_history WHERE task_id=? AND kind=? AND json_extract(detail,?)=?)',current.id,current.id,'task.merged','$.operationId',id),restored:string[]=[],conflicts:{field:string;reason:string}[]=[]
 for(const field of mergeFields)if(before.task[field]!==after.values[field]){
  if(field==='owner_id'&&!await workspaceRole(db,before.task.owner_id,workspace))conflicts.push({field,reason:'previous_owner_unavailable'})
  else if(current[field]!==after.values[field]||history.some(h=>Object.hasOwn(JSON.parse(h.detail),field)))conflicts.push({field,reason:'later_field_edit'})
  else restored.push(field)
 }
 const custom=[]
 for(const field of after.fields){
  const value=(await first<{value:string}>(db,'SELECT value FROM peg_field_values WHERE task_id=? AND field_id=?',current.id,field.id))?.value??null,prior=before.fields.find((v:any)=>v.field_id===field.id)?.value??null
  if(value===prior)continue
  if(value!==field.value||history.some(h=>Object.hasOwn(JSON.parse(h.detail),'keys')))conflicts.push({field:field.label,reason:'later_field_edit'})
  else custom.push({id:field.id,value:prior})
 }
 const links=await all<any>(db,'SELECT id,predecessor_id,successor_id,type,lag_days FROM peg_dependencies WHERE predecessor_id=? OR successor_id=? ORDER BY id',current.id,current.id)
 // A newer relationship may depend on the combined work; splitting then needs re-review.
 if(JSON.stringify(links)!==JSON.stringify(after.dependencies))conflicts.push({field:'dependencies',reason:'later_relationship_edit'})
 const homes=await all<any>(db,"SELECT p.project_id,p.section_id,p.fields,p.position,(SELECT generation FROM peg_rule_link_generations WHERE kind='project' AND task_id=p.task_id AND target_id=p.project_id) generation FROM peg_task_projects p WHERE task_id=? ORDER BY project_id",current.id)
 if(JSON.stringify(homes)!==JSON.stringify(after.homes))conflicts.push({field:'projects',reason:'later_relationship_edit'})
 const start=restored.includes('start_date')?before.task.start_date:current.start_date,due=restored.includes('due_date')?before.task.due_date:current.due_date
 if(start&&due&&Date.parse(start)>Date.parse(due))for(const field of ['start_date','due_date'])if(restored.includes(field)){restored.splice(restored.indexOf(field),1);conflicts.push({field,reason:'later_date_conflict'})}
 const plan={id,sourceId:row.source_id,survivorId:row.survivor_id,restored,custom,conflicts,canApply:!conflicts.some(c=>['dependencies','projects'].includes(c.field))}
 return {...plan,rev,token:await digest(['merge.undo',actor.id,rev,plan])}
}
export async function undoMerge(db:D1Database,actor:Actor,workspace:string,id:string,input:{token?:unknown}){
 const preview=await mergeUndoPreview(db,actor,workspace,id)
 if(input.token!==preview.token)throw conflict('merge_undo_review_changed')
 if(!preview.canApply)throw conflict('merge_undo_relationship_changed')
 const row=await record(db,actor,workspace,id),before=JSON.parse(row.before_state),after=JSON.parse(row.after_state),statements:D1PreparedStatement[]=[]
 if(preview.restored.length)statements.push(bound(db,`UPDATE peg_tasks SET ${preview.restored.map(f=>f+'=?').join(',')},updated_at=? WHERE id=?`,[...preview.restored.map(f=>before.task[f]),now(),row.survivor_id]))
 if(preview.restored.includes('status'))statements.push(bound(db,'UPDATE peg_tasks SET completed_at=? WHERE id=?',[before.task.completed_at,row.survivor_id]))
 for(const field of preview.custom)statements.push(field.value===null?bound(db,'DELETE FROM peg_field_values WHERE task_id=? AND field_id=?',[row.survivor_id,field.id]):bound(db,'UPDATE peg_field_values SET value=? WHERE task_id=? AND field_id=?',[field.value,row.survivor_id,field.id]))
 for(const item of await all<{kind:keyof typeof tables;object_id:string}>(db,'SELECT kind,object_id FROM peg_merge_items WHERE operation_id=?',id))if(tables[item.kind])statements.push(bound(db,`UPDATE ${tables[item.kind]} SET task_id=? WHERE id=? AND task_id=?`,[row.source_id,item.object_id,row.survivor_id]))
 for(const home of after.sourceHomes)if(!before.homes.some((h:any)=>h.project_id===home.project_id))statements.push(bound(db,'DELETE FROM peg_task_projects WHERE task_id=? AND project_id=?',[row.survivor_id,home.project_id]))
 for(const ref of before.refs)statements.push(bound(db,'UPDATE peg_task_refs SET task_id=?,current=? WHERE ref=?',[row.source_id,ref.current,ref.ref]))
 for(const edge of before.dependencies)statements.push(bound(db,'UPDATE peg_dependencies SET predecessor_id=?,successor_id=? WHERE id=?',[edge.predecessor_id,edge.successor_id,edge.id]),bound(db,'INSERT INTO peg_dependencies SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM peg_dependencies WHERE id=?)',[edge.id,edge.workspace_id,edge.predecessor_id,edge.successor_id,edge.type,edge.lag_days,edge.created_by,edge.created_at,edge.id]))
 statements.push(bound(db,'UPDATE peg_task_merges SET undone_at=? WHERE id=?',[now(),id]),historyStatement(db,row.survivor_id,null,actor.id,'task.merge_undone',{operationId:id}),historyStatement(db,row.source_id,null,actor.id,'task.merge_undone',{operationId:id}))
 await guarded(db,preview.rev,statements)
 return {id,sourceId:row.source_id,survivorId:row.survivor_id,conflicts:preview.conflicts}
}
