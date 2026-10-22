// Owner-authorized, single-goal sources. There is no outbound fetch or shared provider credential.
import {all,bound,conflict,first,forbidden,invalid,newId,now,PegError} from '../db'
import {auditStatement} from '../authorization/audit'
import {digest,guarded,revision} from '../decisions/revision'
import {numericSourceGoal} from './goals'
import type {Actor} from '../workspace/people'
interface Source {id:string;goal_id:string;owner_id:string;name:string;kind:'api'|'csv';token_hash:string|null;created_at:number;expires_at:number;revoked_at:number|null}
interface Observation {key:string;value:number;observedAt:number}
const actorFor=(id:string):Actor=>({id,email:'',displayName:'',baseRole:'member'})
function observation(input:Record<string,any>):Observation {
  if(!input||Array.isArray(input)||!['string','number'].includes(typeof input.value)||String(input.value).trim()===''||!['string','number'].includes(typeof input.observedAt)||String(input.observedAt).trim()==='')throw invalid('numeric_source_observation')
  const key=String(input.key??''),value=Number(input.value),observedAt=Number(input.observedAt)
  if(!key.trim()||key.length>120||!Number.isFinite(value)||!Number.isSafeInteger(observedAt)||observedAt<0||observedAt>now())throw invalid('numeric_source_observation')
  return {key,value,observedAt}
}
async function load(db:D1Database,actor:Actor,id:string) {
  const source=await first<Source>(db,'SELECT * FROM peg_goal_sources WHERE id=?',id)
  if(!source)throw forbidden('numeric_source')
  await numericSourceGoal(db,actor,source.goal_id)
  if(source.owner_id!==actor.id)throw forbidden('numeric_source_owner')
  return source
}
const safe=({token_hash,...source}:Source)=>source
export async function listNumericSources(db:D1Database,actor:Actor,goalId:string) {
  await numericSourceGoal(db,actor,goalId)
  return (await all<Source>(db,'SELECT * FROM peg_goal_sources WHERE goal_id=? ORDER BY created_at,id',goalId)).map(safe)
}
export async function createNumericSource(db:D1Database,actor:Actor,goalId:string,input:Record<string,any>) {
  const rev=await revision(db),goal=await numericSourceGoal(db,actor,goalId),kind=input.kind,name=String(input.name??'').trim(),at=now(),expiresAt=Number(input.expiresAt??at+86400000)
  if(!['api','csv'].includes(kind)||!name||name.length>120||!Number.isSafeInteger(expiresAt)||expiresAt<=at||expiresAt>at+30*86400000)throw invalid('numeric_source')
  if(input.consent!==true&&input.consent!=='on')throw invalid('numeric_source_consent_required')
  const id=newId('metric_source'),token=kind==='api'?newId('metric')+newId('scope'):null
  await guarded(db,rev,[bound(db,'INSERT INTO peg_goal_sources VALUES(?,?,?,?,?,?,?,?,NULL)',[id,goalId,actor.id,name,kind,token?await digest(token):null,at,expiresAt]),auditStatement(db,{workspaceId:goal.scope==='personal'?null:goal.workspace_id,actorId:actor.id,action:'goal.source_authorized',targetType:'goal',targetId:goalId,detail:{sourceId:id,kind,name,expiresAt,consent:true}})])
  return {id,kind,expiresAt,...(token?{token}:{}),notice:'The credential publishes observations for this goal only. Save it now; it is never shown again.'}
}
export async function revokeNumericSource(db:D1Database,actor:Actor,id:string) {
  const rev=await revision(db),source=await first<Source>(db,'SELECT * FROM peg_goal_sources WHERE id=?',id)
  if(!source)throw forbidden('numeric_source')
  const goal=await numericSourceGoal(db,actor,source.goal_id)
  // A replacement owner may revoke an earlier owner's source, but never recover or reuse its credential.
  await guarded(db,rev,[bound(db,'UPDATE peg_goal_sources SET revoked_at=COALESCE(revoked_at,?) WHERE id=?',[now(),id]),auditStatement(db,{workspaceId:goal.scope==='personal'?null:goal.workspace_id,actorId:actor.id,action:'goal.source_revoked',targetType:'goal',targetId:goal.id,detail:{sourceId:id}})])
  return {id,revoked:true}
}
async function statements(db:D1Database,source:Source,rows:Observation[]) {
  const out:D1PreparedStatement[]=[]
  for(const row of rows){
    const key=source.id+':'+row.key
    const prior=await first<{value:number;observed_at:number}>(db,'SELECT value,observed_at FROM peg_goal_events WHERE goal_id=? AND event_key=?',source.goal_id,key)
    if(prior){if(prior.value!==row.value||prior.observed_at!==row.observedAt)throw conflict('numeric_event_key_reused');continue}
    out.push(bound(db,'INSERT INTO peg_goal_events(goal_id,event_key,value,observed_at,received_at,actor_id,source_id) VALUES(?,?,?,?,?,?,?)',[source.goal_id,key,row.value,row.observedAt,now(),source.owner_id,source.id]))
  }
  return out
}
function current(source:Source) {
  if(source.revoked_at!==null||source.expires_at<=now())throw forbidden('numeric_source_inactive')
}
function sourceRevision(rev:Awaited<ReturnType<typeof revision>>,source:Source) {
  return {...rev,until:rev.until===null?source.expires_at:Math.min(rev.until,source.expires_at)}
}
export async function publishNumericSource(db:D1Database,id:string,token:string,input:Record<string,any>) {
  const rev=await revision(db),source=await first<Source>(db,"SELECT * FROM peg_goal_sources WHERE id=? AND kind='api'",id)
  if(!source||!token||source.token_hash!==await digest(token))throw new PegError(401,'numeric_source_unauthorized')
  current(source);await numericSourceGoal(db,actorFor(source.owner_id),source.goal_id)
  const row=observation(input),writes=await statements(db,source,[row])
  await guarded(db,sourceRevision(rev,source),writes)
  return {key:row.key,replayed:writes.length===0}
}
function csv(text:unknown):Observation[] {
  if(typeof text!=='string'||text.length>200000)throw invalid('numeric_csv')
  const lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/)
  if(lines.shift()!=='event_key,value,observed_at'||lines.length>1000||!lines.length)throw invalid('numeric_csv_header')
  const seen=new Set<string>()
  return lines.map(line=>{
    const cells=line.split(',')
    if(cells.length!==3||!/^[a-zA-Z0-9_.:-]+$/.test(cells[0]))throw invalid('numeric_csv_row')
    const row=observation({key:cells[0],value:cells[1],observedAt:cells[2]})
    if(seen.has(row.key))throw invalid('numeric_csv_duplicate_key')
    seen.add(row.key);return row
  })
}
export async function previewNumericCsv(db:D1Database,actor:Actor,id:string,input:Record<string,any>) {
  const rev=await revision(db),source=await load(db,actor,id)
  current(source);if(source.kind!=='csv')throw invalid('numeric_csv_source_required')
  const rows=csv(input.csv),writes=await statements(db,source,rows)
  return {source:safe(source),rows,added:writes.length,replayed:rows.length-writes.length,token:await digest([source,rows,rev]),rev}
}
export async function commitNumericCsv(db:D1Database,actor:Actor,id:string,input:Record<string,any>) {
  const preview=await previewNumericCsv(db,actor,id,input)
  if(input.revision!==preview.token)throw conflict('numeric_csv_preview_changed')
  const source=(await first<Source>(db,'SELECT * FROM peg_goal_sources WHERE id=?',id))!,goal=await numericSourceGoal(db,actor,source.goal_id)
  await guarded(db,sourceRevision(preview.rev,source),[...await statements(db,source,preview.rows),auditStatement(db,{workspaceId:goal.scope==='personal'?null:goal.workspace_id,actorId:actor.id,action:'goal.csv_observed',targetType:'goal',targetId:goal.id,detail:{sourceId:id,added:preview.added,replayed:preview.replayed}})])
  return {added:preview.added,replayed:preview.replayed}
}
