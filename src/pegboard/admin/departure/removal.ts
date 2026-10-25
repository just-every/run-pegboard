import { all, batch, bound, conflict, first, forbidden, invalid, newId, notFound, now } from '../../db'
import { digest } from '../../decisions/revision'
import { auditStatement, bumpEpoch } from '../../authorization/audit'
import { historyStatement, reopenGuard } from '../../tasks/history'
import { operatorRow, type Actor } from '../../workspace/people'
import { affectedSets, sets } from './sets'

async function administrator(db: D1Database, actor: Actor) {
  const operator = await operatorRow(db, actor.id)
  if (!operator || operator.status !== 'active' || !['owner','admin'].includes(operator.role)) throw forbidden('installation_administrator')
}
export async function removalPreview(db: D1Database, actor: Actor, person: string) {
  await administrator(db, actor)
  const subject = await operatorRow(db, person)
  if (!subject) throw notFound()
  if (actor.id === person) throw conflict('cannot_remove_self')
  if (subject.role === 'owner' && (await all(db,"SELECT id FROM oa_operators WHERE role='owner' AND status='active'")).length <= 1) throw conflict('last_owner')
  const revision = (await first<{ value: number }>(db, 'SELECT value FROM peg_departure_revision WHERE id=1'))!.value
  const affected = await affectedSets(db, person)
  const credentials = await first<{ sessions: number; keys: number; links: number }>(db, `SELECT
    (SELECT count(*) FROM oa_sessions WHERE operator_id=? AND revoked_at IS NULL) sessions,
    (SELECT count(*) FROM oa_credentials WHERE operator_id=? AND revoked_at IS NULL)+(SELECT count(*) FROM peg_analytics_keys WHERE owner_id=? AND revoked_at IS NULL)+(SELECT count(*) FROM peg_goal_sources WHERE owner_id=? AND ended_at IS NULL) keys,
    (SELECT count(*) FROM oa_tokens WHERE (operator_id=? OR issuer_id=?) AND consumed_at IS NULL AND revoked_at IS NULL) links`, person,person,person,person,person,person)
  const replacements = await all<{ id: string; name: string }>(db,"SELECT id,display_name name FROM oa_operators WHERE status='active' AND role IN ('owner','admin') AND id<>? ORDER BY display_name",person)
  const token = await digest({ person, actor: actor.id, revision, affected, credentials })
  return { completed:!!await first(db,"SELECT 1 FROM peg_permanent_audit WHERE action='person.departure' AND target_type='person' AND target_id=? LIMIT 1",person), person: { id: person, name: subject.display_name, status: subject.status }, revision, affected, credentials: credentials!, replacements, token }
}
export async function removeReviewedPerson(db: D1Database, actor: Actor, person: string, input: Record<string, any>) {
  const preview = await removalPreview(db, actor, person)
  if (input.token !== preview.token) throw conflict('removal_review_changed')
  if (input.confirm !== true && input.confirm !== 'on') throw invalid('confirm_removal')
  const choices = input.choices && typeof input.choices === 'object' ? input.choices : input
  const at = now(), statements: D1PreparedStatement[] = [], dispositions: Record<string,string> = {}
  for (const set of sets) {
    const affected = preview.affected.find(s => s.key === set.key)!
    if (!affected.rows.length) continue
    const choice = choices[set.key]
    if (typeof choice !== 'string' || !choice) throw invalid('disposition_required')
    if (set.mode === 'stop' || set.mode === 'unassign') {
      if (choice !== (set.mode === 'stop' ? 'stop' : 'unassign')) throw invalid('disposition')
    } else if (choice !== 'unassign' && !preview.replacements.some(p => p.id === choice)) throw invalid('replacement')
    dispositions[set.key] = choice
    if (set.mode === 'stop') continue
    const replacement = choice === 'unassign' ? '' : choice
    if (set.key === 'tasks' || set.key === 'personal' || set.key === 'taskApprovals') {
      const tasks = await all<{ id: string }>(db, `SELECT id FROM peg_tasks WHERE ${set.where}`, person)
      for (const task of tasks) statements.push(reopenGuard(db,task.id,actor.id,'member_departure'),historyStatement(db,task.id,null,actor.id,'owner.transferred',{from:person,to:replacement,reason:'member_departure'}))
    }
    statements.push(bound(db,`UPDATE ${set.table} SET ${set.column}=? WHERE ${set.where}`,[replacement,person]))
  }
  // Revocation and transfers are one transaction behind a revision fence, including concurrent new assignments.
  const guard = newId('departure')
  try {
    await batch(db,[bound(db,'INSERT INTO peg_departure_guards VALUES(?,?,?)',[guard,preview.revision,actor.id]),...statements,
      bound(db,'UPDATE peg_recurrences SET active=0 WHERE created_by=?',[person]),
      bound(db,'UPDATE peg_bundle_adoptions SET enabled=0,epoch=epoch+1 WHERE activated_by=? AND enabled=1',[person]),
      bound(db,"UPDATE peg_bundle_jobs SET status='cancelled',finished_at=? WHERE actor_id=? AND status='queued'",[at,person]),
      bound(db,"UPDATE peg_schedule_sets SET status='rejected',decided_by=?,decided_at=? WHERE initiator_id=? AND status='pending'",[actor.id,at,person]),
      bound(db,'DELETE FROM peg_personal_rules WHERE operator_id=?',[person]),
      bound(db,'DELETE FROM peg_approvers WHERE operator_id=?',[person]),
      bound(db,'DELETE FROM peg_inbox WHERE operator_id=?',[person]),
      bound(db,'UPDATE peg_engineering_links SET revoked_at=COALESCE(revoked_at,?),state=\'revoked\',cause=\'member_departure\',version=version+1 WHERE created_by=? AND revoked_at IS NULL',[at,person]),
      bound(db,'UPDATE peg_meetings SET revoked_at=COALESCE(revoked_at,?) WHERE created_by=?',[at,person]),
      bound(db,'UPDATE peg_webhooks SET revoked_at=COALESCE(revoked_at,?) WHERE created_by=?',[at,person]),
      bound(db,"UPDATE peg_grants SET revoked_at=?,revoked_by=? WHERE revoked_at IS NULL AND (grantee_type='person' AND grantee_id=? OR created_by=? AND grantee_id IN(SELECT operator_id FROM peg_workspace_members WHERE role='agent'))",[at,actor.id,person,person]),
      bound(db,"UPDATE oa_policy_approvals SET revoked_at=COALESCE(revoked_at,?),revoke_reason='member_departure' WHERE owner_id=? AND revoked_at IS NULL",[at,person]),
      bound(db,"DELETE FROM peg_goal_audience WHERE grantee_type='person' AND grantee_id=?",[person]),
      bound(db,'DELETE FROM peg_task_collaborators WHERE operator_id=?',[person]),
      bound(db,'DELETE FROM oa_setup_links WHERE owner_id=? AND completed=0',[person]),
      bound(db,'DELETE FROM peg_portfolio_members WHERE operator_id=?',[person]),
      bound(db,'UPDATE peg_analytics_keys SET revoked_at=COALESCE(revoked_at,?) WHERE owner_id=?',[at,person]),
      bound(db,"UPDATE peg_goal_sources SET ended_at=COALESCE(ended_at,?),ended_cause=COALESCE(ended_cause,'member_departure') WHERE owner_id=?",[at,person]),
      bound(db,'DELETE FROM rer_dependency_pending WHERE approved_by=?',[person]),
      bound(db,'UPDATE oa_sessions SET revoked_at=COALESCE(revoked_at,?) WHERE operator_id=?',[at,person]),
      bound(db,'UPDATE oa_credentials SET revoked_at=COALESCE(revoked_at,?) WHERE operator_id=?',[at,person]),
      bound(db,'UPDATE oa_tokens SET revoked_at=COALESCE(revoked_at,?) WHERE operator_id=? OR issuer_id=?',[at,person,person]),
      bound(db,"UPDATE peg_access_requests SET status='stale' WHERE requester_id=? AND status='pending'",[person]),
      bound(db,'DELETE FROM peg_workspace_members WHERE operator_id=?',[person]),
      bound(db,"UPDATE oa_operators SET status='inactive' WHERE id=?",[person]),
      auditStatement(db,{workspaceId:null,actorId:actor.id,action:'person.departure',targetType:'person',targetId:person,subjectId:person,detail:{dispositions,credentials:preview.credentials,history:'preserved',outsideMessages:'not_retracted'}}),
      bumpEpoch(db),bound(db,'DELETE FROM peg_departure_guards WHERE id=?',[guard])])
  } catch (error) { if (/departure_review_changed/.test(String(error))) throw conflict('removal_review_changed'); throw error }
  return { id: person, status: 'inactive', dispositions, revoked: preview.credentials, history: 'preserved' }
}
