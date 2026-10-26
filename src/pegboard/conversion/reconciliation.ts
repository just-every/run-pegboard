import {fieldReadable} from '../workspace/projects'
import type {FieldRow} from '../model'
import {all,first} from '../db'
import {digest} from '../decisions/revision'
import {openTask} from '../tasks/access'
import {readAttachment} from '../tasks/view'
import {proofView} from '../records/custody'
import {dependenciesOf} from '../schedule/dependencies'
import {sheetView} from '../time/time'
import {isRecoveryHidden} from '../recovery/visibility'
import type {Actor} from '../workspace/people'

export async function reconcileConversion(db:D1Database,actor:Actor,taskIds:string[]){
 const manifest:{tasks:any[];comments:any[];files:any[];proofVersions:any[];time:any[];aliases:any[];dependencies:any[];history:any[];fields:any[];collaborators:any[]}={tasks:[],comments:[],files:[],proofVersions:[],time:[],aliases:[],dependencies:[],history:[],fields:[],collaborators:[]}
 const sheets=new Map<string,Awaited<ReturnType<typeof sheetView>>|null>(),seenEdges=new Set<string>()
 for(const id of [...new Set(taskIds)].sort()){
  const {task,access}=await openTask(db,actor,id)
  manifest.tasks.push({id,creatorId:task.creator_id,ownerId:task.owner_id,createdAt:task.created_at,estimateHours:task.estimate_hours,approval:!!await first(db,'SELECT 1 FROM peg_approval_tasks WHERE task_id=?',id)})
  const scoped=(row:{project_id:string|null})=>row.project_id===null||access.contexts.has(row.project_id)
  for(const row of await all<any>(db,'SELECT * FROM peg_comments WHERE task_id=? ORDER BY id',id))if(scoped(row))manifest.comments.push({id:row.id,taskId:id,projectId:row.project_id,authorId:row.author_id,digest:await digest(row)})
  for(const row of await all<any>(db,'SELECT id,project_id,created_by,size FROM peg_attachments WHERE task_id=? ORDER BY id',id)){
   if(row.project_id===null?task.owner_id!==actor.id:!access.contexts.has(row.project_id))continue
   if(await isRecoveryHidden(db,'attachment',row.id))continue
   const version=await first<{id:string}>(db,'SELECT id FROM peg_proof_versions WHERE attachment_id=?',row.id)
   if(version&&await isRecoveryHidden(db,'proof_version',version.id))continue
   const file=await readAttachment(db,actor,row.id),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',file.bytes))].map(n=>n.toString(16).padStart(2,'0')).join('')
   manifest.files.push({...row,taskId:id,digest:hash})
  }
  for(const p of await all<{id:string}>(db,'SELECT id FROM peg_proofs WHERE task_id=? ORDER BY id',id)){
   const proof=await proofView(db,actor,p.id).catch(error=>{if(error?.status===404)return null;throw error})
   if(proof)for(const version of proof.versions)manifest.proofVersions.push({...version,taskId:id,decisions:proof.decisions.filter(d=>d.version_id===version.id)})
  }
  for(const row of await all<any>(db,'SELECT * FROM peg_time_entries WHERE task_id=? ORDER BY id',id)){
   if(!sheets.has(row.sheet_id))sheets.set(row.sheet_id,await sheetView(db,actor,row.sheet_id).catch(error=>{if(error?.status===403||error?.status===404)return null;throw error}))
   const visible=sheets.get(row.sheet_id)?.entries.find(e=>e.id===row.id&&e.available)
   if(visible)manifest.time.push({id:row.id,taskId:id,projectId:row.project_id,personId:row.person_id,seconds:row.seconds,startMs:row.start_ms,endMs:row.end_ms,source:row.source,digest:await digest(row)})
  }
  manifest.aliases.push(...await all<any>(db,'SELECT * FROM peg_task_refs WHERE task_id=? ORDER BY ref',id))
  for(const edge of await dependenciesOf(db,actor,id))if(!seenEdges.has(edge.id)){seenEdges.add(edge.id);manifest.dependencies.push({id:edge.id,taskId:id,otherId:edge.task.id,type:edge.type,lag:edge.lag,direction:edge.direction})}
  manifest.history.push(...(await all<any>(db,'SELECT * FROM peg_history WHERE task_id=? ORDER BY id',id)).filter(scoped).map(row=>({id:row.id,taskId:id,actorId:row.actor_id,projectId:row.project_id,kind:row.kind})))
  for(const row of await all<{field_id:string;value:string}>(db,'SELECT * FROM peg_field_values WHERE task_id=? ORDER BY field_id',id)){
   const field=await first<FieldRow>(db,'SELECT * FROM peg_field_definitions WHERE id=?',row.field_id)
   if(!field)continue
   const projects=await all<{project_id:string}>(db,'SELECT project_id FROM peg_project_fields WHERE field_id=?',row.field_id)
   if(projects.some(p=>{const effective=access.contexts.get(p.project_id);return effective&&fieldReadable(field,effective)}))manifest.fields.push({taskId:id,fieldId:row.field_id,digest:await digest(row.value)})
  }
  manifest.collaborators.push(...await all<any>(db,'SELECT * FROM peg_task_collaborators WHERE task_id=? ORDER BY operator_id',id))
 }
 return {tasks:manifest.tasks.length,comments:manifest.comments.length,files:manifest.files.length,proofVersions:manifest.proofVersions.length,timeEntries:manifest.time.length,timeSeconds:manifest.time.reduce((n,row)=>n+(row.seconds??0),0),aliases:manifest.aliases.length,dependencies:manifest.dependencies.length,history:manifest.history.length,fields:manifest.fields.length,collaborators:manifest.collaborators.length,digest:await digest(manifest),manifest}
}
