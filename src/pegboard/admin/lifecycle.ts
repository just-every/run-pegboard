import { all, conflict, first, forbidden, invalid, notFound } from '../db'
import { digest } from '../decisions/revision'
import { operatorRow, type Actor } from '../workspace/people'
import { requireAdministrator } from './settings'

/** Installation status is global. Only native administrators may review it; private work contributes counts only. */
export async function lifecyclePreview(db: D1Database, actor: Actor, workspace: string, person: string, status: unknown) {
  await requireAdministrator(db, actor, workspace)
  const administrator = await operatorRow(db, actor.id), subject = await operatorRow(db, person)
  if (!administrator || administrator.status !== 'active' || !['owner', 'admin'].includes(administrator.role)) throw forbidden('installation_administrator')
  if (!subject || (subject.role === 'member' && !await first(db, 'SELECT 1 FROM peg_workspace_members WHERE workspace_id=? AND operator_id=?', workspace, person))) throw notFound()
  if (status !== 'active' && status !== 'inactive') throw invalid('status')
  if (status === 'active' && await first(db, 'SELECT 1 FROM peg_erased_people WHERE operator_id=?', person)) throw conflict('identity_erased')
  if (subject.status === 'invited') throw conflict('invitation_required')
  const counts = await first<Record<string, number>>(db, `SELECT
    (SELECT count(*) FROM oa_sessions WHERE operator_id=?1 AND revoked_at IS NULL) sessions,
    (SELECT count(*) FROM peg_api_keys WHERE owner_id=?1 AND revoked_at IS NULL) apiKeys,
    (SELECT count(*) FROM peg_analytics_keys WHERE owner_id=?1 AND revoked_at IS NULL) analystKeys,
    (SELECT count(*) FROM peg_approval_links l JOIN peg_approval_routes r ON r.id=l.route_id WHERE (l.recipient_id=?1 OR r.created_by=?1) AND l.revoked_at IS NULL) proofLinks,
    (SELECT count(*) FROM peg_personal_rules WHERE operator_id=?1) personalRules,
    (SELECT count(*) FROM peg_recurrences WHERE created_by=?1 AND active=1) recurrences,
    (SELECT count(*) FROM peg_local_rules WHERE activated_by=?1 AND enabled=1) localRules,
    (SELECT count(*) FROM peg_bundle_adoptions WHERE activated_by=?1 AND enabled=1) bundles,
    (SELECT count(*) FROM peg_template_rules WHERE enabled=1 AND activation_id IN (SELECT id FROM peg_template_rule_activations WHERE activated_by=?1)) templateRules,
    (SELECT count(*) FROM peg_access_requests WHERE requester_id=?1 AND status='pending') requests`, person)
  const revision = (await first<{ value: number }>(db, 'SELECT value FROM peg_personal_revision WHERE id=1'))!.value
  const token = await digest({ actor: actor.id, person, status, version: subject.version, revision, counts })
  return { person: { id: person, name: subject.display_name, status: subject.status }, status, counts: counts!, token }
}

export async function validateLifecycle(db: D1Database, actor: Actor, workspace: string, person: string, input: Record<string, unknown>) {
  const preview = await lifecyclePreview(db, actor, workspace, person, input.status)
  if (input.token !== preview.token) throw conflict('lifecycle_review_changed')
  if (input.confirm !== true && input.confirm !== 'on') throw invalid('confirm_lifecycle')
  return preview
}

/** Explicit columns keep credential hashes, private titles and old capabilities out of the downloadable review. */
export async function lifecycleReview(db: D1Database, actor: Actor, workspace: string) {
  await requireAdministrator(db, actor, workspace)
  return all<{ id: number; operatorId: string; status: string; at: number; cancelledAccessDecisions: number; cancelledApprovals: number }>(db, `SELECT e.id,e.operator_id operatorId,e.status,e.at,
    (SELECT count(*) FROM peg_identity_request_cancellations c WHERE c.operator_id=e.operator_id) cancelledAccessDecisions,
    (SELECT count(*) FROM peg_identity_approval_cancellations c WHERE c.operator_id=e.operator_id) cancelledApprovals
    FROM peg_identity_events e JOIN oa_operators o ON o.id=e.operator_id
    WHERE o.role IN ('owner','admin') OR EXISTS(SELECT 1 FROM peg_workspace_members m WHERE m.workspace_id=? AND m.operator_id=o.id)
    ORDER BY e.id DESC LIMIT 100`, workspace)
}
