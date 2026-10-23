import type {Bindings} from '../../auth.server'
import {meetingArtifact} from '../connectors/meetings/edge'
import {PegError} from '../db'
import { all, first, batch, bound, run, newId, now, invalid, forbidden, conflict, notFound } from '../db'
import { workspaceRole, type Actor } from '../workspace/people'
import { transcript, type Segment } from '../connectors/meetings/transcript'
import { prepareTask } from '../tasks/tasks'
interface Meeting { id:string;workspace_id:string;created_by:string;service:string;source_id:string;digest:string;segments:string;created_at:number;revoked_at:number|null }
interface Proposal {id:string;meeting_id:string;segment_index:number;title:string;kind:string;owner_id:string|null;due_date:string|null;date_resolved:number;version:number;task_id:string|null}
async function admin(db:D1Database,actor:Actor,workspace:string){if(!['owner','admin'].includes(await workspaceRole(db,actor.id,workspace)??''))throw forbidden()}
async function owned(db:D1Database,actor:Actor,id:string){const m=await first<Meeting>(db,'SELECT * FROM peg_meetings WHERE id=? AND created_by=?',id,actor.id);if(!m)throw notFound();await admin(db,actor,m.workspace_id);return m}
const consent=(v:unknown)=>v===true||v==='on'
export async function meetings(db:D1Database,actor:Actor,workspace:string){await admin(db,actor,workspace);return all<Pick<Meeting,'id'|'service'|'source_id'|'revoked_at'>>(db,'SELECT id,service,source_id,revoked_at FROM peg_meetings WHERE workspace_id=? AND created_by=? ORDER BY created_at DESC',workspace,actor.id)}
export async function meetingView(db:D1Database,actor:Actor,id:string){
  const m=await owned(db,actor,id)
  return {meeting:{...m,segments:JSON.parse(m.segments) as Segment[]},proposals:await all<Proposal>(db,'SELECT * FROM peg_meeting_proposals WHERE meeting_id=? ORDER BY rowid',id)}
}
export async function ingestMeeting(db:D1Database,actor:Actor,workspace:string,input:Record<string,any>,env?:Bindings){
  await admin(db,actor,workspace)
  if(!consent(input.sourceAuthority)||!consent(input.organizerConsent)||!consent(input.participantConsent))throw invalid('meeting_consent_required')
  const source=String(input.sourceId??'').trim();if(!source||source.length>300)throw invalid('meeting_source_required')
  const capture=env&&input.credential?{...input,content:await meetingArtifact(env,String(input.service),source,input.credential)}:input
  const segments=transcript(String(input.service),capture),body=JSON.stringify(segments),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body)))).map(b=>b.toString(16).padStart(2,'0')).join('')
  const old=await first<Meeting>(db,'SELECT * FROM peg_meetings WHERE created_by=? AND service=? AND source_id=?',actor.id,input.service,source)
  if(old){if(old.digest!==digest)throw conflict('meeting_source_revision_changed');return meetingView(db,actor,old.id)}
  const id=newId('meeting'),statements=[bound(db,'INSERT INTO peg_meetings VALUES(?,?,?,?,?,?,?,?,NULL)',[id,workspace,actor.id,input.service,source,digest,body,now()])]
  segments.forEach((s,index)=>{
    const match=s.text.match(/(?:^|\b)(Action|Decision|Follow-up):\s*(.+)/i)
    if(match)statements.push(bound(db,'INSERT INTO peg_meeting_proposals(id,meeting_id,segment_index,title,kind) VALUES(?,?,?,?,?)',[newId('proposal'),id,index,match[2].slice(0,300),match[1].toLowerCase()==='decision'?'decision':match[1].toLowerCase()==='follow-up'?'followup':'task']))
  })
  try{await batch(db,statements)}catch(error){const raced=await first<Meeting>(db,'SELECT * FROM peg_meetings WHERE created_by=? AND service=? AND source_id=?',actor.id,input.service,source);if(raced&&raced.digest===digest)return meetingView(db,actor,raced.id);throw error}
  return meetingView(db,actor,id)
}
export async function reviseMeetingProposal(db:D1Database,actor:Actor,id:string,input:Record<string,any>){
  const p=await first<Proposal>(db,'SELECT * FROM peg_meeting_proposals WHERE id=?',id);if(!p)throw notFound()
  const m=await owned(db,actor,p.meeting_id);if(m.revoked_at||p.task_id)throw conflict('meeting_proposal_closed')
  const title=String(input.title??'').trim(),owner=String(input.ownerId??''),due=String(input.dueDate??'')
  if(!title||title.length>300)throw invalid('meeting_title_invalid')
  if(!owner||!['owner','admin','manager','member'].includes(await workspaceRole(db,owner,m.workspace_id)??''))throw invalid('meeting_owner_unresolved')
  if(!consent(input.dateResolved))throw invalid('meeting_date_unresolved')
  if(due&&(!/^\d{4}-\d{2}-\d{2}$/.test(due)||Number.isNaN(Date.parse(due))||new Date(due).toISOString().slice(0,10)!==due))throw invalid('meeting_date_invalid')
  const changed=await run(db,'UPDATE peg_meeting_proposals SET title=?,owner_id=?,due_date=?,date_resolved=1,version=version+1 WHERE id=? AND version=? AND task_id IS NULL AND EXISTS(SELECT 1 FROM peg_meetings WHERE id=meeting_id AND revoked_at IS NULL)',title,owner,due||null,id,Number(input.version))
  if(!changed.meta.changes)throw conflict('meeting_review_stale')
  return meetingView(db,actor,m.id)
}
export async function adoptMeetingProposal(db:D1Database,actor:Actor,id:string,input:Record<string,any>){
  const p=await first<Proposal>(db,'SELECT * FROM peg_meeting_proposals WHERE id=?',id);if(!p)throw notFound()
  const m=await owned(db,actor,p.meeting_id);if(m.revoked_at)throw conflict('meeting_source_revoked')
  if(!consent(input.confirm))throw invalid('meeting_exact_review_required')
  if(p.task_id)return {taskId:p.task_id}
  if(p.version!==Number(input.version))throw conflict('meeting_review_stale')
  if(!p.owner_id||!p.date_resolved)throw conflict('meeting_ambiguity_unresolved')
  if(!input.projectId)throw invalid('meeting_project_required')
  const task=await prepareTask(db,actor,{projectId:String(input.projectId),ownerId:p.owner_id,title:p.title,kind:p.kind==='decision'?'approval':'task',dueDate:p.due_date,internalOnly:true,description:`Meeting citation: /app/meetings/${m.id} · segment ${p.segment_index+1}`})
  try{await batch(db,[bound(db,`INSERT INTO peg_meeting_guards(value) SELECT CASE WHEN EXISTS(SELECT 1 FROM peg_meeting_proposals p JOIN peg_meetings m ON m.id=p.meeting_id JOIN oa_operators o ON o.id=? WHERE p.id=? AND p.version=? AND p.task_id IS NULL AND m.revoked_at IS NULL AND m.created_by=? AND o.status='active' AND o.role IN ('owner','admin')) THEN 1 ELSE 0 END`,[actor.id,p.id,p.version,actor.id]),bound(db,'INSERT INTO peg_meeting_adoptions VALUES(?,?,?,?)',[p.id,task.id,p.version,actor.id]),...task.statements,bound(db,'UPDATE peg_meeting_proposals SET task_id=? WHERE id=?',[task.id,p.id]),bound(db,'DELETE FROM peg_meeting_guards',[])])}
  catch(error){const existing=await first<Proposal>(db,'SELECT * FROM peg_meeting_proposals WHERE id=?',id);if(existing?.task_id)return {taskId:existing.task_id};if(error instanceof Error&&(error.message.includes('meeting_review_stale')||error.message.includes('CHECK constraint failed')))throw conflict('meeting_review_stale');throw error}
  return {taskId:task.id}
}
export async function revokeMeeting(db:D1Database,actor:Actor,id:string){
  await owned(db,actor,id)
  await batch(db,[bound(db,"UPDATE peg_meetings SET revoked_at=COALESCE(revoked_at,?),segments='[]' WHERE id=?",[now(),id]),bound(db,"UPDATE peg_meeting_proposals SET title='',owner_id=NULL,due_date=NULL,date_resolved=0,version=version+1 WHERE meeting_id=?",[id])])
  return meetingView(db,actor,id)
}

