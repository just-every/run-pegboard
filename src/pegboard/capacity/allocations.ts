import { all, bound, conflict, invalid, now } from '../db'
import type { Actor } from '../workspace/people'
import { openTask, require } from '../tasks/access'
import { historyStatement, reopenGuard } from '../tasks/history'
import { digest, guarded, revision } from '../decisions/revision'
import { capacityMember, capacityPeople, effortHours } from './profiles'

export function effortInput(input:Record<string,any>):Record<string,any> {
 let people=input.people
 if(people===undefined&&Array.isArray(input.selected))people=input.selected.map((id:string)=>({personId:id,sourcePerson:input['sourcePerson:'+id],hours:input['hours:'+id]}))
 if(typeof people==='string'){try{people=JSON.parse(people)}catch{throw invalid('effort_people')}}
 return {...input,people}
}
export async function effortPreview(db:D1Database,actor:Actor,id:string,raw:Record<string,any>) {
 const input=effortInput(raw),rev=await revision(db),{task,access}=await openTask(db,actor,id)
 require(access,'edit');await capacityMember(db,actor,task.workspace_id,true)
 if(access.personal)throw conflict('shared_effort_requires_project')
 const source=String(input.source??'native'),sourceMode=String(input.sourceMode??'unknown'),mode=sourceMode==='unknown'?String(input.choice??''):sourceMode
 if(!['native','board-centric','workspace-list'].includes(source)||!['unknown','split','sum','per-person'].includes(sourceMode)||!['','split','sum','per-person'].includes(mode))throw invalid('effort_semantics')
 if(!Array.isArray(input.people)||!input.people.length||input.people.length>100)throw invalid('effort_people')
 const members=await capacityPeople(db,actor,task.workspace_id),ids=new Set<string>(),sources=new Set<string>()
 const people=input.people.map((p:any)=>{
  if(typeof p.personId!=='string'||!members.some(m=>m.id===p.personId)||ids.has(p.personId)||typeof p.sourcePerson!=='string'||!p.sourcePerson.trim()||p.sourcePerson.length>200||sources.has(p.sourcePerson))throw invalid('effort_person_mapping')
  ids.add(p.personId);sources.add(p.sourcePerson)
  return {personId:p.personId,sourcePerson:p.sourcePerson,name:members.find(m=>m.id===p.personId)!.name,hours:mode==='sum'?task.estimate_hours:mode==='split'?task.estimate_hours/input.people.length:mode==='per-person'?effortHours(p.hours):null}
 })
 if(!ids.has(task.owner_id))throw invalid('accountable_owner_mapping_required')
 if(mode==='per-person'&&Math.abs(people.reduce((n:number,p:{hours:number|null})=>n+(p.hours??0),0)-task.estimate_hours)>0.000001)throw invalid('effort_total_differs')
 const sourceItem=String(input.sourceItem??task.id);if(!sourceItem||sourceItem.length>200)throw invalid('effort_source_item')
 const plan={taskId:task.id,title:task.title,accountableOwner:task.owner_id,taskEstimateHours:task.estimate_hours,source,sourceItem,sourceMode,mode,changedSemantics:sourceMode==='unknown',repair:!mode?'Choose and review the missing source allocation semantics. No lossless workload match is claimed.':sourceMode==='unknown'?'Reviewed changed semantics; source equivalence remains unknown.':null,people,participantHours:mode?people.reduce((n:number,p:{hours:number|null})=>n+(p.hours??0),0):null,revision:rev.value}
 return {...plan,token:await digest([actor.id,plan]),review:rev}
}
export async function applyEffort(db:D1Database,actor:Actor,id:string,input:Record<string,any>) {
 const preview=await effortPreview(db,actor,id,input)
 if(!preview.mode)throw conflict('effort_semantics_review_required')
 if(typeof input.token!=='string'||input.token!==preview.token)throw conflict('review_changed')
 await guarded(db,preview.review,[reopenGuard(db,id,actor.id,'effort'),bound(db,'DELETE FROM peg_effort_allocations WHERE task_id=?',[id]),
  ...preview.people.map((p:{personId:string;sourcePerson:string;hours:number|null})=>bound(db,'INSERT INTO peg_effort_allocations VALUES(?,?,?,?)',[id,p.personId,p.sourcePerson,p.hours!])),
  bound(db,`INSERT INTO peg_effort_mappings VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(task_id) DO UPDATE SET source=excluded.source,source_item=excluded.source_item,source_mode=excluded.source_mode,mode=excluded.mode,changed_semantics=excluded.changed_semantics,reviewed_by=excluded.reviewed_by,reviewed_at=excluded.reviewed_at`,[id,preview.source,preview.sourceItem,preview.sourceMode,preview.mode,preview.changedSemantics?1:0,actor.id,now()]),
  ...preview.people.filter((p:{personId:string})=>p.personId!==preview.accountableOwner).map((p:{personId:string})=>bound(db,'INSERT OR IGNORE INTO peg_task_collaborators(task_id,operator_id) VALUES(?,?)',[id,p.personId])),
  historyStatement(db,id,null,actor.id,'effort.reviewed',{mode:preview.mode,changedSemantics:preview.changedSemantics})])
 return {taskId:id,taskEstimateHours:preview.taskEstimateHours,participantHours:preview.participantHours,people:preview.people,changedSemantics:preview.changedSemantics}
}
export const effortMapping=async(db:D1Database,id:string)=>({mapping:(await all(db,'SELECT source,source_item,source_mode,mode,changed_semantics FROM peg_effort_mappings WHERE task_id=?',id))[0]??null,allocations:await all(db,'SELECT person_id,source_person,hours FROM peg_effort_allocations WHERE task_id=? ORDER BY person_id',id)})
