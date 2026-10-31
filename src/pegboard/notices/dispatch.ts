import { taskAccess } from '../authorization/effective'
import { all, batch, bound, first, now, run } from '../db'
import type { TaskRow } from '../model'
import type { Actor } from '../workspace/people'
import { readinessPreferences } from './preferences'

interface Pending extends TaskRow { generation: number }
const revision = async (db: D1Database) => (await first<{ value: number }>(db, 'SELECT value FROM peg_data_revision WHERE id=1'))!.value

/** Only this signed-in assignee's native Inbox can consume their transitions. No external send is claimed. */
export async function dispatchReadiness(db: D1Database, actor: Actor, workspace: string) {
  const preferences = await readinessPreferences(db, actor, workspace)
  const pending = await all<Pending>(db, `SELECT t.*,n.generation FROM peg_readiness_transitions n JOIN peg_tasks t ON t.id=n.task_id
    JOIN peg_readiness_state s ON s.task_id=t.id AND s.generation=n.generation AND s.blocked=0
    WHERE n.workspace_id=? AND n.state='queued' AND t.owner_id=? AND t.status<>'done' ORDER BY n.committed_at`, workspace, actor.id)
  for (const task of pending) {
    const scopeRevision = await revision(db), access = await taskAccess(db, actor, task)
    const taskMuted = !!await first(db, 'SELECT 1 FROM peg_readiness_task_preferences WHERE task_id=? AND operator_id=? AND muted=1', task.id, actor.id)
    if (!access.capabilities.has('read') || !preferences.enabled || preferences.muted || !preferences.inboxEnabled || taskMuted) {
      await run(db, `UPDATE peg_readiness_transitions SET state='suppressed',deferred_until=NULL,deferred_reason=NULL
        WHERE task_id=? AND generation=? AND state='queued' AND EXISTS(SELECT 1 FROM peg_tasks WHERE id=? AND owner_id=?)`, task.id, task.generation, task.id, actor.id)
      continue
    }
    const at = now(), until = Math.max(preferences.dndUntil ?? 0, preferences.digestUntil ?? 0)
    if (until > at) {
      await run(db, `UPDATE peg_readiness_transitions SET deferred_until=?,deferred_reason=?
        WHERE task_id=? AND generation=? AND state='queued' AND EXISTS(SELECT 1 FROM peg_tasks WHERE id=? AND owner_id=?)`,
      until, (preferences.dndUntil ?? 0) >= (preferences.digestUntil ?? 0) ? 'quiet_hours' : 'digest', task.id, task.generation, task.id, actor.id)
      continue
    }
    const grants = [...new Set([...access.contexts.values()].flatMap(context => context.paths.flatMap(path => path.grantId ? [path.grantId] : [])))].sort()
    // The authority fence and current preferences are checked in the same transaction as the unique delivery.
    await batch(db, [
      bound(db, `INSERT OR IGNORE INTO peg_readiness_deliveries(task_id,generation,recipient_id,visible_at,share_revision)
        SELECT n.task_id,n.generation,?, ?, ? FROM peg_readiness_transitions n
        JOIN peg_readiness_state s ON s.task_id=n.task_id AND s.generation=n.generation AND s.blocked=0
        JOIN peg_tasks t ON t.id=n.task_id
        LEFT JOIN peg_readiness_preferences p ON p.workspace_id=n.workspace_id AND p.operator_id=?
        LEFT JOIN peg_readiness_task_preferences m ON m.task_id=t.id AND m.operator_id=?
        WHERE n.task_id=? AND n.generation=? AND n.state='queued' AND t.owner_id=? AND t.status<>'done'
        AND (SELECT value FROM peg_data_revision WHERE id=1)=?
        AND COALESCE(p.enabled,1)=1 AND COALESCE(p.inbox_enabled,1)=1 AND COALESCE(p.muted,0)=0 AND COALESCE(m.muted,0)=0
        AND COALESCE(p.dnd_until,0)<=? AND COALESCE(p.digest_until,0)<=?`,
      [actor.id, at, JSON.stringify({ revision: scopeRevision, grants }), actor.id, actor.id, task.id, task.generation, actor.id, scopeRevision, at, at]),
      bound(db, `UPDATE peg_readiness_transitions SET state='delivered',deferred_until=NULL,deferred_reason=NULL
        WHERE task_id=? AND generation=? AND state='queued' AND EXISTS(SELECT 1 FROM peg_readiness_deliveries d
        WHERE d.task_id=peg_readiness_transitions.task_id AND d.generation=peg_readiness_transitions.generation)`, [task.id, task.generation]),
    ])
  }
}

export { dispatchApprovalFollowups, processApprovalFollowups, scheduleApprovalFollowups } from './approval-followup'
