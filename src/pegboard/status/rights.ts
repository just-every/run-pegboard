import { all, batch, bound, conflict, first, forbidden, invalid, newId, notFound, now } from '../db'
import { bumpEpoch, epoch } from '../authorization/audit'
import { permanentEvent } from '../audit/search'
import { workspaceRole, type Actor } from '../workspace/people'
import { requireOwner, externalLimits } from '../data/settings'
import { isWorkingDay } from '../schedule/calendar'
const DAY = 86400000
interface RightsRequest {
 id: string; workspace_id: string; target_type: string; target_id: string; received_at: number; ack_due: number; response_due: number;
 handler_id: string; handler_until: number; version: number; acknowledged_at: number | null; responded_at: number | null;
 final_due: number | null; state: string; retention_review_at: number | null; next_review_at: number | null
}
const text = (value: unknown) => { if (typeof value !== 'string' || !value.trim() || value.length > 2000) throw invalid('rights_reason_required'); return value.trim() }
const time = (value: unknown) => { const n = typeof value === 'number' ? value : Date.parse(String(value)); if (!Number.isSafeInteger(n) || n < 0) throw invalid('rights_date'); return n }
async function human(db: D1Database, id: string, workspace: string) {
 const role = await workspaceRole(db,id,workspace)
 if (!['owner','admin','manager','member'].includes(role ?? '')) throw forbidden('named_active_human_required')
}
async function request(db: D1Database, actor: Actor, id: string) {
 const row = await first<RightsRequest>(db,'SELECT * FROM peg_status_rights_requests WHERE id=?',id)
 if (!row) throw notFound()
 await human(db,actor.id,row.workspace_id)
 const owner = await workspaceRole(db,actor.id,row.workspace_id) === 'owner'
 if (!owner && (row.handler_id !== actor.id || row.handler_until <= now())) throw forbidden('scoped_privacy_handler_required')
 return { row, owner }
}
async function inventory(db: D1Database, workspace: string, type: string, id: string) {
 const drafts = await all<{id:string;created_by:string;sources:string;recipients:string;subject_type:string;subject_id:string}>(db,'SELECT * FROM peg_status_drafts WHERE workspace_id=?',workspace)
 const revisions = await all<{id:string;reviewed_by:string;sources:string;recipients:string;subject_type:string;subject_id:string}>(db,'SELECT r.*,u.subject_type,u.subject_id FROM peg_status_revisions r JOIN peg_status_updates u ON u.id=r.id WHERE u.workspace_id=?',workspace)
 const projectTasks = new Set((await all<{id:string}>(db,`WITH RECURSIVE family(id) AS (SELECT id FROM peg_tasks WHERE id=? UNION SELECT task_id FROM peg_task_projects WHERE project_id=? UNION SELECT t.id FROM peg_tasks t JOIN family f ON t.parent_id=f.id) SELECT id FROM family`,type==='task'?id:'',type==='project'?id:'')).map(r=>r.id))
 const affected = (row: typeof drafts[number] | typeof revisions[number]) => type === 'person' ? ('created_by' in row ? row.created_by : row.reviewed_by) === id || JSON.parse(row.recipients).some((r:{id:string})=>r.id===id) : type === 'project' && row.subject_type === 'project' && row.subject_id === id || JSON.parse(row.sources).some((s:{id:string;projectIds?:string[]})=>projectTasks.has(s.id) || type==='project' && s.projectIds?.includes(id))
 const copies = [...drafts.filter(affected).map(r=>({type:'draft',id:r.id})),...revisions.filter(affected).map(r=>({type:'revision',id:r.id}))]
 if (type === 'person') {
  const comments = await all<{id:string;revision_id:string}>(db,'SELECT c.id,c.revision_id FROM peg_status_comments c JOIN peg_status_updates u ON u.id=c.revision_id WHERE c.author_id=? AND u.workspace_id=?',id,workspace)
  for (const c of comments) { copies.push({type:'comment',id:c.id}); if (!copies.some(r=>r.type==='revision'&&r.id===c.revision_id)) copies.push({type:'revision',id:c.revision_id}) }
  for (const r of await all<{draft_id:string}>(db,'SELECT DISTINCT r.draft_id FROM peg_status_draft_rejections r JOIN peg_status_drafts d ON d.id=r.draft_id WHERE r.rejected_by=? AND d.workspace_id=?',id,workspace)) if (!copies.some(c=>c.type==='draft'&&c.id===r.draft_id)) copies.push({type:'draft',id:r.draft_id})
 }
 if(type==='project'||type==='person')for(const announcement of await all<{id:string}>(db,`SELECT id FROM peg_announcements WHERE workspace_id=? AND ${type==='person'?'author_id=?':"subject_type='project' AND subject_id=?"}`,workspace,id))copies.push({type:'announcement',id:announcement.id})
 for(const copy of [...copies].filter(copy=>copy.type==='draft'))if(await first(db,'SELECT 1 FROM peg_status_model_drafts WHERE draft_id=?',copy.id))copies.push({type:'model_draft',id:copy.id})
 return copies
}
export async function createRightsRequest(db: D1Database, actor: Actor, workspace: string, input: Record<string,any>) {
 await requireOwner(db,actor,workspace)
 if (typeof input.targetId !== 'string' || input.targetId.length > 120 || !['task','project','person'].includes(input.type)) throw invalid('rights_scope')
 const table = input.type === 'task' ? 'peg_tasks' : input.type === 'project' ? 'peg_projects' : 'oa_operators'
 if (!await first(db,`SELECT 1 FROM ${table} WHERE id=?${input.type === 'person' ? '' : ' AND workspace_id=?'}`,input.targetId,...(input.type === 'person'?[]:[workspace]))) throw invalid('rights_scope')
 const copies = await inventory(db,workspace,input.type,input.targetId)
 if (input.type === 'person' && !copies.length && !await workspaceRole(db,input.targetId,workspace) && !await first(db,'SELECT 1 FROM peg_workspace_members WHERE operator_id=? AND workspace_id=?',input.targetId,workspace)) throw invalid('rights_scope')
 const at = now(), received = time(input.receivedAt)
 if (received > at) throw invalid('future_rights_receipt')
 let day = Math.floor(received / DAY), left = 10
 while (left) { day++; if (isWorkingDay(day)) left-- }
 const ackDue = (day+1)*DAY-1, responseDue = Math.min(received+45*DAY,input.applicableDeadline === undefined ? received+45*DAY : time(input.applicableDeadline))
 if (responseDue < received) throw invalid('rights_deadline')
 const handler = String(input.handlerId ?? actor.id), until = time(input.handlerUntil)
 await human(db,handler,workspace)
 if (until <= at || until > at+90*DAY) throw invalid('finite_handler_authority_required')
 const id = newId('rights')
 await batch(db,[bound(db,'INSERT INTO peg_status_rights_requests(id,workspace_id,target_type,target_id,received_at,ack_due,response_due,handler_id,handler_until,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',[id,workspace,input.type,input.targetId,received,ackDue,responseDue,handler,until,actor.id,at]),...copies.map(c=>bound(db,'INSERT INTO peg_status_rights_copies VALUES(?,?,?)',[id,c.type,c.id])),bumpEpoch(db),permanentEvent(db,{workspace,actor:actor.id,action:'status.rights_received',type:'rights_request',id})])
 return readRightsRequest(db,actor,id)
}
export async function listRightsRequests(db: D1Database, actor: Actor, workspace: string, at = now()) {
 await human(db,actor.id,workspace)
 const owner = await workspaceRole(db,actor.id,workspace) === 'owner'
 const rows = await all<{id:string}>(db,`SELECT id FROM peg_status_rights_requests WHERE workspace_id=?${owner?'':' AND handler_id=? AND handler_until>?'} ORDER BY received_at,id`,workspace,...(owner?[]:[actor.id,now()]))
 const requests=[]
 for (const row of rows) requests.push(await readRightsRequest(db,actor,row.id,at))
 return {requests}
}
export async function readRightsRequest(db: D1Database, actor: Actor, id: string, at = now()) {
 const {row} = await request(db,actor,id)
 if (!Number.isFinite(at)) throw invalid('rights_date')
 const escalations = []
 if (!row.acknowledged_at && at > row.ack_due) escalations.push('acknowledgment_overdue')
 if (!row.responded_at && at > (row.final_due ?? row.response_due)) escalations.push('disposition_overdue')
 if (row.state === 'controlled_resolution_pending' && row.next_review_at && at >= row.next_review_at) escalations.push('controlled_resolution_review_due')
 if (row.retention_review_at && at >= row.retention_review_at) escalations.push('retention_review_due')
 if (row.handler_until <= at) escalations.push('handler_authority_expired')
 return {...row,evaluatedAt:at,escalations,escalateTo:'installation_owner',copies:await all(db,'SELECT copy_type,copy_id FROM peg_status_rights_copies WHERE request_id=? ORDER BY copy_type,copy_id',id),events:await all(db,'SELECT actor_id,action,at,detail FROM peg_status_rights_events WHERE request_id=? ORDER BY at,id',id),custodyBlocker:'review_status_snapshot_custody_before_erasure',erasureOutcome:'not_erased',externalLimits,inventoryLimits:'Structured native status references only. Manual review must reconcile free text, archives, downloaded and processor copies before any resolution.'}
}
export async function actOnRightsRequest(db: D1Database, actor: Actor, id: string, input: Record<string,any>) {
 const {row,owner} = await request(db,actor,id), at=now()
 if (input.version !== row.version) throw conflict('stale_rights_request')
 const revision = await epoch(db), statements = [bound(db,`INSERT INTO peg_status_rights_guards VALUES(?,COALESCE((
  SELECT q.version=? AND (SELECT value FROM peg_epoch WHERE id=1)=? AND o.status='active'
   AND (o.role IN ('owner','admin') OR EXISTS(SELECT 1 FROM peg_workspace_members m WHERE m.operator_id=o.id AND m.workspace_id=q.workspace_id AND m.role IN ('member','manager')))
   AND (o.role='owner' OR (q.handler_id=o.id AND q.handler_until>CAST((julianday('now')-2440587.5)*86400000 AS INTEGER)))
  FROM peg_status_rights_requests q JOIN oa_operators o ON o.id=? WHERE q.id=?),0))`,[newId('guard'),row.version,revision,actor.id,id])]
 let sql = '', args: (string|number|null)[] = [], detail: Record<string,unknown> = {}
 if (input.action === 'delegate') {
  if (!owner) throw forbidden('owner_required')
  const handler=String(input.handlerId),until=time(input.handlerUntil)
  await human(db,handler,row.workspace_id)
  if (until<=at || until>at+90*DAY) throw invalid('finite_handler_authority_required')
  sql='handler_id=?,handler_until=?';args=[handler,until];detail={handlerId:handler,until}
 } else if (input.action === 'acknowledge') {
  if (row.acknowledged_at) throw conflict('rights_already_acknowledged')
  detail={notice:text(input.notice)};sql='acknowledged_at=?';args=[at]
 } else if (input.action === 'extend') {
  const rule=text(input.rule),reason=text(input.reason),notice=text(input.notice),final=time(input.finalDate),allowedUntil=time(input.permittedUntil)
  if (input.permitted !== true || !row.acknowledged_at || row.final_due || row.responded_at || at>=row.response_due || final<=row.response_due || final>allowedUntil || /implementation|software|indefinite/i.test(reason)) throw invalid('unsupported_rights_extension')
  sql='final_due=?,extension_rule=?,extension_reason=?,extension_notice=?,extension_notified_at=?';args=[final,rule,reason,notice,at];detail={rule,reason,notice,final,permittedUntil:allowedUntil}
 } else if (input.action === 'disposition') {
  if (!row.acknowledged_at) throw invalid('acknowledge_rights_first')
  if (!['controlled_resolution_pending','justified_retention'].includes(input.state)) throw invalid('unverified_erasure_disposition')
  const reason=text(input.reason)
  if (input.state==='justified_retention') {
   const basis=text(input.basis),authority=text(input.authority),review=time(input.reviewAt)
   if (!['lawful_hold','applicable_retention_rule'].includes(input.basisType) || review<=at || /implementation|software|indefinite/i.test(basis+' '+reason)) throw invalid('unsupported_retention_basis')
   sql='state=?,disposition=?,responded_at=?,retention_basis=?,retention_authority=?,retention_review_at=?,next_review_at=NULL';args=[input.state,reason,at,basis,authority,review];detail={reason,basis,authority,review,basisType:input.basisType}
  } else { const review=time(input.reviewAt); if (review<=at || review>at+7*DAY) throw invalid('finite_resolution_review_required'); sql='state=?,disposition=?,responded_at=?,next_review_at=?,retention_basis=NULL,retention_authority=NULL,retention_review_at=NULL';args=[input.state,reason,at,review];detail={reason,review} }
 } else throw invalid('rights_action')
 statements.push(bound(db,`UPDATE peg_status_rights_requests SET ${sql},version=version+1 WHERE id=?`,[...args,id]),bound(db,'INSERT INTO peg_status_rights_events VALUES(?,?,?,?,?,?)',[newId('rights_event'),id,actor.id,input.action,at,JSON.stringify(detail)]),permanentEvent(db,{workspace:row.workspace_id,actor:actor.id,action:'status.rights_'+input.action,type:'rights_request',id}))
 try { await batch(db,statements) } catch(error) { if (String(error).includes('CHECK constraint')) throw conflict('stale_rights_request'); throw error }
 return readRightsRequest(db,actor,id)
}
/** Pending custody review suspends ordinary reuse without granting handlers access to the content. */
export async function assertStatusReuse(db: D1Database, type: string, id: string) {
 if (await first(db,'SELECT 1 FROM peg_status_rights_copies WHERE copy_type=? AND copy_id=?',type,id)) throw conflict('status_rights_custody_review')
}
