import {all, bound, conflict, first, newId, notFound, now} from '../db'
import {guarded} from '../decisions/revision'
import {auditStatement, bumpEpoch} from '../authorization/audit'
import {prepareTask} from '../tasks/tasks'
import {openTask} from '../tasks/access'
import {openProject} from '../workspace/projects'
import type {Actor} from '../workspace/people'
import {duplicationAdmin} from './source'
import {previewDuplicate} from './preview'

export interface StagedRow {id:string;project_id:string;kind:'member'|'rule';source_id:string;config:string;activated_at:number|null;activated_by:string|null}
export async function duplicateProject(db:D1Database,actor:Actor,id:string,input:Record<string,any>){
 // Replay never produces a second graph, even after the source has subsequently changed.
 if(typeof input.revision==='string'){
  const replay=await first<{project_id:string;actor_id:string;source_project:string}>(db,'SELECT * FROM peg_project_duplicates WHERE review_token=?',input.revision)
  if(replay){if(replay.actor_id!==actor.id||replay.source_project!==id)throw conflict('duplicate_replay_refused');await duplicationAdmin(db,actor,id);return duplicateResult(db,actor,replay.project_id)}
 }
 const preview=await previewDuplicate(db,actor,id,input)
 if(input.revision!==preview.token)throw conflict('duplicate_preview_changed')
 const projectId=newId('prj'),at=now(),statements:D1PreparedStatement[]=[]
 const {source}=preview
 statements.push(bound(db,"INSERT INTO peg_projects(id,workspace_id,name,description,owner_id,visibility,start_date,due_date,created_by,created_at) VALUES(?,?,?,?,?,'private',?,?,?,?)",[projectId,source.project.workspace_id,preview.options.name,source.project.description,actor.id,preview.projectDates.startDate,preview.projectDates.dueDate,actor.id,at]),bound(db,'INSERT INTO peg_project_duplicates VALUES(?,?,?,?,?,?)',[projectId,id,actor.id,preview.token,JSON.stringify(preview.options),at]))
 const sections=new Map(source.sections.map(s=>[s.id,newId('sec')]))
 for(const section of source.sections)statements.push(bound(db,'INSERT INTO peg_sections VALUES(?,?,?,?,?)',[sections.get(section.id)!,projectId,section.name,section.position,section.maps_to]))
 const taskIds=new Map<string,string>()
 // Prepare as private work, then place the entire graph in the same atomic batch.
 // This lets the native builder validate task fields without an uncommitted destination lookup.
 for(const work of preview.work){
  const prepared=await prepareTask(db,actor,{workspaceId:source.project.workspace_id,title:work.title,description:work.description,kind:work.approval?'approval':work.kind,status:work.status,priority:work.priority,startDate:work.start_date,dueDate:work.due_date,estimateHours:work.estimate_hours,internalOnly:!!work.internal_only},{queueRules:false})
  taskIds.set(work.id,prepared.id);statements.push(...prepared.statements)
 }
 for(const work of preview.work){
  const taskId=taskIds.get(work.id)!,placement=source.placements.find(p=>p.task_id===work.id)
  statements.push(bound(db,'UPDATE peg_tasks SET owner_id=?,parent_id=?,kind=? WHERE id=?',[work.owner_id,work.parent_id?taskIds.get(work.parent_id)!:null,work.kind,taskId]),bound(db,'INSERT INTO peg_duplicate_tasks VALUES(?,?,?)',[projectId,taskId,work.id]))
  if(!work.parent_id)statements.push(bound(db,'INSERT INTO peg_task_projects(task_id,project_id,section_id,position,added_by,added_at) VALUES(?,?,?,?,?,?)',[taskId,projectId,placement?.section_id?sections.get(placement.section_id)??null:null,placement?.position??0,actor.id,at]))
 }
 const fieldIds=new Map<string,string>()
 for(const field of preview.fields){
  let fieldId=field.id
  if(field.type==='rollup'){
   fieldId=newId('field');const config={...JSON.parse(field.config),sourceProject:projectId}
   statements.push(bound(db,'INSERT INTO peg_field_definitions(id,workspace_id,authority_project,key,label,type,visibility,units,config,version) VALUES(?,?,?,?,?,?,?,?,?,1)',[fieldId,source.project.workspace_id,projectId,field.key,field.label,field.type,field.visibility,field.units,JSON.stringify(config)]))
  }
  fieldIds.set(field.id,fieldId)
  statements.push(bound(db,'INSERT INTO peg_project_fields VALUES(?,?,?)',[projectId,field.key,fieldId]))
 }
 for(const value of preview.values){
  const field=preview.fields.find(f=>f.id===value.fieldId)!
  const next=field.type==='rollup'?(value.value as string[]).map(id=>taskIds.get(id)!):value.value
  statements.push(bound(db,'INSERT INTO peg_field_values VALUES(?,?,?)',[taskIds.get(value.taskId)!,fieldIds.get(value.fieldId)!,JSON.stringify(next)]))
 }
 for(const edge of preview.dependencies)statements.push(bound(db,'INSERT INTO peg_dependencies VALUES(?,?,?,?,?,?,?,?)',[newId('dep'),source.project.workspace_id,taskIds.get(edge.predecessor)!,taskIds.get(edge.successor)!,edge.type,edge.lag,actor.id,at]))
 for(const member of preview.members)statements.push(bound(db,"INSERT INTO peg_duplicate_staged VALUES(?,?,'member',?,?,NULL,NULL)",[newId('stage'),projectId,member.id,JSON.stringify(member)]))
 for(const rule of preview.rules)statements.push(bound(db,"INSERT INTO peg_duplicate_staged VALUES(?,?,'rule',?,?,NULL,NULL)",[newId('stage'),projectId,rule.id,JSON.stringify(rule)]))
 statements.push(auditStatement(db,{workspaceId:source.project.workspace_id,actorId:actor.id,action:'project.duplicated',targetType:'project',targetId:projectId,detail:{sourceProject:id,tasks:preview.work.length,membersStaged:preview.members.length,rulesStaged:preview.rules.length}}),bumpEpoch(db))
 await guarded(db,preview.rev,statements)
 return duplicateResult(db,actor,projectId)
}

