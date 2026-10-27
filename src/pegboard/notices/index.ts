import { taskAccess } from '../authorization/effective'
import { all } from '../db'
import type { TaskRow } from '../model'
import type { Actor } from '../workspace/people'
import { dispatchReadiness } from './dispatch'
import { readinessPreferences } from './preferences'

interface InboxRow extends TaskRow { generation: number; committed_at: number; visible_at: number | null; deferred_until: number | null; deferred_reason: string | null }
export interface ReadinessNotice { id: string; taskId: string; title: string; href: string; kind: 'ready_to_start'; committedAt: number; visibleAt: number }
export interface DeferredReadiness { taskId: string; title: string; href: string; reason: string; nextEligibleAt: number }

/** Dispatch and read use current assignee access, never the audience that existed when a predecessor completed. */
export async function readinessNotices(db: D1Database, actor: Actor, workspace: string) {
  await dispatchReadiness(db, actor, workspace)
  const preferences = await readinessPreferences(db, actor, workspace)
  const notices: ReadinessNotice[] = [], deferred: DeferredReadiness[] = []
  if (!preferences.enabled || preferences.muted || !preferences.inboxEnabled) return { notices, deferred, preferences }
  const rows = await all<InboxRow>(db, `SELECT t.*,n.generation,n.committed_at,n.deferred_until,n.deferred_reason,d.visible_at
    FROM peg_readiness_transitions n JOIN peg_readiness_state s ON s.task_id=n.task_id AND s.generation=n.generation AND s.blocked=0
    JOIN peg_tasks t ON t.id=n.task_id LEFT JOIN peg_readiness_deliveries d ON d.task_id=n.task_id AND d.generation=n.generation AND d.recipient_id=?
    WHERE n.workspace_id=? AND t.owner_id=? AND t.status<>'done' AND (n.state='delivered' AND d.recipient_id=? OR n.state='queued' AND n.deferred_until IS NOT NULL)
    AND NOT EXISTS(SELECT 1 FROM peg_readiness_task_preferences p WHERE p.task_id=t.id AND p.operator_id=? AND p.muted=1)
    ORDER BY n.committed_at DESC`, actor.id, workspace, actor.id, actor.id, actor.id)
  for (const row of rows) {
    if (!(await taskAccess(db, actor, row)).capabilities.has('read')) continue
    const link = { taskId: row.id, title: row.title, href: `/app/tasks/${row.id}` }
    if (row.visible_at !== null) notices.push({ ...link, id: `ready:${row.id}:${row.generation}`, kind: 'ready_to_start', committedAt: row.committed_at, visibleAt: row.visible_at })
    else if (row.deferred_until && row.deferred_reason) deferred.push({ ...link, reason: row.deferred_reason, nextEligibleAt: row.deferred_until })
  }
  return { notices, deferred, preferences }
}

export { readinessPreferences, saveReadinessPreferences, muteReadinessTask } from './preferences'
