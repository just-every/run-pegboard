import {all, first, invalid} from '../db'
import {digest, revision} from '../decisions/revision'
import {sourceDuplication, selection, enabled} from './source'
import {workspaceRole, type Actor} from '../workspace/people'
import {openTask} from '../tasks/access'
import {edgesAmong} from '../schedule/dependencies'
import {dayNumber, dayString, readStamp, writeStamp, workspaceZone} from '../schedule/calendar'
import type {TaskRow} from '../model'

export function shifted(value:string|null,offset:number){if(!value)return null;const stamp=readStamp(value);return writeStamp({...stamp,day:stamp.day+offset})}
export async function previewDuplicate(db:D1Database,actor:Actor,id:string,input:Record<string,any>){
 const rev=await revision(db),source=await sourceDuplication(db,actor,id)
 const name=String(input.name??`${source.project.name} copy`).trim()
 if(!name||name.length>120)throw invalid('name')
 const taskIds=selection(input.taskIds),memberIds=selection(input.memberIds),ruleIds=selection(input.ruleIds)
 const tasks=taskIds.map(taskId=>{const task=source.tasks.find(t=>t.id===taskId);if(!task)throw invalid('duplicate_task_unavailable');return task})
 for(const task of tasks)if(task.parent_id&&!taskIds.includes(task.parent_id))throw invalid('duplicate_parent_required')
 const members=memberIds.map(memberId=>{const m=source.members.find(m=>m.id===memberId);if(!m)throw invalid('duplicate_member_unavailable');return m})
 const rules=ruleIds.map(ruleId=>{const r=source.rules.find(r=>r.id===ruleId);if(!r)throw invalid('duplicate_rule_unavailable');return r})
 const dateMode=input.dateMode??'original'
 if(!['original','relative'].includes(dateMode))throw invalid('duplicate_date_mode')
 const sourceDays=tasks.flatMap(t=>[t.start_date,t.due_date]).filter((v):v is string=>!!v).map(v=>readStamp(v).day)
 const anchor=source.project.start_date??(sourceDays.length?dayString(Math.min(...sourceDays)):null)
 let start:string|null=null,offset=0
 if(dateMode==='relative'){
  start=String(input.startDate??'')
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||Number.isNaN(Date.parse(start))||new Date(start+'T00:00:00Z').toISOString().slice(0,10)!==start)throw invalid('duplicate_start_date')
  offset=anchor?dayNumber(start)-dayNumber(anchor):0
 }
 const includeAssignees=enabled(input.includeAssignees),warnings:string[]=[]
 const work=[]
 for(const task of tasks){
  const ownerId=includeAssignees?task.owner_id:actor.id
  if(ownerId&&!await workspaceRole(db,ownerId,source.project.workspace_id))throw invalid('duplicate_assignee_unavailable')
  work.push({...task,owner_id:ownerId,owner:ownerId===actor.id?actor.displayName:source.names[ownerId]??'Member',start_date:shifted(task.start_date,offset),due_date:shifted(task.due_date,offset),status:task.approval?'todo' as const:task.status})
  if(ownerId&&ownerId!==actor.id&&!['owner','admin'].includes(await workspaceRole(db,ownerId,source.project.workspace_id)??''))warnings.push(`${source.names[ownerId]??'An assignee'} needs a separately activated membership to open ${task.title}.`)
 }
 const fields=source.fields.filter(f=>{
  if(f.type==='rollup'){
   const config=JSON.parse(f.config)
   if(config.sourceProject&&config.sourceProject!==id){warnings.push(`${f.label} is omitted because it reads another project.`);return false}
  }
  return true
 })
 const values=[]
 for(const task of tasks)for(const field of fields){
  const row=await first<{value:string}>(db,'SELECT value FROM peg_field_values WHERE task_id=? AND field_id=?',task.id,field.id)
  if(!row)continue
  let value=JSON.parse(row.value)
  if(field.type==='rollup'){
   if(!Array.isArray(value)||value.some(id=>!taskIds.includes(id))){warnings.push(`${field.label} on ${task.title} is omitted because its relationship includes work outside the selection.`);continue}
  }
  if(field.type==='people'&&Array.isArray(value)){
   const active=[];for(const person of value)if(await workspaceRole(db,person,source.project.workspace_id))active.push(person)
   if(active.length!==value.length)warnings.push(`Inactive people were removed from ${field.label} on ${task.title}.`)
   value=active
  }
  if(field.type==='date'&&typeof value==='string')value=shifted(value,offset)
  values.push({taskId:task.id,fieldId:field.id,value})
 }
 const capacity=[]
 for(const ownerId of [...new Set(work.map(t=>t.owner_id))]){
  const added=work.filter(t=>t.owner_id===ownerId&&t.status!=='done'),dated=added.flatMap(t=>[t.start_date,t.due_date]).filter((v):v is string=>!!v).sort(),from=dated[0]?.slice(0,10)??null,to=dated.at(-1)?.slice(0,10)??null
  let existingHours=0,existingTasks=0
  if(from&&to)for(const task of await all<TaskRow>(db,"SELECT * FROM peg_tasks WHERE workspace_id=? AND owner_id=? AND status<>'done' AND COALESCE(substr(start_date,1,10),substr(due_date,1,10))<=? AND COALESCE(substr(due_date,1,10),substr(start_date,1,10))>=?",source.project.workspace_id,ownerId,to,from)){
   const opened=await openTask(db,actor,task.id).catch(error=>{if(error?.status===404)return null;throw error})
   if(opened){existingHours+=task.estimate_hours;existingTasks++}
  }
  capacity.push({ownerId,owner:work.find(t=>t.owner_id===ownerId)!.owner,addedHours:added.reduce((n,t)=>n+t.estimate_hours,0),existingHours,existingTasks,from,to})
 }
 const options={name,taskIds,memberIds,ruleIds,includeAssignees,dateMode,startDate:start,offset}
 const projectDates={startDate:dateMode==='relative'?start:source.project.start_date,dueDate:shifted(source.project.due_date,offset)}
 const dependencies=await edgesAmong(db,source.project.workspace_id,taskIds)
 const payload={source,options,work,members,rules,fields,values,dependencies,projectDates,capacity,warnings:[...new Set(warnings)],audience:{visibility:'private' as const,ownerId:actor.id,owner:actor.displayName,administrators:'Current workspace owners and administrators retain administrative access.',stagedMembers:members.length,stagedRules:rules.length},timezone:workspaceZone,offset}
 return {...payload,rev,token:await digest([actor.id,rev,payload])}
}
export type DuplicatePreview=Awaited<ReturnType<typeof previewDuplicate>>
