import { bound, conflict, first, invalid, newId, now, PegError } from '../db'
import { digest, guarded, revision } from '../decisions/revision'
import { prepareTask } from '../tasks/tasks'
import { historyStatement } from '../tasks/history'
import { addWorkingTime, readStamp, writeStamp } from '../schedule/calendar'
import { internalForm, published, publicForm, text, type Definition, type FormRow } from './forms'
import type { Actor } from '../workspace/people'
export interface Submission { id:string;form_id:string;form_version:number;request_key:string;fingerprint:string;task_id:string;source_actor:string;submitted_at:number;deadline:number;triaged_at:number|null;escalated_at:number|null }
function answersFor(definition:Definition,input:unknown) {
 if(!input||typeof input!=='object'||Array.isArray(input))throw invalid('intake_answers')
 const answers=input as Record<string,unknown>,out:Record<string,string>={}
 if(Object.keys(answers).some(key=>!definition.fields.some(f=>f.id===key)))throw invalid('intake_answers')
 for(const field of definition.fields){
  const visible=!field.when||out[field.when.field]===field.when.equals
  const answer=answers[field.id]
  if(!visible){if(answer!==undefined&&answer!=='')throw invalid('intake_hidden_answer');continue}
  if(answer===undefined||answer===''){if(field.required)throw invalid('intake_required');continue}
  const value=text(answer,field.id===definition.mapping.title?300:4000)
  if(field.choices&&!field.choices.includes(value))throw invalid('intake_choice')
  out[field.id]=value
 }
 return out
}
const acknowledgment=(row:Submission)=>({receipt:row.id,acknowledgment:'Request received',submittedAt:row.submitted_at,deadline:row.deadline})
export async function submitIntake(db:D1Database,source:{actor:Actor;formId:string}|{capability:string},input:Record<string,any>) {
 // Attachment metadata, unknown mappings and identity claims never get silently discarded.
 const allowed=new Set(['version','requestKey','answers','website','_next'])
 if(Object.keys(input).some(k=>!allowed.has(k))||input.website)throw invalid('intake_input')
 const key=text(input.requestKey,100)
 if(!/^[a-zA-Z0-9_-]{8,100}$/.test(key))throw invalid('intake_request_key')
 for(let attempt=0;attempt<4;attempt++){
  const rev=await revision(db),row:FormRow='capability'in source?await publicForm(db,source.capability):await internalForm(db,source.actor,source.formId)
  if(Number(input.version)!==row.version)throw conflict('intake_version')
  const {actor:publisher,definition,project}=await published(db,row),publicSource='capability'in source
  const answers=answersFor(definition,input.answers),sourceActor=publicSource?'public_intake':source.actor.id
  const description=definition.mapping.description.filter(id=>answers[id]).map(id=>definition.fields.find(f=>f.id===id)!.label+': '+answers[id]).join('\n')
  // Task creation bounds descriptions. Refuse before writing rather than acknowledge lost answers.
  if(description.length>20000)throw invalid('intake_mapping_too_large')
  const fingerprint=await digest([row.version,answers,sourceActor,publicSource?row.public_hash:null])
  const previous=await first<Submission>(db,'SELECT * FROM peg_intake_submissions WHERE form_id=? AND request_key=?',row.id,key)
  if(previous){
   if(previous.fingerprint!==fingerprint)throw conflict('intake_replay_changed')
   if(!await first(db,'SELECT id FROM peg_tasks WHERE id=?',previous.task_id))throw new PegError(410,'intake_work_erased')
   return {...acknowledgment(previous),replayed:true}
  }
  const calendar=JSON.parse(row.published_calendar!),at=now(),deadline=Date.parse(writeStamp(addWorkingTime(readStamp(new Date(at).toISOString(),calendar.zone),definition.hours*3600000,calendar),calendar.zone))
  const prepared=await prepareTask(db,publicSource?publisher:source.actor,{projectId:row.project_id,title:answers[definition.mapping.title],description,ownerId:definition.mapping.ownerId,priority:definition.mapping.priority},{queueRules:false,sourceActorId:publicSource?'public_intake':undefined})
  const submission:Submission={id:newId('submission'),form_id:row.id,form_version:row.version,request_key:key,fingerprint,task_id:prepared.id,source_actor:sourceActor,submitted_at:at,deadline,triaged_at:null,escalated_at:null}
  try {
   await guarded(db,rev,[bound(db,'INSERT INTO peg_intake_guards VALUES(?,?,?)',[newId('guard'),row.id,row.version]),...prepared.statements,bound(db,'INSERT INTO peg_intake_submissions(id,form_id,form_version,request_key,fingerprint,task_id,source_actor,submitted_at,deadline,calendar) VALUES(?,?,?,?,?,?,?,?,?,?)',[submission.id,row.id,row.version,key,fingerprint,prepared.id,sourceActor,at,deadline,JSON.stringify(calendar)]),historyStatement(db,prepared.id,row.project_id,sourceActor,'intake.submitted',{formId:row.id,version:row.version,deadline})])
   return {...acknowledgment(submission),replayed:false}
  }catch(error){if(!(error instanceof PegError&&error.code==='review_changed')&&!/intake_changed/.test(String(error)))throw error;if(attempt===3)throw conflict('intake_changed')}
 }
 throw conflict('intake_changed')
}
export async function limitPublic(db:D1Database,capability:string,address:string) {
 const bucket=await digest([capability,address,Math.floor(now()/600000)])
 await db.prepare('DELETE FROM peg_intake_limits WHERE expires_at<=?').bind(now()).run()
 try{await db.prepare('INSERT INTO peg_intake_limits(bucket,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET attempts=attempts+1').bind(bucket,now()+600000).run()}
 catch(error){if(/CHECK constraint/.test(String(error)))throw new PegError(429,'intake_rate_limited');throw error}
}
