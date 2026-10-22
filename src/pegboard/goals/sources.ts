// Owner-authorized, single-goal sources. There is no outbound fetch or shared provider credential.
import {all,bound,conflict,first,forbidden,invalid,newId,now,PegError} from '../db'
import {auditStatement} from '../authorization/audit'
import {digest,guarded,revision} from '../decisions/revision'
import {numericSourceGoal,type Goal} from './goals'
import {sourceOf,sourceStanding,type SourceRow as Source} from './source-state'
import type {Actor} from '../workspace/people'
interface Observation {key:string;value:number;observedAt:number}
const actorFor=(id:string):Actor=>({id,email:'',displayName:'',baseRole:'member'})
function observation(input:Record<string,any>):Observation {
  if(!input||Array.isArray(input)||!['string','number'].includes(typeof input.value)||String(input.value).trim()===''||!['string','number'].includes(typeof input.observedAt)||String(input.observedAt).trim()==='')throw invalid('numeric_source_observation')
  const key=String(input.key??''),value=Number(input.value),observedAt=Number(input.observedAt)
  if(!key.trim()||key.length>120||!Number.isFinite(value)||!Number.isSafeInteger(observedAt)||observedAt<0||observedAt>now())throw invalid('numeric_source_observation')
  return {key,value,observedAt}
}
async function load(db:D1Database,actor:Actor,id:string) {
  const source=await sourceOf(db,id)
  if(!source)throw forbidden('numeric_source')
  await numericSourceGoal(db,actor,source.goal_id)
  if(source.owner_id!==actor.id)throw forbidden('numeric_source_owner')
  return source
}
/** Safe configuration: never the credential, and always the source's standing with a named cause once it has ended. */
async function safe(db:D1Database,{token_hash,...source}:Source,goal:Goal) {
  const standing=await sourceStanding(db,{...source,token_hash},goal)
  return {...source,state:standing.active?'active' as const:'ended' as const,endCause:standing.active?null:standing.cause,endedAt:standing.active?null:standing.at}
}
export async function listNumericSources(db:D1Database,actor:Actor,goalId:string) {
  const goal=await numericSourceGoal(db,actor,goalId)
  const rows=await all<Source>(db,'SELECT * FROM peg_goal_sources WHERE goal_id=? ORDER BY created_at,id',goalId)
  return Promise.all(rows.map(row=>safe(db,row,goal)))
}
export async function createNumericSource(db:D1Database,actor:Actor,goalId:string,input:Record<string,any>) {
  const rev=await revision(db),goal=await numericSourceGoal(db,actor,goalId),kind=input.kind,name=String(input.name??'').trim(),at=now()
  // The owner chooses a finite expiry, either as a time or as a number of days; 30 days is the engineering bound and one day the default.
  if(input.expiresAt!==undefined&&input.expiresInDays!==undefined&&input.expiresInDays!=='')throw invalid('numeric_source_expiry')
  const days=input.expiresInDays===undefined||input.expiresInDays===''?null:Number(input.expiresInDays),expiresAt=days!==null?at+Math.round(days*86400000):Number(input.expiresAt??at+86400000)
  if(!['api','csv'].includes(kind)||!name||name.length>120||!Number.isSafeInteger(expiresAt)||expiresAt<=at||expiresAt>at+30*86400000)throw invalid('numeric_source')
  if(input.consent!==true&&input.consent!=='on')throw invalid('numeric_source_consent_required')
  const id=newId('metric_source'),token=kind==='api'?newId('metric')+newId('scope'):null
  await guarded(db,rev,[bound(db,'INSERT INTO peg_goal_sources(id,goal_id,owner_id,name,kind,token_hash,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)',[id,goalId,actor.id,name,kind,token?await digest(token):null,at,expiresAt]),auditStatement(db,{workspaceId:goal.scope==='personal'?null:goal.workspace_id,actorId:actor.id,action:'goal.source_authorized',targetType:'goal',targetId:goalId,detail:{sourceId:id,kind,name,expiresAt,consent:true}})])
  return {id,kind,expiresAt,...(token?{token}:{}),notice:'The credential publishes observations for this goal only. Save it now; it is never shown again.'}
}
export async function revokeNumericSource(db:D1Database,actor:Actor,id:string) {
  const rev=await revision(db),source=await sourceOf(db,id)
  if(!source)throw forbidden('numeric_source')
  const goal=await numericSourceGoal(db,actor,source.goal_id)
  // A replacement owner may revoke an earlier owner's source, but never recover or reuse its credential. An ended source keeps its first cause.
  await guarded(db,rev,[bound(db,"UPDATE peg_goal_sources SET ended_at=COALESCE(ended_at,?),ended_cause=COALESCE(ended_cause,'revoked') WHERE id=?",[now(),id]),auditStatement(db,{workspaceId:goal.scope==='personal'?null:goal.workspace_id,actorId:actor.id,action:'goal.source_revoked',targetType:'goal',targetId:goal.id,detail:{sourceId:id}})])
  return {id,revoked:true}
}
async function statements(db:D1Database,source:Source,rows:Observation[]) {
  const out:D1PreparedStatement[]=[]
  for(const row of rows){
    const prior=await first<{value:number;observed_at:number}>(db,'SELECT value,observed_at FROM peg_goal_events WHERE goal_id=? AND source_id=? AND event_key=?',source.goal_id,source.id,row.key)
    if(prior){if(prior.value!==row.value||prior.observed_at!==row.observedAt)throw conflict('numeric_event_key_reused');continue}
    // The source records its own observations; holding its credential confers no person's identity.
    out.push(bound(db,'INSERT INTO peg_goal_events(goal_id,source_id,event_key,value,observed_at,received_at,actor_id) VALUES(?,?,?,?,?,?,?)',[source.goal_id,source.id,row.key,row.value,row.observedAt,now(),source.id]))
  }
  return out
}
/** Refuses an ended source and names why, so the owner and the publisher learn the cause rather than a bare refusal. */
async function current(db:D1Database,source:Source) {
  const goal=(await first<Goal>(db,'SELECT * FROM peg_goals WHERE id=?',source.goal_id))!,standing=await sourceStanding(db,source,goal)
  if(!standing.active)throw new PegError(403,'numeric_source_ended',{cause:standing.cause})
}
function sourceRevision(rev:Awaited<ReturnType<typeof revision>>,source:Source) {
  return {...rev,until:rev.until===null?source.expires_at:Math.min(rev.until,source.expires_at)}
}
export async function publishNumericSource(db:D1Database,id:string,token:string,input:Record<string,any>) {
  const rev=await revision(db),source=await sourceOf(db,id)
  if(!source||source.kind!=='api'||!token||source.token_hash!==await digest(token))throw new PegError(401,'numeric_source_unauthorized')
  await current(db,source);await numericSourceGoal(db,actorFor(source.owner_id),source.goal_id)
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
  await current(db,source);if(source.kind!=='csv')throw invalid('numeric_csv_source_required')
  const rows=csv(input.csv),writes=await statements(db,source,rows)
  return {source:await safe(db,source,await numericSourceGoal(db,actor,source.goal_id)),rows,added:writes.length,replayed:rows.length-writes.length,token:await digest([source,rows,rev]),rev}
}
export async function commitNumericCsv(db:D1Database,actor:Actor,id:string,input:Record<string,any>) {
  const preview=await previewNumericCsv(db,actor,id,input)
  if(input.revision!==preview.token)throw conflict('numeric_csv_preview_changed')
  const source=(await sourceOf(db,id))!,goal=await numericSourceGoal(db,actor,source.goal_id)
  await guarded(db,sourceRevision(preview.rev,source),[...await statements(db,source,preview.rows),auditStatement(db,{workspaceId:goal.scope==='personal'?null:goal.workspace_id,actorId:actor.id,action:'goal.csv_observed',targetType:'goal',targetId:goal.id,detail:{sourceId:id,added:preview.added,replayed:preview.replayed}})])
  return {added:preview.added,replayed:preview.replayed}
}
