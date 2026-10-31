import { decisionPreview } from '../decisions/tasks'
import { guarded, revision as noticeRevision } from '../decisions/revision'
import { openTask } from '../tasks/access'
import { PegError, invalid, notFound } from '../db'
import { internalPreferences } from './preferences'
import { internalNoticePolicy, pendingNoticeRows } from './events'
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

/** Content and the current relationship are checked for dispatch and every subsequent Inbox read. */
export async function internalNoticeContent(db: D1Database, actor: Actor, event: Awaited<ReturnType<typeof pendingNoticeRows>>[number]) {
  const opened = await openTask(db, actor, event.task_id).catch(() => null)
  if (!opened) return null
  const {task,access} = opened
  if (event.kind === 'assignment') {
    if (task.owner_id !== actor.id || task.status === 'done') return null
    if (await first(db, `SELECT 1 FROM peg_notice_events WHERE task_id=? AND kind='assignment' AND rowid>(SELECT rowid FROM peg_notice_events WHERE id=?)`, task.id, event.id)) return null
  }
  if (event.kind === 'approval') {
    const decision = await decisionPreview(db, actor, task.id)
    if (!decision.canDecide || decision.state === 'approved' || decision.state === 'rejected') return null
  }
  let explanation=event.kind==='assignment'?'Assigned to you':event.kind==='approval'?'Approval requested':'You were mentioned'
  if (event.kind === 'comment') {
    const comment = await first<{ project_id: string | null; internal_only: number }>(db, 'SELECT project_id,internal_only FROM peg_comments WHERE id=? AND task_id=?', event.comment_id, task.id)
    if (!comment || (comment.internal_only && access.role === 'guest') || (comment.project_id === null ? !access.personal : !access.contexts.has(comment.project_id))) return null
    if(event.reason!=='mention'){
      if(task.owner_id===actor.id)explanation='A comment on work you own'
      else if(await first(db,'SELECT 1 FROM peg_task_collaborators WHERE task_id=? AND operator_id=?',task.id,actor.id))explanation='A comment on work you collaborate on'
      else if(await first(db,'SELECT 1 FROM peg_notice_follows WHERE task_id=? AND operator_id=? AND following=1',task.id,actor.id))explanation='A comment on work you follow'
      else return null
    }
  }
  if (await first(db, 'SELECT 1 FROM peg_readiness_task_preferences WHERE task_id=? AND operator_id=? AND muted=1', task.id, actor.id)) return null
  return { explanation, title: task.title, taskId: task.id, href: `/app/tasks/${task.id}` }
}

export interface InternalNoticeItem {explanation:string;title:string;taskId:string;href:string;id:string;recipientId:string;commentId:string|null;kind:'assignment'|'comment'|'approval';reason:string;read:boolean;at:number;snoozedUntil:number|null}
export interface InternalInbox {items:InternalNoticeItem[];snoozed:InternalNoticeItem[];unread:number;preferences:Awaited<ReturnType<typeof internalPreferences>>;policy:Awaited<ReturnType<typeof internalNoticePolicy>>;deferred:boolean}
export async function internalNotices(db: D1Database, actor: Actor, workspace: string, attempt = 0): Promise<InternalInbox> {
  const readRevision = await noticeRevision(db)
  const preferences = await internalPreferences(db, actor, workspace), policy = await internalNoticePolicy(db, actor, workspace)
  const items = [], snoozed = []
  const deferred = (preferences.dndUntil ?? 0) > now()
  for (const event of await pendingNoticeRows(db, actor.id, workspace)) {
    const rev = readRevision, content = await internalNoticeContent(db, actor, event)
    if (!content || preferences.muted) {
      if (event.state === 'queued') await run(db, "UPDATE peg_notice_targets SET state='suppressed' WHERE event_id=? AND recipient_id=? AND state='queued'", event.id, actor.id)
      continue
    }
    // DND defers new deliveries; already delivered work remains actionable.
    if (deferred && event.state === 'queued') continue
    if (event.state === 'queued') {
      try { await guarded(db, rev, [bound(db, `UPDATE peg_notice_targets SET state='delivered',visible_at=? WHERE event_id=? AND recipient_id=? AND state='queued'`, [now(), event.id, actor.id])]) }
      catch (error) { if (error instanceof PegError && error.status === 409) continue; throw error }
    }
    const stored=await first<{visible_at:number;read_at:number|null;snoozed_until:number|null}>(db,"SELECT visible_at,read_at,snoozed_until FROM peg_notice_targets WHERE event_id=? AND recipient_id=? AND state='delivered'",event.id,actor.id)
    if(!stored)continue
    const item = { ...content, id: event.id, recipientId: actor.id, commentId: event.comment_id, kind: event.kind, reason: event.reason,
      read: stored.read_at !== null, at: stored.visible_at, snoozedUntil: stored.snoozed_until }
    if ((stored.snoozed_until ?? 0) > now()) snoozed.push(item); else items.push(item)
  }
  if((await noticeRevision(db)).value!==readRevision.value){
    if(attempt<1)return internalNotices(db,actor,workspace,attempt+1)
    return {items:[],snoozed:[],unread:0,preferences,policy,deferred}
  }
  return { items, snoozed, unread: items.filter(item => !item.read).length, preferences, policy, deferred }
}
export async function changeInternalNotice(db: D1Database, actor: Actor, workspace: string, id: string, input: Record<string, unknown>) {
  const view = await internalNotices(db, actor, workspace), item = [...view.items, ...view.snoozed].find(item => item.id === id)
  if (!item) throw notFound()
  if (input.read !== undefined && typeof input.read !== 'boolean') throw invalid('notice_read')
  if (input.snoozedUntil !== undefined && input.snoozedUntil !== null && (!Number.isSafeInteger(input.snoozedUntil) || Number(input.snoozedUntil) < 0)) throw invalid('notice_snooze')
  await run(db, `UPDATE peg_notice_targets SET read_at=?,snoozed_until=? WHERE event_id=? AND recipient_id=?`,
    input.read === undefined ? item.read ? now() : null : input.read ? now() : null,
    input.snoozedUntil === undefined ? item.snoozedUntil : input.snoozedUntil as number | null, id, actor.id)
  return { id }
}
