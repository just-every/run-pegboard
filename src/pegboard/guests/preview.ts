import {all, forbidden, notFound} from '../db'
import {openProject,need} from '../workspace/projects'
import {operatorRow,workspaceRole,type Actor} from '../workspace/people'
import {viewTask} from '../tasks/view'
import {projectEffective} from '../authorization/effective'

// Preview current guest authority through exactly the same reads as their own portal.
export async function guestPreview(db:D1Database,actor:Actor,projectId:string,recipientId:string){
  const {project,effective}=await openProject(db,actor,projectId)
  need(effective,'manage_shares')
  if(await workspaceRole(db,recipientId,project.workspace_id)!=='guest')throw notFound()
  const person=await operatorRow(db,recipientId)
  if(!person)throw notFound()
  const recipient:Actor={id:person.id,email:person.email,displayName:person.display_name,baseRole:'member'}
  const standing=await projectEffective(db,recipient,project)
  if(!standing.paths.some(path=>path.capabilities.includes('read')))throw forbidden('current_guest_share_required')
  const tasks=[]
  const candidates=await all<{id:string}>(db,`WITH RECURSIVE work(id,depth) AS (
    SELECT task_id,0 FROM peg_task_projects WHERE project_id=?
    UNION ALL SELECT t.id,w.depth+1 FROM peg_tasks t JOIN work w ON t.parent_id=w.id WHERE w.depth<50
  ) SELECT DISTINCT id FROM work`,projectId)
  for(const row of candidates){
    const task=await viewTask(db,recipient,row.id).catch(error=>{if(error.status===404)return null;throw error})
    if(task)tasks.push(task)
  }
  return {recipient:{id:person.id,name:person.display_name},project:{id:project.id,name:project.name,description:standing.capabilities.has('read')?project.description:null},paths:standing.paths.map(path=>({level:path.level,scope:path.scope??'full'})),tasks}
}

// Initial sharing is a separate, human-reviewed door. Drafts hold opaque manifests
// and a content digest, so historical consent never retains a second copy of text.
import {bound, conflict, first, invalid, newId, now, placeholders} from '../db'
import {authorizeGrant, grantStatements, type GrantInput} from '../authorization/grants'
import {previewGuestActor} from '../authorization/effective'
import {digest, guarded, revision} from '../decisions/revision'
import {auditStatement} from '../authorization/audit'
import {guestAccounting} from '../workspace/people'
import type {Level} from '../authorization/levels'

