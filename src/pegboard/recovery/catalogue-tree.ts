import {all,bound,newId,now,type Param} from '../db'
import {conversionGraph} from '../conversion/graph'
import {viewTask} from '../tasks/view'
import {definitions} from '../fields/definitions'
import {openProject,fieldReadable} from '../workspace/projects'
import {prepareTask} from '../tasks/tasks'
import {issueRef} from '../references/refs'
import {historyStatement} from '../tasks/history'
import type {Actor} from '../workspace/people'

export async function copyTreePlan(db:D1Database,actor:Actor,workspace:string,id:string,projectId:string){
 const graph=await conversionGraph(db,actor,workspace,[id]),destination=await openProject(db,actor,projectId),fields=await definitions(db,projectId),nodes=[]
 for(const row of graph){
  const visible=await viewTask(db,actor,row.id),values=[]
  for(const field of fields){
   if(!fieldReadable(field,destination.effective)||['formula','rollup'].includes(field.type)||!visible.projects.some(p=>p.fields.some(f=>f.id===field.id)))continue
   const value=await db.prepare('SELECT value FROM peg_field_values WHERE task_id=? AND field_id=?').bind(row.id,field.id).first<{value:string}>()
   if(value)values.push({id:field.id,label:field.label,value:value.value})
  }
  nodes.push({id:row.id,parentId:row.parent_id,kind:visible.kind,title:row.title,description:row.description,status:visible.kind==='approval'?'todo':row.status,priority:row.priority,startDate:row.start_date,dueDate:row.due_date,estimateHours:row.estimate_hours,...('internalNotes' in visible?{internalNotes:row.internal_notes,internalOnly:!!row.internal_only}:{}),fields:values})
 }
 return nodes
}
export async function prepareTreeCopy(db:D1Database,actor:Actor,projectId:string,nodes:Awaited<ReturnType<typeof copyTreePlan>>,offsets:Map<string,number>){
 const {project}=await openProject(db,actor,projectId),root=nodes[0],created=await prepareTask(db,actor,{...root,parentId:undefined,title:root.title.slice(0,295)+' copy',projectId,kind:root.kind==='approval'?'approval':root.kind==='milestone'?'milestone':'task',ownerId:actor.id},{queueRules:false,referenceOffsets:offsets}),mapping=new Map([[root.id,created.id]]),statements=[...created.statements],at=now()
 for(const node of nodes.slice(1))mapping.set(node.id,newId('tsk'))
 for(const node of nodes){
  const id=mapping.get(node.id)!,parent=node.id===root.id?null:mapping.get(node.parentId!)!
  if(node.id!==root.id){
   statements.push(bound(db,'INSERT INTO peg_tasks(id,workspace_id,title,description,kind,parent_id,status,priority,start_date,due_date,owner_id,creator_id,estimate_hours,internal_only,internal_notes,created_at,updated_at,completed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[id,project.workspace_id,node.title,node.description,node.kind==='approval'?'task':node.kind,parent,node.status,node.priority,node.startDate,node.dueDate,actor.id,actor.id,node.estimateHours,Number(node.internalOnly??false),node.internalNotes??'',at,at,node.status==='done'?at:null]))
   if(node.kind==='approval')statements.push(bound(db,'INSERT INTO peg_approval_tasks VALUES(?,?,?)',[id,actor.id,at]))
   const offset=project.prefix?offsets.get(project.prefix)??0:0,reference=await issueRef(db,project,id,offset)
   if(reference){statements.push(...reference.statements);offsets.set(project.prefix!,offset+1)}
   statements.push(historyStatement(db,id,null,actor.id,'created',{kind:node.kind,parentId:parent,duplicatedFrom:node.id}))
  }
  statements.push(...node.fields.map(f=>bound(db,'INSERT INTO peg_field_values VALUES(?,?,?)',[id,f.id,f.value])))
 }
 return {id:created.id,ids:[...mapping.values()],statements}
}
export async function treeVersions(db:D1Database,actor:Actor,workspace:string,id:string){
 const graph=await conversionGraph(db,actor,workspace,[id]),versions=[]
 for(const task of graph){
  const generation=await db.prepare("SELECT generation FROM peg_rule_mutation_generations WHERE task_id=? AND kind='task'").bind(task.id).first<{generation:number}>()
  const homes=await all<{project_id:string;section_id:string|null;fields:string;position:number}>(db,'SELECT project_id,section_id,fields,position FROM peg_task_projects WHERE task_id=? ORDER BY project_id',task.id)
  versions.push({id:task.id,parentId:task.parent_id,generation:generation?.generation??0,homes})
 }
 return versions.sort((a,b)=>a.id.localeCompare(b.id))
}
