import type { Bindings } from '../../auth.server'
import { all, batch, bound, conflict, first, forbidden, invalid, newId, notFound, now, PegError } from '../db'
import { digest, guarded, revision } from '../decisions/revision'
import { permanentEvent } from '../audit/search'
import { requireOwner } from '../data/settings'
import { workspaceRole, type Actor } from '../workspace/people'
import { openProject, need } from '../workspace/projects'
import { templatePreview, applyTemplate, readTemplateInput } from '../templates/instantiation'
import { hubspot, sourceIdentity, verifiedHubspotEvents, type Deal } from '../connectors/commercial/hubspot'
interface Portal { id: string; workspace_id: string; portal_id: string; actor_id: string; actor_version: number; active: number }
interface Handoff { id: string; workspace_id: string; portal_auth_id: string; portal_id: string; deal_id: string; state: string; project_id: string | null; source_revision: string | null; commitment: string; actor_id: string | null; created_at: number }
interface Review { id: string; handoff_id: string; kind: string; actor_id: string; actor_version: number; plan: string; state: string; cause: string | null; expires_at: number; created_at: number }
const confirmed = (v: unknown) => v === true || v === 'on' || v === 'yes'
const audit = (db: D1Database, actor: Actor | null, workspace: string, action: string, id: string, result = 'success') => permanentEvent(db, { workspace, actor: actor?.id ?? null, action: 'commercial.' + action, type: 'handoff', id, result })
async function ownerVersion(db: D1Database, actor: Actor, workspace: string) {
  await requireOwner(db, actor, workspace)
  const row = await first<{ version: number }>(db, "SELECT version FROM oa_operators WHERE id=? AND status='active'", actor.id)
  if (!row) throw forbidden('current_owner_required')
  return row.version
}
async function currentPortal(db: D1Database, portal: Portal | null) {
  if (!portal?.active || await workspaceRole(db, portal.actor_id, portal.workspace_id) !== 'owner' || !await first(db, "SELECT 1 FROM oa_operators WHERE id=? AND version=? AND status='active'", portal.actor_id, portal.actor_version)) throw forbidden('commercial_authority_revoked')
  return portal
}
async function own(db: D1Database, actor: Actor, workspace: string, id: string) {
  await ownerVersion(db, actor, workspace)
  const source = await first<Handoff>(db, 'SELECT * FROM peg_commercial_handoffs WHERE id=? AND workspace_id=?', id, workspace)
  if (!source || ['erased', 'inactive'].includes(source.state)) throw notFound()
  const portal = await currentPortal(db, await first<Portal>(db, 'SELECT * FROM peg_commercial_portals WHERE id=?', source.portal_auth_id))
  if (portal.actor_id !== actor.id) throw forbidden('commercial_grant_owner_required')
  if (source.project_id) { const opened = await openProject(db, actor, source.project_id); need(opened.effective, 'manage_templates') }
  return source
}
export async function commercialSettings(db: D1Database, actor: Actor, workspace: string) {
  await ownerVersion(db, actor, workspace)
  return { portals: await all<Portal>(db, 'SELECT * FROM peg_commercial_portals WHERE workspace_id=? ORDER BY created_at,id', workspace), handoffs: (await all<Handoff>(db, 'SELECT * FROM peg_commercial_handoffs WHERE workspace_id=? ORDER BY created_at,id', workspace)).map(s => ({ ...s, commitment: JSON.parse(s.commitment) })), reviews: (await all<Review>(db, 'SELECT r.* FROM peg_commercial_reviews r JOIN peg_commercial_handoffs h ON h.id=r.handoff_id WHERE h.workspace_id=? ORDER BY r.created_at,r.id', workspace)).map(r => ({ ...r, plan: JSON.parse(r.plan) })) }
}
export async function authorizePortal(db: D1Database, env: Bindings, actor: Actor, workspace: string, input: Record<string, any>) {
  const rev = await revision(db), version = await ownerVersion(db, actor, workspace), portalId = sourceIdentity(input.portalId)
  if (!confirmed(input.confirm)) throw invalid('commercial_explicit_consent')
  if (await hubspot(env, input.credential).portal() !== portalId) throw forbidden('hubspot_portal_refused')
  const id = newId('commercial')
  if (await first(db, 'SELECT 1 FROM peg_commercial_portals WHERE portal_id=? AND active=1', portalId)) throw conflict('commercial_portal_already_authorized')
  await guarded(db, rev, [bound(db, 'INSERT INTO peg_commercial_portals VALUES(?,?,?,?,?,1,?)', [id, workspace, portalId, actor.id, version, now()]), audit(db, actor, workspace, 'portal_authorized', id)])
  return { id, portalId }
}
export async function revokePortal(db: D1Database, actor: Actor, workspace: string, id: string) {
  const rev = await revision(db); await ownerVersion(db, actor, workspace)
  if (!await first(db, 'SELECT 1 FROM peg_commercial_portals WHERE id=? AND workspace_id=?', id, workspace)) throw notFound()
  await guarded(db, rev, [bound(db, 'UPDATE peg_commercial_portals SET active=0 WHERE id=?', [id]), audit(db, actor, workspace, 'portal_revoked', id)])
  return { id, active: false }
}
export async function receiveHubspot(request: Request, env: Bindings) {
  const events = await verifiedHubspotEvents(request, env), db = env.DB
  // An app signature authenticates transport, never tenant consent. Unconsented portals are ignored.
  let accepted = 0
  for (const event of events) {
    const portalId = sourceIdentity(event.portalId), dealId = sourceIdentity(event.objectId), eventId = sourceIdentity(event.eventId)
    const candidate = await first<Portal>(db, 'SELECT * FROM peg_commercial_portals WHERE portal_id=? AND active=1', portalId)
    if (!candidate) continue
    try { await currentPortal(db, candidate) } catch (error) { if (error instanceof PegError) continue; throw error }
    const rev = await revision(db), id = newId('handoff')
    await guarded(db, rev, [bound(db, "INSERT OR IGNORE INTO peg_commercial_handoffs(id,workspace_id,portal_auth_id,portal_id,deal_id,state,created_at) VALUES(?,?,?,?,?,'pending',?)", [id, candidate.workspace_id, candidate.id, portalId, dealId, now()]), bound(db, 'INSERT OR IGNORE INTO peg_commercial_events SELECT ?,?,id,? FROM peg_commercial_handoffs WHERE workspace_id=? AND portal_id=? AND deal_id=?', [portalId, eventId, event.occurredAt, candidate.workspace_id, portalId, dealId]), audit(db, null, candidate.workspace_id, 'event_received', id)])
    accepted++
  }
  return { accepted, notice: 'Events create no projects or grants.' }
}
const nativePlan = (view: Awaited<ReturnType<typeof templatePreview>>) => { const { rev, token, ...plan } = view; return plan }
const projection = (deal: Deal) => ({ portalId: deal.portalId, dealId: deal.dealId, revision: deal.revision, stage: deal.stage, won: deal.won, fields: deal.fields, url: deal.url })
async function projectState(db: D1Database, actor: Actor, id: string) {
  const { project, effective } = await openProject(db, actor, id); need(effective, 'manage_templates')
  return { project, tasks: await all(db, 'SELECT t.id,t.owner_id,t.status,t.start_date,t.due_date,t.updated_at FROM peg_tasks t JOIN peg_task_projects p ON p.task_id=t.id WHERE p.project_id=? ORDER BY t.id', id) }
}
async function saveReview(db: D1Database, actor: Actor, source: Handoff, kind: string, plan: unknown, rev: Awaited<ReturnType<typeof revision>>) {
  const id = newId('commercialreview'), at = now(), version = await ownerVersion(db, actor, source.workspace_id)
  await guarded(db, rev, [bound(db, "INSERT INTO peg_commercial_reviews VALUES(?,?,?,?,?,?,'pending',NULL,?,?)", [id, source.id, kind, actor.id, version, JSON.stringify(plan), at + 300000, at]), audit(db, actor, source.workspace_id, kind + '_reviewed', source.id)])
  return { id, kind, plan, expiresAt: at + 300000, state: 'pending' }
}
export async function reviewAdoption(db: D1Database, env: Bindings, actor: Actor, workspace: string, id: string, input: Record<string, any>) {
  const rev = await revision(db), source = await own(db, actor, workspace, id)
  if (source.state !== 'pending') throw conflict('commercial_handoff_decided')
  if (input.targetProjectId) throw invalid('commercial_new_private_project_required')
  const deal = await hubspot(env, input.credential).read(source.portal_id, source.deal_id)
  if (!deal.won) throw conflict('commercial_won_deal_required')
  const native = readTemplateInput(input), template = await templatePreview(db, actor, workspace, native)
  if (template.missingRoles.length || template.unreachableOwners.length || template.configurationConflicts.length || template.kind !== 'project') throw invalid('commercial_template_roles_required')
  const plan = { source: projection(deal), native: { ...native, token: undefined }, template: nativePlan(template), ownerId: actor.id, clientShare: { audience: [], grants: [], visibility: 'private', excluded: ['contacts', 'email', 'amount', 'account health', 'ticket SLA', 'unselected customer properties'] } }
  return saveReview(db, actor, source, 'adoption', plan, rev)
}
async function ownReview(db: D1Database, actor: Actor, workspace: string, id: string) {
  const rev = await revision(db), review = await first<Review>(db, 'SELECT * FROM peg_commercial_reviews WHERE id=?', id)
  if (!review) throw notFound()
  const source = await own(db, actor, workspace, review.handoff_id)
  if (review.actor_id !== actor.id || review.actor_version !== await ownerVersion(db, actor, workspace)) throw forbidden('commercial_review_authority_changed')
  return { review, source, rev, plan: JSON.parse(review.plan) }
}
export async function adoptHandoff(db: D1Database, env: Bindings, actor: Actor, workspace: string, id: string, input: Record<string, any>) {
  const { review, source, rev, plan } = await ownReview(db, actor, workspace, id)
  if (review.kind !== 'adoption' || !confirmed(input.confirm)) throw invalid('commercial_exact_review_required')
  if (review.state === 'adopted' && source.state === 'adopted') {
    await hubspot(env, input.credential).read(source.portal_id, source.deal_id)
    return { projectId: source.project_id, replayed: true }
  }
  if (review.state !== 'pending' || source.state !== 'pending' || review.expires_at <= now()) throw conflict('commercial_review_changed')
  const deal = await hubspot(env, input.credential).read(source.portal_id, source.deal_id)
  const template = await templatePreview(db, actor, workspace, plan.native)
  if (await digest(projection(deal)) !== await digest(plan.source) || !deal.won || await digest(nativePlan(template)) !== await digest(plan.template)) throw conflict('commercial_review_changed')
  // Fence provider latency and commit native project plus mapping in the template's one transaction.
  if ((await revision(db)).value !== rev.value) throw conflict('commercial_review_changed')
  return applyTemplate(db, actor, workspace, { ...plan.native, token: template.token }, undefined, result => [bound(db, "UPDATE peg_commercial_handoffs SET state='adopted',project_id=?,source_revision=?,commitment=?,actor_id=? WHERE id=? AND state='pending'", [result.projectId, deal.revision, JSON.stringify(plan), actor.id, source.id]), bound(db, "UPDATE peg_commercial_reviews SET state='adopted' WHERE id=?", [id]), audit(db, actor, workspace, 'adopted', source.id)], source.id)
}
export async function declineHandoff(db: D1Database, actor: Actor, workspace: string, id: string, input: Record<string, any>) {
  const rev = await revision(db), source = await own(db, actor, workspace, id)
  if (!confirmed(input.confirm)) throw invalid('commercial_decline_confirmation')
  if (source.state === 'declined') return { id, state: 'declined' }
  if (source.state !== 'pending') throw conflict('commercial_handoff_decided')
  await guarded(db, rev, [bound(db, "UPDATE peg_commercial_handoffs SET state='declined' WHERE id=?", [id]), bound(db, "UPDATE peg_commercial_reviews SET state='cancelled' WHERE handoff_id=? AND state='pending'", [id]), audit(db, actor, workspace, 'declined', id)])
  return { id, state: 'declined' }
}
export async function reviewReturn(db: D1Database, env: Bindings, actor: Actor, workspace: string, id: string, input: Record<string, any>) {
  const rev = await revision(db), source = await own(db, actor, workspace, id)
  if (source.state !== 'adopted' || !source.project_id) throw conflict('commercial_adopted_project_required')
  if (await first(db, "SELECT 1 FROM peg_commercial_reviews WHERE handoff_id=? AND kind='return' AND state IN ('sending','uncertain')", id)) throw conflict('commercial_reconcile_required')
  const provider = hubspot(env, input.credential), status = String(input.status ?? '')
  await provider.returnSchema(status)
  const deal = await provider.read(source.portal_id, source.deal_id)
  const plan = { source: projection(deal), prior: { status: deal.deliveryStatus, operation: deal.deliveryOperation }, project: await projectState(db, actor, source.project_id), status, properties: ['pegboard_delivery_status', 'pegboard_delivery_operation'], audience: 'HubSpot deal readers', notice: 'Only the selected delivery status and opaque operation ID return. No work, customer fields or grants are sent.' }
  return saveReview(db, actor, source, 'return', plan, rev)
}
async function finishReturn(db: D1Database, actor: Actor, workspace: string, id: string, state: string, cause: string | null) {
  await batch(db, [bound(db, 'UPDATE peg_commercial_reviews SET state=?,cause=? WHERE id=?', [state, cause, id]), audit(db, actor, workspace, 'return_' + state, id, state === 'acknowledged' ? 'success' : state)])
  return { id, state, cause }
}
export async function reconcileReturn(db: D1Database, env: Bindings, actor: Actor, workspace: string, id: string, input: Record<string, any>) {
  const { review, source, plan } = await ownReview(db, actor, workspace, id)
  if (review.kind !== 'return' || !['sending', 'uncertain', 'acknowledged'].includes(review.state)) throw conflict('commercial_return_not_uncertain')
  try {
    const deal = await hubspot(env, input.credential).read(source.portal_id, source.deal_id)
    await own(db, actor, workspace, source.id)
    if (deal.deliveryOperation === id && deal.deliveryStatus === plan.status) return finishReturn(db, actor, workspace, id, 'acknowledged', null)
    return finishReturn(db, actor, workspace, id, 'uncertain', 'readback_does_not_match')
  } catch (error) {
    if (!(error instanceof PegError)) throw error
    return finishReturn(db, actor, workspace, id, 'uncertain', error.code)
  }
}
export async function sendReturn(db: D1Database, env: Bindings, actor: Actor, workspace: string, id: string, input: Record<string, any>) {
  const { review, source, rev, plan } = await ownReview(db, actor, workspace, id)
  if (review.kind !== 'return' || !confirmed(input.confirm)) throw invalid('commercial_exact_review_required')
  if (review.state !== 'pending') return reconcileReturn(db, env, actor, workspace, id, input)
  if (review.expires_at <= now() || !source.project_id) throw conflict('commercial_review_changed')
  const provider = hubspot(env, input.credential)
  const deal = await provider.read(source.portal_id, source.deal_id)
  await provider.returnSchema(plan.status)
  if (await digest(projection(deal)) !== await digest(plan.source) || deal.deliveryStatus !== plan.prior.status || deal.deliveryOperation !== plan.prior.operation || await digest(await projectState(db, actor, source.project_id)) !== await digest(plan.project)) throw conflict('commercial_review_changed')
  await own(db, actor, workspace, source.id)
  await guarded(db, rev, [bound(db, "UPDATE peg_commercial_reviews SET state='sending',cause=NULL WHERE id=? AND state='pending'", [id]), audit(db, actor, workspace, 'return_claimed', id, 'started')])
  try { await provider.write(source.deal_id, plan.status, id) }
  catch (error) {
    if (!(error instanceof PegError)) throw error
    if (error.status === 403) return finishReturn(db, actor, workspace, id, 'rejected', error.code)
    await finishReturn(db, actor, workspace, id, 'uncertain', error.code)
  }
  // Every response, including a lost acknowledgment, is reconciled before any possible future write.
  return reconcileReturn(db, env, actor, workspace, id, input)
}