const exclusions = [
  'Internal-only tasks, fields, notes and comments',
  'Other projects and their fields, comments, files and exports without a current share',
  'Private attachment links and revoked links',
  'Member directory, invitations, sharing and configuration',
  'Agent-written messages and disclosures outside this share require separate review',
  'Proof revision uploads require a separately reviewed upload grant',
]
interface ReviewRow {
  id:string; project_id:string; recipient_id:string; actor_id:string; proposal:string;
  manifest:string; fingerprint:string; revision:number; authority_until:number|null;
  review_until:number; created_at:number; status:'pending'|'approved'|'cancelled';
  decided_at:number|null; grant_id:string|null
}
function proposalFor(projectId:string, input:Record<string,unknown>): GrantInput {
  const level = String(input.level ?? 'viewer') as Level
  const scope = String(input.scope ?? 'full') as 'full'|'approve'|'assignee'
  const expiresAt = input.expiresAt === '' || input.expiresAt == null ? null : typeof input.expiresAt === 'number' ? input.expiresAt : Date.parse(String(input.expiresAt).replace(/^(\d{4}-\d\d-\d\dT\d\d:\d\d)$/,'$1Z'))
  if (!['viewer','commenter','editor'].includes(level) || !['full','approve','assignee'].includes(scope)) throw invalid('guest_role')
  if ((scope === 'approve' && level !== 'viewer') || (scope === 'assignee' && level !== 'editor')) throw invalid('guest_role')
  if (expiresAt !== null && (!Number.isSafeInteger(expiresAt) || expiresAt <= now())) throw invalid('guest_expiry')
  return {objectType:'project',objectId:projectId,granteeType:'person',granteeId:String(input.recipientId ?? ''),level,scope,expiresAt}
}
async function proposedPortal(db:D1Database, actor:Actor, proposal:GrantInput) {
  const standing = await authorizeGrant(db,actor,proposal)
  if (standing.effective.role === 'guest' || standing.effective.role === 'agent') throw forbidden('human_share_review')
  if (await workspaceRole(db,proposal.granteeId,standing.workspaceId) !== 'guest') throw notFound()
  const person = (await operatorRow(db,proposal.granteeId))!
  const recipient:Actor = {id:person.id,email:person.email,displayName:person.display_name,baseRole:'member'}
  if ((await projectEffective(db,recipient,standing.project!)).paths.some(path => path.capabilities.includes('read'))) throw conflict('guest_already_shared')
  const projected = previewGuestActor(recipient,{object_id:proposal.objectId,level:proposal.level,scope:proposal.scope ?? 'full'})
  const projectedStanding = await projectEffective(db,projected,standing.project!)
  const tasks = []
  const candidates = await all<{id:string}>(db,`WITH RECURSIVE work(id,depth) AS (
    SELECT task_id,0 FROM peg_task_projects WHERE project_id=?
    UNION ALL SELECT t.id,w.depth+1 FROM peg_tasks t JOIN work w ON t.parent_id=w.id WHERE w.depth<50
  ) SELECT DISTINCT id FROM work ORDER BY id`,proposal.objectId)
  for (const row of candidates) {
    const task = await viewTask(db,projected,row.id).catch(error => {if(error.status===404)return null;throw error})
    if (task) tasks.push(task)
  }
  const content = {recipient:{id:person.id,name:person.display_name},project:{id:standing.project!.id,name:standing.project!.name,description:projectedStanding.capabilities.has('read')?standing.project!.description:null},proposal,tasks,exclusions}
  const manifest = {taskIds:tasks.map(t=>t.id),fields:tasks.flatMap(t=>t.projects.flatMap(p=>p.fields.map(f=>f.id))),commentIds:tasks.flatMap(t=>t.comments.map(c=>c.id)),attachmentIds:tasks.flatMap(t=>t.attachments.map(a=>a.id)),exclusions}
  const candidateIds=candidates.map(t=>t.id)
  const withheld = {
    taskIds:candidateIds.filter(id=>!manifest.taskIds.includes(id)),
    commentIds:(await all<{id:string}>(db,`SELECT id FROM peg_comments WHERE task_id IN (${placeholders(candidateIds)}) ORDER BY id`,...candidateIds)).map(r=>r.id).filter(id=>!manifest.commentIds.includes(id)),
    attachmentIds:(await all<{id:string}>(db,`SELECT id FROM peg_attachments WHERE task_id IN (${placeholders(candidateIds)}) ORDER BY id`,...candidateIds)).map(r=>r.id).filter(id=>!manifest.attachmentIds.includes(id)),
    fieldIds:(await all<{field_id:string}>(db,`SELECT DISTINCT field_id FROM peg_field_values WHERE task_id IN (${placeholders(candidateIds)}) ORDER BY field_id`,...candidateIds)).map(r=>r.field_id).filter(id=>!manifest.fields.includes(id)),
  }
  return {content,manifest:{...manifest,withheld},workspaceId:standing.workspaceId}
}
export async function previewGuestShare(db:D1Database,actor:Actor,projectId:string,input:Record<string,unknown>) {
  const rev = await revision(db), proposal = proposalFor(projectId,input)
  const {content,manifest} = await proposedPortal(db,actor,proposal)
  const id = newId('gshr'), fingerprint = await digest(content), at = now(), until = at + 15*60*1000
  await guarded(db,rev,[bound(db,`INSERT INTO peg_guest_share_reviews(id,project_id,recipient_id,actor_id,proposal,manifest,fingerprint,revision,authority_until,review_until,created_at,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,'pending')`,
    [id,projectId,proposal.granteeId,actor.id,JSON.stringify(proposal),JSON.stringify(manifest),fingerprint,rev.value,rev.until,until,at])])
  return {id,fingerprint,status:'pending' as const,reviewUntil:until,...content,manifest}
}
export async function guestShareReview(db:D1Database,actor:Actor,projectId:string,id:string) {
  const {project,effective} = await openProject(db,actor,projectId)
  need(effective,'manage_shares')
  if (effective.role === 'guest' || effective.role === 'agent') throw forbidden('human_share_review')
  const row = await first<ReviewRow>(db,'SELECT * FROM peg_guest_share_reviews WHERE id=? AND project_id=?',id,projectId)
  if (!row || row.actor_id !== actor.id) throw notFound()
  const proposal = JSON.parse(row.proposal) as GrantInput
  let content = null
  if (row.status === 'pending' && row.review_until > now() && (!proposal.expiresAt || proposal.expiresAt > now())) {
    const rev = await revision(db)
    if (rev.value === row.revision && (!row.authority_until || row.authority_until > now())) {
      const current = await proposedPortal(db,actor,proposal)
      if (await digest(current.content) === row.fingerprint) content = current.content
    }
  }
  return {id:row.id,fingerprint:row.fingerprint,status:row.status,reviewUntil:row.review_until,createdAt:row.created_at,decidedAt:row.decided_at,actorId:row.actor_id,recipientId:row.recipient_id,proposal,manifest:JSON.parse(row.manifest),grantId:row.grant_id,content,stale:row.status==='pending'&&!content,projectId:project.id}
}
export async function decideGuestShare(db:D1Database,actor:Actor,projectId:string,id:string,input:Record<string,unknown>) {
  const review = await guestShareReview(db,actor,projectId,id)
  if (review.status !== 'pending') throw conflict('review_decided')
  if (!['approve','cancel'].includes(String(input.decision))) throw invalid('decision')
  if (input.fingerprint !== review.fingerprint) throw conflict('review_changed')
  // Changes to proposal fields are never silently accepted, even with a valid token.
  for (const key of ['level','scope','expiresAt','recipientId']) if (input[key] !== undefined && String(input[key]) !== String(key==='recipientId'?review.recipientId:review.proposal[key as keyof GrantInput])) throw conflict('review_changed')
  const at = now()
  if (input.decision === 'cancel') {
    await guarded(db,await revision(db),[
      bound(db,'INSERT INTO peg_guest_share_decisions(review_id,decision,actor_id,at) VALUES(?,?,?,?)',[id,'cancel',actor.id,at]),
      bound(db,"UPDATE peg_guest_share_reviews SET status='cancelled',decided_at=? WHERE id=?",[at,id]),
    ])
    return {id,status:'cancelled'}
  }
  if (review.stale || !review.content) throw conflict('review_changed')
  const standing = await authorizeGrant(db,actor,review.proposal)
  const row = (await first<ReviewRow>(db,'SELECT * FROM peg_guest_share_reviews WHERE id=?',id))!
  const grant = grantStatements(db,actor.id,standing.workspaceId,review.proposal,{source:'direct'})
  await guarded(db,{value:row.revision,until:Math.min(row.authority_until??Infinity,row.review_until,review.proposal.expiresAt??Infinity)},[
    bound(db,'INSERT INTO peg_guest_share_decisions(review_id,decision,actor_id,at) VALUES(?,?,?,?)',[id,'approve',actor.id,at]),
    ...grant.statements,
    bound(db,"UPDATE peg_guest_share_reviews SET status='approved',decided_at=?,grant_id=? WHERE id=?",[at,grant.id,id]),
    auditStatement(db,{workspaceId:standing.workspaceId,actorId:actor.id,subjectId:review.recipientId,action:'guest.share.reviewed',targetType:'project',targetId:projectId,detail:{reviewId:id,grantId:grant.id,fingerprint:row.fingerprint,level:review.proposal.level,scope:review.proposal.scope}}),
  ])
  return {id,status:'approved',grantId:grant.id}
}
export async function guestShareHistory(db:D1Database,actor:Actor,projectId:string) {
  const {project,effective} = await openProject(db,actor,projectId)
  need(effective,'manage_shares')
  if (effective.role === 'guest' || effective.role === 'agent') throw forbidden('human_share_review')
  const rows = await all<ReviewRow>(db,"SELECT * FROM peg_guest_share_reviews WHERE project_id=? AND status<>'pending' ORDER BY created_at DESC,id",projectId)
  return {accounting:await guestAccounting(db,project.workspace_id),decisions:rows.map(row=>({id:row.id,actorId:row.actor_id,recipientId:row.recipient_id,status:row.status,decidedAt:row.decided_at,proposal:JSON.parse(row.proposal) as GrantInput,manifest:JSON.parse(row.manifest),fingerprint:row.fingerprint,grantId:row.grant_id}))}
}