export async function proposeMeetingAction(db:D1Database,actor:Actor,id:string,input:Record<string,any>){
  const m=await owned(db,actor,id);if(m.revoked_at)throw conflict('meeting_source_revoked')
  const segments=JSON.parse(m.segments) as Segment[],index=Number(input.segmentIndex),title=String(input.title??'').trim(),kind=String(input.kind??'task')
  if(!Number.isInteger(index)||index<0||index>=segments.length||!title||title.length>300||!['task','decision','followup'].includes(kind))throw invalid('meeting_proposal_invalid')
  await run(db,'INSERT INTO peg_meeting_proposals(id,meeting_id,segment_index,title,kind) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM peg_meetings WHERE id=? AND revoked_at IS NULL)',newId('proposal'),id,index,title,kind,id)
  return meetingView(db,actor,id)
}

export async function refreshMeetingSource(db:D1Database,env:Bindings,actor:Actor,id:string,input:Record<string,any>){
  const m=await owned(db,actor,id);if(m.revoked_at)throw conflict('meeting_source_revoked')
  try{
    const content=await meetingArtifact(env,m.service,m.source_id,input.credential)
    const body=JSON.stringify(transcript(m.service,{content})),digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body)))).map(b=>b.toString(16).padStart(2,'0')).join('')
    await owned(db,actor,id)
    if(digest!==m.digest)throw conflict('meeting_source_revision_changed')
  }catch(error){if(error instanceof PegError&&error.code==='meeting_source_refused')return revokeMeeting(db,actor,id);throw error}
  return meetingView(db,actor,id)
}
