import { all, bound, conflict, first, forbidden, invalid, newId, notFound, now, PegError } from '../db'
import { digest, guarded, revision } from '../decisions/revision'
import { permanentEvent } from '../audit/search'
import { proofView } from '../records/custody'
import { readAttachment } from '../tasks/view'
import { openTask } from '../tasks/access'
import { proofContext } from './material'
import { routeFor, routeView, independent, type Route } from './routing'
import { operatorRow, workspaceRole, type Actor } from '../workspace/people'
import { currentProofPolicy, requireProofOwner, type ProofPolicy } from './proof-policy'
import { approvalPreferences } from '../notices/preferences'
import { availableStamp, instantOf, readStamp, dayString, type WorkingCalendar } from '../schedule/calendar'

interface Episode {
  id:string; proof_id:string; task_id:string; workspace_id:string; policy_id:string; accountable_id:string; accountable_version:number
  created_by:string; created_at:number; route_id:string; version_id:string; digest:string; state:string; cause:string|null; next_at:number|null; round:number
}
interface Event { id:string; episode_id:string; binding_id:string; ordinal:number; recipient_id:string; recipient_version:number; state:string; cause:string|null; next_at:number|null; visible_at:number|null; created_at:number }
const openStates = ['active','awaiting_revision','awaiting_route']
const asActor = (id:string) => ({id} as Actor)
const getEpisode = async (db:D1Database,id:string) => { const row=await first<Episode>(db,'SELECT * FROM peg_proof_followup_episodes WHERE id=?',id);if(!row)throw notFound();return row }
const eligibleAt = (at:number,policy:ProofPolicy) => {
  const calendar:WorkingCalendar=JSON.parse(policy.calendar), next=availableStamp(readStamp(new Date(at).toISOString(),calendar.zone),calendar)
  return Math.max(at,instantOf(dayString(next.day),next.wallMs!,calendar.zone))
}
async function material(db:D1Database,person:Actor,proofId:string) {
  const view=await proofView(db,person,proofId), opened=await openTask(db,person,view.taskId)
  if(!opened.access.capabilities.has('manage_shares')||['guest','agent'].includes(opened.access.role??''))throw forbidden('proof_custodian')
  await proofContext(db,person,opened,view.proof.current_version!)
  const version=view.versions.find(v=>v.id===view.proof.current_version)!
  const file=await readAttachment(db,person,version.attachment_id)
  const actual=[...new Uint8Array(await crypto.subtle.digest('SHA-256',file.bytes))].map(n=>n.toString(16).padStart(2,'0')).join('')
  if(actual!==version.digest)throw conflict('proof_bytes_changed')
  return {view,opened,version}
}
async function livePolicy(db:D1Database,workspace:string,id?:string) {
  const policy=await currentProofPolicy(db,workspace)
  if(!policy?.enabled||id&&policy.id!==id)throw conflict('proof_policy_inactive')
  const owner=await operatorRow(db,policy.approved_by)
  if(owner?.role!=='owner'||owner.status!=='active'||owner.version!==policy.approver_version)throw conflict('proof_policy_authority_lost')
  return policy
}
async function routeContext(db:D1Database,proofId:string,routeId:string,person:Actor) {
  const m=await material(db,person,proofId), route=await first<Route>(db,'SELECT * FROM peg_approval_routes WHERE id=?',routeId)
  if(!route||route.kind!=='proof'||route.subject_id!==proofId||route.withdrawn_at||(await routeFor(db,'proof',proofId))?.id!==route.id||route.version!==m.version.id)throw conflict('current_proof_route_required')
  const creator=await operatorRow(db,route.created_by)
  if(creator?.status!=='active')throw conflict('routing_authority_lost')
  const manager=await routeView(db,asActor(creator.id),route.id)
  if(!manager.canManage)throw conflict('routing_authority_lost')
  // A signed-in external reviewer needs their own current reviewed share, even after a vote.
  const rev=await revision(db)
  for(const stage of manager.stages)for(const id of stage.people??[]) {
    const role=await workspaceRole(db,id,m.opened.task.workspace_id)
    if(!role||role==='agent')throw conflict('reviewer_ineligible')
    const reviewer=await routeView(db,asActor(id),route.id)
    const opened=await openTask(db,asActor(id),m.view.taskId)
    if(!opened.access.capabilities.has('approve')||!await independent(db,opened.task.id,opened.task.owner_id,id))throw conflict('reviewer_ineligible')
    if(role==='guest') {
      const links=await all<{expires_at:number}>(db,'SELECT expires_at FROM peg_approval_links WHERE route_id=? AND recipient_id=? AND version=? AND revoked_at IS NULL AND expires_at>?',route.id,id,route.version,now())
      if(!links.length)throw conflict('reviewed_share_unavailable')
      rev.until=Math.min(rev.until??Infinity,Math.max(...links.map(l=>l.expires_at)))
    }
    if(reviewer.state==='withdrawn'||reviewer.state==='stale')throw conflict('reviewer_ineligible')
  }
  return {...m,route,manager,rev}
}
export async function previewProofEpisode(db:D1Database,person:Actor,proofId:string,input:Record<string,any>) {
  const m=await material(db,person,proofId), workspace=m.opened.task.workspace_id
  await requireProofOwner(db,person,workspace)
  const policy=await livePolicy(db,workspace), route=await routeFor(db,'proof',proofId)
  if(!route)throw conflict('current_proof_route_required')
  const c=await routeContext(db,proofId,route.id,person)
  if(c.manager.state!=='pending')throw conflict('pending_review_required')
  if(![...m.opened.access.contexts.keys()].some(id=>JSON.parse(policy.projects).includes(id)))throw forbidden('reviewed_project_scope')
  const accountable=String(input.accountableId??''), recipient=await operatorRow(db,accountable)
  if(!JSON.parse(policy.recipients).includes(accountable)||!['owner','admin','manager','member'].includes(await workspaceRole(db,accountable,workspace)??'')||!recipient)throw forbidden('reviewed_internal_accountable_person')
  await material(db,asActor(accountable),proofId)
  const prior=input.episodeId?await getEpisode(db,String(input.episodeId)):null
  if(prior&&(prior.proof_id!==proofId||!openStates.includes(prior.state)||prior.accountable_id!==accountable||prior.policy_id!==policy.id))throw conflict('episode_not_continuable')
  const config={proofId,routeId:route.id,versionId:m.version.id,digest:m.version.digest,policyId:policy.id,accountableId:accountable,accountableVersion:recipient.version,episodeId:prior?.id??null}
  return {...config,rev:c.rev,token:await digest([person.id,config,c.rev,prior])}
}
export async function commitProofEpisode(db:D1Database,person:Actor,proofId:string,input:Record<string,any>) {
  const p=await previewProofEpisode(db,person,proofId,input)
  if(input.token!==p.token||![true,'true','on'].includes(input.consent))throw conflict('proof_followup_review_required')
  const m=await material(db,person,proofId), id=p.episodeId??newId('proofepisode'), at=now(), statements:D1PreparedStatement[]=[]
  if(p.episodeId)statements.push(bound(db,"UPDATE peg_proof_followup_episodes SET route_id=?,version_id=?,digest=?,state='active',cause='human_reviewed_revision',next_at=?,round=0 WHERE id=?",[p.routeId,p.versionId,p.digest,at,id]))
  else statements.push(bound(db,"INSERT INTO peg_proof_followup_episodes VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'active',NULL,?,0)",[id,proofId,m.view.taskId,m.opened.task.workspace_id,p.policyId,p.accountableId,p.accountableVersion,person.id,at,p.routeId,p.versionId,p.digest,at]))
  statements.push(bound(db,'INSERT INTO peg_proof_followup_bindings VALUES(?,?,?,?,?,?,?)',[newId('proofbinding'),id,p.routeId,p.versionId,p.digest,person.id,at]),permanentEvent(db,{workspace:m.opened.task.workspace_id,actor:person.id,action:p.episodeId?'proof_followup.revision_reviewed':'proof_followup.started',type:'proof',id:proofId,metadata:{id,sourceId:p.routeId,scopeDigest:p.digest}}))
  await guarded(db,p.rev,statements)
  return {id,proofId,routeId:p.routeId,versionId:p.versionId,state:'active'}
}
async function current(db:D1Database,e:Episode) {
  if(!['active','awaiting_revision'].includes(e.state))throw conflict('proof_episode_inactive')
  const policy=await livePolicy(db,e.workspace_id,e.policy_id), person=await operatorRow(db,e.accountable_id)
  if(!person||person.version!==e.accountable_version||!JSON.parse(policy.recipients).includes(person.id))throw conflict('accountable_authority_lost')
  const c=await routeContext(db,e.proof_id,e.route_id,asActor(person.id))
  if(c.version.id!==e.version_id||c.version.digest!==e.digest)throw conflict('proof_binding_changed')
  const homes=[...c.opened.access.contexts.keys()]
  if(!homes.some(id=>JSON.parse(policy.projects).includes(id)))throw conflict('outside_reviewed_scope')
  return {...c,policy}
}
async function cancel(db:D1Database,e:Episode,cause:string) {
  const rev=await revision(db), latest=await first<Episode>(db,'SELECT * FROM peg_proof_followup_episodes WHERE id=?',e.id)
  if(!latest||!openStates.includes(latest.state))return
  if(latest.state==='awaiting_route'&&['current_proof_route_required','proof_binding_changed','proof_episode_inactive'].includes(cause))return
  await guarded(db,rev,[bound(db,"UPDATE peg_proof_followup_episodes SET state='cancelled',cause=?,next_at=NULL WHERE id=? AND state IN ('active','awaiting_revision','awaiting_route')",[cause,e.id])])
}
export async function processProofFollowups(db:D1Database,workspace?:string,at=now(),dispatch=true) {
  const episodes=await all<Episode>(db,`SELECT * FROM peg_proof_followup_episodes WHERE state IN ('active','awaiting_revision') ${workspace?'AND workspace_id=?':''} ORDER BY created_at,id LIMIT 200`,...(workspace?[workspace]:[]))
  for(const e of episodes)try {
    const c=await current(db,e), rev=c.rev
    if(c.manager.state==='approved') {
      await guarded(db,rev,[bound(db,"UPDATE peg_proof_followup_episodes SET state='approved',cause='current_human_quorum',next_at=NULL WHERE id=? AND state IN ('active','awaiting_revision')",[e.id])]);continue
    }
    const events=await all<Event>(db,'SELECT * FROM peg_proof_followup_events WHERE episode_id=? ORDER BY created_at,id',e.id)
    let event=events.find(x=>['queued','deferred'].includes(x.state))
    if(!event&&e.next_at!==null&&e.next_at<=at&&e.round<c.policy.max_rounds) {
      const binding=await first<{id:string}>(db,'SELECT id FROM peg_proof_followup_bindings WHERE episode_id=? AND route_id=?',e.id,e.route_id)
      if(!binding)throw conflict('proof_binding_missing')
      const id=newId('proofnotice')
      await guarded(db,rev,[bound(db,"INSERT INTO peg_proof_followup_events VALUES(?,?,?,?,?,?,'queued','accountable_followup',?,NULL,?)",[id,e.id,binding.id,e.round+1,e.accountable_id,e.accountable_version,e.next_at,at]),bound(db,'UPDATE peg_proof_followup_episodes SET round=round+1,next_at=NULL WHERE id=?',[e.id])])
      event=(await first<Event>(db,'SELECT * FROM peg_proof_followup_events WHERE id=?',id))!
    }
    if(!event||!dispatch)continue
    // Re-read authority after enqueue so a concurrent policy or permission change cannot pass.
    const fresh=await current(db,await getEpisode(db,e.id)), prefs=await approvalPreferences(db,asActor(e.accountable_id),e.workspace_id), next=eligibleAt(Math.max(at,prefs.dndUntil??0),fresh.policy)
    const state=!prefs.enabled||prefs.muted?'cancelled':next>at?'deferred':'visible'
    const cause=state==='cancelled'?'recipient_muted':state==='deferred'?(prefs.dndUntil??0)>at?'do_not_disturb':'working_hours':'inbox_visible'
    const latest=await getEpisode(db,e.id)
    await guarded(db,fresh.rev,[bound(db,"UPDATE peg_proof_followup_events SET state=?,cause=?,next_at=?,visible_at=? WHERE id=? AND state IN ('queued','deferred')",[state,cause,state==='deferred'?next:null,state==='visible'?at:null,event.id]),bound(db,"UPDATE peg_proof_followup_episodes SET next_at=? WHERE id=? AND state IN ('active','awaiting_revision')",[state==='deferred'||latest.round>=fresh.policy.max_rounds?null:eligibleAt(at+fresh.policy.repeat_minutes*60000,fresh.policy),e.id])])
  } catch(error) {
    if(error instanceof PegError&&error.status===409&&error.code==='review_changed')continue
    if(error instanceof PegError&&[403,404,409].includes(error.status)){await cancel(db,e,error.code);continue}
    throw error
  }
}
export async function proofEpisodeView(db:D1Database,person:Actor,id:string) {
  let e=await getEpisode(db,id)
  await material(db,person,e.proof_id)
  if(!openStates.includes(e.state))return detail()
  if(e.state!=='awaiting_route') {
    try{await current(db,e)}catch(error){if(error instanceof PegError&&[403,404,409].includes(error.status)){await cancel(db,e,error.code)}else throw error}
    e=await getEpisode(db,id)
  }
  return detail()
  async function detail() {
    const rev=await revision(db)
    e=await getEpisode(db,id)
    const m=await material(db,person,e.proof_id)
    await proofContext(db,person,m.opened,e.version_id)
    const visible=new Set(m.view.versions.map(v=>v.id))
    const route=await routeFor(db,'proof',e.proof_id), routing=route?await routeView(db,person,route.id):null
    const bindings=(await all<{id:string;version_id:string}>(db,'SELECT * FROM peg_proof_followup_bindings WHERE episode_id=? ORDER BY at,id',id)).filter(b=>visible.has(b.version_id))
    const bindingIds=new Set(bindings.map(b=>b.id))
    const events=(await all<Event>(db,'SELECT * FROM peg_proof_followup_events WHERE episode_id=? ORDER BY created_at,id',id)).filter(event=>bindingIds.has(event.binding_id))
    const eventIds=new Set(events.map(event=>event.id))
    const outcomes=(await all<{event_id:string|null}>(db,'SELECT * FROM peg_proof_followup_outcomes WHERE episode_id=? ORDER BY id',id)).filter(outcome=>outcome.event_id===null||eventIds.has(outcome.event_id))
    const names=routing?.names??{}
    const result={rev,accountableName:(await operatorRow(db,e.accountable_id))?.display_name??'Unavailable custodian',episode:e,title:m.opened.task.title,version:m.version,routing,bindings,events,outcomes,canStop:await workspaceRole(db,person.id,e.workspace_id)==='owner'&&openStates.includes(e.state),token:await digest([person.id,e,rev]),missing:routing?.stages.map(s=>({name:s.name,quorum:s.quorum,approved:s.approved,people:(s.people??[]).filter(id=>!routing.votes.some(v=>v.actor_id===id)).map(id=>({id,name:names[id]??'Reviewer'}))}))??[]}
    if((await revision(db)).value!==rev.value||rev.until!==null&&rev.until<=now())throw conflict('proof_review_changed')
    return result
  }
}
export async function stopProofEpisode(db:D1Database,person:Actor,id:string,input:Record<string,any>) {
  const v=await proofEpisodeView(db,person,id)
  if(!v.canStop)throw forbidden('owner_stop')
  const rev=v.rev
  if(v.token!==input.token||![true,'true','on'].includes(input.consent))throw conflict('proof_stop_review_required')
  await guarded(db,rev,[bound(db,"UPDATE peg_proof_followup_episodes SET state='stopped',cause='explicit_owner_stop',next_at=NULL WHERE id=?",[id]),permanentEvent(db,{workspace:v.episode.workspace_id,actor:person.id,action:'proof_followup.stopped',type:'proof',id:v.episode.proof_id,metadata:{id}})])
  return {id,state:'stopped'}
}
export async function proofFollowupInbox(db:D1Database,person:Actor,workspace:string) {
  const notices:Array<{id:string;eventId:string;episodeId:string;recipientId:string;routeId:string;versionId:string;title:string;href:string}>=[], rev=await revision(db), prefs=await approvalPreferences(db,person,workspace)
  if(!prefs.enabled||prefs.muted||(prefs.dndUntil??0)>now())return {notices}
  for(const row of await all<Event>(db,"SELECT n.* FROM peg_proof_followup_events n JOIN peg_proof_followup_episodes e ON e.id=n.episode_id WHERE e.workspace_id=? AND e.state IN ('active','awaiting_revision') AND n.recipient_id=? AND n.state='visible'",workspace,person.id)) {
    const e=await getEpisode(db,row.episode_id)
    try{const c=await current(db,e);notices.push({id:row.id,eventId:row.id,episodeId:e.id,recipientId:person.id,routeId:e.route_id,versionId:e.version_id,title:c.opened.task.title,href:'/app/proof-followup/'+e.id})}catch(error){if(!(error instanceof PegError&&[403,404,409].includes(error.status)))throw error}
  }
  if((await revision(db)).value!==rev.value||rev.until!==null&&rev.until<=now())return {notices:[]}
  return {notices}
}
export async function proofEpisodes(db:D1Database,person:Actor,proofId:string) {
  const rev=await revision(db), m=await material(db,person,proofId), visible=new Set(m.view.versions.map(v=>v.id))
  const rows=(await all<Episode>(db,'SELECT * FROM peg_proof_followup_episodes WHERE proof_id=? ORDER BY created_at,id',proofId)).filter(e=>visible.has(e.version_id))
  if((await revision(db)).value!==rev.value||rev.until!==null&&rev.until<=now())throw conflict('proof_review_changed')
  return rows
}