export async function duplicateResult(db:D1Database,actor:Actor,id:string){
 const {project}=await duplicationAdmin(db,actor,id)
 const origin=await first<{source_project:string;created_at:number;options:string}>(db,'SELECT * FROM peg_project_duplicates WHERE project_id=?',id)
 if(!origin)throw notFound()
 const source=await openProject(db,actor,origin.source_project).catch(error=>{if(error?.status===404)return null;throw error})
 const tasks=[]
 for(const link of await all<{task_id:string;source_task:string}>(db,'SELECT * FROM peg_duplicate_tasks WHERE project_id=? ORDER BY task_id',id)){
  const duplicate=await openTask(db,actor,link.task_id).catch(error=>{if(error?.status===404)return null;throw error})
  if(!duplicate?.access.contexts.has(id))continue
  const original=source?await openTask(db,actor,link.source_task).catch(error=>{if(error?.status===404)return null;throw error}):null
  const readable=original?.access.contexts.has(origin.source_project)
  tasks.push({id:duplicate.task.id,title:duplicate.task.title,parentId:duplicate.task.parent_id,ownerId:duplicate.task.owner_id,startDate:duplicate.task.start_date,dueDate:duplicate.task.due_date,status:duplicate.task.status,sourceId:readable?link.source_task:null,sourceTitle:readable?original!.task.title:null,approval:!!await first(db,'SELECT 1 FROM peg_approval_tasks WHERE task_id=?',link.task_id)})
 }
 const staged=(await all<StagedRow>(db,'SELECT * FROM peg_duplicate_staged WHERE project_id=? ORDER BY kind,id',id)).map(row=>({...row,config:JSON.parse(row.config)}))
 return {project,source:source?{id:source.project.id,name:source.project.name}:null,createdAt:origin.created_at,tasks,staged,options:JSON.parse(origin.options)}
}
export type DuplicateResult=Awaited<ReturnType<typeof duplicateResult>>
