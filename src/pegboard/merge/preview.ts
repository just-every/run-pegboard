import {all,first,invalid,conflict} from '../db'
import {revision,digest} from '../decisions/revision'
import {mergePair} from './authority'
import {projectHomes} from '../conversion/context'
import {definitions} from '../fields/definitions'
import {fieldReadable} from '../workspace/projects'
import {viewTask} from '../tasks/view'
import {propose} from '../schedule/graph'
import {taskCalendars} from '../schedule/availability'
import {toEdge} from '../schedule/dependencies'
import type {TaskRow} from '../model'
import {proofView} from '../records/custody'
import type {Actor} from '../workspace/people'

export const mergeFields=['title','description','owner_id','priority','status','start_date','due_date','estimate_hours','internal_notes'] as const
export interface MergeInput {sourceId?:unknown;survivorId?:unknown;choices?:unknown;token?:unknown;[key:string]:unknown}
export function mergeChoices(input:MergeInput):Record<string,'source'|'survivor'>{
 let choices=input.choices??Object.fromEntries(Object.entries(input).filter(([k])=>k.startsWith('choice:')).map(([k,v])=>[k.slice(7),v]))
 if(typeof choices==='string')try{choices=JSON.parse(choices)}catch{throw invalid('merge_choices')}
 if(!choices||typeof choices!=='object'||Array.isArray(choices)||Object.values(choices).some(v=>v!=='source'&&v!=='survivor'))throw invalid('merge_choices')
 return choices as Record<string,'source'|'survivor'>
}
export async function mergePreview(db:D1Database,actor:Actor,workspace:string,input:MergeInput){
 const rev=await revision(db),{source,survivor,sourceGraph,survivorGraph}=await mergePair(db,actor,workspace,String(input.sourceId??''),String(input.survivorId??'')),choices=mergeChoices(input),fields=[],unresolved:string[]=[],values:Record<string,any>={}
 for(const field of mergeFields){
  const a=source.task[field],b=survivor.task[field],different=a!==b,choice=choices[field]
  if(different&&!choice)unresolved.push(field)
  values[field]=different&&choice==='source'?a:b
  fields.push({key:field,source:a,survivor:b,choice:choice??'',different})
 }
 if(values.start_date&&values.due_date&&Date.parse(values.start_date)>Date.parse(values.due_date))throw invalid('merge_date_order')
 const stored=await all<{task_id:string;field_id:string;value:string}>(db,'SELECT * FROM peg_field_values WHERE task_id IN (?,?) ORDER BY field_id,task_id',source.task.id,survivor.task.id),custom=[]
 for(const id of [...new Set(stored.map(v=>v.field_id))]){
  const a=stored.find(v=>v.task_id===source.task.id&&v.field_id===id)?.value??null,b=stored.find(v=>v.task_id===survivor.task.id&&v.field_id===id)?.value??null
  let definition:Awaited<ReturnType<typeof definitions>>[number]|undefined
  for(const home of [...source.homes,...survivor.homes]){const candidate=(await definitions(db,home.project_id)).find(f=>f.id===id);if(candidate){if(!fieldReadable(candidate, (source.access.contexts.get(home.project_id)??survivor.access.contexts.get(home.project_id))!))throw conflict('merge_field_scope');definition=candidate}}
  if(!definition)throw conflict('merge_field_scope')
  const key='field:'+id,choice=choices[key],different=a!==null&&b!==null&&a!==b
  if(different&&!choice)unresolved.push(key)
  custom.push({key,id,label:definition.label,source:a?JSON.parse(a):null,survivor:b?JSON.parse(b):null,choice:choice??'',different,value:different&&choice==='source'?a:b??a})
 }
 const dependencies=await all<any>(db,'SELECT * FROM peg_dependencies WHERE workspace_id=? ORDER BY id',workspace),mapped=dependencies.map(e=>({...e,predecessor_id:e.predecessor_id===source.task.id?survivor.task.id:e.predecessor_id,successor_id:e.successor_id===source.task.id?survivor.task.id:e.successor_id})),edges=mapped.filter(e=>e.predecessor_id!==e.successor_id),conflicts:string[]=[]
 const pairs=new Map<string,string>()
 for(const e of edges){const key=e.predecessor_id+':'+e.successor_id,value=e.type+':'+e.lag_days;if(pairs.has(key)&&pairs.get(key)!==value)conflicts.push('dependency_conflict');pairs.set(key,value)}
 const reachable=new Set<string>(),pending=edges.filter(e=>e.predecessor_id===survivor.task.id).map(e=>e.successor_id)
 while(pending.length){const id=pending.pop()!;if(id===survivor.task.id){conflicts.push('dependency_cycle');break}if(reachable.has(id))continue;reachable.add(id);pending.push(...edges.filter(e=>e.predecessor_id===id).map(e=>e.successor_id))}
 const linked=dependencies.filter(e=>[source.task.id,survivor.task.id].includes(e.predecessor_id)||[source.task.id,survivor.task.id].includes(e.successor_id))
 for(const edge of linked)for(const id of [edge.predecessor_id,edge.successor_id])await viewTask(db,actor,id)
 // Refuse a merge needing date propagation; the ordinary schedule door must review that change first.
 if(linked.length){
  const connected=new Set([survivor.task.id]);let expanded=true
  while(expanded){expanded=false;for(const edge of edges)if(connected.has(edge.predecessor_id)||connected.has(edge.successor_id))for(const id of [edge.predecessor_id,edge.successor_id])if(!connected.has(id)){connected.add(id);expanded=true}}
  const tasks=(await all<TaskRow>(db,'SELECT * FROM peg_tasks WHERE workspace_id=?',workspace)).filter(t=>connected.has(t.id)&&t.id!==source.task.id).map(t=>t.id===survivor.task.id?{...t,...values}:t)
  const calendars=(await taskCalendars(db,tasks)).calendars,result=propose(tasks.map(t=>({id:t.id,start:t.start_date,due:t.due_date,done:t.status==='done',calendar:calendars.get(t.id)})),edges.filter(e=>connected.has(e.predecessor_id)&&connected.has(e.successor_id)).map(toEdge),{})
  if(result.shifts.length||result.cyclic.length)conflicts.push('dependency_dates_require_schedule_review')
 }
 // Personal files retain their task owner's custody after a reviewed project share.
 // Transferring them to a different owner would change who can download their bytes.
 for(const subject of [source,survivor])if(values.owner_id!==subject.task.owner_id&&await first(db,'SELECT 1 FROM peg_attachments WHERE task_id=? AND project_id IS NULL',subject.task.id))conflicts.push('merge_attachment_scope')
 const views=await Promise.all([viewTask(db,actor,source.task.id),viewTask(db,actor,survivor.task.id)])
 const proofs=[]
 for(const task of views)for(const row of await all<{id:string}>(db,'SELECT id FROM peg_proofs WHERE task_id=? ORDER BY id',task.id)){
  const proof=await proofView(db,actor,row.id),version=proof.versions.find(v=>v.id===proof.proof.current_version)!
  proofs.push({id:row.id,sourceTaskId:task.id,versionId:version.id,name:task.attachments.find(a=>a.id===version.attachment_id)?.name??'Reviewed attachment',state:proof.state})
 }
 const plan={source:{id:source.task.id,title:source.task.title},survivor:{id:survivor.task.id,title:survivor.task.title},fields,custom,values,choices,unresolved,conflicts:[...new Set(conflicts)],projects:[...new Map(views.flatMap(v=>v.projects).map(p=>[p.id,{id:p.id,name:p.name,section:p.section}])).values()],collaborators:[...new Map(views.flatMap(v=>v.collaborators).map(p=>[p.id,p])).values()],tags:[...new Map(views.flatMap(v=>v.tags).map(t=>[t.id,{id:t.id,name:t.name}])).values()],comments:views.flatMap(v=>v.comments.map(c=>({...c,sourceTaskId:v.id}))),attachments:views.flatMap(v=>v.attachments.map(a=>({...a,sourceTaskId:v.id}))),dependencies:linked.map(e=>({id:e.id,from:e.predecessor_id,to:e.successor_id,type:e.type,lag:e.lag_days,removesInternal:e.predecessor_id===source.task.id&&e.successor_id===survivor.task.id||e.successor_id===source.task.id&&e.predecessor_id===survivor.task.id})),canApply:!unresolved.length&&!conflicts.length}
 const children=[...sourceGraph,...survivorGraph].filter(t=>t.parent_id).map(t=>({id:t.id,title:t.title,parentId:t.parent_id}))
 return {...plan,proofs,children,rev,token:await digest(['merge',workspace,actor.id,rev,plan,proofs,children])}
}
